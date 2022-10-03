const chai = require('chai'),
    debug = require('debug')('fuzzy-weather:temperature-spec'),
    rain = require('../../src/conditions/rain'),
    weatherDataGenerate = require('../data/dc.weather')

let now = new Date()
let time = Math.round(now.getTime() / 1000)

const rainCondition = { code: 501, probability: 0.7, level: 5 }
const dailyData = { dt: time, rain: 10, pop: 0.70 }

const options = {
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
    nightTempBreak: 15
}

chai.should()
let expect = chai.expect

describe('rain module', function() {

    describe('rain headline', function() {

        it('should return a headline string with replaceable "day"', function() {
            let result = rain.headline()
            expect(result).to.be.a('string')
            expect(result).to.contain('{day}')
        })
    })

    describe('rain daily text', function() {

        it('should return empty string for low probability', function() {
            let result = rain.dailyText({ }, { precipProbability: 0.05 }, 'America/New_York')
            expect(result).to.be.a('string').and.have.property('length').that.equals(0)
        })

        it('should return correct text for rain', function() {
            let result = rain.dailyText(rainCondition, dailyData, 'America/New_York')
            expect(result).to.be.a('string')
            expect(result).to.contain('70 percent')
            expect(result).to.contain('moderate')
        })

    })

    describe('rain hourly text', function() {

        it('should be able to get hourly rain data with one rain event (increasing)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 75,
                minTemp: 55,
                heatIndexPercent: 0.05,
                conditions: [
                    { type: 'rain', delay: 7, length: 13, maxProb: 0.7, maxLevel: 2, form: 'increasing' }
                ]
            }, '2025-01-01T00:30:00')
            let rainHourly = data.hourly.slice(0,24)

            let result = rain.hourlyText(rainHourly, data.timezone, dailyData, options)
            expect(result).to.be.a('string').and.contain('rain').and.contain('increasing')
        })

        it('should be able to get hourly rain data with one rain event (decreasing)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 75,
                minTemp: 55,
                heatIndexPercent: 0.05,
                conditions: [
                    { type: 'rain', delay: 7, length: 13, maxProb: 0.7, maxLevel: 2, form: 'decreasing' }
                ]
            }, '2025-01-01T00:30:00')
            let rainHourly = data.hourly.slice(0,24)

            let result = rain.hourlyText(rainHourly, data.timezone, dailyData, options)
            expect(result).to.be.a('string').and.contain('Rain').and.contain('decrease')
        })

        it('should be able to get hourly rain data with one rain event (bell)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 75,
                minTemp: 55,
                heatIndexPercent: 0.05,
                conditions: [
                    { type: 'rain', delay: 7, length: 13, maxProb: 0.7, maxLevel: 2, form: 'bell' }
                ]
            }, '2025-01-01T00:30:00')
            let rainHourly = data.hourly.slice(0,24)

            debug(rainHourly)

            let result = rain.hourlyText(rainHourly, data.timezone, dailyData, options)
            expect(result).to.be.a('string').and.contain('rain')
        })

        it('should be able to get hourly rain data with one rain event (even)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 75,
                minTemp: 55,
                heatIndexPercent: 0.05,
                conditions: [
                    { type: 'rain', delay: 7, length: 13, maxProb: 0.7, maxLevel: 2, form: 'even' }
                ]
            }, '2025-01-01T00:30:00')
            let rainHourly = data.hourly.slice(0,24)

            let result = rain.hourlyText(rainHourly, data.timezone, dailyData, options)
            expect(result).to.be.a('string').and.contain('steady')
        })

        it('should be able to get hourly rain data with two rain events (bell, decreasing)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 75,
                minTemp: 55,
                heatIndexPercent: 0.05,
                conditions: [
                    { type: 'rain', delay: 7, length: 6, maxProb: 0.7, maxLevel: 2, form: 'bell' },
                    { type: 'rain', delay: 18, length: 23, maxProb: 0.7, maxLevel: 2, form: 'decreasing' }
                ]
            }, '2025-01-01T00:30:00')
            let rainHourly = data.hourly.slice(0,24)

            let result = rain.hourlyText(rainHourly, data.timezone, dailyData, options)
            expect(result).to.be.a('string').and.contain('rain')
        })

    })


})
