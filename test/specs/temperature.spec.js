const chai = require('chai'),
    debug = require('debug')('fuzzy-weather:temperature-spec'),
    tempModule = require('../../src/conditions/temperature'),
    moment = require('moment-timezone'),
    weatherDataGenerate = require('../data/dc.weather')

let now = new Date()
now.setHours(12)
let time = Math.round(now.getTime() / 1000)

const dailyData = {
    dt: time,
    temp: {
        min: 68.17,
        max: 86.49,
        morn: 69.12,
        day: 84.26,
        eve: 75.82,
        night: 70.48
    },
    feels_like: {
        morn: 68.55,
        day: 90.01,
        eve: 77.38,
        night: 71.93
    }
}

chai.should()
let expect = chai.expect

describe('temp module', function() {

    describe('temp daily text', function() {

        it('should return correct text for temp', function() {
            let result = tempModule.summary('America/New_York', dailyData).replace(/\n/, ' ')

            debug(result)

            expect(result).to.be.a('string')
            expect(result).to.contain(`low {day} will be ${Math.round(dailyData.temp.min)} degrees`)
            expect(result).to.contain(`a high around ${Math.round(dailyData.temp.max)}`)
        })

    })


    describe('temp hourly text', function() {

        it('should be able to get hourly temp info (normal temp curve)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 85,
                minTemp: 55,
                dayPeakHour: 14,
                heatIndexPercent: 0.05,
                conditions: []
            }, '2018-07-01T07:01:00')
            let tempHourly = data.hourly.slice(0,24)

            let dailyData = {}
            data.daily.forEach(function(singleDayData) {
                if (moment(singleDayData.dt * 1000).format('YYYY-MM-DD') === '2018-07-01') {
                    dailyData = singleDayData
                    singleDayData.type = 'daily'
                }
            })

            let result = tempModule.summary(data.timezone, dailyData, tempHourly);
            expect(result).to.be.a('string')
                .and.contain('high of 85 degrees {day} around 2 pm')
                .and.contain('81 at the end of the work day')
        })

        it('should be able to get hourly temp info (dropping temps)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 75,
                minTemp: 40,
                dayPeakHour: 8,
                dayCurve: 'down',
                heatIndexPercent: 0,
                conditions: []
            }, '2018-07-01T07:01:00')
            let tempHourly = data.hourly.slice(0,24)

            let dailyData = {}
            data.daily.forEach(function(singleDayData) {
                if (moment(singleDayData.dt * 1000).format('YYYY-MM-DD') === '2018-07-01') {
                    dailyData = singleDayData
                    singleDayData.type = 'daily'
                }
            })

            let result = tempModule.summary(data.timezone, dailyData, tempHourly);
            expect(result).to.be.a('string')
                .and.contain('heading down through {day}')
                .and.contain('40 degrees by 11 pm')
                .and.contain('54 at the end of the work day');
        })

    })

})
