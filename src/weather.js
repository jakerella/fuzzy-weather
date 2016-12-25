'use strict';

let debug = require('debug')('fuzzy-weather'),
    _ = require('lodash'),
    request = require('request');
require('./array-util');

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
            let todaySimple = getCYMD(now);

            // No date? no problem! Just get today's weather.
            if (!requestedDate) {
                requestedDate = now.getTime();
            }

            let reqDateObj = new Date(requestedDate);
            if (!reqDateObj.getTime()) {
                return reject(new Error('Please provide a valid date to check the weather for!'));
            }
            reqDateObj.setHours(0);
            let simpleDate = getCYMD(reqDateObj);

            if (simpleDate < todaySimple) {
                return reject(new Error(`Unable to get weather foreacast for date in the past (${simpleDate})`));
            } else if (reqDateObj.getTime() > (now.getTime() + (86400000 * 7))) {
                return reject(new Error(`Only able to get weather for dates within 7 days of now (${simpleDate})`));
            }

            let midnight = Math.round(reqDateObj.getTime() / 1000);
            request({
                url: `https://api.darksky.net/forecast/${o.apiKey}/${o.location.lat},${o.location.lng},${midnight}`
            }, function(err, res, body) {
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

                let data;
                try {
                    data = JSON.parse(body);
                } catch(e) {
                    debug('Invalid JSON data from weather API:', body);
                    return reject(new Error('The API did not return valid data.'));
                }

                resolve({
                    dailySummary: getDailySummary(o, data, reqDateObj),
                    hourByHour: getHourByHour(o, data, reqDateObj),
                    date: reqDateObj
                });
            });
        });
    }
};

/**
* Build the text for the daily summary weather report for the given date
*
* @param  {Object} o      The options for this instance of fuzzy weather
* @param  {Object} data   The data returned from the Dark Sky API
* @param  {Date} reqDate  The date of the request
* @return {String}        The daily summary text of the forecast
 */
function getDailySummary(o, data, reqDate) {
    let simpleDate = getCYMD(reqDate);
    let info = {
        data: null,
        conditions: {},
        forecaste: null
    };

    debug(`getting daily summary for ${simpleDate}`);

    data.daily.data.forEach(function(dailyData) {
        if (getCYMD(dailyData.time * 1000) === simpleDate) {
            dailyData.type = 'daily';
            let day = getDayOfWeek(reqDate, true);

            info.data = dailyData;
            info.forecast = getDailyConditions(o, dailyData)
                .map(function(condition, i) {
                    let conditionMod,
                        condText,
                        text = [];

                    debug('getting text for condition:', condition);

                    try {
                        conditionMod = require('./conditions/' + condition.topic);
                    } catch(err) {
                        debug('No condition module for %s', condition.topic);
                    }

                    if (!conditionMod) { return ''; }

                    if (i === 0) {
                        text.push(render(conditionMod.headline(), {
                            day: day
                        }));
                    }
                    condText = conditionMod.dailyText(condition, dailyData);
                    info.conditions[condition.topic] = condText;
                    text.push(render(condText, {
                        day: day
                    }));
                    return text.join(' ');
                })
                .join(' ');
        }
    });

    return info;
}


/**
 * Build the text for the hour-by-hour (ish) weather report for the given date
 *
 * @param  {Object} o      The options for this instance of fuzzy weather
 * @param  {Object} data   The data returned from the Dark Sky API
 * @param  {Date} reqDate  The date of the request
 * @return {String}        The hour-by-hour text of the forecast
 */
function getHourByHour(o, data, reqDate) {
    let info = {
        data: null,
        conditions: {},
        forecast: null
    };

    let refinedData = getHourByHourData(data, reqDate);
    if (!refinedData) { return null; }
    info.data = refinedData.hourly;

    let simpleDate = getCYMD(reqDate);
    debug(`getting hour-by-hour summary for ${simpleDate}`);

    let conditionMod;
    let text = [];
    let dayHeadliner = getDailyConditions(o, refinedData.daily)[0];

    try {
        conditionMod = require('./conditions/' + dayHeadliner.topic);
    } catch(err) {
        debug('No condition module for %s', dayHeadliner.topic);
    }

    if (conditionMod) {
        text.push(conditionMod.headline());
    }

    info.forecast = render(text.join(' '), {
        day: getDayOfWeek(reqDate, true)
    });

    return info;
}


function getHourByHourData(data, reqDate) {
    let refinedData = null;
    let now = new Date();
    let simpleDate = getCYMD(reqDate);
    let todaySimple = getCYMD(now);
    let tomorrowSimple = getCYMD(now.getTime() + 86400000);

    if (todaySimple === simpleDate || tomorrowSimple === simpleDate) {
        let hourStart = 0;
        let hourEnd = 0;
        let dailyIndex = 0;

        // determine what data applies to the requested day
        if (todaySimple === simpleDate) {
            for (let i=0; i<24; ++i) {
                if (getCYMD(data.hourly.data[i].time * 1000) !== simpleDate) {
                    hourEnd = i;
                    break;
                }
            }
        } else {
            // If it isn't today, it's tomorrow
            dailyIndex = 1;
            for (let i=0; i<49; ++i) {
                if (!hourStart && getCYMD(data.hourly.data[i].time * 1000) === simpleDate) {
                    hourStart = i;
                } else if (hourStart && getCYMD(data.hourly.data[i].time * 1000) !== simpleDate) {
                    hourEnd = i;
                    break;
                }
            }
            hourEnd = hourEnd || 49;
        }

        refinedData = {
            hourly: data.hourly.data.slice(hourStart, hourEnd),
            daily: data.daily.data[dailyIndex]
        };
    }

    return refinedData;
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
    let dCopy;
    if (d instanceof Date) {
        dCopy = new Date(d.getTime());
    } else {
        dCopy = new Date(d);
    }
    if (!dCopy.getTime()) {
        return null;
    }

    dCopy.setHours(dCopy.getHours()-(dCopy.getTimezoneOffset() / 60));

    return dCopy.toJSON().split('T')[0];
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
