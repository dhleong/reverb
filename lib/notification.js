/**
 * Notification fetcher module for Reverb
 */

var request = require('request')
  , Q = require('q')
  , _ = require('lodash')
  
  , USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.81 Safari/537.36';

function NotificationFetcher(opts) {
    this.opts = _.extend({
        ajax_host: 'pitangui.amazon.com'
    }, opts);
 
    if (!opts.cookie) throw new Error('`cookie` is required');

    this.request = request.defaults({
        gzip: true
      , headers: {
            Cookie: opts.cookie
          , 'User-Agent': USER_AGENT
        }
    });

    // Get current timers and alarms, but mainly devicetype and serial
    var url = '/api/notifications'
    var qs = {'_': new Date().getTime()};

    self = this
    this._get(url, qs).then(function(body) {
        var notifications = JSON.parse(body);
        self.opts.device = notifications.notifications[0].deviceType
        self.opts.serial = notifications.notifications[0].deviceSerialNumber
    })
}

NotificationFetcher.prototype._get = function(url, qs) {
    var urlBase = 'https://' + this.opts.ajax_host;
    var request = this.request;
    var debug = this.opts.debug;
    return Q.Promise(function(resolve, reject) {
        var fullUrl = urlBase + url;
        var args = {url: fullUrl};
        if (qs)
            args.qs = qs;

        request(args, function(err, response, body) {
            if (err) return reject(err);
            if (200 != response.statusCode) {

                if (debug) {
                    console.warn(response, body);
                }

                return reject(new Error(
                        "Failed to load " + fullUrl 
                        + "; status=" + response.statusCode));
            }

            resolve(body);
        });
    });
};

NotificationFetcher.prototype.fetch = function(notification) {
    var url = '/api/notifications/' + this.opts.device + "-" + this.opts.serial + "-" + notification.id;
    var qs = {'_': new Date().getTime()};

    return this._get(url, qs).then(function(body) {
        var notification = JSON.parse(body);
        return notification
    });
}

module.exports = NotificationFetcher;
