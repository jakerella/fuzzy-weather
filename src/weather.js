const debug = require('debug')('fuzzy-weather'),
    debugCurrently = require('debug')('fuzzy-weather:currently'),
    debugHourly = require('debug')('fuzzy-weather:hourly'),
    debugDaily = require('debug')('fuzzy-weather:daily'),
    _ = require('lodash'),
    fetch = require('node-fetch'),
    moment = require('moment-timezone'),
    tempModule = require('./conditions/temperature'),
    conditionMap = require('./conditions/condition-codes.json'),
    rankConditions = require('./conditions/rank').rankConditions

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
    windBreak: 5,
    cloudBreak: 0.65,
    highTempBreak: 95,
    lowTempBreak: 32,
    nightTempBreak: 15,
    __dataOverride: null   // @TODO: implement me
}

module.exports = function(options = {}) {
    let o = {}
    _.merge(o, OPTIONS, options)
    debug('Setting up new fuzzy-weather with options:', o)
    return getWeatherForDate

    /**
     * The publicly available function for getting weather for a given date.
     *
     * @param  {String|Number} requestedDate Anything that can be passed into new Date() (OPTIONAL, will use current date otherwise)
     * @return {Promise}                     Will resolve (hopefully) with an object containing the weather report:
     *                                         {
     *                                           date: Date,
     *                                           currently: Object,    // will be `null` if date is not current day
     *                                           dailySummary: Object,
     *                                           detail: Object        // will be `null` if the date is not within 48 hours
     *                                         }
     *                                       Note that the Object for each section above will always contain:
     *                                         {
     *                                           data: Object,       // Direct from the weather API
     *                                           conditions: Object, // key / readable text (i.e. "heat": "it'll be scorcher tomorrow")
     *                                                               // These "conditions" will only be present when necessary (like it's really hot)
     *                                           forecast: String    // suitable for voice output
     *                                         }
     *                                       May also reject with an {Error}
     */
    function getWeatherForDate(requestedDate) {
        return new Promise(async (resolve, reject) => {
            debug('Getting weather for %s', requestedDate)

            if (!o.apiKey) {
                debug('API key?', o.apiKey)
                return reject(new Error('No API key provided'))
            }

            if (!o.location || !o.location.lat || !o.location.lng ||
                typeof(o.location.lat) !== 'number' || typeof(o.location.lng) !== 'number'
            ) {
                debug('lat/lng?', o.location.lat, o.location.lng)
                return reject(new Error('Lattitude and longitude must be provided and be numeric'))
            }

            let now = new Date()
            let todaySimple = moment(now).format('YYYY-MM-DD')

            // No date? no problem! Just get today's weather.
            if (!requestedDate) {
                requestedDate = now.getTime()
            }

            let reqDateObj = new Date(requestedDate)
            if (!reqDateObj.getTime()) {
                return reject(new Error('Please provide a valid date to check the weather for!'))
            }
            reqDateObj.setHours(0)
            let simpleDate = moment(reqDateObj).format('YYYY-MM-DD')

            if (simpleDate < todaySimple) {
                return reject(new Error(`Unable to get weather foreacast for date in the past (${simpleDate})`))
            } else if (reqDateObj.getTime() > (now.getTime() + (86400000 * 7))) {
                return reject(new Error(`Only able to get weather for dates within 7 days of now (${simpleDate})`))
            }

            const resp = await fetch(
                `https://api.openweathermap.org/data/3.0/onecall?appid=${o.apiKey}&units=imperial&lat=${o.location.lat}&lon=${o.location.lng}`
            )
            if (!resp.ok) {
                const data = await resp.text()
                debug('Non-2XX status code from weather API:', resp.status, data)
                return reject(new Error(`There was a problem getting weather data (${resp.status})`))
            }

            let data
            try {
                data = await resp.json()
            } catch (err) {
                debug('Invalid JSON data from weather API:', err)
                return reject(new Error(`The API did not return valid data: ${err.message}`))
            }

            debug('Got raw data from API with %d hourly entries and %d daily entries', data.hourly.length, data.daily.length)

            resolve({
                currently: getCurrentConditions(o, data, reqDateObj),
                dailySummary: getDailySummary(o, data, reqDateObj),
                detail: getDetail(o, data, reqDateObj),
                date: reqDateObj
            })
        })
    }
}

/**
* Build the text for the daily summary weather report for the given date
*
* @param  {Object} o      The options for this instance of fuzzy weather
* @param  {Object} data   The data returned from the weather API
* @param  {Date} reqDate  The date of the request
* @return {Object}        The daily summary text of the forecast { data, conditions, forecast }
 */
