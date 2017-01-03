'use strict';

let debug = require('debug')('fuzzy-weather:rain'),
    debugOut = require('debug')('fuzzy-weather:rain:output'),
    moment = require('moment-timezone'),
    lsq = require('least-squares');
require('../array-util');

module.exports = {
    headline: getHeadline,
    dailyText: getDailyText,
    hourlyText: getHourlyText
};


function getHeadline() {
    return [
        `Don't forget your umbrella {day}!`,
        `Remember the umbrella {day}.`,
        `Prepare for some wet weather {day}.`,
        `It's going to be wet {day}.`,
        `You'll need the umbrella {day}.`
    ].sample();
}


/**
 * Get text for rainy day
 * @param  {Object} condition The condition info: topic: { snow, probability, level }
 * @param  {Object} data      The weather data from the API
 * @param  {String} timezone  The timezone for weather data
 * @return {String}           The text to use for rain information given the data provided
 */
function getDailyText(condition, data, timezone) {
    debug('getting rain text if prob is up:', data.precipProbability);

    if (data.precipProbability < 0.1) {
        return '';
    }

    let peak = moment.tz(data.precipIntensityMaxTime * 1000, 'GMT').tz(timezone);

    // TODO:
    // * base text on level
    // * create array of possible phrases

    let output =
        `You should expect ${getPrecipIntensityText(data.precipIntensityMax, data.precipType)} peaking at around ${peak.format('ha')}.
        There is a ${Math.round(data.precipProbability * 100)} percent chance overall.`;
    debugOut(output);
    return output;
}


function getHourlyText(data, timezone) {
    let text = [];
    let strongInstances = [];
    let holdInstance = null;

    let xValues = [];
    let yValues = [];

    data.forEach(function determineInstances(hourData) {
        let hour = moment.tz(hourData.time * 1000, 'GMT').tz(timezone);

        // Track X and Y values to do linear regression later...
        if (hourData.precipProbability > 0.05) {
            xValues.push(hour.hours());
            yValues.push(hourData.precipProbability);
        }

        if (hourData.precipType !== 'rain') { return; }

        // Track any "strong" instances through the day...
        if (hourData.precipProbability > 0.33 && hourData.precipIntensity > 0.03) {
            // there's some rain this hour...
            if (holdInstance === null) {
                // we need a new rain instance
                holdInstance = {
                    startTime: hourData.time,
                    startHour: hour.format('ha'),
                    startPercent: hourData.precipProbability,
                    length: 1,
                    maxPrecipProbability: hourData.precipProbability,
                    maxPrecipProbabilityTime: hourData.time,
                    maxPrecipProbabilityHour: hour.format('ha'),
                    maxIntensity: hourData.precipIntensity,
                    maxIntensityTime: hourData.time,
                    maxIntensityHour: hour.format('ha')
                };
            } else {
                // add to existing instance
                holdInstance.length++;
                if (hourData.precipIntensity >= holdInstance.maxIntensity) {
                    holdInstance.maxIntensity = hourData.precipIntensity;
                    holdInstance.maxIntensityTime = hourData.time;
                    holdInstance.maxIntensityHour = hour.format('ha');
                }
                if (hourData.precipProbability >= holdInstance.maxPrecipProbability) {
                    holdInstance.maxPrecipProbability = hourData.precipProbability;
                    holdInstance.maxPrecipProbabilityTime = hourData.time;
                    holdInstance.maxPrecipProbabilityHour = hour.format('ha');
                }
            }
        } else if (holdInstance) {
            // No rain this hour, but we have a previous rain instance!
            strongInstances.push(holdInstance);
            holdInstance = null;
        }
    });

    if (holdInstance) {
        // leftover strong instance at the end of the day?
        strongInstances.push(holdInstance);
        holdInstance = null;
    }

    if (xValues.length) {
        // Use linear regression (least squares) to determine if rain
        // chances increase or decrease through the day. Check the fit of the
        // line to ensure correlation is strong enough in either direction
        let regrData = {};
        let regr = lsq(xValues, yValues, true, regrData);
        let xMin = xValues[0];
        let xMax = xValues[xValues.length-1];
        debug(regr(xMin), regr(xMax), regrData);
        if (regrData.bErr < 0.05 && regrData.mErr < 0.005) {
            if (regr(xMin) < regr(xMax) && (regr(xMax) - regr(xMin)) > 0.4) {
                text.push('There is an increasing rain chance through {day}.');
            } else if (regr(xMin) > regr(xMax) && (regr(xMin) - regr(xMax)) > 0.4) {
                text.push('Rain chances decrease through {day}.');
            } else if (Math.abs(regr(xMin) - regr(xMax)) < 0.3) {
                let hours = moment.tz(data[0].time * 1000, 'GMT').tz(timezone);
                hours.add(xValues[xMin], 'h');
                let evenText = `Chances for rain are pretty steady from about ${hours.format('ha')} through`;
                hours.add(xValues.length, 'h');
                evenText += ` ${hours.format('ha')}.`;
                text.push(evenText);
            }
        }
    }

    if (strongInstances.length) {
        debug('strong rain instances', strongInstances);

        if (strongInstances.length > 1) {
            text.push(`It looks like there will be multiple rain chances {day}.`);
        }

        let holdMaxIntensity = null;
        strongInstances.forEach(function addInstance(instance, i) {
            let description;

            // ${getPrecipIntensityText(data.precipIntensityMax, data.precipType)}

            if (i > 0) {
                description =
                    `There's another chance beginning about ${instance.startHour}
                    peaking at ${instance.maxPrecipProbabilityHour} with a
                    ${Math.round(instance.maxPrecipProbability * 100)} percent chance.`;
            } else {
                description =
                    `Chances are good for rain starting about ${instance.startHour} with a
                    ${Math.round(instance.startPercent * 100)} percent chance`;
                if (instance.startHour === instance.maxPrecipProbabilityHour ||
                    instance.startPercent === instance.maxPrecipProbability) {
                    description += '.';
                } else {
                    description +=
                        ` rising to
                        ${Math.round(instance.maxPrecipProbability * 100)} percent at
                        ${instance.maxPrecipProbabilityHour}.`;
                }
            }
            if (!holdMaxIntensity || instance.maxIntensity > holdMaxIntensity.value) {
                holdMaxIntensity = {
                    value: instance.maxIntensity,
                    hour: instance.maxIntensityHour
                };
            }
            text.push(description);
        });
        text.push(`The heaviest bit should be around ${holdMaxIntensity.hour}.`);
    }

    debugOut(text.join(' ').replace(/\s{2,}/g, ' '));
    return text.join(' ').replace(/\s{2,}/g, ' ');
}


function getPrecipIntensityText(intensity, type) {
    let intensityText = 'no';
    if (intensity > 0.7) {
        intensityText = 'extremely heavy';
    } else if (intensity > 0.2) {
        intensityText = 'heavy';
    } else if (intensity > 0.07) {
        intensityText = 'moderate';
    } else if (intensity > 0.01) {
        intensityText = 'light';
    } else if (intensity > 0) {
        intensityText = 'drizzling';
    }
    return intensityText + ' ' + type;
}
