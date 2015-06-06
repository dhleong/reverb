/*
 * Echo protocol-related classes
 *  and functions, pretty'd up from
 *  the web app's js. Many thanks to:
 *
 *    http://www.jsnice.org
 */

(function(result) {
    /**
     * @param {ArrayBuffer} payload
     * @param {Number} channel
     * @param {string} type
     * @return {undefined}
     */
    result.Message = function(payload, channel, type) {
        /** @type {string} */
        this.channel = channel;
        /** @type {string} */
        this.type = type;
        this.payloadBuf = payload;
    };
    /**
     * @return {?}
     */
    result.Message.prototype.getPayloadAsString = function() {
        return module.exports.abToStr(this.payloadBuf);
    };
    /**
     * @return {?}
     */
    result.Message.prototype.getPayloadAsBuffer = function() {
        return this.payloadBuf;
    };
    /**
     * @param {?} payload
     * @param {?} channel
     * @param {?} type
     * @param {?} originId
     * @param {?} destId
     * @return {undefined}
     */
    result.GatewayMessage = function(payload, channel, type, originId, destId) {
        result.Message.call(this, payload, channel, type);
        this.originId = originId;
        this.destId = destId;
    };
    /** @type {Object} */
    result.GatewayMessage.prototype = Object.create(result.Message.prototype);
})(module.exports);


/**
 * MessageBuffer
 */