function getDailySummary(o, data, reqDate) {
    let simpleDate = moment(reqDate).format('YYYY-MM-DD')
    let info = {
        data: null,
        conditions: {},
        forecast: null
    }

    debugDaily(`getting daily summary for ${simpleDate}`)

    data.daily.forEach(function(dailyData) {
        if (moment(dailyData.dt * 1000).format('YYYY-MM-DD') === simpleDate) {
            dailyData.type = 'daily'
            let day = getDayOfWeek(reqDate, true)

            info.data = dailyData
            let text = rankConditions(o, dailyData)
                .map(function(condition, i) {
                    let conditionMod,
                        condText,
                        text = []

                    debugDaily('getting text for condition:', condition)

                    try {
                        conditionMod = require('./conditions/' + condition.topic)
                    } catch(err) {
                        debugDaily('No condition module for %s', condition.topic)
                    }

                    if (!conditionMod) { return '' }

                    if (i === 0) {
                        text.push(render(conditionMod.headline(), {
                            day: day
                        }))
                    }
                    condText = conditionMod.dailyText(condition, dailyData, data.timezone, o)
                    info.conditions[condition.topic] = condText
                    text.push(render(condText, {
                        day: day
                    }))
                    return text.join(' ')
                })
                .filter(function(piece) { return piece.trim().length })

            let hour = moment(dailyData.dt * 1000).format('h')
            if (!text.length && day === 'today' && hour > 10) {
                text.push('The rest of today will be pretty quiet weather wise,')
            } else if (!text.length) {
                text.push(render(`{day} will be pretty quiet weather wise,`, { day }))
            }


            let refinedData = getHourByHourData(data, reqDate)
            text.push(render(tempModule.summary(data.timezone, dailyData, (refinedData && refinedData.hourly)), {
                day: day
            }))

            info.forecast = text.join(' ').replace(/\n/g, ' ')
        }
    });

    return info
}


/**
 * Build the text for the hour-by-hour (ish) weather report for the given date
 *
 * @param  {Object} o      The options for this instance of fuzzy weather
 * @param  {Object} data   The data returned from the weather API
 * @param  {Date} reqDate  The date of the request
 * @return {Object|null}   The hour-by-hour text of the forecast (null if not today or tomorrow)  { data, conditions, forecast }
 */
function getDetail(o, data, reqDate) {
    let info = {
        data: null,
        conditions: {},
        forecast: null
    }

    let refinedData = getHourByHourData(data, reqDate)
    if (!refinedData) { return null }
    info.data = refinedData.hourly

    let simpleDate = moment(reqDate).format('YYYY-MM-DD')
    debugHourly(`getting hour-by-hour summary for ${simpleDate}`)

    let text = []
    let conditions = rankConditions(o, refinedData.daily)

    let dailyData = {}
    data.daily.forEach((singleDayData) => {
        if (moment(singleDayData.dt * 1000).format('YYYY-MM-DD') === simpleDate) {
            dailyData = singleDayData
            singleDayData.type = 'daily'
        }
    })

    text.push(tempModule.summary(data.timezone, dailyData, refinedData.hourly))

    conditions.forEach((condition) => {
        try {
            
            debugHourly('loading condition module for %s', condition.topic)
            let conditionMod = require('./conditions/' + condition.topic)
            text.push(conditionMod.hourlyText(refinedData.hourly, data.timezone, dailyData, o))
            info.conditions[condition.topic] = conditionMod.dailyText(condition, dailyData, data.timezone, o)

        } catch(err) {
            debugHourly('Cannot get conditions from module for %s:', condition.topic, err.message)
        }
    })

    info.forecast = render(text.join(' ').replace(/\n/g, ' '), {
        day: getDayOfWeek(reqDate, true)
    })

    return info
}


function getHourByHourData(data, reqDate) {
    let refinedData = null
    let now = new Date()
    let simpleDate = moment(reqDate).format('YYYY-MM-DD')
    let todaySimple = moment(now).format('YYYY-MM-DD')
    let tomorrowSimple = moment(now).add(1, 'd').format('YYYY-MM-DD')

    if (todaySimple === simpleDate || tomorrowSimple === simpleDate) {
        let hourStart = 0
        let hourEnd = 0
        let dailyIndex = 0

        // determine what data applies to the requested day
        if (todaySimple === simpleDate) {
            for (let i=0; i<24; ++i) {
                if (moment(data.hourly[i].dt * 1000).format('YYYY-MM-DD') !== simpleDate) {
                    hourEnd = i
                    break
                }
            }
        } else {
            // If it isn't today, it's tomorrow
            dailyIndex = 1
            for (let i=0; i<49; ++i) {
                if (!hourStart && moment(data.hourly[i].dt * 1000).format('YYYY-MM-DD') === simpleDate) {
                    hourStart = i
                } else if (hourStart && moment(data.hourly[i].dt * 1000).format('YYYY-MM-DD') !== simpleDate) {
                    hourEnd = i
                    break
                }
            }
            hourEnd = hourEnd || 49
        }

        refinedData = {
            hourly: data.hourly.slice(hourStart, hourEnd),
            daily: data.daily[dailyIndex]
        }
    }

    return refinedData
}

