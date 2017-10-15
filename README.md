
# Fuzzy Weather

Powered by the [Dark Sky](https://darksky.net/) API!

This library will retrieve weather data using the Dark Sky API and then provide
a text description of the weather for a given day using a "fuzzy" representation
suitable for use in a voice interface system. Think of this as a virtual
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

weather()  // defaults to weather forecast for today
    .then(function(data) {
        console.log(data);
    })
    .catch(console.error);
```

## Options

There are three required pieces of information when you initialize the module,
then some other ones you probably want to set:

```
apiKey: String,  // REQUIRED
location: {
    lat: Number, // REQUIRED
    lng: Number  // REQUIRED
}
```

That said, you **really** want to set the `avgTemps` for the area in question as well.
This is what will determine the library's decision about whether it is unseasonably
warm or cold in the requested location. This will default to the average temps in
Washington, DC (the author's home town), which may be VERY different than the
location requested. You can get historical weather data in a variety of places, for
example the [Open Weather Map](https://openweathermap.org/history) project.

```
avgTemps: [                        // defaults to temps in Washington, DC
    { high: Number, low: Number }, // Jan
    ...,                           // Feb-Nov
    { high: Number, low: Number }  // Dec
]
```

(Yes, yes... I'd love for this module to get that data from an API service based
on the lat and lng, but I can't find a free one that provides this information.
Maybe I'll set up a scraper for that some time in the future.)

There are a few other options that define when the library will report that it is
humid, windy, or sunny/cloudy:

```
dewPointBreak: Number,  // The dewpoint (temp) at which the air becomes nasty (humid) [defaults to 69]
humidityBreak: Number,  // The percent humidity (0-1) at which the air becomes nasty [defaults to 0.7]
windBreak: Number,      // The max wind velocity (in mph) at which you consider it "significant" [defaults to 15]
cloudBreak: Number      // The percent cloud coverage (0-1) at which you consider it to be "mostly cloudy" [defaults to 0.8]
```

### Forecast for Requested Date

In addition to the options above, every time you call the module you may pass in
the date you want the forecast for. If you leave this blank, then it will use
the current date (as defined by the server).

Get today's forecast:

```
let weather = require('fuzzy-weather')({ /* options... */ });
weather().then(function() { ... });
```

Get forecast based on string date (must be within 7 days of current date):

```
let weather = require('fuzzy-weather')({ /* options... */ });
weather('11/30/2016').then(function() { ... });
```

Get forecast for timestamp (must be within 7 days of current date):

```
let weather = require('fuzzy-weather')({ /* options... */ });
weather(1480492800000).then(function() { ... });
```

## Response Data

The primary function of this library (see usage above) will always return a `Promise`
which you must then attach handlers to. A rejected Promise will always be fulfilled
with an `Error` object, and a resolved Promise will always provide the same data
structure:

```
{
    date: Date,
    currently: Object | null,
    hourByHour: Object | null,
    dailySummary: Object
}
```

The `date` above will be a JavaScript `Date` object representing the date this
forecast is for. The other three sections will always have the same substructure:

```
{
    forecast: String,
    data: Object,
    conditions: Object
}
```

That said, they will not always be present. The `dailySummary` block is the _only_
section that will _always_ be provided. The `currently` section is only provided
if the requested date is the current day. The `hourByHour` section is only provided
if the requested date is within 48 hours (Dark Sky only provides hourly data for
the next 48 hours).

The data within those three blocks will contain:

* **`forecast`**: This is really the reason you're here. This will be a string that
represents the forecast for the requested day. It should be suitable for a voice
interface (like Alexa or Google Home).
* **`data`**: The `data` block within these will be the data as provided by the
Dark Sky API. You should review the [developer documentation](https://darksky.net/dev/)
on Dark Sky's website for more information.
* **`conditions`**: A hash of "condition":"readable text" pairs. For example, it
might contain `{ "heat": "it'll be a scorcher tomorrow" }`, but _only_ if the
requested date was tomorrow _and_ the forecast data calls for above normal temperatures.
Other conditions might include: "wind", "cold", "rain", "snow", "humidity", etc.

## Notes and Such

### API Key

You will need a Dark Sky API key to use this module. Head over to their
[developer documentation](https://darksky.net/dev/) and sign up. You can then
get your API key from the [account page](https://darksky.net/dev/account).

### Limits

Note that Dark Sky does impose some [API limits](https://darksky.net/dev/docs/faq) -
as of this update, that limit was 1,000 API calls per day for the free tier. If
you require more than that, simply update your account with a credit card and
they will bill you $0.0001 per call beyond that.

#### Current Data Retrieved

Currently this module only supports **temperature** and **rain** data in the forecast.
The rest of the data provided by Dark Sky will come in soon... I just need to get
the rain module solid first, and ensure everything is working in the main module.

#### Forecast Only

Additionally, note that this library is all about forecasting, thus you can only
get fuzzy weather data for dates in the future (including the current day)
**up to 7 days** (the Dark Sky limit). You can't request the weather for a date
in the past.

## Issues? Want to help?

If you have a problem you want addressed, please open an [issue on GitHub](https://github.com/jakerella/fuzzy-weather/issues).
If you want to help, please see the [CONTRIBUTING](CONTRIBUTING.md) documentation,
I would be more than happy to see other contributors on this package!

## Author and License

This module was written by [Jordan Kasper (@jakerella)](https://github.com/jakerella) and is
licensed under the [MIT license](LICENSE). Feel free to use it any way you want,
just be nice.
