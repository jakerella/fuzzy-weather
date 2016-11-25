'use strict';

let debug = require('debug')('fuzzy-weather:rain');

module.exports = getRainText;

/**
 * Get text for rainy day
 * @param  {Object} condition The condition info: topic: { snow, probability, level }
 * @param  {Object} data      The weather data from the API
 * @return {String}           The text to use for rain information given the data provided
 */
function getRainText(condition, data) {
    debug('getting rain text if prob is up:', data.precipProbability);

    if (data.precipProbability < 0.1) {
        return '';
    }

    let peak = new Date(data.precipIntensityMaxTime * 1000);
    peak = peak.getHours() + (peak.getTimezoneOffset() / 60);
    peak = (peak > 12) ? ((peak - 12) + ' pm') : (peak + 'am');

    // TODO:
    // * base text on level
    // * create array of possible phrases

    return `You should expect ${getPrecipIntensityText(data.precipIntensityMax, data.precipType)} \
peaking at around ${peak}. There is a ${(data.precipProbability * 100)} percent chance overall.`;
}

getRainText.headline = function headline() {
    return [
        `Don't forget your umbrella {day}!`,
        `Remember the umbrella {day}.`,
        `Prepare for some wet weather {day}.`,
        `It's going to be wet {day}.`,
        `You'll need the umbrella {day}.`
    ].sample();
};

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
