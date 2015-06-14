#!/usr/bin/env node

var util = require('util')
  , events = require('events')
  , WebSocket = require('ws') // jshint ignore:line
  , _ = require('lodash')

  , ActivityFetcher = require('./lib/activity')
  , NotificationFetcher = require('./lib/notification')
  , Echo = require('./lib/echolib')
  , Channels = Echo.Channels

    /** This is a bit of a hack, but it works */
  , Endpoints = {
        DEVICE: "urn:tcomm-endpoint:device:deviceType:0:deviceSerialNumber:0"
      , WEB_MESSAGING: "urn:tcomm-endpoint:service:serviceName:DeeWebsiteMessagingService"
    }

    /** It's probably safe to assume a constant device type */
  , DEVICE_TYPE = 'ALEGCNGL9K0HM';

/**
 * The main entry into the library
 */
function Reverb(opts) {
    opts = _.extend({
        push_host: 'dp-gw-na-js.amazon.com'
      , origin: 'http://echo.amazon.com'
    }, opts);

    if (!opts.serial) throw new Error("`serial` is required");
    if (!opts.cookie) throw new Error("`cookie` is required");
    var self = this;

    this.log = opts.debug 
        ? function() { console.log.apply(console, arguments); }
        : function() {};

    this._messageHandlers = [];
    this._activityFetcher = new ActivityFetcher(opts);
    this._notificationFetcher = new NotificationFetcher(opts, function(notifications){
        self.log("Received", notifications.length, "notifications")
        for (var i = 0; i < notifications.length; i++) {
            if (notifications[i].type == "Timer") {
                self.log("Got a timer")
                if (notifications[i].status == "ON") {
                    self.addTimer(notifications[i])
                }
            } else if (notifications[i].type == "Alarm") {
                self.log("Got an alarm")
                self.setAlarm(notifications[i])
            }
        }
    });

    var url = 'wss://' + opts.push_host + '/'
        + '?x-amz-device-type=' + DEVICE_TYPE 
        + '&x-amz-device-serial=' + opts.serial;

    var ws = this.ws = new WebSocket(url, {
        headers: {
            Cookie: opts.cookie
        }
      , origin: opts.origin
      , rejectUnauthorized: false
    });
    ws.on('open', function open() {
        self.log("Opened!");
        self.emit('open', self);

        // begin the handshake
        self.initTuningHandshake();
    })
    ws.on('error', function error(err) {
        self.log("ERROR:", err);
        self.emit('error', err);
    });
    ws.on('close', function close(code, message) {
        self.emit('close', code, message);
        console.log("Disconnected", code, message);
        this._messageHandlers = [];
    });
    ws.on('message', self.onMessage.bind(self));
}
util.inherits(Reverb, events.EventEmitter);

Reverb.prototype.onMessage = function(data/* , flags */) {
    this.log("<<", data);
    var handlers = this._messageHandlers;
    handlers.forEach(function(fun) {
        fun(data);
    });
}

Reverb.prototype.addMessageListener = function(proto, handler) {
    var fun;
    if (handler) {
        fun = function(data) {
            var decoded;
            try {
                decoded = proto.decodeMessage(data)
            } catch (e) {
                console.warn("Failed to decode:", e);
                return;
            }
            // call handlers with themself as "this"
            //  as you would expect, so they can
            //  remove themselves
            handler.call(handler, decoded);
        };
        fun.id = handler;
    } else {
        fun = proto;
        fun.id = proto;
    }

    this._messageHandlers.push(fun);
}

Reverb.prototype.removeMessageListener = function(handler) {
    var found = false;
    this._messageHandlers = this._messageHandlers.filter(function(fun) {
        found |= fun.id == handler;
        return fun.id != handler;
    });

    if (!found) console.warn("UNABLE TO REMOVE HANDLER!");
    return found;
};

Reverb.prototype.initTuningHandshake = function() {
    var msg = Echo.Protocols.map(function(proto) {
        return proto.protocolName;
    });

    var proto = new Echo.TuningProtocolHandler(Echo.HexCodec);
    var self = this;
    this.send(proto, msg[0]); // is this correct?
    this.addMessageListener(proto, function(data) {
        self.removeMessageListener(this);
        if (data.protocolName != 'A:H') {
            console.error(data);
            throw new Error("Unexpected protocol" + data.protocolName);
        }

        // now ack
        self.send(proto, JSON.stringify(data));
        self.log("Agreed to A:H protocol");

        // prepare the protocol and finish the handshake
        var params = {};
        Object.keys(data.parameters).forEach(function(param) {
            var name = param.substr(param.indexOf('.') + 1);
            params[name] = data.parameters[name];
        });

        self._register(new Echo.AlphaProtocolHandler(params, Echo.HexCodec));
    });
}

