'use strict';

let nock = require('nock'),
    debugOutput = require('debug')('fuzzy-weather:output'),
    chai = require('chai'),
    chaiPromise = require('chai-as-promised'),
    _ = require('lodash'),
    weatherInit = require('../../src/weather'),
    weatherData = require('../data/dc.weather')(null, {
        maxTemp: 75,
        minTemp: 55,
        heatIndexPercent: 0.05,
        conditions: [ { type: 'rain', length: 5, delay: 8 } ]
    }),
    origCurrently = _.clone(weatherData.currently);

chai.use(chaiPromise);
chai.should();
let expect = chai.expect;

const API_KEY = '1234567890';
const LAT = 38.9649734;
const LNG = -77.0207249;
const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

describe('Weather core', function() {

    afterEach(function() {
        weatherData.currently = origCurrently;
        weatherData.alerts = null;
    });

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

    describe('getting daily weather data', function() {
        beforeEach(function() {
            nock('https://api.darksky.net')
                .get(new RegExp(`forecast/${API_KEY}/${LAT},${LNG}`))
                .reply(200, weatherData);
        });

        it('should resolve with correct data properties given valid options', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            let reqDate = Date.now() + (2 * 86400000);
            let p = weather(reqDate);

            let day = DAYS_OF_WEEK[(new Date(reqDate)).getDay()];

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'currently', 'dailySummary', 'hourByHour'),
                expect(p).to.eventually.have.property('date').that.is.an.instanceof(Date),
                expect(p).to.eventually.have.property('hourByHour').that.is.null,
                expect(p).to.eventually.have.property('currently').that.is.null,
                expect(p).to.eventually.have.property('dailySummary').that.is.a('object'),
                expect(p).to.eventually.have.property('dailySummary')
                    .that.has.property('forecast').that.is.a('string'),
                expect(p).to.eventually.have.property('dailySummary')
                    .that.has.property('forecast').that.contains(day),
                expect(p).to.eventually.have.property('dailySummary')
                    .that.has.property('forecast').that.contains('light rain'),
                expect(p).to.eventually.have.property('dailySummary')
                    .that.has.property('forecast').that.contains('47 percent'),
                expect(p).to.eventually.have.property('dailySummary')
                    .that.has.property('data').that.is.an('object'),
                expect(p).to.eventually.have.property('dailySummary')
                    .that.has.property('conditions').that.is.an('object'),
                expect(p).to.eventually.have.property('dailySummary')
                    .that.has.property('conditions').that.is.an('object').that.has.property('rain')
            ]);
        });

    });

    describe('getting hourly weather data', function() {
        beforeEach(function() {
            nock('https://api.darksky.net')
                .get(new RegExp(`forecast/${API_KEY}/${LAT},${LNG}`))
                .reply(200, weatherData);
        });

        it('should get an hour by hour summary type given a date of today', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            let p = weather(Date.now());

            p.then(function(data) {
                debugOutput(data.date);
                debugOutput('CURRENT', data.currently && data.currently.forecast);
                debugOutput('DAILY', data.dailySummary && data.dailySummary.forecast);
                debugOutput('HOURLY', data.hourByHour && data.hourByHour.forecast);
            });

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'currently', 'dailySummary', 'hourByHour'),
                expect(p).to.eventually.have.property('hourByHour').that.is.a('object'),
                expect(p).to.eventually.have.property('hourByHour')
                    .that.has.property('forecast').that.is.a('string')
                    .and.contains('rain'),
                expect(p).to.eventually.have.property('hourByHour')
                    .that.has.property('data').that.is.an('array'),
                expect(p).to.eventually.have.property('hourByHour')
                    .that.has.property('conditions').that.is.an('object')
            ]);
        });

        it('should get an hour by hour summary type given a date of tomorrow', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            let p = weather(Date.now() + 86400000);

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'currently', 'dailySummary', 'hourByHour'),
                expect(p).to.eventually.have.property('currently').that.is.null,
                expect(p).to.eventually.have.property('hourByHour').that.is.an('object'),
                expect(p).to.eventually.have.property('hourByHour')
                    .that.has.property('forecast').that.is.a('string'),
                expect(p).to.eventually.have.property('hourByHour').that.has.property('forecast')
                    .that.is.a('string'),
                expect(p).to.eventually.have.property('hourByHour')
                    .that.has.property('data').that.is.an('array'),
                expect(p).to.eventually.have.property('hourByHour')
                    .that.has.property('conditions').that.is.an('object'),
                expect(p).to.eventually.have.property('dailySummary').that.is.a('object'),
                expect(p).to.eventually.have.property('dailySummary').that.has.property('forecast').that.is.a('string')
            ]);
        });

        it('should get an hour by hour summary type given NO date', function() {
            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            let p = weather();

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'currently', 'dailySummary', 'hourByHour'),
                expect(p).to.eventually.have.property('date').that.is.an.instanceof(Date),
                expect(p).to.eventually.have.property('hourByHour').that.is.an('object'),
                expect(p).to.eventually.have.property('hourByHour')
                    .that.has.property('forecast').that.is.a('string'),
                expect(p).to.eventually.have.property('hourByHour')
                    .that.has.property('forecast').that.contains('rain'),
                expect(p).to.eventually.have.property('hourByHour')
                    .that.has.property('data').that.is.an('array'),
                expect(p).to.eventually.have.property('hourByHour')
                    .that.has.property('conditions').that.is.an('object'),
                expect(p).to.eventually.have.property('dailySummary').that.is.a('object'),
                expect(p).to.eventually.have.property('dailySummary').that.has.property('forecast').that.is.a('string')
            ]);
        });

    });

    describe('getting daily weather data', function() {

        it('should get current conditions for today with all sorts of activity', function() {
            weatherData.currently = _.clone(weatherData.currently);
            weatherData.currently.apparentTemperature = weatherData.currently.temperature + 6;
            weatherData.currently.precipType = 'rain';
            weatherData.currently.precipIntensity = 0.18;
            weatherData.currently.precipProbability = 0.9;
            weatherData.currently.humidity = 0.75;
            weatherData.currently.dewPoint = 75;
            weatherData.currently.windSpeed = 19.76;
            weatherData.alerts = [
                {
                    'title': 'Red Flag Warning for Washington, DC',
                    'time': Math.round(Date.now() / 1000) - (60 * 60),  // start time of the alert
                    'expires': Math.round(Date.now() / 1000) + (60 * 60 * 4),
                    'description': '... EXCESSIVELY LONG DESCRIPTION ...',
                    'uri': 'https://alerts.weather.gov/cap/wwacapget.php?x=[ALERT_ID]'
                }
            ];

            nock('https://api.darksky.net')
                .get(new RegExp(`forecast/${API_KEY}/${LAT},${LNG}`))
                .reply(200, weatherData);

            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            let p = weather();

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'currently', 'dailySummary', 'hourByHour'),
                expect(p).to.eventually.have.property('currently').that.has.keys('data', 'forecast'),
                expect(p).to.eventually.have.property('currently').that.has.property('forecast').that.is.a('string')
                    .that.contains(Math.round(weatherData.currently.temperature) + ' degrees')
                    .and.contains('feels like ' + Math.round(weatherData.currently.apparentTemperature))
                    .and.contains('75 percent humidity')
                    .and.contains('moderate rain')
                    .and.contains('wind').and.contains('20 miles per hour')
                    .and.contains('weather alert').and.contains('Red Flag')
            ]);
        });

        it('should get current conditions for today with nothing going on', function() {
            weatherData.currently = _.clone(origCurrently);
            weatherData.alerts = null;
            nock('https://api.darksky.net')
                .get(new RegExp(`forecast/${API_KEY}/${LAT},${LNG}`))
                .reply(200, weatherData);

            let weather = weatherInit({ apiKey: API_KEY, location: { lat: LAT, lng: LNG } });
            let p = weather();

            return Promise.all([
                expect(p).to.eventually.have.keys('date', 'currently', 'dailySummary', 'hourByHour'),
                expect(p).to.eventually.have.property('currently').that.has.keys('data', 'forecast'),
                expect(p).to.eventually.have.property('currently').that.has.property('forecast').that.is.a('string')
                    .that.contains(Math.round(weatherData.currently.temperature) + ' degrees')
                    .and.to.not.contain('rain')
                    .and.to.not.contain('humidity')
                    .and.to.not.contain('feels like')
                    .and.to.not.contain('wind')
                    .and.to.not.contain('alert')
            ]);
        });
    });

});
