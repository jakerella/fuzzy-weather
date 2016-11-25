'use strict';

let debug = require('debug')('fuzzy-weather'),
    _ = require('lodash'),
    request = require('request');


const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const OPTIONS = {
    apiKey: null,
    location: { lat: null, lng: null },
    avgTemps: [            // averages for Washington, DC
        {high:40, low:30}, // Jan
        {high:45, low:30}, // Feb
        {high:55, low:40}, // Mar
        {high:65, low:45}, // Apr
        {high:75, low:55}, // May
        {high:85, low:65}, // Jun
        {high:90, low:70}, // Jul
        {high:85, low:70}, // Aug
        {high:80, low:65}, // Sep
        {high:70, low:50}, // Oct
        {high:60, low:40}, // Nov
        {high:45, low:35}  // Dec
    ],
    dewPointBreak: 69,
    humidityBreak: 0.70,
    windBreak: 15,
    cloudBreak: 0.8
};

module.exports = function(options = {}) {
    let o = {};
    _.merge(o, OPTIONS, options);
    debug('Setting up new fuzzy-weather with options:', o);
    return getWeatherForDate;

    /**
     * The publicly available function for getting weather for a given date.
     *
     * @param  {String|Number} requestedDate Anything that can be passed into new Date() (OPTIONAL, will use current date otherwise)
     * @return {Promise}                     Will resolve (hopefully) with an object containing the weather report:
     *                                         - text {String} the text to read out
     *                                         - type {String} "day-summary" or "hour-by-hour"
     *                                         - date {Date} the date this weather report is for
     *                                       May also reject with an {Error}
     */
    function getWeatherForDate(requestedDate) {
        return new Promise(function (resolve, reject) {
            debug('Getting weather for %s', requestedDate);

            if (!o.apiKey) {
                debug('API key?', o.apiKey);
                return reject(new Error('No API key for Dark Sky provided'));
            }

            if (!o.location || !o.location.lat || !o.location.lng ||
                typeof(o.location.lat) !== 'number' || typeof(o.location.lng) !== 'number') {
                debug('lat/lng?', o.location.lat, o.location.lng);
                return reject(new Error('Lattitude and longitude must be provided and be numeric'));
            }

            let now = new Date();

            // No date? no problem! Just get today's weather.
            if (!requestedDate) {
                requestedDate = now.getTime();
            }

            let reqDateObj = new Date(requestedDate);
            if (!reqDateObj.getTime()) {
                return reject(new Error('Please provide a valid date to check the weather for!'));
            }
            let simpleDate = getCYMD(reqDateObj);

            if (simpleDate < getCYMD(now)) {
                return reject(new Error(`Unable to get weather foreacast for date in the past (${simpleDate})`));
            } else if (reqDateObj.getTime() > (now.getTime() + (86400000 * 7))) {
                return reject(new Error(`Only able to get weather for dates within 7 days of now (${simpleDate})`));
            }

            request({
                url: `https://api.darksky.net/forecast/${o.apiKey}/${o.location.lat},${o.location.lng}`
            }, function(err, res, body) {
                let data;
                let text = 'We got some weather.';
                let type = 'summary';

                if (err) {
                    debug('Error from API call', err);
                    if (!(err instanceof Error)) {
                        err = new Error(''+err);
                    }
                    return reject(err);
                } else if (res.statusCode > 299) {
                    debug('Non-200 status code from weather API:', res.statusCode, body);
                    return reject(
                        new Error(`There was a problem getting weather data: received non-200 status code (${res.statusCode})`)
                    );
                }

                try {
                    data = JSON.parse(body);
                } catch(e) {
                    debug('Invalid JSON data from weather API:', body);
                    return reject(new Error('The API did not return valid data.'));
                }


                if (getCYMD(now) === simpleDate ||
                    getCYMD(now.getTime() + 86400000) === simpleDate) {
                    // for today or tomorrow, use hour by hour (ish) summary
                    debug(`getting hour-by-hour summary for ${simpleDate}`);
                    text = getHourByHour(reqDateObj, data);
                    type = 'hour-by-hour';

                } else {
                    // for any other day just give the summary of that day
                    debug(`getting daily summary for ${simpleDate}`);
                    type = 'day-summary';
                    data.daily.data.forEach(function(dailyData) {
                        if (getCYMD(dailyData.time * 1000) === simpleDate) {
                            dailyData.type = 'daily';
                            let day = getDayOfWeek(reqDateObj, true);
                            text = getDailyConditions(o, dailyData)
                                .map(function(condition, i) {
                                    let getCondition,
                                        text = [];

                                    debug('getting text for condition:', condition);

                                    try {
                                        getCondition = require('./conditions/' + condition.topic);
                                    } catch(err) {
                                        debug('No condition module for %s', condition.topic);
                                    }

                                    if (!getCondition) { return ''; }

                                    if (i === 0) {
                                        text.push(render(getCondition.headline(), {
                                            day: day
                                        }));
                                    }
                                    text.push(render(getCondition(condition, dailyData), {
                                        day: day
                                    }));
                                    return text.join(' ');
                                })
                                .join(' ');
                        }
                    });
                }

                resolve({
                    text: text,
                    type: type,
                    date: reqDateObj
                });
            });
        });
    }
};

