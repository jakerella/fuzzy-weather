'use strict';

let chai = require('chai'),
    rain = require('../../src/conditions/rain'),
    weatherDataGenerate = require('../data/dc.weather');

let now = new Date();
let time = Math.round(now.getTime() / 1000);

let rainCondition = {
        topic: 'rain',
        probability: 0.5,
        level: 8
    },
    dailyData = {
        'time':time,
        'summary':'Partly cloudy until evening.',
        'precipIntensity':0.0003,
        'precipIntensityMax':0.0859,
        'precipIntensityMaxTime':time + (60 * 60 * 2),
        'precipProbability':0.50,
        'precipType':'rain'
    };

chai.should();
let expect = chai.expect;

describe('rain module', function() {

    describe('rain headline', function() {

        it('should return a headline string with replaceable "day"', function() {
            let result = rain.headline();
            expect(result).to.be.a('string');
            expect(result).to.contain('{day}');
        });
    });

    describe('rain daily text', function() {

        it('should return empty string for low probability', function() {
            let result = rain.dailyText({}, { precipProbability: 0.05 }, 'America/New_York');
            expect(result).to.be.a('string').and.have.property('length').that.equals(0);
        });

        it('should return correct text for rain', function() {
            let result = rain.dailyText(rainCondition, dailyData, 'America/New_York');
            expect(result).to.be.a('string');
            expect(result).to.contain('50 percent');
            expect(result).to.contain('moderate');
        });

    });

    describe('rain hourly text', function() {

        it('should be able to get hourly rain data with one rain event (increasing)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 75,
                minTemp: 55,
                heatIndexPercent: 0.05,
                conditions: [
                    { type: 'rain', delay: 7, length: 13, form: 'increasing' }
                ]
            }, '2025-01-01T00:30:00');
            let rainHourly = data.hourly.data.slice(0,24);

            let result = rain.hourlyText(rainHourly, data.timezone);
            expect(result).to.be.a('string').and.contain('rain').and.contain('increasing');
        });

        it('should be able to get hourly rain data with one rain event (decreasing)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 75,
                minTemp: 55,
                heatIndexPercent: 0.05,
                conditions: [
                    { type: 'rain', delay: 7, length: 13, form: 'decreasing' }
                ]
            }, '2025-01-01T00:30:00');
            let rainHourly = data.hourly.data.slice(0,24);

            let result = rain.hourlyText(rainHourly, data.timezone);
            expect(result).to.be.a('string').and.contain('rain').and.contain('decrease');
        });

        it('should be able to get hourly rain data with one rain event (bell)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 75,
                minTemp: 55,
                heatIndexPercent: 0.05,
                conditions: [
                    { type: 'rain', delay: 7, length: 13, form: 'bell' }
                ]
            }, '2025-01-01T00:30:00');
            let rainHourly = data.hourly.data.slice(0,24);

            let result = rain.hourlyText(rainHourly, data.timezone);
            expect(result).to.be.a('string').and.contain('rain');
        });

        it('should be able to get hourly rain data with one rain event (even)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 75,
                minTemp: 55,
                heatIndexPercent: 0.05,
                conditions: [
                    { type: 'rain', delay: 7, length: 13, form: 'even' }
                ]
            }, '2025-01-01T00:30:00');
            let rainHourly = data.hourly.data.slice(0,24);

            let result = rain.hourlyText(rainHourly, data.timezone);
            expect(result).to.be.a('string').and.contain('steady');
        });

        it('should be able to get hourly rain data with two rain events (bell, decreasing)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 75,
                minTemp: 55,
                heatIndexPercent: 0.05,
                conditions: [
                    { type: 'rain', delay: 7, length: 6, form: 'bell' },
                    { type: 'rain', delay: 18, length: 23, form: 'decreasing' }
                ]
            }, '2025-01-01T00:30:00');
            let rainHourly = data.hourly.data.slice(0,24);

            let result = rain.hourlyText(rainHourly, data.timezone);
            expect(result).to.be.a('string').and.contain('rain');
        });

    });


});
