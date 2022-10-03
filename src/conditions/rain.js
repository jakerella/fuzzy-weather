const debug = require('debug')('fuzzy-weather:rain'),
    debugOut = require('debug')('fuzzy-weather:rain:output'),
    moment = require('moment-timezone'),
    lsq = require('least-squares'),
    sample = require('../util').sample,
    conditionMap = require('./condition-codes.json'),
    rankConditions = require('./rank').rankConditions

module.exports = {
    headline: getHeadline,
    dailyText: getDailyText,
    hourlyText: getHourlyText
}


function getHeadline() {
    return sample([
        `Don't forget your umbrella {day}!`,
        `Remember the umbrella {day}.`,
        `Prepare for some wet weather {day}.`,
        `It's going to be wet {day}.`,
        `You'll need the umbrella {day}.`
    ])
}


/**
 * Get text for rainy day
 * @param  {Object} condition The condition info
 * @param  {Object} data      The weather data from the API
 * @param  {String} timezone  The timezone for weather data
 * @param  {String} o         The options used for the original weather call
 * @return {String}           The text to use for rain information given the data provided
 */
function getDailyText(condition, data, timezone, o) {
    debug('getting rain text for daily:', condition)

    if (!condition || !condition.code) {
        return ''
    }

    if (!conditionMap[condition.code]) {
        debug('Unable to find code in condition map:', condition)
        return ''
    }

    // TODO:
    // * base text on level
    // * create array of possible phrases

    let output = `You should expect ${conditionMap[condition.code].description}. There is a ${Math.round(condition.probability * 100)} percent chance overall.`
    debugOut(output)
    return output
}


function getHourlyText(data, timezone, daily, o) {
    let text = []
    let strongInstances = []
    let holdInstance = null

    let xValues = []
    let yValues = []

    data.forEach((hourData) => {
        let hour = moment.tz(hourData.dt * 1000, 'GMT').tz(timezone)

        // Track X and Y values to do linear regression later...
        if (hourData.pop > 0.05) {
            xValues.push(hour.hours())
            yValues.push(hourData.pop)
        }

        const condition = rankConditions(o, hourData, 'rain')[0]
        if (!condition || condition.topic !== 'rain') {
            debug('no rain condition at this hour', hourData.dt, hourData.rain, hourData.pop)
            return
        }

        // Track good rain chances through the day...
        if (condition.probability > 0.3 && condition.level > 1) {
            // there's some rain this hour...
            if (holdInstance === null) {
                // we need a new rain instance
                holdInstance = {
                    startTime: hourData.dt,
                    startHour: hour.format('ha'),
                    startPercent: condition.probability,
                    length: 1,
                    maxPrecipProbability: condition.probability,
                    maxPrecipProbabilityTime: hourData.dt,
                    maxPrecipProbabilityHour: hour.format('ha'),
                    maxIntensity: condition.level,
                    maxIntensityTime: hourData.dt,
                    maxIntensityHour: hour.format('ha')
                }
            } else {
                // add to existing instance
                holdInstance.length++ 
                if (condition.level >= holdInstance.maxIntensity) {
                    holdInstance.maxIntensity = condition.level
                    holdInstance.maxIntensityTime = hourData.dt
                    holdInstance.maxIntensityHour = hour.format('ha')
                }
                if (condition.probability >= holdInstance.maxPrecipProbability) {
                    holdInstance.maxPrecipProbability = condition.probability
                    holdInstance.maxPrecipProbabilityTime = hourData.dt
                    holdInstance.maxPrecipProbabilityHour = hour.format('ha')
                }
            }
        } else if (holdInstance) {
            // No rain this hour, but we have a previous rain instance!
            strongInstances.push(holdInstance)
            holdInstance = null
        }
    })

    if (holdInstance) {
        // leftover strong instance at the end of the day?
        strongInstances.push(holdInstance)
        holdInstance = null
    }

    if (xValues.length) {
        // Use linear regression (least squares) to determine if rain
        // chances increase or decrease through the day. Check the fit of the
        // line to ensure correlation is strong enough in either direction
        let regrData = {}
        let regr = lsq(xValues, yValues, true, regrData)
        let xMin = xValues[0]
        let xMax = xValues[xValues.length-1]
        debug(regr(xMin), regr(xMax), regrData)
        if (regrData.bErr < 0.05 && regrData.mErr < 0.005) {
            if (regr(xMin) < regr(xMax) && (regr(xMax) - regr(xMin)) > 0.4) {
                text.push('There is an increasing rain chance through {day}.')
            } else if (regr(xMin) > regr(xMax) && (regr(xMin) - regr(xMax)) > 0.4) {
                text.push('Rain chances decrease through {day}.')
            } else if (Math.abs(regr(xMin) - regr(xMax)) < 0.3) {
                let hours = moment.tz(data[0].dt * 1000, 'GMT').tz(timezone)
                hours.add(xValues[xMin], 'h')
                let evenText = `Chances for rain are pretty steady from about ${hours.format('ha')} through`
                hours.add(xValues.length, 'h')
                evenText += ` ${hours.format('ha')}.`
                text.push(evenText)
            }
        }
    }

    if (strongInstances.length) {
        debug('strong rain instances', strongInstances)

        if (strongInstances.length > 1) {
            text.push(`It looks like there will be multiple rain chances {day}.`)
        }

        let holdMaxIntensity = null
        strongInstances.forEach(function addInstance(instance, i) {
            let description

            if (i > 0) {
                description =
`There's another chance beginning about ${instance.startHour}
peaking at ${instance.maxPrecipProbabilityHour} with a
${Math.round(instance.maxPrecipProbability * 100)} percent chance.`
            } else {
                description =
`Chances are good for rain starting about ${instance.startHour} with a
${Math.round(instance.startPercent * 100)} percent chance`
                if (instance.startHour === instance.maxPrecipProbabilityHour ||
                    instance.startPercent === instance.maxPrecipProbability) {
                    description += '.'
                } else {
                    description +=
` rising to
${Math.round(instance.maxPrecipProbability * 100)} percent at
${instance.maxPrecipProbabilityHour}.`
                }
            }
            if (!holdMaxIntensity || instance.maxIntensity > holdMaxIntensity.value) {
                holdMaxIntensity = {
                    value: instance.maxIntensity,
                    hour: instance.maxIntensityHour
                }
            }
            text.push(description)
        })
        text.push(`The heaviest rain should be around ${holdMaxIntensity.hour}.`)
    }

    debugOut(text.join(' ').replace(/\s{2,}/g, ' '))
    return text.join(' ').replace(/\s{2,}/g, ' ')
}
