'use strict';

let nock = require('nock'),
    chai = require('chai'),
    chaiPromise = require('chai-as-promised'),
    weatherInit = require('../../src/weather'),
    weatherData = require('../data/dc.weather');

chai.use(chaiPromise);
chai.should();
let expect = chai.expect;

const API_KEY = 'abcdef1234567890';
const LAT = 38.9649734;
const LNG = -77.0207249;

describe('Weather core', function() {

    beforeEach(function() {
        nock('https://api.forecast.io')
            .get(`/forecast/${API_KEY}/${LAT},${LNG}`)
            .reply(200, weatherData);
    });

    it('should return a promise, but reject with no API key', function() {
        return expect(weatherInit()()).to.eventually.be.rejectedWith(Error)
                .and.have.property('message').that.contains('API key');
    });


});