/** Register the connection to receive events */
Reverb.prototype._register = function(proto) {

    var message = Echo.jsonToAb({
        command: "REGISTER_CONNECTION"
    });

    var gwChannel = Channels.DEE_WEBSITE_MESSAGING;
    var origin = Echo.IdentityFactory.getFromUrn(Endpoints.DEVICE);
    var dest = Echo.IdentityFactory.getFromUrn(Endpoints.WEB_MESSAGING);

    var gateway = new Echo.GatewayProtocolHandler(Echo.HexCodec);
    var encoded = gateway.encodeMessage(message, gwChannel, origin, dest);

    // now wrap it in our outer protocol
    var wrapped = proto.encodeMessage(encoded, Channels.GW_CHANNEL);
    this.send(wrapped);
    this.emit('ready', self);
    this.log("Ready");

    var self = this;
    this.addMessageListener(proto, function(gwPacket) {
        self.log("<< GW PAYLOAD:", gwPacket.getPayloadAsString());
        var decoded = gateway.decodeMessage(gwPacket.getPayloadAsBuffer());
        var payload = JSON.parse(decoded.getPayloadAsString());
        self.onGatewayCommand(payload);
    });
}

Reverb.prototype.onGatewayCommand = function(command) {
    this.log("<< GW CMD:", command);
    this.emit('command', command);

    if (command.command == 'PUSH_ACTIVITY') {
        var body = JSON.parse(command.payload);
        this.onActivity({
            id: body.key.entryId
          , user: body.key.registeredUserId
        });
    } else if (command.command == 'PUSH_NOTIFICATION_CHANGE') {
        var body = JSON.parse(command.payload);
        if (body.notificationId == "t1") {
            this.onTimer({
                id: body.notificationId
            });
        } else if (body.notificationId == "a1") {
            this.onAlarm({
                id: body.notificationId
            });
        }
    }
}

Reverb.prototype.onActivity = function(activity) {
    this.log("<< Activity", activity);
    if (!this.listeners('activity').length) {
        // no listeners; don't bother fetching
        return;
    }

    this.log("Resolving activity...");
    var self = this;
    this._activityFetcher.fetch(activity)
    .then(function(resolved) {
        self.log("<< RESOLVED activity", resolved);
        self.emit('activity', resolved);
    }, function(err) {
        console.warn("Failed to resolve activity", err);
    });
}

Reverb.prototype.onTimer = function(notification) {
    this.log("<< Timer", notification);
/*    if (!this.listeners('timer').length) {
        // no listeners; don't bother fetching
        return;
    } */
    this.log("Resolving timer...");
    var self = this;
    this._notificationFetcher.fetch(notification)
    .then(function(resolved) {
        self.log("<< RESOLVED notification", resolved);
        if (resolved.status == "ON") {
            self.addTimer(resolved)
            self.emit('timerStart', resolved);
        } else if (resolved.status == "OFF") {
            self.removeTimer(resolved)
            self.emit('timerRemove', resolved);
        } else if (resolved.status == "PAUSED") {
            self.pauseTimer(resolved)
            self.emit('timerPause', resolved);
        }
    }, function(err) {
        console.warn("Failed to resolve timer", err);
    });
}

Reverb.prototype.onAlarm = function(notification) {
    this.log("<< Alarm", notification);
    this.log("Resolving alarm...");
    var self = this;
    this._notificationFetcher.fetch(notification)
    .then(function(resolved) {
        self.log("<< RESOLVED notification", resolved);
        if (resolved.status == "ON") {
            if (self.alarm.status == "ON") {
                self.emit('alarmUpdate', resolved);
            } else {
                self.emit('alarmSet', resolved);
            }
            self.setAlarm(resolved)
        } else if (resolved.status == "OFF") {
            if (self.alarm.status == "OFF") {
                self.emit('alarmUpdate', resolved);
            } else {
                self.emit('alarmRemove', resolved);
            }
            self.setAlarm(resolved)
        }
    }, function(err) {
        console.warn("Failed to resolve timer", err);
    });
}

Reverb.prototype.send = function(protocol, message) {
    if (message) {
        var encoded = protocol.encodeMessage(message);
        this.ws.send(encoded);
        this.log(">>", Echo.abToStr(encoded));
    } else {
        this.ws.send(protocol); // send directly
    }
}

Reverb.prototype.addTimer = function(timer) {
    var self = this;
    this.log("Adding a timer")
    this.timer = {
        status: timer.status
      , remainingTime: timer.remainingTime
    }
    this.timer.timeoutId = setTimeout(function() {
        self.log("Timer has completed")
        self.emit('timerComplete', timer);
    }, this.timer.remainingTime)
}

Reverb.prototype.pauseTimer = function(timer) {
    this.log("I should remove the timer because it is paused")
    clearTimeout(this.timer.timeoutId)
}

Reverb.prototype.removeTimer = function(timer) {
    this.log("This should remove the timer.")
    clearTimeout(this.timer.timeoutId)
}

Reverb.prototype.setAlarm = function(alarm) {
    this.log("Setting an alarm")
    this.alarm = {
        status: alarm.status
      , alarmTime: alarm.alarmTime
    }
}

module.exports = Reverb;