/*
data.hourly.data[0] - 48
{
    "time":1470751200,
    "summary":"Partly Cloudy",
    "icon":"partly-cloudy-day",
    "precipIntensity":0.0047,
    "precipProbability":0.17,
    "precipType":"rain",
    "temperature":77.87,
    "apparentTemperature":77.87,
    "dewPoint":66.94,
    "humidity":0.69,
    "windSpeed":5.79,
    "windBearing":97,
    "visibility":10,
    "cloudCover":0.48,
    "pressure":1021.9,
    "ozone":295.99
}
 */

function getHourByHour() {
    return 'Gonna have some weather today!';
}



/**
 * This method takes some daily foreacast data and determines what conditions
 * exist that we want to report on. For example, if there is no wind expected
 * today then we don't need to say that. The data returned is an array of the
 * conditions that *should* be reported on, sorted by severity - `level` in
 * the data. Also included is a text `topic` and `probability` (although the
 * probability is often times just `1`).
 *
 * @param  {Object} o    The options for this instance of fuzzy weather
 * @param  {Object} data Daily summary data as returned from Dark Sky API
 * @return {Array}       Sorted conditions, each entry being an object with:
 *                       - topic {String} for example: "rain", "wind", "clouds"
 *                       - probability {Number} percentage represented as 0-1
 *                       - level {Number} The severity from 1-10 (could be outside of this)
 */
function getDailyConditions(o, data) {
    let avgTemps = o.avgTemps[(new Date(data.time * 1000)).getMonth()],
        conditions = [];

    // -------- RAIN
    if (data.precipType === 'rain' && data.precipProbability > 0.1 && data.precipIntensityMax > 0.01) {
        conditions.push({
            topic: 'rain',
            probability: data.precipProbability,
            level: (data.precipIntensityMax * 10) * 2
        });

    // -------- SNOW
    } else if (data.precipType === 'snow' && data.precipProbability > 0.1 && data.precipIntensityMax > 0.005) {
        let level = (1 - data.visibility);
        if (level < 1) {
            // if visibility isn't indicative, let's use precipAccumulation
            level = data.precipAccumulation;
        }

        conditions.push({
            topic: 'snow',
            probability: data.precipProbability,
            level: level
        });

    // -------- SLEET
    } else if (data.precipType === 'sleet' && data.precipProbability > 0.1 && data.precipIntensityMax > 0.05) {
        conditions.push({
            topic: 'snow',
            probability: data.precipProbability,
            level: data.precipAccumulation * 10
        });

    // -------- HEAT (and humidity)
    } else if (data.temperatureMax > avgTemps.high || data.apparentTemperatureMax > (avgTemps.high + 5)) {
        let level = Math.max((data.temperatureMax - avgTemps.high), (data.apparentTemperatureMax - avgTemps.high));
        if (data.dewPoint > o.dewPointBreak || data.humidity > o.humidityBreak) {
            level += ((data.dewPoint - o.dewPointBreak) + (data.humidity - o.humidityBreak)) / 2;
        }

        conditions.push({
            topic: (data.dewPoint > o.dewPointBreak || data.humidity > o.humidityBreak) ? 'heat-humid' : 'heat',
            probability: 1,
            level: level
        });

    // -------- HUMIDITY
    } else if (data.dewPoint > (o.dewPointBreak * 0.90) && data.humidity > (o.humidityBreak * 0.90)) {
        conditions.push({
            topic: 'humidity',
            probability: 1,
            level: (data.dewPoint - o.dewPointBreak) + (data.humidity - o.humidityBreak)
        });

    // -------- COLD (and windy)
    } else if (data.temperatureMin < avgTemps.low || data.apparentTemperatureMin < (avgTemps.low - 5)) {
        let level = Math.max((avgTemps.low - data.temperatureMin), (avgTemps.low - data.apparentTemperatureMin));
        if (data.windSpeed > o.windBreak) {
            level += ((data.windSpeed - o.windBreak) / 5);
        }

        conditions.push({
            topic: (data.windSpeed > o.windBreak) ? 'cold-wind' : 'cold',
            probability: 1,
            level: level
        });

    // -------- CLOUDS
    } else if (data.cloudCover > o.cloudBreak) {
        conditions.push({
            topic: 'clouds',
            probability: 1,
            level: (data.cloudCover - o.cloudBreak) * 50
        });

    // -------- WIND
    } else if (data.windSpeed > o.windBreak) {
        conditions.push({
            topic: 'wind',
            probability: 1,
            level: (data.windSpeed - o.windBreak) / 2
        });
    }

    return conditions.sort(function(a, b) {
        return b.level - a.level;
    });
}



