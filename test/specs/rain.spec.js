'use strict';

let chai = require('chai'),
    rain = require('../../src/conditions/rain');

let now = Math.round(Date.now() / 1000),
    rainData = {
        topic: 'rain',
        probability: 0.5,
        level: 8
    },
    daily = {
        // some rain, not all day
        'time':now,
        'summary':'Partly cloudy until evening.',
        'icon':'partly-cloudy-day',
        'sunriseTime':1470651415,
        'sunsetTime':1470701583,
        'moonPhase':0.19,
        'precipIntensity':0.0003,
        'precipIntensityMax':0.0029,
        'precipIntensityMaxTime':now + (60 * 60 * 2),
        'precipProbability':0.09,
        'precipType':'rain',
        'temperatureMin':68.17,
        'temperatureMinTime':1470650400,
        'temperatureMax':86.49,
        'temperatureMaxTime':1470679200,
        'apparentTemperatureMin':68.17,
        'apparentTemperatureMinTime':1470650400,
        'apparentTemperatureMax':89.4,
        'apparentTemperatureMaxTime':1470679200,
        'dewPoint':65.82,
        'humidity':0.72,
        'windSpeed':1.79,
        'windBearing':205,
        'visibility':9.88,
        'cloudCover':0.32,
        'pressure':1017.02,
        'ozone':303.05
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


});
