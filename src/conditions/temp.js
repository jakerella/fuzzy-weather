'use strict';

let debug = require('debug')('fuzzy-weather:temp'),
    debugOut = require('debug')('fuzzy-weather:temp:output'),
    moment = require('moment-timezone'),
    lsq = require('least-squares');
require('../array-util');

module.exports = {
    summary: getSummary,
    detail: getDetail
};

function getSummary(timezone, dailyData, hourlyData) {
    let text = [];

    if (!dailyData && !hourlyData) {
        return '';
    }
    if (!hourlyData) {
        return simpleSummary(timezone, dailyData);
    }


    let xValues = [];
    let yValues = [];
    let maxTemp = -100;
    let maxHour = 0;
    let minTemp = 200;
    let minHour = 23;

    let dailyMaxTime = moment.tz(dailyData.temperatureMaxTime * 1000, 'GMT').tz(timezone);
    let dailyMinTime = moment.tz(dailyData.temperatureMinTime * 1000, 'GMT').tz(timezone);

    hourlyData.forEach(function determineInstances(hourData, i) {
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

    debug(`max/min: ${minTemp} at ${dailyMinTime.format('H')} / ${maxTemp} at ${dailyMaxTime.format('H')}`);

    if (xValues.length) {
        // TODO...
        // Using linear regression on this temp data does not appear to be giving
        // good results, especially when the requested time (hour) is later in the
        // day. For now, I'm going to manually look at peak hours and try to
        // determine if this is a typical temp curve day or not.

        let maxHours = moment.tz(hourlyData[0].time * 1000, 'GMT').tz(timezone);
        maxHours.add(maxHour, 'h');
        let minHours = moment.tz(hourlyData[0].time * 1000, 'GMT').tz(timezone);
        minHours.add(minHour, 'h');

        if (dailyMaxTime.format('H') > 17) {
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

        } else if (dailyMaxTime.format('H') < 12) {
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


function simpleSummary(timezone, data) {
    let output;

    debug('no hourly data, only getting general daily summary');

    let low = moment.tz(data.temperatureMinTime * 1000, 'GMT').tz(timezone);
    let peak = moment.tz(data.temperatureMaxTime * 1000, 'GMT').tz(timezone);

    if (peak.format('H') < 12) {
        output =
`Temperatures will be heading down {day}. The high of ${Math.round(data.temperatureMax)} degrees will be at
${peak.format('h a')} and temps will get down to ${Math.round(data.temperatureMin)} at ${low.format('h a')}.`;

    } else if (peak.format('H') > 17) {
        output =
`Temperatures will increase throughout the day {day}. The low will be ${Math.round(data.temperatureMin)}
degrees at ${low.format('h a')} and rise to ${Math.round(data.temperatureMax)} at ${peak.format('h a')}.`;

    } else {
        output =
`The low {day} will be ${Math.round(data.temperatureMin)} degrees at around ${low.format('h a')}. You should expect a
high of ${Math.round(data.temperatureMax)} degrees around ${peak.format('h a')}.`;
    }

    debugOut(output);
    return output;
}


function getDetail(data, timezone, dailyData) {
    // TODO: more detailed temp info for the days...
    return 'temps';
}
