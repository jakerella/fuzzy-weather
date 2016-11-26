'use strict';

let nock = require('nock'),
    chai = require('chai'),
    chaiPromise = require('chai-as-promised'),
    weatherInit = require('../../src/weather'),
    weatherData = require('../data/dc.weather')(null, {
        maxTemp: 75,
        minTemp: 55,
        heatIndexPercent: 0.05,
        conditions: [ { type: 'rain', length: 5, delay: 8 } ]
    });

chai.use(chaiPromise);
chai.should();
let expect = chai.expect;

const API_KEY = '1234567890';
const LAT = 38.9649734;
const LNG = -77.0207249;

describe('Weather core', function() {

    describe('options check', function() {
        it ('should return a promise', function() {
            expect(weatherInit()()).to.be.a('promise');
        });

        it('should reject with no API key', function() {
            return expect(weatherInit()()).to.eventually.be.rejectedWith(Error)
                    .and.have.property('message').that.contains('API key');
        });

        it('should reject with no lattitude', function() {
            let weather = weatherInit({ apiKey: '1234567890', location: { lng: 42 } });
            return expect(weather()).to.eventually.be.rejectedWith(Error)
                    .and.have.property('message').that.contains('attitude');
        });

        it('should reject with no longitude', function() {
            let weather = weatherInit({ apiKey: '1234567890', location: { lat: -13 } });
            return expect(weather()).to.eventually.be.rejectedWith(Error)
                    .and.have.property('message').that.contains('ongitude');
        });

        it('should reject with invalid date', function() {
            let weather = weatherInit({ apiKey: '1234567890', location: { lat: -13, lng: 42 } });
            return expect(weather('asdfghjkl')).to.eventually.be.rejectedWith(Error)
                    .and.have.property('message').that.contains('valid date');
        });

        it('should reject with date in the past', function() {
            let weather = weatherInit({ apiKey: '1234567890', location: { lat: -13, lng: 42 } });
            return expect(weather('1/1/2000')).to.eventually.be.rejectedWith(Error)
                    .and.have.property('message').that.contains('past');
        });

        it('should reject with date beyond 7 days', function() {
            let weather = weatherInit({ apiKey: '1234567890', location: { lat: -13, lng: 42 } });
            let futureTime = Date.now() + (8 * 86400000);
            return expect(weather(futureTime)).to.eventually.be.rejectedWith(Error)
                    .and.have.property('message').that.contains('7 days');
        });
    });

    describe('getting weather data', function() {
        beforeEach(function() {
            nock('https://api.darksky.net')
                .get(`/forecast/${API_KEY}/${LAT},${LNG}`)
                .reply(200, weatherData);
        });

        it('should resolve with correct data properties given valid options', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            let reqDate = Date.now() + (2 * 86400000);
            let p = weather(reqDate);

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'text', 'type'),
                expect(p).to.eventually.have.property('date').that.is.an.instanceof(Date),
                expect(p).to.eventually.have.property('type').that.equals('day-summary'),
                expect(p).to.eventually.have.property('text').that.is.a('string')
            ]);
        });

        it('should get an hour by hour summary type given a date of today', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            let p = weather(Date.now());

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'text', 'type'),
                expect(p).to.eventually.have.property('type').that.equals('hour-by-hour')
            ]);
        });

        it('should get an hour by hour summary type given NO date', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            let p = weather();

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'text', 'type'),
                expect(p).to.eventually.have.property('date').that.is.an.instanceof(Date),
                expect(p).to.eventually.have.property('type').that.equals('hour-by-hour')
            ]);
        });
    });

    describe('Full weather output', function() {

        beforeEach(function() {
            nock('https://api.darksky.net')
                .get(`/forecast/${API_KEY}/${LAT},${LNG}`)
                .reply(200, weatherData);
        });

        it('should have all the right data for "today"', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            return weather()
                .then(function(data) {
                    console.log(data);
                });
        });

        it('should have all the right data for "tomorrow"', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            return weather(Date.now() + 86400000)
                .then(function(data) {
                    console.log(data);
                });
        });

        it('should have all the right data for rain', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            return weather(Date.now() + (2 * 86400000))
                .then(function(data) {
                    console.log(data);
                });
        });
    });


});
