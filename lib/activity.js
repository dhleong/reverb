/**
 * Activity fetcher module for Reverb
 */

var request = require('request')
  , Q = require('q')
  , _ = require('lodash')
  
  , USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.81 Safari/537.36';

function ActivityFetcher(opts) {
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
}

ActivityFetcher.prototype._get = function(url, qs) {
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

/**
 * @param {ActivityDict} activity A raw activity dict:
 *      {
 *          id: <activityEntryId>
 *        , user: <registeredUserId>
 *      }
 * @return A promise that resolves to an Activity info:
 *      {
 *          summary: "The spoken text"
 *        , activity: { 
 *              // this is the raw `activity` JSON dict;
 *              // not sure if anyone will be interested,
 *              //  but it's provided just in case
 *              activityStatus: "SUCCESS"
 *            , id: <full activity id>
 *            , sourceDeviceIds: [
 *                  {deviceType: '...', serialNumber: '...'}
 *              ]
 *            , utteranceId: // ...
 *            , description: {
 *                  // this is originally a string-encoded
 *                  //  json; we parse it anyway, so it will
 *                  //  be filled out as a dict for you
 *              }
 *          }
 *      }
 */
ActivityFetcher.prototype.fetch = function(activity) {
    var fullId = activity.user + '%23' + activity.id;
    var url = '/api/activities/' + fullId;
    var qs = {'_': new Date().getTime()};

    return this._get(url, qs).then(function(body) {
        var activity = JSON.parse(body).activity;
        var desc = JSON.parse(activity.description);
        activity.description = desc; // convenience
        return {
            summary: desc.summary
          , activity: activity
        }
    });
}

module.exports = ActivityFetcher;