(function(tree) {
    function toArrayBuffer(buffer) {
        var ab = new ArrayBuffer(buffer.length);
        var view = new Uint8Array(ab);
        for (var i = 0; i < buffer.length; ++i) {
            view[i] = buffer[i];
        }
        return ab;
    }

    /**
     * @param {?} buffer
     * @param {string} codec
     * @return {undefined}
     */
    tree.MessageBuffer = function(buffer, codec) {
        this.buffer = buffer;
        /** @type {number} */
        this.byteOffset = 0;
        /** @type {string} */
        this.codec = codec;

        if (buffer instanceof Buffer) {
            this.buffer = toArrayBuffer(buffer);
        }
    };
    /**
     * @return {undefined}
     */
    tree.MessageBuffer.prototype.appendDelimiter = function() {
        this.appendASCIIString(this.codec.DELIMITER, true);
    };
    /**
     * @param {string} a
     * @param {boolean} dataAndEvents
     * @return {undefined}
     */
    tree.MessageBuffer.prototype.appendASCIIString = function(a, dataAndEvents) {
        var al = a.length;
        /** @type {Uint8Array} */
        var view = new Uint8Array(this.buffer, this.byteOffset, a.length);
        /** @type {number} */
        var i = 0;
        for (;i < a.length;i++) {
            var origin = a.charCodeAt(i);
            if (127 < origin) {
                throw "String does not appear to be ASCII";
            }
            view[i] = origin;
        }
        this.byteOffset += al;
        if (!dataAndEvents) {
            this.appendDelimiter();
        }
    };
    /**
     * @param {?} deepDataAndEvents
     * @param {boolean} dataAndEvents
     * @return {undefined}
     */
    tree.MessageBuffer.prototype.appendBool = function(deepDataAndEvents, dataAndEvents) {
        this.appendASCIIString(this.codec.encodeBool(deepDataAndEvents), dataAndEvents);
    };
    /**
     * @param {ArrayBuffer} buffer
     * @param {?} collectionView
     * @return {undefined}
     */
    tree.MessageBuffer.prototype.appendBuffer = function(buffer, collectionView) {
        var len = buffer.byteLength;
        /** @type {Uint8Array} */
        var view = new Uint8Array(this.buffer, this.byteOffset, len);
        /** @type {Uint8Array} */
        var data = new Uint8Array(buffer);
        /** @type {number} */
        var i = 0;
        for (;i < len;i++) {
            view[i] = data[i];
        }
        this.byteOffset += len;
        if (!collectionView) {
            this.appendDelimiter();
        }
    };
    /**
     * @param {?} time
     * @param {boolean} dataAndEvents
     * @return {undefined}
     */
    tree.MessageBuffer.prototype.appendInt = function(time, dataAndEvents) {
        this.appendASCIIString(this.codec.encodeInt(time), dataAndEvents);
    };
    /**
     * @param {?} t
     * @param {boolean} dataAndEvents
     * @return {undefined}
     */
    tree.MessageBuffer.prototype.appendLong = function(t, dataAndEvents) {
        this.appendASCIIString(this.codec.encodeLong(t), dataAndEvents);
    };
    /**
     * @return {undefined}
     */
    tree.MessageBuffer.prototype.readDelimiter = function() {
        var firstLength = this.codec.DELIMITER.length;
        if (this.readASCIIString(firstLength, true) != this.codec.DELIMITER) {
            throw "Delimiter not found at: " + (this.byteOffset - firstLength);
        }
    };
    /**
     * @param {number} length
     * @param {boolean} ignoreDelimeter
     * @return {?}
     */
    tree.MessageBuffer.prototype.readASCIIString = function(length, ignoreDelimeter) {
        /** @type {Array} */
        var rulesets = [];
        /** @type {Uint8Array} */
        var charArray = new Uint8Array(this.buffer, this.byteOffset, length);
        /** @type {number} */
        var i = 0;
        for (;i < length;i++) {
            rulesets.push(String.fromCharCode(charArray[i]));
        }
        /** @type {string} */
        rulesets = rulesets.join("");
        this.byteOffset += length;
        if (!ignoreDelimeter) {
            this.readDelimiter();
        }
        return rulesets;
    };
    /**
     * @param {boolean} dataAndEvents
     * @return {?}
     */
    tree.MessageBuffer.prototype.readBool = function(dataAndEvents) {
        return this.codec.decodeBool(this.readASCIIString(this.codec.BOOL_LENGTH, dataAndEvents));
    };
    /**
     * @param {number} length
     * @param {?} buffer
     * @return {?}
     */
    tree.MessageBuffer.prototype.readBuffer = function(length, buffer) {
        /** @type {ArrayBuffer} */
        var array = new ArrayBuffer(length);
        /** @type {Uint8Array} */
        var uint8Array = new Uint8Array(array);
        /** @type {Uint8Array} */
        var b = new Uint8Array(this.buffer, this.byteOffset, length);
        /** @type {number} */
        var i = 0;
        for (;i < length;i++) {
            uint8Array[i] = b[i];
        }
        this.byteOffset += length;
        if (!buffer) {
            this.readDelimiter();
        }
        return array;
    };
    /**
     * @param {boolean} ignoreDelimeter
     * @return {?}
     */
    tree.MessageBuffer.prototype.readInt = function(ignoreDelimeter) {
        return this.codec.decodeInt(this.readASCIIString(this.codec.INT_LENGTH, ignoreDelimeter));
    };
    /**
     * @param {boolean} dataAndEvents
     * @return {?}
     */
    tree.MessageBuffer.prototype.readLong = function(dataAndEvents) {
        return this.codec.decodeLong(this.readASCIIString(this.codec.LONG_LENGTH, dataAndEvents));
    };
})(module.exports);

(function(a){
    a.HexCodec={
        INT_LENGTH:10,
        LONG_LENGTH:18,
        BOOL_LENGTH:1,
        DELIMITER:" "
    };
    a.HexCodec.encodeInt=function(l){
        0>l&&(l=l+4294967295+1);
        for(l=l.toString(16);l.length<a.HexCodec.INT_LENGTH-2;)
            l="0"+l;
        return"0x"+l
    };
    a.HexCodec.encodeLong=function(l){
        for(l=l.toString(16);l.length<a.HexCodec.LONG_LENGTH-2;)
            l="0"+l;
        return"0x"+l
    };
    a.HexCodec.decodeInt=function(a){
        return~~parseInt(a,16)
    };
    a.HexCodec.decodeLong=function(a){
        return parseInt(a,16)
    };
    a.HexCodec.encodeBool=function(a){
        return a?"t":"f"
    };
    a.HexCodec.decodeBool=function(a){
        if("t"===a)return!0;
        if("f"===a)return!1;
        throw"Could not decode "+a+" into boolean!";
    }
})(module.exports);

/**
 * DeviceIdentity
 */
