#!/usr/bin/env node

/**
 * Test the fuzzy weather module with LIVE data.
 * 
 * First, set the WEATHER_API_KEY env var to your proper API key
 * 
 * Then run it: node test/live
 * 
 * You can set a couple options:
 *  --date=2022-10-09             The date to use for weather forecasting
 *  --file=./test/data/rain.json  The path to a static JSON data file to use instead of the API
 */

const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')

const args = yargs(hideBin(process.argv))
    .option('date', {
        alias: 'd',
        type: 'string',
        description: 'When do you want the forecast for? (valid JavaScript Date string)',
        defaultDescription: 'current date'
    })
    .option('file', {
        alias: 'f',
        type: 'string',
        description: 'Want to use static test data? (string file path)'
    })
    .option('start', {
        alias: 's',
        type: 'string',
        description: 'When should static test data start? (valid JavaScript Date string)',
        defaultDescription: 'current date/date'
    })
    .option('tzoffset', {
        alias: 'z',
        type: 'number',
        description: 'Offset from UTC for this run? (number of minutes)',
        default: -240
    })
    .parse()


let data = null
if (args.file) {
    data = updateDates(args.file, args.start)
}

const options = {
    apiKey: process.env.WEATHER_API_KEY,
    location: {
        lat: 38.9649734,
        lng: -77.0207249
    },
    timezoneOffset: args.tzoffset,
    __dataOverride: data || null
}

let weather = require('../src/weather')(options)
weather(args.date).then((data) => console.log(data)).catch(console.error)



function updateDates(file, start) {
    const data = require(file)

    // Need to loop through and set "dt" (and other) info correctly
    // file.

    return data
}