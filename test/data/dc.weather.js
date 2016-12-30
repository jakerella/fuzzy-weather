'use strict';

/* jshint maxdepth:5 */

let _ = require('lodash'),
    moment = require('moment-timezone'),
    debug = require('debug')('fuzzy-weather:testdata');

const TZ = 'America/New_York';

/**
 * Generates weather data as returned by the Dark Sky API
 * @param  {Object} base       Location info for the generated data:
                               {
                                latitude: Number,
                                longitude: Number,
                                timezone: String,
                                offset: Number
                               }
 * @param  {Object} hourByHour @see generateHourByHour
 * @param  {Date|Number|String} start An optional start time/date for the data generation (EDT)
 * @return {Object}            The generated weather data (as returned by Dark Sky)
 */
module.exports = function generateWeather(location = {}, hourByHour = {}, start = null) {
    let startDate = moment.tz(start || Date.now(), TZ);
    debug('weather data generating from date:', startDate.format());

    let baseData = getBaseData(Number(startDate.format('X')));

    let conditionData = generateHourByHour(hourByHour, Number(startDate.format('X')));
    let data = _.merge({}, baseData, location, { hourly: { stuff: 1, data: conditionData.hourly } });
    _.merge(data.daily.data[0], conditionData.daily[0]);
    _.merge(data.daily.data[1], conditionData.daily[1]);
    return data;
};

/**
 * Generates the hour by hour data
 * @param  {Object} conditions The conditions for the next 48 hours of data:
                                {
                                 maxTemp: Number,
                                 minTemp: Number,
                                 heatIndexPercent: Number,
                                 conditions: [ { type: String, length: Number, delay: Number } ]
                                }
 * @return {Object}         The hourly and daily data changes: { hourly: Array, daily: Array }
 */
function generateHourByHour(conditions = {}, now = 0) {
    let hourly = [];
    let daily = [{}, {}];
    let hour = (new Date()).getHours();
    let dayPeakPercent = 1 - (Math.abs(hour - 14) / 14);
    let maxPrecipProbability = 1 - (Math.random() / 2);
    let maxPrecipIntensity = (maxPrecipProbability * 0.8) - (Math.random() / 2);

    conditions.maxTemp = conditions.maxTemp || 75;
    conditions.minTemp = conditions.minTemp || 55;
    conditions.heatIndexPercent = conditions.heatIndexPercent || 0;
    conditions.conditions = conditions.conditions || [];

    debug('hourly conditions to generate', conditions);

    for (let i=0; i<49; ++i) {
        let currTemp = conditions.minTemp + ((conditions.maxTemp - conditions.minTemp) * dayPeakPercent);
        // basic set
        let hour = {
            time: now + (i * 3600),
            summary: 'Clear',
            icon: 'clear-day',
            precipIntensity: 0.0000,
            precipProbability: 0.00,
            precipType: 'rain',
            temperature: currTemp,
            apparentTemperature: currTemp + (currTemp * conditions.heatIndexPercent),
            dewPoint: 65.00,
            humidity: 0.60,
            windSpeed: 0.00,
            windBearing: 180,
            visibility: 10.0,
            cloudCover: 0.0,
            pressure: 1000.00,
            ozone: 300.00
        };

        for (let j=0; j<conditions.conditions.length; ++j) {
            if (i >= conditions.conditions[j].delay && i <= (conditions.conditions[j].delay + (conditions.conditions[j].length - 1))) {
                let form = conditions.conditions[j].form || 'even';
                let percentComplete = Math.max(0.1, (i - conditions.conditions[j].delay) / conditions.conditions[j].length);

                if (conditions.conditions[j].type === 'rain') {
                    debug('adding rain condition at hour', i);

                    let intensity = 0;
                    let probability = 0;
                    if (form === 'bell') {
                        intensity = Math.abs(maxPrecipIntensity - ((Math.abs(percentComplete - 0.5) * 1.5) * maxPrecipIntensity));
                        probability = maxPrecipProbability - Math.abs(percentComplete - 0.5);
                    } else if (form === 'even') {
                        intensity = maxPrecipIntensity;
                        probability = maxPrecipProbability;
                    } else if (form === 'increasing') {
                        intensity = percentComplete * maxPrecipIntensity;
                        probability = percentComplete * maxPrecipProbability;
                    } else if (form === 'decreasing') {
                        intensity = (1.1 - percentComplete) * maxPrecipIntensity;
                        probability = (1.1 - percentComplete) * maxPrecipProbability;
                    }

                    _.merge(hour, {
                        summary: 'Heavy Rain',
                        icon: 'rain',
                        precipIntensity: intensity,
                        precipProbability: probability,
                        precipType: 'rain'
                    });
                }

                // TODO: add other conditions
            }
        }
        hourly.push(hour);
    }

    // Set daily data values
    for (let i=0; i<conditions.conditions.length; ++i) {
        let cond = conditions.conditions[i];

        if (cond.type === 'rain') {
            let form = cond.form || 'even';
            let maxPrecipTime = 0;
            if (form === 'even' || form === 'bell') {
                maxPrecipTime = now + ((Math.round(cond.length / 2) + cond.delay) * 3600);
            } else if (form === 'increasing') {
                maxPrecipTime = now + ((cond.delay + cond.length - 1) * 3600);
            } else if (form === 'decreasing') {
                maxPrecipTime = now + ((cond.delay + 1) * 3600);
            }

            let dailyData = {
                precipIntensity: maxPrecipIntensity / 2,
                precipIntensityMax: maxPrecipIntensity,
                precipIntensityMaxTime: maxPrecipTime,
                precipProbability: maxPrecipProbability / 2
            };
            if (cond.delay < 24) {
                _.merge(daily[0], dailyData);
            } else {
                _.merge(daily[1], dailyData);
            }
        }

        // TODO: add other conditions
    }

    return {
        hourly,
        daily
    };
}

