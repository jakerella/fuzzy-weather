# Fuzzy Weather

~~Powered by the [Dark Sky](https://darksky.net/) API!~~  
Now powered by [OpenWeather](https://openweathermap.org/darksky-openweather-3)!

This library will retrieve weather data using the OpenWeather API and then provide
a text description of the weather for a given day using a "fuzzy" representation
suitable for use in a voice interface system. Think of this as a virtual
meteorologist.

> Note that you will need an [OpenWeather](https://openweathermap.org/api/one-call-3) API key to use this module!

## Install and Basic Usage

Install with npm using:

`npm install fuzzy-weather`

Then you can use the module like so:

```
// Initialize the fuzzy weather module
let fuzzyWeather = require('fuzzy-weather')({
    apiKey: 'abcdefg1234567890',  // your OpenWeather API key!
    location: {
        lat: 38.9649734,
        lng: -77.0207249
    }
})

fuzzyWeather()   // Get forecast - defaults to weather for current day
    .then((data) => {
        console.log(data)
    })
    .catch(console.error)
```

## Options

There are three required pieces of information when you initialize the module,
then some other ones you probably want to set:

```
{
  apiKey: String,  // REQUIRED
  location: {
    lat: Number,   // REQUIRED
    lng: Number    // REQUIRED
  }
}
```

That said, you **really** want to set the `avgTemps` option for the area you're 
forecasting for. This is what will determine the library's decision about whether 
it is unseasonably warm or cold in the forecast. This option will default to the 
average temps in Washington, DC, which may be VERY different than the location 
requested. You can get historical weather data from a variety of places, for example 
from the [OpenWeather History API](https://openweathermap.org/history) ($$$).

```
{
  ...,  // (other required options)
  avgTemps: [                        // defaults to temps in Washington, DC
    { high: Number, low: Number },   // Jan (Month 0)
    ...,                             // Feb-Nov (Months 1-10)
    { high: Number, low: Number }    // Dec (Month 11)
  ]
}
```

(Yes, yes... I'd love for this module to get that data from an API service based
on the lat and lng, but I can't find a free one that provides this information.)

There are also a few options that define when the library will report that it is
humid, windy, or sunny/cloudy:

```
{
  ...,  // (required options)
  dewPointBreak: Number,  // The dewpoint (temp in F) at which the air becomes nasty (humid) [defaults to 69]
  humidityBreak: Number,  // The percent humidity (0-1) at which the air becomes nasty [defaults to 0.7]
  windBreak: Number,      // The max wind velocity (in mph) at which you want it reported [defaults to 5]
  cloudBreak: Number,     // The percent cloud coverage (0-1) at which you consider it to be "mostly cloudy" [defaults to 0.8]
  highTempBreak: Number,  // The minimum daily high temperature (F) to start reporting on it being really hot [defaults to 95]
  lowTempBreak: Number,   // The maximum daily low temperature (F) to start reporting on it being really cold [defaults to 32]
  nightTempBreak: Number  // The maximum NIGHTLY low temperature (F) to start reporting on it being a really cold NIGHT [defaults to 15]
}
```

### Forecast for Requested Date

In addition to the options above, every time you call the module you may pass in
the date you want the forecast for. If you leave this blank, then it will use
the current date (as defined by the server).

> Note that the options for the module are set _once_, then each time you 
> call the module you can specify _when_ you want the forecast to be for.

Set options: `let weather = require('fuzzy-weather')({ /* options */ })`

Get **today's forecast**:

```
weather().then((data) => { ... }).catch(...)
```

Get forecast based on **string date** (must be within 7 days of current date):

```
weather('11/30/2022').then((data) => { ... }).catch(...)
```

Get forecast for a **timestamp** (must be within 7 days of current date):

```
weather(1480492800000).then(() => { ... }).catch(...)
```

## Response Data

This module will always return a `Promise` which you must listen to. A rejected 
Promise will always be fulfilled with an `Error` object, and a resolved Promise 
will always provide the same data structure:

```
{
  date: Date,
  dailySummary: Object,
  currently: Object | null,
  hourByHour: Object | null
}
```

The `date` above will be a JavaScript `Date` object representing the date this
forecast is for. The other three sections will always have the same substructure:

```
{
  date: Date,
  dailySummary: {
    forecast: String,
    data: Object,
    conditions: Object
  },
  currently: { ... },
  hourByHour: { ... }
}
```

That said, they will not always be present. The `dailySummary` block will **always** 
be provided. The `currently` section is only provided if the requested date is the 
current day. The `hourByHour` section is only provided if the requested date is within 
48 hours. This is based on the data provided by the third party API.

The data within those three subsections will contain:

* **`forecast`**: This is really the reason you're here. This will be a string that
represents the forecast for the requested day. It should be suitable for a voice
interface (like Alexa or Google Home) and provided in plain language.
* **`data`**: The `data` block will be the data as provided by the third party API. 
You should review the [developer documentation](https://openweathermap.org/api/one-call-3)
for more information.
* **`conditions`**: A collection of `"condition": "readable text"` pairs. For example, it
might contain `{ "heat": "it'll be a scorcher tomorrow" }`, but _only_ if the
requested date was tomorrow _and_ the forecast data calls for above normal temperatures.
Other conditions might include: "wind", "cold", "rain", "snow", "humidity", etc.

## Notes and Such

### API Limits

The third party weather API imposes some [API limits](https://openweathermap.org/price). 
As of October 2022, that limit was 1,000 API calls per day for the free tier. If
you require more than that, update your account with a credit card and change
your subscription.

#### Current Data Retrieved

Currently this module only supports **temperature** and **rain** data in the forecast.
The rest of the data provided will be incorporated as I have time to work on this!

#### Forecast Only

This library is all about forecasting, thus you can only get fuzzy weather data for 
dates in the future, including the current day and _up to 7 days_ ahead. You can't 
request the weather for a date in the past, or past seven days (this is a limit of
the third party API).

## Issues? Want to help?

If you have a problem you want addressed, please open an 
[issue on GitHub](https://github.com/jakerella/fuzzy-weather/issues).
If you want to help, please see the [CONTRIBUTING](CONTRIBUTING.md) documentation,
I would be more than happy to see other contributors on this module!

## Author and License

This module was written by [Jordan Kasper (@jakerella)](https://github.com/jakerella) and is
licensed under the [MIT license](LICENSE). Feel free to use it any way you want,
just be nice.
