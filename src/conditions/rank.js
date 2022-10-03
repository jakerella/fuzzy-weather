
const debug = require('debug')('fuzzy-weather:rankConditions'),
    conditionMap = require('./condition-codes.json')

const dailyRainMap = [
    { min: 0, max: 2, code: 311 },
    { min: 2, max: 7, code: 500 },
    { min: 7, max: 15, code: 501 },
    { min: 15, max: 30, code: 503 },
    { min: 30, max: 99, code: 504 }
]
const hourlyRainMap = [
    { min: 0, max: 0.1, code: 311 },
    { min: 0.1, max: 1, code: 500 },
    { min: 1, max: 4, code: 501 },
    { min: 4, max: 10, code: 503 },
    { min: 10, max: 99, code: 504 }
]
const dailySnowMap = [
    { min: 0, max: 10, code: 600 },
    { min: 10, max: 20, code: 601 },
    { min: 20, max: 99, code: 602 }
]
const cloudMap = [
    { min: 0, max: 10, code: 800 },
    { min: 10, max: 25, code: 801 },
    { min: 25, max: 50, code: 802 },
    { min: 50, max: 84, code: 803 },
    { min: 84, max: 100, code: 804 }
]
const windMap = [
    { min: 0, max: 5, code: 9030 },
    { min: 5, max: 15, code: 9031 },
    { min: 15, max: 30, code: 9032 },
    { min: 30, max: 99, code: 9033 }
]