(function(tree) {
    /** @type {RegExp} */
    var rtagName = /^urn:tcomm-endpoint:device(:deviceAccountId:([^:]*))?(:customerId:([^:]*))?(:deviceType:([^:]*))?(:deviceSerialNumber:([^:]*))?$/;
    /**
     * @param {?} dataAndEvents
     * @param {?} deepDataAndEvents
     * @param {?} inType
     * @param {?} ignoreMethodDoesntExist
     * @return {undefined}
     */
    tree.DeviceIdentity = function(dataAndEvents, deepDataAndEvents, inType, ignoreMethodDoesntExist) {
        if (!inType || !ignoreMethodDoesntExist) {
            throw "Device identity requires valid type and serial number strings.";
        }
        if (dataAndEvents) {
            if (deepDataAndEvents) {
                this.deviceAccountId = dataAndEvents;
                this.customerId = deepDataAndEvents;
            }
        }
        this.deviceType = inType;
        this.deviceSerialNumber = ignoreMethodDoesntExist;
    };
    /**
     * @return {?}
     */
    tree.DeviceIdentity.prototype.asUrn = function() {
        /** @type {Array} */
        var suiteView = ["urn:tcomm-endpoint:device"];
        isUndefined(suiteView, "deviceAccountId", this.deviceAccountId);
        isUndefined(suiteView, "customerId", this.customerId);
        isUndefined(suiteView, "deviceType", this.deviceType);
        isUndefined(suiteView, "deviceSerialNumber", this.deviceSerialNumber);
        return suiteView.join(":");
    };
    /**
     * @param {Array} obj
     * @param {string} target
     * @param {?} val
     * @return {undefined}
     */
    var isUndefined = function(obj, target, val) {
        if ("undefined" !== typeof val) {
            if (null !== val) {
                obj.push(target);
                obj.push(val);
            }
        }
    };
    /**
     * @param {(Array|string)} value
     * @return {?}
     */
    tree.DeviceIdentity.getFromUrn = function(value) {
        /** @type {(Array.<string>|null)} */
        value = rtagName.exec(value);
        return null === value ? null : new tree.DeviceIdentity(value[1] ? value[2] : null, value[3] ? value[4] : null, value[5] ? value[6] : null, value[7] ? value[8] : null);
    };
})(module.exports);

/**
 * ServiceIdentity
 */
(function(tree) {
    /** @type {RegExp} */
    var rtagName = /^urn:tcomm-endpoint:service(:serviceName:([^:]*))?(:domain:([^:]*))?(:realm:([^:]*))?(:hostname:([^:]*))?(:port:([^:]*))?$/;
    /**
     * @param {string} serviceName
     * @param {string} domain
     * @param {?} realm
     * @param {string} a
     * @param {string} b
     * @return {undefined}
     */
    tree.ServiceIdentity = function(serviceName, domain, realm, a, b) {
        if (!serviceName) {
            throw "Service identity requires valid name.";
        }
        if (!(a && b || !a && !b)) {
            throw "Service identity requires either a hostname AND a port, or neither.";
        }
        /** @type {string} */
        this.serviceName = serviceName;
        /** @type {string} */
        this.domain = domain;
        this.realm = realm;
        /** @type {string} */
        this.hostname = a;
        /** @type {string} */
        this.port = b;
    };
    /**
     * @return {?}
     */
    tree.ServiceIdentity.prototype.asUrn = function() {
        /** @type {Array} */
        var parts = ["urn:tcomm-endpoint:service", "serviceName", this.serviceName];
        parse(parts, "domain", this.domain);
        parse(parts, "realm", this.realm);
        parse(parts, "hostname", this.hostname);
        parse(parts, "port", this.port);
        return parts.join(":");
    };
    /**
     * @param {Array} options
     * @param {string} str
     * @param {?} url
     * @return {undefined}
     */
    var parse = function(options, str, url) {
        if ("undefined" !== typeof url) {
            if (null !== url) {
                options.push(str);
                options.push(url);
            }
        }
    };
    /**
     * @param {Array} value
     * @return {?}
     */
    tree.ServiceIdentity.getFromUrn = function(value) {
        /** @type {(Array.<string>|null)} */
        value = rtagName.exec(value);
        return null === value ? null : new tree.ServiceIdentity(value[1] ? value[2] : null, value[3] ? value[4] : null, value[5] ? value[6] : null, value[7] ? value[8] : null, value[9] ? value[10] : null);
    };
})(module.exports);

