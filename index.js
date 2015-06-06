#!/usr/bin/env node

var util = require('util')
  , events = require('events')
  , WebSocket = require('ws') // jshint ignore:line
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
    var url = 'wss://dp-gw-na-js.amazon.com/'
        + '?x-amz-device-type=' + DEVICE_TYPE 
        + '&x-amz-device-serial=' + opts.serial;

    this._messageHandlers = [];

    var self = this;
    var ws = this.ws = new WebSocket(url, {
        headers: {
            Cookie: opts.cookie
        }
      , origin: 'http://echo.amazon.com'
      , rejectUnauthorized: false
    });
    ws.on('open', function open() {
        console.log("Opened!");

        self.initTuningHandshake();
    })
    ws.on('error', function error(err) {
        console.log("ERROR:", err);
    });
    ws.on('close', function close(code, message) {
        console.log("Disconnected", code, message);
        this._messageHandlers = [];
    });
    ws.on('message', self.onMessage.bind(self));

    this.log = opts.debug 
        ? function() { console.log.apply(console, arguments); }
        : function() {};
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

        var params = {};
        Object.keys(data.parameters).forEach(function(param) {
            var name = param.substr(param.indexOf('.') + 1);
            params[name] = data.parameters[name];
        });

        self.register(new Echo.AlphaProtocolHandler(params, Echo.HexCodec));
    });
}

/** Register the connection to receive events */
Reverb.prototype.register = function(proto) {

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
    console.log("Ready");

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
        var key = body.key;
        var userId = key.registeredUserId;
        var activityId = key.entryId;
        this.onActivity(userId, activityId);
    }
}

Reverb.prototype.onActivity = function(userId, activityId) {
    this.log("<< Activity", userId, activityId);
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

module.exports = Reverb;
