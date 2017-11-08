'use strict';

let chai = require('chai'),
    temp = require('../../src/conditions/temp'),
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
            let result = temp.dailyText({}, dailyData, 'America/New_York').replace(/\n/, ' ');
            expect(result).to.be.a('string');
            expect(result).to.contain(`is ${Math.round(dailyData.temperatureMin)} degrees`);
            expect(result).to.contain(`a high of ${Math.round(dailyData.temperatureMax)}`);
        });

    });


    describe('temp hourly text', function() {

        it('should be able to get hourly temp info (normal temp curve)', function() {
            let data = weatherDataGenerate(null, {
                maxTemp: 85,
                minTemp: 55,
                heatIndexPercent: 0.05,
                conditions: []
            }, '2018-07-01T00:01:00');
            let tempHourly = data.hourly.data.slice(0,24);

            let result = temp.hourlyText(tempHourly, data.timezone);
            expect(result).to.be.a('string')
                .and.contain('high of about 85 degrees around 3 pm')
                .and.contain('for your commute home at 5 pm');
        });

    });

});