/**
 * IdentityFactory
 */
(function(dd) {
    dd.IdentityFactory = {};
    /**
     * @param {?} dataAndEvents
     * @param {?} deepDataAndEvents
     * @param {string} classNames
     * @param {string} expr
     * @return {?}
     */
    dd.IdentityFactory.getDeviceIdentity = function(dataAndEvents, deepDataAndEvents, classNames, expr) {
        return new dd.DeviceIdentity(expr || "", classNames || "", dataAndEvents, deepDataAndEvents);
    };
    /**
     * @param {?} var2
     * @return {?}
     */
    dd.IdentityFactory.getServiceIdentityFromName = function(var2) {
        return new dd.ServiceIdentity(var2);
    };
    /**
     * @param {?} value
     * @return {?}
     */
    dd.IdentityFactory.getFromUrn = function(value) {
        var isFunction = dd.ServiceIdentity.getFromUrn(value);
        if (!isFunction) {
            isFunction = dd.DeviceIdentity.getFromUrn(value);
        }
        if (!isFunction) {
            throw "Could not parse identity from urn";
        }
        return isFunction;
    };
})(module.exports);

/**
 * Checksum utils
 */
(function(exports) {
    /**
     * @param {number} m1
     * @param {number} opt_attributes
     * @return {?}
     */
    function opt(m1, opt_attributes) {
        m1 = norm(m1);
        for (;0 !== opt_attributes && 0 !== m1;) {
            /** @type {number} */
            m1 = Math.floor(m1 / 2);
            opt_attributes--;
        }
        return m1;
    }
    /**
     * @param {number} m1
     * @return {?}
     */
    function norm(m1) {
        if (0 > m1) {
            m1 = 4294967295 + m1 + 1;
        }
        return m1;
    }
    /**
     * @param {Uint8Array} array
     * @param {number} start
     * @param {number} end
     * @return {?}
     */
    exports.computeRFC1071LikeChecksum = function(array, start, end) {
        if (end < start) {
            throw "Invalid checksum exclusion window!";
        }
        /** @type {Uint8Array} */
        array = new Uint8Array(array);
        /** @type {number} */
        var b = 0;
        /** @type {number} */
        var m1 = 0;
        /** @type {number} */
        var i = 0;
        for (;i < array.length;i++) {
            if (i != start) {
                m1 += norm(array[i] << ((i & 3 ^ 3) << 3));
                b += opt(m1, 32);
                m1 = norm(m1 & 4294967295);
            } else {
                /** @type {number} */
                i = end - 1;
            }
        }
        for (;b;) {
            m1 += b;
            b = opt(m1, 32);
            m1 &= 4294967295;
        }
        return norm(m1);
    };
    /**
     * @param {number} expected
     * @param {Uint8Array} value
     * @param {number} start
     * @param {number} end
     * @return {?}
     */
    exports.validateChecksum = function(expected, value, start, end) {
        return exports.computeRFC1071LikeChecksum(value, start, end) === norm(expected);
    };
})(module.exports);

/**
 * TuningProtocolHandler
 */
