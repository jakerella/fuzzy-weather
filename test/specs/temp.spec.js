'use strict';

let chai = require('chai'),
    temp = require('../../src/conditions/temp'),
    moment = require('moment-timezone'),
    weatherDataGenerate = require('../data/dc.weather');

let now = new Date();
now.setHours(12);
let time = Math.round(now.getTime() / 1000);

let dailyData = {
        'time':time,
        'summary':'Mostly sunny.',
        'temperatureMin':68.17,
        'temperatureMinTime':1470650400,
        'temperatureMax':86.49,
        'temperatureMaxTime':time + 120,
        'apparentTemperatureMin':68.17,
        'apparentTemperatureMinTime':1470650400,
        'apparentTemperatureMax':89.4,
        'apparentTemperatureMaxTime':time + 120
    };

chai.should();
let expect = chai.expect;

describe('temp module', function() {

    describe('temp daily text', function() {

        it('should return correct text for temp', function() {
            let result = temp.summary('America/New_York', '2018-07-01', dailyData).replace(/\n/, ' ');
            expect(result).to.be.a('string');
            expect(result).to.contain(`${Math.round(dailyData.temperatureMin)} degrees`);
            expect(result).to.contain(`a high of ${Math.round(dailyData.temperatureMax)}`);
        });

    });


    describe('temp hourly text', function() {

        it('should be able to get hourly temp info (normal temp curve)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 85,
                minTemp: 55,
                dayPeakHour: 14,
                heatIndexPercent: 0.05,
                conditions: []
            }, '2018-07-01T07:01:00');
            let tempHourly = data.hourly.data.slice(0,24);

            let dailyData = {};
            data.daily.data.forEach(function(singleDayData) {
                if (moment(singleDayData.time * 1000).format('YYYY-MM-DD') === '2018-07-01') {
                    dailyData = singleDayData
                    singleDayData.type = 'daily';
                }
            });
            let reqDate = moment(dailyData.time * 1000);
            dailyData.temperatureMaxTime = reqDate.hours(14).format('X');
            dailyData.temperatureMinTime = reqDate.hours(3).format('X');

            let result = temp.summary(data.timezone, '2018-07-01', dailyData, tempHourly);
            expect(result).to.be.a('string')
                .and.contain('currently 66')
                .and.contain('high of 85 degrees {day} around 2 pm')
                .and.contain('81 at the end of the work day');
        });

        it('should be able to get hourly temp info (dropping temps)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 75,
                minTemp: 40,
                dayPeakHour: 8,
                dayCurve: 'down',
                heatIndexPercent: 0,
                conditions: []
            }, '2018-07-01T07:01:00');
            let tempHourly = data.hourly.data.slice(0,24);

            let dailyData = {};
            data.daily.data.forEach(function(singleDayData) {
                if (moment(singleDayData.time * 1000).format('YYYY-MM-DD') === '2018-07-01') {
                    dailyData = singleDayData
                    singleDayData.type = 'daily';
                }
            });
            let reqDate = moment(dailyData.time * 1000);
            dailyData.temperatureMaxTime = reqDate.hours(8).format('X');
            dailyData.temperatureMinTime = reqDate.hours(23).format('X');

            // console.log(tempHourly.map(d=>Math.round(d.temperature)));

            let result = temp.summary(data.timezone, '2018-07-01', dailyData, tempHourly);
            expect(result).to.be.a('string')
                .and.contain('currently 73')
                .and.contain('heading down through {day}')
                .and.contain('40 degrees by 11 pm')
                .and.contain('54 at the end of the work day');
        });

    });

});
