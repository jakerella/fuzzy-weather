let _ = require('lodash'),
    moment = require('moment-timezone'),
    debug = require('debug')('fuzzy-weather:testdata'),
    ranking = require('../../src/conditions/rank')

const TZ = 'America/New_York'

/**
 * Generates weather data as returned by the weather API
 * @param  {Object} base       Location info for the generated data:
                               {
                                latitude: Number,
                                longitude: Number,
                                timezone: String,
                                offset: Number
                               }
 * @param  {Object} hourByHour @see generateHourByHour
 * @param  {Date|Number|String} start An optional start time/date for the data generation (EDT)
 * @return {Object}            The generated weather data (as returned by weather API)
 */
module.exports = function generateWeather(location = {}, hourByHour = {}, start = null) {
    let startDate = moment.tz(start || Date.now(), TZ)
    debug('weather data generating from date:', startDate.format())

    let baseData = getBaseData(Number(startDate.format('X')))

    let conditionData = generateHourByHour(hourByHour, Number(startDate.format('X')))
    let data = _.merge({}, baseData, location, { hourly: conditionData.hourly })
    _.merge(data.daily[0], conditionData.daily[0])
    _.merge(data.daily[1], conditionData.daily[1])
    return data
}

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
function generateHourByHour(conditions = {}, start = 0) {
    let hourly = []
    let daily = [{}, {}]
    let temps = []
    let tempsDayTwo = []
    let totalRain = 0
    let totalSnow = 0

    conditions.maxTemp = conditions.maxTemp || 75
    conditions.minTemp = conditions.minTemp || 55
    conditions.heatIndexPercent = conditions.heatIndexPercent || 0
    conditions.conditions = conditions.conditions || []

    debug(`hourly conditions to generate for time: ${start}`, conditions)

    // Determine temps at each hour for use in hourly data generation below
    let dayCurve = conditions.dayCurve || 'sin'
    let amp = (conditions.maxTemp - conditions.minTemp) / 2
    let midTempHour = (conditions.dayPeakHour || 15) - 6
    let midTemp = conditions.minTemp + amp

    if (dayCurve === 'down') {
        // for current day...
        for (let i=0; i<24; ++i) {
            let currTemp = conditions.maxTemp
            if (i < conditions.dayPeakHour) {
                currTemp -= (1 - (i / conditions.dayPeakHour)) * amp
            } else if (i > conditions.dayPeakHour) {
                currTemp -= ((i - conditions.dayPeakHour) / (23 - conditions.dayPeakHour)) * (amp * 2)
            }
            temps[i] = currTemp
        }

        // for next day
        for (let i=0; i<24; ++i) {
            let currTemp = (amp / 2) * Math.sin((Math.PI / 12) * (i - 7)) + (midTemp - (amp / 2))
            tempsDayTwo[i] = Math.round(currTemp)
        }
    } else {
        // Default is a sin curve
        for (let i=0; i<24; ++i) {
            let currTemp = amp * Math.sin((Math.PI / 12) * (i - midTempHour)) + midTemp
            temps[i] = currTemp
        }
    }

    for (let i=0; i<48; ++i) {
        let startDate = (new Date((start + (i * 3600)) * 1000))
        let clockHour = startDate.getHours()

        let baseTemp = temps[clockHour]
        if (tempsDayTwo.length && startDate.getDate() !== startDate.getDate()) {
            baseTemp = tempsDayTwo[clockHour]
        }

        debug('Base temp set for hour index', i, baseTemp)

        // basic set
        let hour = {
            dt: start + (i * 3600),
            pop: 0.00,
            temp: baseTemp,
            feels_like: baseTemp + (baseTemp * conditions.heatIndexPercent),
            dewPoint: 65.0,
            humidity: 60,
            windSpeed: 0.00,
            wind_deg: 180,
            wind_gust: 0.00,
            visibility: 10000,
            clouds: 0,
            pressure: 1000,
            uvi: 0.5,
            weather: []
        }


        for (let j=0; j<conditions.conditions.length; ++j) {
            let maxProbability = 0
            let maxLevel = 0
            if (conditions.conditions[j].type === 'rain') {
                maxProbability = conditions.conditions[j].maxProb || 1
                maxLevel = conditions.conditions[j].maxLevel || 1
            }

            if (i >= conditions.conditions[j].delay && i <= (conditions.conditions[j].delay + (conditions.conditions[j].length - 1))) {
                let form = conditions.conditions[j].form || 'even'
                let percentComplete = Math.max(0.1, (i - conditions.conditions[j].delay) / conditions.conditions[j].length)

                if (conditions.conditions[j].type === 'rain') {
                    let amount = 0
                    let probability = 0
                    if (form === 'bell') {
                        amount = Math.abs(maxLevel - ((Math.abs(percentComplete - 0.5) * 1.5) * maxLevel))
                        probability = maxProbability - Math.abs(percentComplete - 0.5)
                    } else if (form === 'even') {
                        amount = maxLevel
                        probability = maxProbability
                    } else if (form === 'increasing') {
                        amount = percentComplete * maxLevel
                        probability = percentComplete * maxProbability
                    } else if (form === 'decreasing') {
                        amount = (1.1 - percentComplete) * maxLevel
                        probability = (1.1 - percentComplete) * maxProbability
                    }

                    totalRain += amount
                    const conditionId = ranking.hourlyRainMap
                        .filter((level) => { return amount > level.min && amount <= level.max })[0].code

                    _.merge(hour, {
                        rain: { '1h': amount },
                        pop: probability,
                        clouds: 100,
                        humidity: 90,
                        weather: [ { id: conditionId } ]
                    })
                }

                // TODO: add other conditions
            }
        }
        hourly.push(hour)
    }

    // Set daily data values
    for (let i=0; i<conditions.conditions.length; ++i) {
        let cond = conditions.conditions[i]

        if (cond.type === 'rain') {
            let dailyData = {
                rain: totalRain,
                pop: cond.maxProb
            }
            if (cond.delay < 24) {
                _.merge(daily[0], dailyData)
                if ((cond.delay + cond.length) > 23) {
                    _.merge(daily[1], dailyData)
                }
            } else {
                _.merge(daily[1], dailyData)
            }
        }

        // TODO: add other conditions
    }

    return {
        hourly,
        daily
    }
}

