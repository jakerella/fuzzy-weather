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
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

            let day = DAYS_OF_WEEK[(new Date(reqDate)).getDay()];

            // p.then(function(data) {
            //     console.log(data.text);
            // });

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'dailySummary', 'hourByHour'),
                expect(p).to.eventually.have.property('date').that.is.an.instanceof(Date),
                expect(p).to.eventually.have.property('hourByHour').that.is.null,
                expect(p).to.eventually.have.property('dailySummary').that.is.a('string'),
                expect(p).to.eventually.have.property('dailySummary').that.contains(day),
                expect(p).to.eventually.have.property('dailySummary').that.contains('light rain'),
                expect(p).to.eventually.have.property('dailySummary').that.contains('47 percent')
            ]);
        });

        it('should get an hour by hour summary type given a date of today', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            let p = weather(Date.now());

            // p.then(function(data) {
            //     console.log(data.text);
            // });

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'dailySummary', 'hourByHour'),
                expect(p).to.eventually.have.property('hourByHour').that.is.a('string'),
                expect(p).to.eventually.have.property('hourByHour').that.contains('today'),
                expect(p).to.eventually.have.property('dailySummary').that.is.a('string')
            ]);
        });

        it('should get an hour by hour summary type given a date of tomorrow', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            let p = weather(Date.now() + 86400000);

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'dailySummary', 'hourByHour'),
                expect(p).to.eventually.have.property('hourByHour').that.is.a('string'),
                expect(p).to.eventually.have.property('hourByHour').that.contains('tomorrow'),
                expect(p).to.eventually.have.property('dailySummary').that.is.a('string')
            ]);
        });

        it('should get an hour by hour summary type given NO date', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            let p = weather();

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'dailySummary', 'hourByHour'),
                expect(p).to.eventually.have.property('date').that.is.an.instanceof(Date),
                expect(p).to.eventually.have.property('hourByHour').that.is.a('string'),
                expect(p).to.eventually.have.property('hourByHour').that.contains('today'),
                expect(p).to.eventually.have.property('dailySummary').that.is.a('string')
            ]);
        });
    });

});