function getBaseData(now = 0) {
    let oneDay = 60 * 60 * 24;

    let baseData = {
        'latitude': 38.9649734,
        'longitude': -77.0207249,
        'timezone': TZ,
        'offset': ((new Date()).getTimezoneOffset() / 60) * -1,
        'currently': {
            'time':now,
            'summary':'Clear',
            'icon':'clear-night',
            'nearestStormDistance':36,
            'nearestStormBearing':335,
            'precipIntensity':0,
            'precipProbability':0,
            'temperature':74.31,
            'apparentTemperature':74.31,
            'dewPoint':65.56,
            'humidity':0.74,
            'windSpeed':3.76,
            'windBearing':187,
            'visibility':9.78,
            'cloudCover':0.2,
            'pressure':1018.03,
            'ozone':300.8
        },
        'minutely': {
            'summary':'Clear for the hour.',
            'icon':'clear-night',
            'data':[
                {
                    'time':now,
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + 60,
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 2),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 3),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 4),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 5),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 6),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 7),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 8),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 9),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 10),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 11),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 12),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 13),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 14),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 15),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 16),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 17),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 18),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 19),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 20),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 21),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 22),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 23),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 24),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 25),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 26),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 27),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 28),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 29),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 30),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 31),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 32),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 33),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 34),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 35),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 36),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 37),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 38),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 39),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 40),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 41),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 42),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 43),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 44),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 45),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 46),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 47),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 48),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 49),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 50),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 51),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 52),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 53),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 54),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 55),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 56),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 57),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 58),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 59),
                    'precipIntensity':0,
                    'precipProbability':0
                },
                {
                    'time':now + (60 * 60),
                    'precipIntensity':0,
                    'precipProbability':0
                }
            ]
        },
        'hourly': {
            'summary':'Rain in the morning.',
            'icon':'rain',
            'data': null
            /*
            'data':[
                {
                    'time':now,
                    'summary':'Clear',
                    'icon':'clear-night',
                    'precipIntensity':0.0007,
                    'precipProbability':0.01,
                    'precipType':'rain',
                    'temperature':74.37,
                    'apparentTemperature':74.37,
                    'dewPoint':65.59,
                    'humidity':0.74,
                    'windSpeed':3.74,
                    'windBearing':188,
                    'visibility':9.8,
                    'cloudCover':0.2,
                    'pressure':1018.01,
                    'ozone':300.78
                },
                {
                    'time':now + (3600 * 2),
                    'summary':'Clear',
                    'icon':'clear-night',
                    'precipIntensity':0,
                    'precipProbability':0,
                    'temperature':71.75,
                    'apparentTemperature':71.75,
                    'dewPoint':63.93,
                    'humidity':0.76,
                    'windSpeed':5.09,
                    'windBearing':172,
                    'visibility':8.87,
                    'cloudCover':0.24,
                    'pressure':1018.71,
                    'ozone':301.48
                },
                {
                    'time':now + (3600 * 3),
                    'summary':'Clear',
                    'icon':'clear-night',
                    'precipIntensity':0,
                    'precipProbability':0,
                    'temperature':70.6,
                    'apparentTemperature':70.6,
                    'dewPoint':63.77,
                    'humidity':0.79,
                    'windSpeed':4.57,
                    'windBearing':180,
                    'visibility':8.53,
                    'cloudCover':0.05,
                    'pressure':1019.34,
                    'ozone':301.62
                },
                {
                    'time':now + (3600 * 4),
                    'summary':'Clear',
                    'icon':'clear-night',
                    'precipIntensity':0,
                    'precipProbability':0,
                    'temperature':69.23,
                    'apparentTemperature':69.23,
                    'dewPoint':63.44,
                    'humidity':0.82,
                    'windSpeed':3.59,
                    'windBearing':186,
                    'visibility':8.24,
                    'cloudCover':0.04,
                    'pressure':1019.75,
                    'ozone':300.76
                },
                {
                    'time':now + (3600 * 5),
                    'summary':'Clear',
                    'icon':'clear-night',
                    'precipIntensity':0,
                    'precipProbability':0,
                    'temperature':67.64,
                    'apparentTemperature':67.64,
                    'dewPoint':62.49,
                    'humidity':0.84,
                    'windSpeed':2.68,
                    'windBearing':194,
                    'visibility':8.08,
                    'cloudCover':0.12,
                    'pressure':1020.05,
                    'ozone':299.33
                },
                {
                    'time':now + (3600 * 6),
                    'summary':'Clear',
                    'icon':'clear-night',
                    'precipIntensity':0,
                    'precipProbability':0,
                    'temperature':66.44,
                    'apparentTemperature':66.44,
                    'dewPoint':62.08,
                    'humidity':0.86,
                    'windSpeed':1.52,
                    'windBearing':206,
                    'visibility':7.92,
                    'cloudCover':0.19,
                    'pressure':1020.26,
                    'ozone':297.97
                },
                {
                    'time':now + (3600 * 7),
                    'summary':'Clear',
                    'icon':'clear-night',
                    'precipIntensity':0,
                    'precipProbability':0,
                    'temperature':65.2,
                    'apparentTemperature':65.2,
                    'dewPoint':61.43,
                    'humidity':0.88,
                    'windSpeed':0.51,
                    'windBearing':256,
                    'visibility':7.52,
                    'cloudCover':0.23,
                    'pressure':1020.36,
                    'ozone':296.75
                },
                {
                    'time':now + (3600 * 8),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0.0012,
                    'precipProbability':0.02,
                    'precipType':'rain',
                    'temperature':64.66,
                    'apparentTemperature':64.66,
                    'dewPoint':61.37,
                    'humidity':0.89,
                    'windSpeed':0.82,
                    'windBearing':10,
                    'visibility':7.4,
                    'cloudCover':0.25,
                    'pressure':1020.38,
                    'ozone':295.6
                },
                {
                    'time':now + (3600 * 9),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0.002,
                    'precipProbability':0.05,
                    'precipType':'rain',
                    'temperature':65.02,
                    'apparentTemperature':65.02,
                    'dewPoint':61.99,
                    'humidity':0.9,
                    'windSpeed':1.71,
                    'windBearing':31,
                    'visibility':7.07,
                    'cloudCover':0.27,
                    'pressure':1020.47,
                    'ozone':294.88
                },
                {
                    'time':now + (3600 * 10),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0.0032,
                    'precipProbability':0.1,
                    'precipType':'rain',
                    'temperature':66.21,
                    'apparentTemperature':66.21,
                    'dewPoint':63.11,
                    'humidity':0.9,
                    'windSpeed':2.18,
                    'windBearing':44,
                    'visibility':6.78,
                    'cloudCover':0.3,
                    'pressure':1020.75,
                    'ozone':294.89
                },
                {
                    'time':now + (3600 * 11),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0045,
                    'precipProbability':0.16,
                    'precipType':'rain',
                    'temperature':68.11,
                    'apparentTemperature':68.11,
                    'dewPoint':64.51,
                    'humidity':0.88,
                    'windSpeed':2.47,
                    'windBearing':56,
                    'visibility':6.8,
                    'cloudCover':0.33,
                    'pressure':1021.12,
                    'ozone':295.33
                },
                {
                    'time':now + (3600 * 12),
                    'summary':'Drizzle',
                    'icon':'rain',
                    'precipIntensity':0.0054,
                    'precipProbability':0.21,
                    'precipType':'rain',
                    'temperature':71.36,
                    'apparentTemperature':71.36,
                    'dewPoint':65.11,
                    'humidity':0.81,
                    'windSpeed':3.39,
                    'windBearing':66,
                    'visibility':8.5,
                    'cloudCover':0.37,
                    'pressure':1021.43,
                    'ozone':295.71
                },
                {
                    'time':now + (3600 * 13),
                    'summary':'Drizzle',
                    'icon':'rain',
                    'precipIntensity':0.0053,
                    'precipProbability':0.2,
                    'precipType':'rain',
                    'temperature':75.1,
                    'apparentTemperature':75.1,
                    'dewPoint':66.2,
                    'humidity':0.74,
                    'windSpeed':4.25,
                    'windBearing':85,
                    'visibility':9.61,
                    'cloudCover':0.42,
                    'pressure':1021.69,
                    'ozone':295.88
                },
                {
                    'time':now + (3600 * 14),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0047,
                    'precipProbability':0.17,
                    'precipType':'rain',
                    'temperature':77.87,
                    'apparentTemperature':77.87,
                    'dewPoint':66.94,
                    'humidity':0.69,
                    'windSpeed':5.79,
                    'windBearing':97,
                    'visibility':10,
                    'cloudCover':0.48,
                    'pressure':1021.9,
                    'ozone':295.99
                },
                {
                    'time':now + (3600 * 15),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0041,
                    'precipProbability':0.14,
                    'precipType':'rain',
                    'temperature':80.21,
                    'apparentTemperature':82.72,
                    'dewPoint':67.56,
                    'humidity':0.65,
                    'windSpeed':6.99,
                    'windBearing':105,
                    'visibility':10,
                    'cloudCover':0.55,
                    'pressure':1022.01,
                    'ozone':295.96
                },
                {
                    'time':now + (3600 * 16),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0037,
                    'precipProbability':0.12,
                    'precipType':'rain',
                    'temperature':82.1,
                    'apparentTemperature':85.09,
                    'dewPoint':68.1,
                    'humidity':0.63,
                    'windSpeed':7.78,
                    'windBearing':111,
                    'visibility':9.99,
                    'cloudCover':0.61,
                    'pressure':1021.97,
                    'ozone':295.73
                },
                {
                    'time':now + (3600 * 17),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0033,
                    'precipProbability':0.1,
                    'precipType':'rain',
                    'temperature':83.56,
                    'apparentTemperature':87.17,
                    'dewPoint':68.89,
                    'humidity':0.61,
                    'windSpeed':8.71,
                    'windBearing':114,
                    'visibility':9.99,
                    'cloudCover':0.68,
                    'pressure':1021.82,
                    'ozone':295.36
                },
                {
                    'time':now + (3600 * 18),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0039,
                    'precipProbability':0.13,
                    'precipType':'rain',
                    'temperature':83.64,
                    'apparentTemperature':87.94,
                    'dewPoint':70.06,
                    'humidity':0.64,
                    'windSpeed':8.97,
                    'windBearing':114,
                    'visibility':9.98,
                    'cloudCover':0.71,
                    'pressure':1021.61,
                    'ozone':294.92
                },
                {
                    'time':now + (3600 * 19),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0038,
                    'precipProbability':0.13,
                    'precipType':'rain',
                    'temperature':84.2,
                    'apparentTemperature':89.56,
                    'dewPoint':71.49,
                    'humidity':0.66,
                    'windSpeed':9.22,
                    'windBearing':118,
                    'visibility':9.98,
                    'cloudCover':0.72,
                    'pressure':1021.29,
                    'ozone':294.41
                },
                {
                    'time':now + (3600 * 20),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0031,
                    'precipProbability':0.1,
                    'precipType':'rain',
                    'temperature':84.69,
                    'apparentTemperature':91.18,
                    'dewPoint':72.79,
                    'humidity':0.68,
                    'windSpeed':9.27,
                    'windBearing':123,
                    'visibility':9.99,
                    'cloudCover':0.72,
                    'pressure':1020.88,
                    'ozone':293.82
                },
                {
                    'time':now + (3600 * 21),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0024,
                    'precipProbability':0.07,
                    'precipType':'rain',
                    'temperature':84.23,
                    'apparentTemperature':90.95,
                    'dewPoint':73.32,
                    'humidity':0.7,
                    'windSpeed':9.35,
                    'windBearing':127,
                    'visibility':10,
                    'cloudCover':0.7,
                    'pressure':1020.55,
                    'ozone':293.23
                },
                {
                    'time':now + (3600 * 22),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0024,
                    'precipProbability':0.07,
                    'precipType':'rain',
                    'temperature':82.64,
                    'apparentTemperature':88.61,
                    'dewPoint':73.34,
                    'humidity':0.74,
                    'windSpeed':9.01,
                    'windBearing':130,
                    'visibility':10,
                    'cloudCover':0.6,
                    'pressure':1020.4,
                    'ozone':292.59
                },
                {
                    'time':now + (3600 * 23),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0027,
                    'precipProbability':0.08,
                    'precipType':'rain',
                    'temperature':81.12,
                    'apparentTemperature':86.12,
                    'dewPoint':73.19,
                    'humidity':0.77,
                    'windSpeed':8.23,
                    'windBearing':130,
                    'visibility':10,
                    'cloudCover':0.45,
                    'pressure':1020.35,
                    'ozone':291.94
                },
                {
                    'time':now + (3600 * 24),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0027,
                    'precipProbability':0.08,
                    'precipType':'rain',
                    'temperature':79.76,
                    'apparentTemperature':79.76,
                    'dewPoint':73.15,
                    'humidity':0.8,
                    'windSpeed':7.56,
                    'windBearing':130,
                    'visibility':10,
                    'cloudCover':0.36,
                    'pressure':1020.37,
                    'ozone':291.46
                },
                {
                    'time':now + (3600 * 25),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0.0019,
                    'precipProbability':0.05,
                    'precipType':'rain',
                    'temperature':78.76,
                    'apparentTemperature':78.76,
                    'dewPoint':73.46,
                    'humidity':0.84,
                    'windSpeed':7.19,
                    'windBearing':131,
                    'visibility':10,
                    'cloudCover':0.36,
                    'pressure':1020.52,
                    'ozone':291.4
                },
                {
                    'time':now + (3600 * 26),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0.0009,
                    'precipProbability':0.01,
                    'precipType':'rain',
                    'temperature':77.89,
                    'apparentTemperature':77.89,
                    'dewPoint':73.88,
                    'humidity':0.88,
                    'windSpeed':6.93,
                    'windBearing':133,
                    'visibility':10,
                    'cloudCover':0.43,
                    'pressure':1020.75,
                    'ozone':291.5
                },
                {
                    'time':now + (3600 * 27),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0,
                    'precipProbability':0,
                    'temperature':77.18,
                    'apparentTemperature':77.18,
                    'dewPoint':74.19,
                    'humidity':0.91,
                    'windSpeed':6.68,
                    'windBearing':136,
                    'visibility':10,
                    'cloudCover':0.53,
                    'pressure':1020.91,
                    'ozone':291.2
                },
                {
                    'time':now + (3600 * 28),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0.0009,
                    'precipProbability':0.01,
                    'precipType':'rain',
                    'temperature':76.7,
                    'apparentTemperature':76.7,
                    'dewPoint':74.35,
                    'humidity':0.92,
                    'windSpeed':6.58,
                    'windBearing':140,
                    'visibility':10,
                    'cloudCover':0.64,
                    'pressure':1020.94,
                    'ozone':290.05
                },
                {
                    'time':now + (3600 * 29),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0.0019,
                    'precipProbability':0.05,
                    'precipType':'rain',
                    'temperature':76.35,
                    'apparentTemperature':76.35,
                    'dewPoint':74.4,
                    'humidity':0.94,
                    'windSpeed':6.61,
                    'windBearing':145,
                    'visibility':10,
                    'cloudCover':0.75,
                    'pressure':1020.9,
                    'ozone':288.49
                },
                {
                    'time':now + (3600 * 30),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0.0027,
                    'precipProbability':0.08,
                    'precipType':'rain',
                    'temperature':75.94,
                    'apparentTemperature':75.94,
                    'dewPoint':74.3,
                    'humidity':0.95,
                    'windSpeed':6.72,
                    'windBearing':150,
                    'visibility':10,
                    'cloudCover':0.81,
                    'pressure':1020.83,
                    'ozone':287.18
                },
                {
                    'time':now + (3600 * 31),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0.0031,
                    'precipProbability':0.1,
                    'precipType':'rain',
                    'temperature':75.38,
                    'apparentTemperature':75.38,
                    'dewPoint':74.02,
                    'humidity':0.96,
                    'windSpeed':6.54,
                    'windBearing':153,
                    'visibility':10,
                    'cloudCover':0.78,
                    'pressure':1020.71,
                    'ozone':286.29
                },
                {
                    'time':now + (3600 * 32),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0.0034,
                    'precipProbability':0.11,
                    'precipType':'rain',
                    'temperature':74.87,
                    'apparentTemperature':74.87,
                    'dewPoint':73.68,
                    'humidity':0.96,
                    'windSpeed':6.21,
                    'windBearing':156,
                    'visibility':10,
                    'cloudCover':0.72,
                    'pressure':1020.57,
                    'ozone':285.66
                },
                {
                    'time':now + (3600 * 33),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0.0035,
                    'precipProbability':0.11,
                    'precipType':'rain',
                    'temperature':74.62,
                    'apparentTemperature':74.62,
                    'dewPoint':73.42,
                    'humidity':0.96,
                    'windSpeed':6.1,
                    'windBearing':160,
                    'visibility':10,
                    'cloudCover':0.69,
                    'pressure':1020.55,
                    'ozone':285.44
                },
                {
                    'time':now + (3600 * 34),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0.0036,
                    'precipProbability':0.12,
                    'precipType':'rain',
                    'temperature':74.98,
                    'apparentTemperature':74.98,
                    'dewPoint':73.65,
                    'humidity':0.96,
                    'windSpeed':6.38,
                    'windBearing':167,
                    'visibility':10,
                    'cloudCover':0.73,
                    'pressure':1020.75,
                    'ozone':285.93
                },
                {
                    'time':now + (3600 * 35),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0037,
                    'precipProbability':0.12,
                    'precipType':'rain',
                    'temperature':75.6,
                    'apparentTemperature':75.6,
                    'dewPoint':73.94,
                    'humidity':0.95,
                    'windSpeed':7.02,
                    'windBearing':173,
                    'visibility':10,
                    'cloudCover':0.81,
                    'pressure':1021.08,
                    'ozone':286.84
                },
                {
                    'time':now + (3600 * 36),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0034,
                    'precipProbability':0.11,
                    'precipType':'rain',
                    'temperature':76.73,
                    'apparentTemperature':76.73,
                    'dewPoint':74.13,
                    'humidity':0.92,
                    'windSpeed':7.73,
                    'windBearing':178,
                    'visibility':10,
                    'cloudCover':0.88,
                    'pressure':1021.32,
                    'ozone':287.43
                },
                {
                    'time':now + (3600 * 37),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0025,
                    'precipProbability':0.07,
                    'precipType':'rain',
                    'temperature':78.78,
                    'apparentTemperature':78.78,
                    'dewPoint':74.07,
                    'humidity':0.86,
                    'windSpeed':8.38,
                    'windBearing':182,
                    'visibility':10,
                    'cloudCover':0.89,
                    'pressure':1021.44,
                    'ozone':287.33
                },
                {
                    'time':now + (3600 * 38),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0013,
                    'precipProbability':0.02,
                    'precipType':'rain',
                    'temperature':81.47,
                    'apparentTemperature':86.97,
                    'dewPoint':73.74,
                    'humidity':0.78,
                    'windSpeed':9.09,
                    'windBearing':186,
                    'visibility':10,
                    'cloudCover':0.86,
                    'pressure':1021.49,
                    'ozone':286.91
                },
                {
                    'time':now + (3600 * 39),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0,
                    'precipProbability':0,
                    'temperature':84,
                    'apparentTemperature':90.56,
                    'dewPoint':73.25,
                    'humidity':0.7,
                    'windSpeed':9.73,
                    'windBearing':187,
                    'visibility':10,
                    'cloudCover':0.8,
                    'pressure':1021.39,
                    'ozone':286.59
                },
                {
                    'time':now + (3600 * 40),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0,
                    'precipProbability':0,
                    'temperature':86.26,
                    'apparentTemperature':93.37,
                    'dewPoint':72.87,
                    'humidity':0.65,
                    'windSpeed':10.11,
                    'windBearing':184,
                    'visibility':10,
                    'cloudCover':0.65,
                    'pressure':1021.09,
                    'ozone':286.57
                },
                {
                    'time':now + (3600 * 41),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0,
                    'precipProbability':0,
                    'temperature':88.33,
                    'apparentTemperature':95.7,
                    'dewPoint':72.48,
                    'humidity':0.6,
                    'windSpeed':10.22,
                    'windBearing':179,
                    'visibility':10,
                    'cloudCover':0.48,
                    'pressure':1020.66,
                    'ozone':286.65
                },
                {
                    'time':now + (3600 * 42),
                    'summary':'Partly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0,
                    'precipProbability':0,
                    'temperature':89.79,
                    'apparentTemperature':97.22,
                    'dewPoint':72.14,
                    'humidity':0.56,
                    'windSpeed':10.18,
                    'windBearing':175,
                    'visibility':10,
                    'cloudCover':0.37,
                    'pressure':1020.25,
                    'ozone':286.56
                },
                {
                    'time':now + (3600 * 43),
                    'summary':'Drizzle',
                    'icon':'rain',
                    'precipIntensity':0.0056,
                    'precipProbability':0.22,
                    'precipType':'rain',
                    'temperature':90.7,
                    'apparentTemperature':98.37,
                    'dewPoint':72.13,
                    'humidity':0.55,
                    'windSpeed':10.5,
                    'windBearing':173,
                    'visibility':10,
                    'cloudCover':0.39,
                    'pressure':1019.83,
                    'ozone':286.1
                },
                {
                    'time':now + (3600 * 44),
                    'summary':'Light Rain',
                    'icon':'rain',
                    'precipIntensity':0.0123,
                    'precipProbability':0.44,
                    'precipType':'rain',
                    'temperature':91.26,
                    'apparentTemperature':99.53,
                    'dewPoint':72.59,
                    'humidity':0.55,
                    'windSpeed':10.83,
                    'windBearing':171,
                    'visibility':10,
                    'cloudCover':0.49,
                    'pressure':1019.36,
                    'ozone':285.48
                },
                {
                    'time':now + (3600 * 45),
                    'summary':'Light Rain',
                    'icon':'rain',
                    'precipIntensity':0.0158,
                    'precipProbability':0.47,
                    'precipType':'rain',
                    'temperature':90.88,
                    'apparentTemperature':99.45,
                    'dewPoint':72.96,
                    'humidity':0.56,
                    'windSpeed':10.78,
                    'windBearing':169,
                    'visibility':10,
                    'cloudCover':0.59,
                    'pressure':1018.96,
                    'ozone':285.01
                },
                {
                    'time':now + (3600 * 46),
                    'summary':'Light Rain',
                    'icon':'rain',
                    'precipIntensity':0.0129,
                    'precipProbability':0.45,
                    'precipType':'rain',
                    'temperature':89.4,
                    'apparentTemperature':97.85,
                    'dewPoint':73.26,
                    'humidity':0.59,
                    'windSpeed':9.94,
                    'windBearing':167,
                    'visibility':10,
                    'cloudCover':0.67,
                    'pressure':1018.91,
                    'ozone':284.87
                },
                {
                    'time':now + (3600 * 47),
                    'summary':'Drizzle',
                    'icon':'rain',
                    'precipIntensity':0.0068,
                    'precipProbability':0.28,
                    'precipType':'rain',
                    'temperature':87.13,
                    'apparentTemperature':95,
                    'dewPoint':73.39,
                    'humidity':0.64,
                    'windSpeed':8.8,
                    'windBearing':163,
                    'visibility':10,
                    'cloudCover':0.74,
                    'pressure':1019.05,
                    'ozone':284.88
                },
                {
                    'time':now + (3600 * 48),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-day',
                    'precipIntensity':0.0021,
                    'precipProbability':0.05,
                    'precipType':'rain',
                    'temperature':84.89,
                    'apparentTemperature':91.89,
                    'dewPoint':73.32,
                    'humidity':0.68,
                    'windSpeed':8.02,
                    'windBearing':161,
                    'visibility':10,
                    'cloudCover':0.79,
                    'pressure':1019.21,
                    'ozone':284.89
                },
                {
                    'time':now + (3600 * 49),
                    'summary':'Mostly Cloudy',
                    'icon':'partly-cloudy-night',
                    'precipIntensity':0,
                    'precipProbability':0,
                    'temperature':83.5,
                    'apparentTemperature':90.15,
                    'dewPoint':73.69,
                    'humidity':0.72,
                    'windSpeed':7.9,
                    'windBearing':164,
                    'visibility':10,
                    'cloudCover':0.79,
                    'pressure':1019.46,
                    'ozone':284.87
                }
            ]
            */
        },
        'daily': {
            'summary':'Light rain tomorrow through Monday, with temperatures rising to 96°F on Saturday.',
            'icon':'rain',
            'data':[
                {
                    // some rain, not all day
                    'time':now,
                    'summary':'Partly cloudy until evening.',
                    'icon':'partly-cloudy-day',
                    'sunriseTime':1470651415,
                    'sunsetTime':1470701583,
                    'moonPhase':0.19,
                    'precipIntensity':0.0003,
                    'precipIntensityMax':0.0029,
                    'precipIntensityMaxTime':now,
                    'precipProbability':0.09,
                    'precipType':'rain',
                    'temperatureMin':68.17,
                    'temperatureMinTime':1470650400,
                    'temperatureMax':86.49,
                    'temperatureMaxTime':1470679200,
                    'apparentTemperatureMin':68.17,
                    'apparentTemperatureMinTime':1470650400,
                    'apparentTemperatureMax':89.4,
                    'apparentTemperatureMaxTime':1470679200,
                    'dewPoint':65.82,
                    'humidity':0.72,
                    'windSpeed':1.79,
                    'windBearing':205,
                    'visibility':9.88,
                    'cloudCover':0.32,
                    'pressure':1017.02,
                    'ozone':303.05
                },
                {
                    // heat / humidity
                    'time':now + (oneDay * 2),
                    'summary':'Light rain starting in the afternoon.',
                    'icon':'rain',
                    'sunriseTime':1470824326,
                    'sunsetTime':1470874240,
                    'moonPhase':0.25,
                    'precipIntensity':0.0037,
                    'precipIntensityMax':0.0158,
                    'precipIntensityMaxTime':now + oneDay,
                    'precipProbability':0.47,
                    'precipType':'rain',
                    'temperatureMin':74.62,
                    'temperatureMinTime':1470819600,
                    'temperatureMax':91.26,
                    'temperatureMaxTime':1470859200,
                    'apparentTemperatureMin':74.62,
                    'apparentTemperatureMinTime':1470819600,
                    'apparentTemperatureMax':99.53,
                    'apparentTemperatureMaxTime':1470859200,
                    'dewPoint':73.52,
                    'humidity':0.77,
                    'windSpeed':8.16,
                    'windBearing':169,
                    'visibility':10,
                    'cloudCover':0.7,
                    'pressure':1020.36,
                    'ozone':286.23
                },
                {
                    // rain
                    'time':now + oneDay,
                    'summary':'Rain in the morning.',
                    'icon':'rain',
                    'sunriseTime':1470737870,
                    'sunsetTime':1470787912,
                    'moonPhase':0.22,
                    'precipIntensity':0.0265,
                    'precipIntensityMax':0.0320,
                    'precipIntensityMaxTime':now + (oneDay * 2),
                    'precipProbability':0.31,
                    'precipType':'rain',
                    'temperatureMin':64.66,
                    'temperatureMinTime':1470729600,
                    'temperatureMax':84.69,
                    'temperatureMaxTime':1470772800,
                    'apparentTemperatureMin':64.66,
                    'apparentTemperatureMinTime':1470729600,
                    'apparentTemperatureMax':91.18,
                    'apparentTemperatureMaxTime':1470772800,
                    'dewPoint':68,
                    'humidity':0.78,
                    'windSpeed':4.94,
                    'windBearing':119,
                    'visibility':9.08,
                    'cloudCover':0.43,
                    'pressure':1020.9,
                    'ozone':294.86
                },
                {
                    // snow
                    'time':now + (oneDay * 3),
                    'summary':'Light rain throughout the day.',
                    'icon':'rain',
                    'sunriseTime':1470910781,
                    'sunsetTime':1470960567,
                    'moonPhase':0.28,
                    'precipIntensity':0.0098,
                    'precipIntensityMax':0.0208,
                    'precipIntensityMaxTime':now + (oneDay * 4),
                    'precipProbability':0.49,
                    'precipType':'rain',
                    'temperatureMin':75.44,
                    'temperatureMinTime':1470909600,
                    'temperatureMax':92.97,
                    'temperatureMaxTime':1470942000,
                    'apparentTemperatureMin':75.44,
                    'apparentTemperatureMinTime':1470909600,
                    'apparentTemperatureMax':105.53,
                    'apparentTemperatureMaxTime':1470942000,
                    'dewPoint':74.64,
                    'humidity':0.76,
                    'windSpeed':8.01,
                    'windBearing':191,
                    'visibility':9.99,
                    'cloudCover':0.52,
                    'pressure':1018.27,
                    'ozone':279.17
                },
                {
                    // sleet
                    'time':now + (oneDay * 4),
                    'summary':'Rain starting in the afternoon.',
                    'icon':'rain',
                    'sunriseTime':1470997236,
                    'sunsetTime':1471046893,
                    'moonPhase':0.31,
                    'precipIntensity':0.0183,
                    'precipIntensityMax':0.0687,
                    'precipIntensityMaxTime':now + (oneDay * 5),
                    'precipProbability':0.6,
                    'precipType':'rain',
                    'temperatureMin':78.59,
                    'temperatureMinTime':1470996000,
                    'temperatureMax':94.39,
                    'temperatureMaxTime':1471028400,
                    'apparentTemperatureMin':78.59,
                    'apparentTemperatureMinTime':1470996000,
                    'apparentTemperatureMax':108.47,
                    'apparentTemperatureMaxTime':1471028400,
                    'dewPoint':75.98,
                    'humidity':0.76,
                    'windSpeed':7.74,
                    'windBearing':215,
                    'visibility':10,
                    'cloudCover':0.49,
                    'pressure':1013.42,
                    'ozone':273.65
                },
                {
                    // cold  / wind
                    'time':now + (oneDay * 5),
                    'summary':'Light rain starting in the afternoon.',
                    'icon':'rain',
                    'sunriseTime':1471083692,
                    'sunsetTime':1471133218,
                    'moonPhase':0.34,
                    'precipIntensity':0.007,
                    'precipIntensityMax':0.0246,
                    'precipIntensityMaxTime':now + (oneDay * 6),
                    'precipProbability':0.51,
                    'precipType':'rain',
                    'temperatureMin':77.99,
                    'temperatureMinTime':1471078800,
                    'temperatureMax':95.7,
                    'temperatureMaxTime':1471118400,
                    'apparentTemperatureMin':77.99,
                    'apparentTemperatureMinTime':1471078800,
                    'apparentTemperatureMax':110.51,
                    'apparentTemperatureMaxTime':1471118400,
                    'dewPoint':76.06,
                    'humidity':0.75,
                    'windSpeed':6.84,
                    'windBearing':230,
                    'cloudCover':0.75,
                    'pressure':1011.79,
                    'ozone':274.86
                },
                {
                    // clouds
                    'time':now + (oneDay * 6),
                    'summary':'Rain starting in the afternoon.',
                    'icon':'rain',
                    'sunriseTime':1471170147,
                    'sunsetTime':1471219541,
                    'moonPhase':0.37,
                    'precipIntensity':0.0231,
                    'precipIntensityMax':0.0938,
                    'precipIntensityMaxTime':now + (oneDay * 7),
                    'precipProbability':0.63,
                    'precipType':'rain',
                    'temperatureMin':75.57,
                    'temperatureMinTime':1471165200,
                    'temperatureMax':88.06,
                    'temperatureMaxTime':1471197600,
                    'apparentTemperatureMin':75.57,
                    'apparentTemperatureMinTime':1471165200,
                    'apparentTemperatureMax':98.02,
                    'apparentTemperatureMaxTime':1471197600,
                    'dewPoint':75.4,
                    'humidity':0.83,
                    'windSpeed':4.65,
                    'windBearing':239,
                    'cloudCover':0.98,
                    'pressure':1013.71,
                    'ozone':275.76
                },
                {
                    // wind
                    'time':now + (oneDay * 7),
                    'summary':'Light rain in the morning and afternoon.',
                    'icon':'rain',
                    'sunriseTime':1471256602,
                    'sunsetTime':1471305863,
                    'moonPhase':0.4,
                    'precipIntensity':0.0211,
                    'precipIntensityMax':0.0527,
                    'precipIntensityMaxTime':now + (oneDay * 8),
                    'precipProbability':0.58,
                    'precipType':'rain',
                    'temperatureMin':74.82,
                    'temperatureMinTime':1471316400,
                    'temperatureMax':87.8,
                    'temperatureMaxTime':1471284000,
                    'apparentTemperatureMin':74.82,
                    'apparentTemperatureMinTime':1471316400,
                    'apparentTemperatureMax':97.44,
                    'apparentTemperatureMaxTime':1471284000,
                    'dewPoint':74.96,
                    'humidity':0.84,
                    'windSpeed':3,
                    'windBearing':281,
                    'cloudCover':0.93,
                    'pressure':1015.09,
                    'ozone':277.43
                }
            ]
        },
        // 'alerts': [
        //     {
        //         'title': 'Red Flag Warning for Oklahoma, OK',
        //         'time': now - (60 * 60),  // start time of the alert
        //         'expires': now + (60 * 60 * 4),
        //         'description': '... EXCESSIVELY LONG DESCRIPTION ...',
        //         'uri': 'https://alerts.weather.gov/cap/wwacapget.php?x=[ALERT_ID]'
        //     }
        // ],
        'flags': {
            'sources':[
                'darksky',
                'lamp',
                'gfs',
                'cmc',
                'nam',
                'rap',
                'rtma',
                'sref',
                'fnmoc',
                'isd',
                'nwspa',
                'madis',
                'nearest-precip'
            ],
            'darksky-stations':[
                'KLWX'
            ],
            'lamp-stations':[
                'KADW',
                'KBWI',
                'KCGS',
                'KDAA',
                'KDCA',
                'KDMH',
                'KFDK',
                'KFME',
                'KHEF',
                'KIAD',
                'KJYO',
                'KNAK',
                'KNYG'
            ],
            'isd-stations':[
                '722244-99999',
                '724050-13743',
                '997314-99999',
                '999999-13751',
                '999999-93725'
            ],
            'madis-stations':[
                'AS365',
                'AU722',
                'C3648',
                'C9346',
                'D1357',
                'D4441',
                'D6279',
                'D8016',
                'D9421',
                'E2809',
                'E3336',
                'E5309',
                'E8552',
                'KCGS',
                'KDCA',
                'WASD2'
            ],
            'units':'us'
        }
    };

    return baseData;
}