/**
* Build the text for the current conditions (today / right now)
*
* @param  {Object} o      The options for this instance of fuzzy weather
* @param  {Object} data   The data returned from the weather API
* @param  {Date} reqDate  The date of the request
* @return {Object|null}   The current condition text of the forecast (or null if not for today) { data, conditions, forecast }
 */
function getCurrentConditions(o, data, reqDate) {
    let simpleDate = moment(reqDate).format('YYYY-MM-DD')
    let todaySimple = moment(Date.now()).format('YYYY-MM-DD')

    let text = []
    let info = {
        data: data.current,
        conditions: {},
        forecast: null
    };

    if (simpleDate !== todaySimple) {
        debugCurrently(`forecast was not requested for today (${simpleDate} != ${todaySimple})`)
        return null
    }

    debugCurrently(`getting current conditions for ${simpleDate}`)

    let hasPrecip = false
    rankConditions(o, data.current).forEach((condition) => {
        if (condition.topic === 'rain' || condition.topic === 'snow') {
            let precipText = `There is ${conditionMap[condition.code].description} ${data.current.precipType} right now`
            text.push(precipText)
            info.conditions[condition.topic] = precipText
            hasPrecip = true
        }
    })

    if (!hasPrecip) {
        if (data.current.clouds < 40) {
            text.push(`It's ${(data.current.clouds > 20) ? 'mostly' : ''} sunny right now`)
        } else if (data.current.clouds < (o.cloudBreak * 100)) {
            text.push(`There's some cloud cover right now`)
        } else {
            let cloudText = `It's pretty cloudy right now`
            text.push(cloudText)
            info.conditions.clouds = cloudText
        }
    }

    let temp = `and it's currently ${Math.round(data.current.temp)} degrees`
    if (data.current.feels_like > (data.current.temp + 5) ||
        data.current.feels_like < (data.current.temp - 5)) {
        temp += `, but it feels like ${Math.round(data.current.apparentTemperature)} out there`
    }
    text.push(temp + '.')

    
    // TODO: use the "temperature" condition to indicate if it's excessive (or humid)
    //       also wind...


    if (data.alerts && data.alerts.length) {
        let alerts = []
        let types = []
        data.alerts.forEach((alert) => {
            if (data.current.dt > alert.start && data.current.dt < alert.end) {
                if (types.includes(alert.event)) { return }

                types.push(alert.event)
                let expires = moment.tz(alert.end * 1000, 'GMT').tz(data.timezone)

                if (alert.event.toLowerCase() === 'special weather statement') {
                    let description = alert.description.substr(0, alert.description.indexOf('For additional info'))
                    alerts.push(`until ${expires.format('ha')}: ${description}`)
                } else {
                    alerts.push(`${alert.event} until ${expires.format('ha')}`)
                }
            }
        })
        if (alerts.length > 1) {
            text.push('There are multiple weather alerts:')
        } else if (alerts.length) {
            text.push('There is a weather alert:')
        }
        text = text.concat(alerts)
    }

    info.forecast = text.join(' ').replace(/\n/g, ' ')
    debugCurrently('forecast for current weather:', info.forecast)
    return info
}


/* ****************************************************** *
                 VARIOUS HELPER METHODS
 * ****************************************************** */

function render(text, data) {
    var newText = text
    Object.keys(data).forEach(function(key) {
        newText = text.replace('{' + key + '}', data[key])
    })
    return newText
}

function getDayOfWeek(date, useFamiliar) {
    let now = Date.now()
    let day = 'that day'

    if (useFamiliar && moment(date).format('YYYY-MM-DD') === moment(now).format('YYYY-MM-DD')) {
        day = 'today'
    } else if (useFamiliar && moment(date).format('YYYY-MM-DD') === moment(now + (1000*60*60*24)).format('YYYY-MM-DD')) {
        day = 'tomorrow'
    } else {
        day = moment(date).format('dddd')
    }
    return day
}