function getBaseData(start = 0) {
    let oneDay = 60 * 60 * 24

    let baseData = {
        'lat': 38.9649734,
        'lon': -77.0207249,
        'timezone': TZ,
        'timezone_offset': ((new Date()).getTimezoneOffset() / 60) * -1,
        'current': {
            'dt':start,
            "sunrise": 1664622233,
            "sunset": 1664664685,
            "temp": 60.17,
            "feels_like": 60.21,
            "pressure": 1009,
            "humidity": 85,
            "dew_point": 57.85,
            "uvi": 0.41,
            "clouds": 57,
            "visibility": 10000,
            "wind_speed": 10.27,
            "wind_deg": 50,
            "weather": [
                {
                    "id": 802,
                    "main": "Clouds",
                    "description": "overcast clouds",
                    "icon": "04d"
                }
            ]
        },
        'minutely': [
            {
                'dt':start,
                'precipitation':0
            },
            {
                'dt':start + 60,
                'precipitation':0
            },
            {
                'dt':start + (60 * 2),
                'precipitation':0
            },
            {
                'dt':start + (60 * 3),
                'precipitation':0
            },
            {
                'dt':start + (60 * 4),
                'precipitation':0
            },
            {
                'dt':start + (60 * 5),
                'precipitation':0
            },
            {
                'dt':start + (60 * 6),
                'precipitation':0
            },
            {
                'dt':start + (60 * 7),
                'precipitation':0
            },
            {
                'dt':start + (60 * 8),
                'precipitation':0
            },
            {
                'dt':start + (60 * 9),
                'precipitation':0
            },
            {
                'dt':start + (60 * 10),
                'precipitation':0
            },
            {
                'dt':start + (60 * 11),
                'precipitation':0
            },
            {
                'dt':start + (60 * 12),
                'precipitation':0
            },
            {
                'dt':start + (60 * 13),
                'precipitation':0
            },
            {
                'dt':start + (60 * 14),
                'precipitation':0
            },
            {
                'dt':start + (60 * 15),
                'precipitation':0
            },
            {
                'dt':start + (60 * 16),
                'precipitation':0
            },
            {
                'dt':start + (60 * 17),
                'precipitation':0
            },
            {
                'dt':start + (60 * 18),
                'precipitation':0
            },
            {
                'dt':start + (60 * 19),
                'precipitation':0
            },
            {
                'dt':start + (60 * 20),
                'precipitation':0
            },
            {
                'dt':start + (60 * 21),
                'precipitation':0
            },
            {
                'dt':start + (60 * 22),
                'precipitation':0
            },
            {
                'dt':start + (60 * 23),
                'precipitation':0
            },
            {
                'dt':start + (60 * 24),
                'precipitation':0
            },
            {
                'dt':start + (60 * 25),
                'precipitation':0
            },
            {
                'dt':start + (60 * 26),
                'precipitation':0
            },
            {
                'dt':start + (60 * 27),
                'precipitation':0
            },
            {
                'dt':start + (60 * 28),
                'precipitation':0
            },
            {
                'dt':start + (60 * 29),
                'precipitation':0
            },
            {
                'dt':start + (60 * 30),
                'precipitation':0
            },
            {
                'dt':start + (60 * 31),
                'precipitation':0
            },
            {
                'dt':start + (60 * 32),
                'precipitation':0
            },
            {
                'dt':start + (60 * 33),
                'precipitation':0
            },
            {
                'dt':start + (60 * 34),
                'precipitation':0
            },
            {
                'dt':start + (60 * 35),
                'precipitation':0
            },
            {
                'dt':start + (60 * 36),
                'precipitation':0
            },
            {
                'dt':start + (60 * 37),
                'precipitation':0
            },
            {
                'dt':start + (60 * 38),
                'precipitation':0
            },
            {
                'dt':start + (60 * 39),
                'precipitation':0
            },
            {
                'dt':start + (60 * 40),
                'precipitation':0
            },
            {
                'dt':start + (60 * 41),
                'precipitation':0
            },
            {
                'dt':start + (60 * 42),
                'precipitation':0
            },
            {
                'dt':start + (60 * 43),
                'precipitation':0
            },
            {
                'dt':start + (60 * 44),
                'precipitation':0
            },
            {
                'dt':start + (60 * 45),
                'precipitation':0
            },
            {
                'dt':start + (60 * 46),
                'precipitation':0
            },
            {
                'dt':start + (60 * 47),
                'precipitation':0
            },
            {
                'dt':start + (60 * 48),
                'precipitation':0
            },
            {
                'dt':start + (60 * 49),
                'precipitation':0
            },
            {
                'dt':start + (60 * 50),
                'precipitation':0
            },
            {
                'dt':start + (60 * 51),
                'precipitation':0
            },
            {
                'dt':start + (60 * 52),
                'precipitation':0
            },
            {
                'dt':start + (60 * 53),
                'precipitation':0
            },
            {
                'dt':start + (60 * 54),
                'precipitation':0
            },
            {
                'dt':start + (60 * 55),
                'precipitation':0
            },
            {
                'dt':start + (60 * 56),
                'precipitation':0
            },
            {
                'dt':start + (60 * 57),
                'precipitation':0
            },
            {
                'dt':start + (60 * 58),
                'precipitation':0
            },
            {
                'dt':start + (60 * 59),
                'precipitation':0
            },
            {
                'dt':start + (60 * 60),
                'precipitation':0
            }
        ],
        'hourly': [
            /*
            EXAMPLES
            {
                "dt": start,
                "temp": 58.8,
                "feels_like": 58.86,
                "pressure": 1011,
                "humidity": 95,
                "dew_point": 57.38,
                "uvi": 0,
                "clouds": 100,
                "visibility": 10000,
                "wind_speed": 10.13,
                "wind_deg": 48,
                "wind_gust": 25.46,
                "weather": [
                    {
                        "id": 500,
                        "main": "Rain",
                        "description": "light rain",
                        "icon": "10n"
                    }
                ],
                "pop": 0.93,
                "rain": {
                    "1h": 0.41
                }
            },
            {
                "dt": start + (3600 * 1),
                "temp": 55.67,
                "feels_like": 55.4,
                "pressure": 1012,
                "humidity": 95,
                "dew_point": 54.37,
                "uvi": 0,
                "clouds": 100,
                "visibility": 10000,
                "wind_speed": 8.21,
                "wind_deg": 44,
                "wind_gust": 20.76,
                "weather": [
                    {
                        "id": 804,
                        "main": "Clouds",
                        "description": "overcast clouds",
                        "icon": "04n"
                    }
                ],
                "pop": 0.3
            },
            ...
            */
        ],
        'daily': [
            {
                "dt": start,
                "sunrise": 1664881601,
                "sunset": 1664923600,
                "moonrise": 1664914620,
                "moonset": 1664858580,
                "moon_phase": 0.31,
                "temp": {
                    "day": 59.97,
                    "min": 48.42,
                    "max": 62.44,
                    "night": 55.02,
                    "eve": 59.02,
                    "morn": 49.19
                },
                "feels_like": {
                    "day": 57.31,
                    "night": 52.81,
                    "eve": 56.82,
                    "morn": 46.74
                },
                "pressure": 1020,
                "humidity": 35,
                "dew_point": 31.84,
                "wind_speed": 9.89,
                "wind_deg": 22,
                "wind_gust": 21.92,
                "weather": [
                    {
                        "id": 500,
                        "main": "Rain",
                        "description": "light rain",
                        "icon": "10d"
                    }
                ],
                "clouds": 99,
                "pop": 0.39,
                "rain": 0.2,
                "uvi": 4.43
            },
            {
                "dt": start + (oneDay * 1),
                "sunrise": 1664881601,
                "sunset": 1664923600,
                "moonrise": 1664914620,
                "moonset": 1664858580,
                "moon_phase": 0.31,
                "temp": {
                    "day": 59.97,
                    "min": 48.42,
                    "max": 62.44,
                    "night": 55.02,
                    "eve": 59.02,
                    "morn": 49.19
                },
                "feels_like": {
                    "day": 57.31,
                    "night": 52.81,
                    "eve": 56.82,
                    "morn": 46.74
                },
                "pressure": 1020,
                "humidity": 35,
                "dew_point": 31.84,
                "wind_speed": 9.89,
                "wind_deg": 22,
                "wind_gust": 21.92,
                "weather": [
                    {
                        "id": 500,
                        "main": "Rain",
                        "description": "light rain",
                        "icon": "10d"
                    }
                ],
                "clouds": 99,
                "pop": 0.39,
                "rain": 0.2,
                "uvi": 4.43
            },
            {
                "dt": start + (oneDay * 2),
                "sunrise": 1664881601,
                "sunset": 1664923600,
                "moonrise": 1664914620,
                "moonset": 1664858580,
                "moon_phase": 0.31,
                "temp": {
                    "day": 59.97,
                    "min": 48.42,
                    "max": 62.44,
                    "night": 55.02,
                    "eve": 59.02,
                    "morn": 49.19
                },
                "feels_like": {
                    "day": 57.31,
                    "night": 52.81,
                    "eve": 56.82,
                    "morn": 46.74
                },
                "pressure": 1020,
                "humidity": 35,
                "dew_point": 31.84,
                "wind_speed": 9.89,
                "wind_deg": 22,
                "wind_gust": 21.92,
                "weather": [
                    {
                        "id": 500,
                        "main": "Rain",
                        "description": "light rain",
                        "icon": "10d"
                    }
                ],
                "clouds": 99,
                "pop": 0.39,
                "rain": 0.2,
                "uvi": 4.43
            },
            {
                "dt": start + (oneDay * 3),
                "sunrise": 1664881601,
                "sunset": 1664923600,
                "moonrise": 1664914620,
                "moonset": 1664858580,
                "moon_phase": 0.31,
                "temp": {
                    "day": 59.97,
                    "min": 48.42,
                    "max": 62.44,
                    "night": 55.02,
                    "eve": 59.02,
                    "morn": 49.19
                },
                "feels_like": {
                    "day": 57.31,
                    "night": 52.81,
                    "eve": 56.82,
                    "morn": 46.74
                },
                "pressure": 1020,
                "humidity": 35,
                "dew_point": 31.84,
                "wind_speed": 5.89,
                "wind_deg": 22,
                "wind_gust": 8.92,
                "weather": [],
                "clouds": 20,
                "pop": 0,
                "uvi": 4.43
            },
            // TODO: heat/humidity, rain, snow, sleet, cold/wind, clouds, wind
        ],
        'alerts': [
            {
                'sender_name': 'NWS Philadelphia - Mount Holly (New Jersey, Delaware, Southeastern Pennsylvania)',
                'event': 'Red Flag Warning for Oklahoma, OK',
                'start': start - (60 * 60),  // start time of the alert
                'end': start + (60 * 60 * 4),
                'description': '... EXCESSIVELY LONG DESCRIPTION ...',
                'tags': []
            }
        ]
    }

    return baseData
}