module.exports = {
    dailyRainMap,
    hourlyRainMap,
    dailySnowMap,
    cloudMap,
    windMap,

    /**
     * This method takes weather data and determines what conditions
     * exist that we want to report on. For example, if there is no wind expected
     * today then we don't need to say that. The data returned is an array of the
     * conditions that *should* be reported on, sorted by severity - `level` in
     * the data. Also included is a text `topic` and `probability` (although the
     * probability is often times just `1` for things like wind and clouds).
     *
     * @param  {Object} o              The options for this instance of fuzzy weather
     * @param  {Object} data           Daily summary data as returned from weather API
     * @param  {String} limitCategory  Name of a category to restrict this ranking to (i.e. "rain")
     * @return {Array}       Sorted conditions, each entry being an object with:
     *                       - topic {String} for example: "rain", "wind", "clouds"
     *                       - code {Number} the code used in the conditions JSON file to identify the condition
     *                       - probability {Number} percentage represented as 0-1
     *                       - level {Number} The severity from 0-10  (0 = nothing; 10+ = extreme)
     */
    rankConditions: function rankConditions(o, data, limitCategory) {
        let avgTemps = o.avgTemps[(new Date(data.dt * 1000)).getMonth()],
            conditions = []

        const condCheck = {}
        
        data.weather.forEach((condition) => {
            if (!conditionMap[condition.id]) {
                debug(`Unable to identify weather condition. Code: ${condition.id}`)
                return
            }

            if (limitCategory && conditionMap[condition.id].category !== limitCategory) {
                debug(`Skipping condition because category doesn't match: ${limitCategory} != ${conditionMap[condition.id].category}`)
                return
            }

            conditions.push({
                topic: conditionMap[condition.id].category,
                probability: data.pop || 1,
                level: conditionMap[condition.id].level,
                code: condition.id
            })

            if (!condCheck[conditionMap[condition.id].category]) {
                condCheck[conditionMap[condition.id].category] = true
            }
        })

        // Now figure out if we need to add things that aren't in the 'weather' array...

        // See if we have any precipitation to deal with...
        if ((!limitCategory || limitCategory === 'rain') && !condCheck.rain && data.rain && data.rain['1h']) {
            // This is only for "current" conditions where somehow "rain" isn't in the "weather" block
            const code = hourlyRainMap
                .filter((level) => { return data.rain['1h'] > level.min && data.rain['1h'] <= level.max })[0].code

            conditions.push({
                topic: 'rain',
                probability: 1,  // this is only for "current" data, so it's raining now
                level: conditionMap[code].level,
                code
            })

        } else if ((!limitCategory || limitCategory === 'rain') && data.pop > 0.05 && data.rain && !condCheck.rain) {
            let code = dailyRainMap
                .filter((level) => { return data.rain > level.min && data.rain <= level.max })
            debug(data.rain, code)
            code = (code.length) ? code[0].code : 500

            conditions.push({
                topic: 'rain',
                probability: data.pop,
                level: conditionMap[code].level,
                code
            })

        } else if ((!limitCategory || limitCategory === 'snow') && data.pop && data.snow && !condCheck.snow) {
            const code = dailySnowMap
                .filter((level) => { return data.snow > level.min && data.snow <= level.max })[0].code

            conditions.push({
                topic: 'snow',
                probability: data.pop,
                level: conditionMap[code].level,
                code
            })

        }
        

        if ((!limitCategory || limitCategory === 'clouds') && data.clouds && !condCheck.clouds) {
            const code = cloudMap
                .filter((level) => { return data.clouds > level.min && data.clouds <= level.max })[0].code

            conditions.push({
                topic: 'clouds',
                probability: 1,
                level: conditionMap[code].level,
                code
            })

        }
        
        
        if ((!limitCategory || limitCategory === 'wind') && data.wind_speed > o.windBreak) {
            const windDiff = data.wind_speed - o.windBreak
            const code = windMap
                .filter((level) => { return windDiff > level.min && windDiff <= level.max })[0].code

            conditions.push({
                topic: 'wind',
                probability: 1,
                level: conditionMap[code].level,
                code
            })

        }
        
        
        if (!limitCategory || limitCategory === 'temperature') {
            // See if we have any high or low temperatures to deal with...
            let highTemp = data.temp
            let lowTemp = data.temp
            let highFeelsLike = data.feels_like
            let lowFeelsLike = data.feels_like
            
            if (data.temp.max) {
                highTemp = data.temp.max
                highFeelsLike = Math.max(...Object.values(data.feels_like))
                lowTemp = data.temp.min
                lowFeelsLike = Math.min(...Object.values(data.feels_like))
            }

            highTemp = Math.max(highTemp, highFeelsLike)
            lowTemp = Math.min(lowTemp, lowFeelsLike)

            if (highTemp > o.highTempBreak && highTemp > (avgTemps.high * 1.05)) {
                let code = (highTemp > (avgTemps.high * 1.15)) ? 9011 : 9010
                if (code === 9010 && data.dew_point > o.dewPointBreak || data.humidity > (o.humidityBreak / 100)) {
                    code = 9012
                }
                
                conditions.push({
                    topic: 'temperature',
                    probability: 1,
                    level: conditionMap[code].level,
                    code
                })

            } else if (highTemp < o.lowTempBreak && highTemp < (avgTemps.high * 0.9)) {
                const code = (highTemp < (avgTemps.high * 0.8)) ? 9016 : 9015
                conditions.push({
                    topic: 'temperature',
                    probability: 1,
                    level: conditionMap[code].level,
                    code
                })
            }
            
            if (lowTemp < o.nightTempBreak && lowTemp < avgTemps.low) {
                conditions.push({
                    topic: 'temperature',
                    probability: 1,
                    level: conditionMap[9017].level,
                    code: 9017
                })
            }
        }


        if ((!limitCategory || limitCategory === 'atmosphere') && data.moon_phase && (data.moon_phase === 0 || data.moon_phase === 1)) {
            conditions.push({
                topic: 'atmosphere',
                probability: 1,
                level: conditionMap[9021].level,
                code: 9021
            })
        } else if (data.moon_phase && data.moon_phase === 0.5) {
            conditions.push({
                topic: 'atmosphere',
                probability: 1,
                level: conditionMap[9020].level,
                code: 9020
            })
        }

        
        return conditions.sort(function(a, b) {
            return b.level - a.level
        })
    }
}