// function getDailyTemperatureText(data) {
//     let text;
//     let min = Math.round(data.temperatureMin);
//     let max = Math.round(data.temperatureMax);
//     let appMax = Math.round(data.apparentTemperatureMax);
//
//     if (max > 90) {
//          text = 'It will reach ' + max + ' degrees';
//          if (appMax > (max + 5)) {
//              text += ', but it might feel more like ' + appMax;
//          }
//          text += '. Lows will be near ' + min;
//
//     } else if (max > 70) {
//         text = 'The high will be ' + max + ' and the low around ' + min;
//
//     } else if (max > 40) {
//         text = 'Temperatures will only get up to ' + max + ' with lows near ' + min;
//
//     } else {
//         text = 'It might only hit ' + max;
//         if (appMax < (max - 5)) {
//             text += ', but it might only feel like ' + appMax;
//         }
//         text += '. The low is expected to be ' + min;
//     }
//
//     return text;
// }

// function getDailyHumidityText(data) {
//     let text;
//
//     if (data.dewPoint > o.dewPointBreak && data.humidity > o.humidityBreak) {
//         text = 'The relative humidity will be near ' + (data.humidity * 100) +
//             ' percent with the dew point at ' + Math.round(data.dewPoint);
//     } else if (data.humidity < 0.4) {
//         text = 'It\'s going to be very dry, grab that lotion. The humidity will only be ' + data.humidity;
//     }
//
//     return text;
// }
//
// function getDailyWindText(data) {
//     let text;
//
//     if (data.windSpeed > 30) {
//         text = 'The wind could be fierce today, reaching speeds near ' + Math.round(data.windSpeed) + ' miles per hour';
//     } else if (data.windSpeed > 20) {
//         text = 'There may be some breezy moments with wind speeds peaking around ' + Math.round(data.windSpeed) + ' miles per hour';
//     } else if (data.windSpeed > 10) {
//         text = 'There should be a light breeze in the air';
//     }
//
//     return text;
// }


/* ****************************************************** *
                 VARIOUS HELPER METHODS
 * ****************************************************** */

function render(text, data) {
    var newText = text;
    Object.keys(data).forEach(function(key) {
        newText = text.replace('{' + key + '}', data[key]);
    });
    return newText;
}

function getCYMD(d) {
    if (typeof(d) === 'number') {
        d = new Date (d);
    }
    if (!d.getTime()) {
        return null;
    }
    return d.toISOString().split('T')[0];
}

function getDayOfWeek(date, useFamiliar) {
    let now = Date.now();
    let day = 'that day';
    if (useFamiliar && getCYMD(date) === getCYMD(now)) {
        day = 'today';
    } else if (useFamiliar && getCYMD(date) === getCYMD(now + (1000*60*60*24))) {
        day = 'tomorrow';
    } else if ( (date.getTime() - now) < (1000*60*60*24*7) ) {
        // only use day of the week if within the next week
        day = DAYS_OF_WEEK[date.getDay()];
    }
    return day;
}

if (!Array.prototype.sample) {
    Array.prototype.sample = function sample() {
        return this[Math.floor(Math.random() * this.length)];
    };
}

// function shuffle(a) {
//     let j, x, i;
//     for (i = a.length; i; i--) {
//         j = Math.floor(Math.random() * i);
//         x = a[i - 1];
//         a[i - 1] = a[j];
//         a[j] = x;
//     }
//     return a;
// }
