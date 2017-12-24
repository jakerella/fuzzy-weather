'use strict';

let debug = require('debug')('fuzzy-weather:temp'),
    debugOut = require('debug')('fuzzy-weather:temp:output'),
    moment = require('moment-timezone'),
    lsq = require('least-squares');
require('../array-util');

module.exports = {
    headline: function() { return 'There\'s gonna be some temperatures.'; },
    dailyText: getDailyText,
    hourlyText: getHourlyText
};


/**
 * Get text for temperature on a given day
 * @param  {Object} condition The condition info: topic: { snow, probability, level }
 * @param  {Object} data      The weather data from the API
 * @param  {String} timezone  The timezone for weather data
 * @return {String}           The text to use for temp information given the data provided
 */
function getDailyText(condition, data, timezone) {
    debug('getting daily temps...');

    if (data.precipProbability < 0.1) {
        return '';
    }

    let peak = moment.tz(data.temperatureMaxTime * 1000, 'GMT').tz(timezone);

    let output =
`The low {day} is ${Math.round(data.temperatureMin)} degrees. You should expect a
high of ${Math.round(data.temperatureMax)} degrees peaking around ${peak.format('ha')}.`;
    debugOut(output);
    return output;
}

function getHourlyText(data, timezone, dailyData) {
    let text = [];

    let xValues = [];
    let yValues = [];
    let maxTemp = -100;
    let maxHour = 0;
    let minTemp = 200;
    let minHour = 23;

    let dailyMaxTime = moment.tz(dailyData.temperatureMaxTime * 1000, 'GMT').tz(timezone);
    let dailyMinTime = moment.tz(dailyData.temperatureMinTime * 1000, 'GMT').tz(timezone);

    debug('max/min', dailyMinTime.format('h'), dailyMaxTime.format('h'));

    data.forEach(function determineInstances(hourData, i) {
        let hour = moment.tz(hourData.time * 1000, 'GMT').tz(timezone);
        xValues.push(hour.hours());
        yValues.push(hourData.temperature);

        if (hourData.temperature > maxTemp) {
            maxHour = i;
            maxTemp = hourData.temperature;
        }
        if (hourData.temperature < minTemp) {
            minHour = i;
            minTemp = hourData.temperature;
        }
    });

    if (xValues.length) {
        // TODO...
        // Using linear regression on this temp data does not appear to be giving
        // good results, especially when the requested time (hour) is later in the
        // day. For now, I'm going to manually look at peak hours and try to
        // determine if this is a typical temp curve day or not.

        let maxHours = moment.tz(data[0].time * 1000, 'GMT').tz(timezone);
        maxHours.add(maxHour, 'h');
        let minHours = moment.tz(data[0].time * 1000, 'GMT').tz(timezone);
        minHours.add(minHour, 'h');

        if (dailyMaxTime.format('h') > 17) {
            text.push(
`The temperature is currently ${Math.round(yValues[0])} degrees and {day} it will be climbing
through the evening, peaking at about ${Math.round(maxTemp)} degrees around ${maxHours.format('h a')}.`
            );

            if (xValues[0] < 17) {
                xValues.forEach(function findSixPM(hour, i) {
                    if (Number(hour) === 17) {
                        text.push(`It'll be about ${Math.round(yValues[i])} at the end of the work day`);
                    }
                });
            }

        } else if (dailyMaxTime.format('h') < 12) {
            text.push(
`The temperature is currently ${Math.round(yValues[0])} degrees, but temps will be heading
down through {day}, it'll get down to about ${Math.round(minTemp)} degrees at ${minHours.format('h a')}.`
            );

            if (xValues[0] < 17) {
                xValues.forEach(function findCommuteTime(hour, i) {
                    if (Number(hour) === 17) {
                        text.push(`It'll be about ${Math.round(yValues[i])} at the end of the work day`);
                    }
                });
            }

        } else {
            text.push(
`It's currently ${Math.round(yValues[0])} degrees outside. You'll see a high of about
${Math.round(maxTemp)} degrees around ${maxHours.format('h a')}.`
            );

            if (xValues[0] < 17) {
                xValues.forEach(function findSixPM(hour, i) {
                    if (Number(hour) === 17) {
                        text.push(`It'll be about ${Math.round(yValues[i])} at the end of the work day`);
                    }
                });
            }
        }
    }

    debugOut(text.join(' ').replace(/\n/g, ' '));
    return text.join(' ').replace(/\n/g, ' ');
}