(function(self) {
    /**
     * @param {?} codec
     * @return {undefined}
     */
    self.TuningProtocolHandler = function(codec) {
        /** @type {string} */
        this.footer = "TUNE";
        this.codec = codec;
    };
    /**
     * @param {(Array|number)} data
     * @return {?}
     */
    self.TuningProtocolHandler.prototype.encodeMessage = function(data) {
        if ("string" !== typeof data) {
            throw new TypeError("Tuning message must be a string!");
        }
        var res = this.codec.DELIMITER.length;
        var out = this.codec.INT_LENGTH + res + this.codec.INT_LENGTH + res + data.length + this.footer.length;
        res = new self.MessageBuffer(new ArrayBuffer(out), this.codec);
        var len = res.byteOffset;
        res.appendInt(0);
        var request = res.byteOffset;
        res.appendInt(out);
        res.appendASCIIString(data, true);
        res.appendASCIIString(this.footer, true);
        data = self.computeRFC1071LikeChecksum(res.buffer, len, request);
        res.byteOffset = len;
        res.appendInt(data);
        return res.buffer;
    };
    /**
     * @param {ArrayBuffer} res
     * @return {?}
     */
    self.TuningProtocolHandler.prototype.decodeMessage = function(res) {
        var data = new self.MessageBuffer(res, this.codec);
        var oldValue = data.byteOffset;
        var checkSum = data.readInt();
        if (!self.validateChecksum(checkSum, data.buffer, oldValue, data.byteOffset)) {
            throw "Failed to decode tuning message. Checksum mismatch!";
        }
        data.readInt();
        res = data.readASCIIString(res.length - this.footer.length - data.byteOffset, true);
        var footer = data.readASCIIString(this.footer.length, true);
        if (footer !== this.footer) {
            throw "Failed to decode tuning message. Footer " 
                + footer + "!=" + this.footer;
        }
        try {
            return JSON.parse(res);
        } catch (h) {
            throw "Failed to decode tuning message. Payload was not valid JSON";
        }
    };
})(module.exports);

/**
 * AlphaProtocolHandler
 */
(function(self) {
    /**
     * @param {?} params
     * @param {?} codec
     * @return {undefined}
     */
    self.AlphaProtocolHandler = function(params, codec) {
        this.codec = codec;
        /** @type {string} */
        this.footer = "FABE";
        /** @type {string} */
        this.MESSAGE_MESSAGE_TYPE = "MSG";
        /** @type {string} */
        this.REQUEST_MESSAGE_TYPE = "RQS";
        /** @type {string} */
        this.RESPONSE_MESSAGE_TYPE = "RSP";
        /** @type {number} */
        this.TYPE_LENGTH = 3;
        /** @type {boolean} */
        this.moreFlag = false;
        /** @type {number} */
        this.seq = 1;
        /** @type {number} */
        this.DEFAULT_MAX_FRAGMENT_SIZE = 16E3;
        /** @type {number} */
        this.DEFAULT_RECEIVE_WINDOW_SIZE = 16;
        this.maxFragmentSize = params.maxFragmentSize || this.DEFAULT_MAX_FRAGMENT_SIZE;
        this.receiveWindowSize = params.receiveWindowSize || this.DEFAULT_RECEIVE_WINDOW_SIZE;
        this.chosenEncoding = params.chosenEncoding;
    };
    /** @type {number} */
    self.AlphaProtocolHandler.nextMsgId = Math.floor(1E9 * Math.random());
    /**
     * @param {ArrayBuffer} buffer
     * @param {number} channel
     * @return {?}
     */
    self.AlphaProtocolHandler.prototype.encodeMessage = function(buffer, channel) {
        return this.encode(buffer, this.MESSAGE_MESSAGE_TYPE, channel);
    };
    /**
     * @param {ArrayBuffer} x
     * @param {number} contents
     * @return {?}
     */
    self.AlphaProtocolHandler.prototype.encodeRequest = function(x, contents) {
        return this.encode(x, this.REQUEST_MESSAGE_TYPE, contents);
    };
    /**
     * @param {ArrayBuffer} data
     * @param {number} type
     * @param {number} channel
     * @return {?}
     */
    self.AlphaProtocolHandler.prototype.encode = function(data, type, channel) {
        if (data instanceof ArrayBuffer) {
            if ("number" !== typeof channel) {
                throw new TypeError("Channel must be a number!");
            }
            if ("string" !== typeof type) {
                throw new TypeError("Type must be a string!");
            }
        } else {
            throw new TypeError("Payload must be an ArrayBuffer!");
        }
        var e = this.codec.INT_LENGTH;
        var d = this.codec.DELIMITER.length;
        d = this.TYPE_LENGTH + d + e + d + e + d + this.codec.BOOL_LENGTH + d + e + d + e + d + e + d + data.byteLength + this.footer.length;
        e = new self.MessageBuffer(new ArrayBuffer(d), this.codec);
        e.appendASCIIString(type);
        e.appendInt(channel);
        e.appendInt(self.AlphaProtocolHandler.nextMsgId++);
        e.appendBool(this.moreFlag);
        e.appendInt(this.seq);
        var key = e.byteOffset;
        e.appendInt(0);
        var s = e.byteOffset;
        e.appendInt(d);
        e.appendBuffer(data, true);
        e.appendASCIIString(this.footer, true);
        data = self.computeRFC1071LikeChecksum(e.buffer, key, s);
        /** @type {number} */
        e.byteOffset = key;
        e.appendInt(data);
        return e.buffer;
    };
    /**
     * @param {ArrayBufferView} res
     * @return {?}
     */
    self.AlphaProtocolHandler.prototype.decodeMessage = function(res) {
        res = new self.MessageBuffer(res, this.codec);
        var msg = res.readASCIIString(this.TYPE_LENGTH);
        var server = res.readInt();
        res.readInt();
        res.readBool();
        res.readInt();
        var data = res.byteOffset;
        var onComplete = res.readInt();
        if (!self.validateChecksum(onComplete, res.buffer, data, res.byteOffset)) {
            throw "Failed to decode tcomm message. Checksum mismatch!";
        }
        /** @type {number} */
        data = res.readInt() - this.footer.length - res.byteOffset;
        data = res.readBuffer(data, true);
        if (res.readASCIIString(this.footer.length, true) !== this.footer) {
            throw "Failed to decode tcomm message. Footer mismatch!";
        }
        return new self.Message(data, server, msg);
    };
})(module.exports);


