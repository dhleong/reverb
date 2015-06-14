Reverb
======

*Is there an Echo in here?*

## What?

Reverb is an open source library for creating custom interactions
with the Amazon Echo. Unlike existing solutions, Reverb uses a
true "push"-style interaction and does not rely on using a 
simulated or real web browser behind the scenes. This makes it
fast and lightweight on both your network and your machine.

### Usage

[![NPM](https://nodei.co/npm/reverb.png?mini=true)](https://nodei.co/npm/reverb/)

For now, Reverb requires you to get extract some data by hand.
These are the "Cookie" header and the device serial number. These
can both be easily acquired using the Developer Tools that come
with Chrome. Simply open [the Echo web app](http://echo.amazon.com)
and open the Network tab of the developer tools. Click on the
Filter icon (it looks a bit like a funnel) and filter down to
"WebSockets." Then, refresh the page. 

There should be a single entry in the list pointing to 
`dp-gw-na-js.amazon.com`. Select that and go to the "Headers" tab.
The serial number you want will be the `x-amz-device-serial` 
parameter under "Query String Parameters," and the "Cookie"
is the (potentially huge) string next to `Cookie:` under 
"Request Headers."

Now that you have those, it's simple to get access to the 
Echo's transcriptions of your requests:

```javascript
var Reverb = require('reverb');
new Reverb({
    cookie: // The Cookie retrieved above
  , serial: // The serial retrieved above
}).on('ready', function() {
    // this is emitted when the connection is
    //  established and the hands have been shaked
    console.log("Ready!");
}).on('activity', function(activity) {
    // parse the transcription and do something
    //  with it here
    console.log("You said:", activity.summary);
}).on('timerStart', function(timer) {
    // do something when timers are started
    console.log("timer started:", timer.remainingTime);
}).on('timerPause', function(timer) {
    // do somethign when timers are paused
    console.log("timer paused:", timer.remainingTime);
}).on('timerComplete', function(timer) {
    // do something when timers complete
    console.log("timer complete");
}).on('alarmSet', function(alarm) {
    // do something when alarms are set
    console.log("alarm set:", alarm);
}).on('alarmUpdate', function(alarm) {
    // do something when alarms are changed
    console.log("alarm time updated:", alarm.alarmTime);
}).on('alarmRemove', function(alarm) {
    // do something when alarmas are turned off
    console.log("alarm unset");
});
```

Note that, as with other solutions, you will have to append
"cancel" or "stop" to the end of your custom commands to 
prevent Echo from trying to process it.

### Future Work

* Provide an easy mechanism for authenticating
* Perhaps, provide an "Action Dispatcher" to make parsing the activity text easier
* Perhaps, provide a useful `-g` install
    * Plugins could be dropped into a folder

## Why?

The Amazon Echo's voice capabilities are truly amazing, but
they have yet to provide a proper API for extending its
capabilities. I was not satisfied with the "poll"-style 
mechanism used in existing solutions and wanted to see if
there was something better.
