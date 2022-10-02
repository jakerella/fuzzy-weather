const debug = require('debug')('fuzzy-weather:temp'),
    debugOut = require('debug')('fuzzy-weather:temp:output'),
    moment = require('moment-timezone')

module.exports = {
    summary: getSummary,
    detail: getDetail
}

function getSummary(timezone, dailyData, hourlyData) {
    let text = []

    if (!dailyData && !hourlyData) {
        return ''
    }
    if (!hourlyData) {
        return simpleSummary(dailyData)
    }


    let xValues = []
    let yValues = []
    let maxTemp = -100
    let maxHour = 0
    let minTemp = 200
    let minHour = 23
    let dailyMaxTime = 0
    let dailyMinTime = 0

    hourlyData.forEach(function determineInstances(hourData, i) {
        let hour = moment.tz(hourData.dt * 1000, 'GMT').tz(timezone)
        xValues.push(hour.hours())
        yValues.push(hourData.temp)

        if (hourData.temp > maxTemp) {
            maxHour = i
            dailyMaxTime = hour
            maxTemp = hourData.temp
        }
        if (hourData.temp < minTemp) {
            minHour = i
            dailyMinTime = hour
            minTemp = hourData.temp
        }
    })

    debug(`max/min: ${minTemp} at ${dailyMinTime.format('H')} / ${maxTemp} at ${dailyMaxTime.format('H')}`)

    // TODO...
    // Using linear regression on this temp data does not appear to be giving
    // good results, especially when the requested time (hour) is later in the
    // day. For now, I'm going to manually look at peak hours and try to
    // determine if this is a typical temp curve day or not.

    let maxHours = moment.tz(hourlyData[0].dt * 1000, 'GMT').tz(timezone)
    maxHours.add(maxHour, 'h')
    let minHours = moment.tz(hourlyData[0].dt * 1000, 'GMT').tz(timezone)
    minHours.add(minHour, 'h')

    if (dailyMaxTime.format('H') > 17) {
        text.push(
            `Temperatures {day} it will be climbing through the evening, peaking at about ${Math.round(maxTemp)} degrees around ${maxHours.format('h a')}.`
        )

        if (xValues[0] < 16) {
            xValues.forEach(function findSixPM(hour, i) {
                if (Number(hour) === 17) {
                    text.push(`It'll be about ${Math.round(yValues[i])} at the end of the work day.`);
                }
            });
        }

    } else if (dailyMaxTime.format('H') < 12) {
        text.push(
            `Temperatures will be heading down through {day} getting down to about ${Math.round(minTemp)} degrees by ${minHours.format('h a')}.`
        );

        if (xValues[0] < 16) {
            xValues.forEach(function findCommuteTime(hour, i) {
                if (Number(hour) === 17) {
                    text.push(`It'll be about ${Math.round(yValues[i])} at the end of the work day.`);
                }
            });
        }

    } else if (xValues[0] < 11) {
        text.push(`You'll see a high of ${Math.round(maxTemp)} degrees {day} around ${maxHours.format('h a')}.`);

        xValues.forEach(function findSixPM(hour, i) {
            if (Number(hour) === 17) {
                text.push(`It'll be about ${Math.round(yValues[i])} at the end of the work day.`);
            }
        });
    } else if (xValues[0] < 17) {
        xValues.forEach(function findSixPM(hour, i) {
            if (Number(hour) === 17) {
                text.push(`It'll be about ${Math.round(yValues[i])} at the end of the work day`);
            }
            if (Number(hour) === 21) {
                text.push(`and ${Math.round(yValues[i])} by 9 pm.`);
            }
        });
    } else {
        xValues.forEach(function findSixPM(hour, i) {
            if (Number(hour) === 23) {
                text.push(`It'll be ${Math.round(yValues[i])} around 11pm to finish out your day.`);
            }
        });
    }

    debugOut(text.join(' ').replace(/\n/g, ' '));
    return text.join(' ').replace(/\n/g, ' ');
}


function simpleSummary(data) {
    let output

    debug('no hourly data, only getting general daily summary')

    if (data.temp.max < data.temp.day) {
        output =
`Temperatures will be heading down throughout {day}. The high of ${Math.round(data.temp.max)} degrees will be hit early 
and temps will get down to ${Math.round(data.temp.min)} later in the day.`

    } else {
        output =
`The low {day} will be ${Math.round(data.temp.min)} degrees and you should expect a
high around ${Math.round(data.temp.max)} later in the day.`
    }

    debugOut(output)
    return output
}


function getDetail(data, timezone, dailyData) {
    // TODO: more detailed temp info for the days...
    
    return 'temps'
}
