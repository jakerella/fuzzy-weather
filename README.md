
# Fuzzy Weather

Powered by Dark Sky!

This library will retrieve weather data using the Dark Sky API and then provide
a text description of the weather for a given day using a "fuzzy" representation
suitable for use in a voice-command system. Think of this as a virtual
meteorologist.

> Note that you will need a [Dark Sky API key](https://darksky.net/dev/) to use this module!

## Install and Basic Use

Install with npm using:

`npm install --save fuzzy-weather`

Then you can use the module like so:

```
let weather = require('fuzzy-weather')({
    apiKey: 'abcdefg1234567890',  // your Dark Sky API key!
    location: {
        lat: 38.9649734,
        lng: -77.0207249
    }
});

weather('11/30/2016')
    .then(function(data) {
        console.log(data.text);
    });
```

### API Key

You will need a Dark Sky API key to use this module. Head over to their
[developer documentation](https://darksky.net/dev/) and sign up. You can then
get your API key from the [account page](https://darksky.net/dev/account).

## Limits

Note that Dark Sky does impose some [API limits](https://darksky.net/dev/docs/faq) -
as of this update, that limit was 1,000 API calls per day for the free tier. If
you require more than that, simply update your account with a credit card and
they will bill you $0.0001 per call beyond that.

### Forecast Only

Additionally, note that this library is all about forecasting, thus you can only
get fuzzy weather data for dates in the future (including the current day)
**within 7 days**.

## Options

There are three required pieces of information when you initialize the module,
then some other ones you probably want to set:

```
apiKey: String,  // REQUIRED
location: {
    lat: Number, // REQUIRED
    lng: Number  // REQUIRED
},
avgTemps: [      // defaults to temps in Washington, DC
    { high: Number, low: Number }, // Jan
    ...,                           // Feb-Nov
    { high: Number, low: Number }  // Dec
],
dewPointBreak: Number,  // The dewpoint (temp) at which the air becomes nasty (humid) [defaults to 69]
humidityBreak: Number,  // The percent humidity (0-1) at which the air becomes nasty [defaults to 0.7]
windBreak: Number,      // The max wind velocity (in mph) at which you consider it "significant" [defaults to 15]
cloudBreak: Number      // The percent cloud coverage (0-1) at which you consider it to be "mostly cloudy" [defaults to 0.8]
```

### Forecast for Requested Date

In addition to the options above, every time you call the module you may pass in
the date you want the forecast for. If you leave this blank, then it will use
the current date (as defined by the server).

`let weather = require('fuzzy-weather')({ ... });`

Get today's forecast:

`weather().then(function() { ... });`

Get forecast based on string date (must be within 7 days of current date):

`weather('11/30/2016').then(function() { ... });`

Get forecast for timestamp (must be within 7 days of current date):

`weather(1480492800000).then(function() { ... });`

## Author and License

This module was written by [@jakerella](https://github.com/jakerella) and is
licensed under the [MIT license](LICENSE). Feel free to use it any way you want,
just be nice.