/** 
 * GatewayProtocolHandler
 */
(function(tree) {
    /**
     * @param {?} codec
     * @return {undefined}
     */
    tree.GatewayProtocolHandler = function(codec) {
        /** @type {string} */
        this.GATEWAY_MESSAGE_TYPE = "GWM";
        /** @type {string} */
        this.MESSAGE_MESSAGE_TYPE = "MSG";
        /** @type {string} */
        this.REQUEST_MESSAGE_TYPE = "RQS";
        this.codec = codec;
    };
    /**
     * @param {ArrayBuffer} x
     * @param {?} method
     * @param {Array} timestep
     * @param {Array} _super
     * @return {?}
     */
    tree.GatewayProtocolHandler.prototype.encodeRequest = function(x, method, timestep, _super) {
        return this.encode(x, this.REQUEST_MESSAGE_TYPE, method, timestep, _super);
    };

    /**
     * @param {ArrayBuffer} buffer
     * @param {Number} channel
     * @param {ServiceIdentity|DeviceIdentity} origin
     * @param {ServiceIdentity|DeviceIdentity} destination
     * @return {?}
     */
    tree.GatewayProtocolHandler.prototype.encodeMessage = function(buffer, channel, origin, destination) {
        return this.encode(buffer, this.MESSAGE_MESSAGE_TYPE, channel, origin, destination);
    };

    /**
     * @param {ArrayBuffer} data
     * @param {String} type
     * @param {Number} channel
     * @param {ServiceIdentity|DeviceIdentity} origin
     * @param {ServiceIdentity|DeviceIdentity} destination
     * @return The encoded buffer
     */
    tree.GatewayProtocolHandler.prototype.encode = function(data, type, channel, origin, destination) {
        if (data instanceof ArrayBuffer) {
            if ("number" !== typeof channel) {
                throw new TypeError("Channel must be a number!");
            }
            if (!(origin instanceof tree.ServiceIdentity || origin instanceof tree.DeviceIdentity)) {
                throw new TypeError("Origin must be either a ServiceIdentity or a DeviceIdentity!");
            }
            if (!(destination instanceof tree.ServiceIdentity || destination instanceof tree.DeviceIdentity)) {
                throw new TypeError("Destination must be either a ServiceIdentity or a DeviceIdentity!");
            }
        } else {
            throw new TypeError("Payload must be an ArrayBuffer!");
        }
        origin = origin.asUrn();
        destination = destination.asUrn();
        var c = this.codec.INT_LENGTH;
        var _ = this.codec.DELIMITER.length;
        c = new tree.MessageBuffer(new ArrayBuffer(this.GATEWAY_MESSAGE_TYPE.length + _ + type.length + _ + c + _ + c + _ + origin.length + _ + c + _ + destination.length + _ + data.byteLength), this.codec);
        c.appendASCIIString(this.GATEWAY_MESSAGE_TYPE);
        c.appendASCIIString(type);
        c.appendInt(channel);
        c.appendInt(origin.length);
        c.appendASCIIString(origin);
        c.appendInt(destination.length);
        c.appendASCIIString(destination);
        c.appendBuffer(data, true);
        return c.buffer;
    };

    /**
     * @param {?} bytes
     * @return {?}
     */
    tree.GatewayProtocolHandler.prototype.decodeMessage = function(bytes) {
        var ber = new tree.MessageBuffer(bytes, this.codec);
        var options = ber.readASCIIString(3);
        if (this.GATEWAY_MESSAGE_TYPE !== options) {
            throw "Failed to decode Gateway message. Unexpected gateway message type: " + options;
        }
        options = ber.readASCIIString(3);
        var variables = ber.readInt();
        var cn = ber.readInt();
        cn = ber.readASCIIString(cn);
        var secret = ber.readInt();
        secret = ber.readASCIIString(secret);
        bytes = ber.readBuffer(bytes.byteLength - ber.byteOffset, true);
        return new tree.GatewayMessage(bytes, variables, options, tree.IdentityFactory.getFromUrn(cn), tree.IdentityFactory.getFromUrn(secret));
    };
})(module.exports);

module.exports.Protocols = [
    {
        protocolName: 'A:H',
        parameters: {
            "AlphaProtocolHandler.receiveWindowSize":"16",
            "AlphaProtocolHandler.maxFragmentSize":"16000"
        }
    }
];

module.exports.abToStr = function abToStr(a){
    var l="";
    a=new Uint8Array(a);
    for(var e=0;e<a.length;e++)
        l+=String.fromCharCode(a[e]);
    return l
};

/**
 * @param {string} byteString
 * @return {?}
 */
module.exports.strToAb = function strToAb(byteString) {
    /** @type {ArrayBuffer} */
    var ab = new ArrayBuffer(byteString.length);
    /** @type {Uint8Array} */
    var ia = new Uint8Array(ab);
    /** @type {number} */
    var i = 0;
    for (;i < byteString.length;i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return ab;
}

module.exports.jsonToAb = function jsonToAb(json) {
    return module.exports.strToAb(JSON.stringify(json));
}

/** Named channel ids */
module.exports.Channels = {
    CHANNEL_FOR_BATCHED_METRICS: 106
 ,  CHANNEL_FOR_DEGS: 1026
 ,  CHANNEL_FOR_ECHO_2_CHANNEL_TEST: 1048574
 ,  CHANNEL_FOR_ECHO_TEST: 1048575
 ,  CHANNEL_FOR_HEARTBEAT: 101
 ,  CHANNEL_FOR_LOOPBACK: 1048568
 ,  CHANNEL_FOR_S2DM: 480
 ,  CHANNEL_FOR_S2DM_ACK: 481
 ,  CHANNEL_FOR_SINGLE_METRICS: 105
 ,  CHANNEL_FOR_SYSTEM_MESSAGES: 120
 ,  DEE_WEBSITE_MESSAGING: 46201
 ,  DEMO_SEND_MESSAGE_TEST_CHANNEL: 1048572
 ,  DROP_DATA_TEST_CHANNEL: 1048569
 ,  GATEWAY_ECHO_TEST_CHANNEL: 1048573
 ,  GATEWAY_TRANSPARENT_TEST_CHANNEL: 1048571
 ,  GMD_CHANNEL: 463
 ,  GW_CHANNEL: 866
 ,  GW_CTL_CHANNEL: 867
 ,  GW_HANDSHAKE_CHANNEL: 865
 ,  HEARTBEAT_TEST_CHANNEL: 1048570
 ,  INVALID_CHANNEL_ID: -1
 ,  RAW_MESSAGE_CHANNEL_FOR_DEGS: 1026
 ,  REQUEST_RESPONSE_CHANNEL_ID_START: 1048577
 ,  RMR_N_TIMES_TEST_CHANNEL: 202
 ,  RMR_TEST_CHANNEL: 200
 ,  RMR_THREADING_TEST_CHANNEL: 201
};

