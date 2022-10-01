
let weather = require('../src/weather')({
    apiKey: process.env.WEATHER_API_KEY,
    location: {
        lat: 38.9649734,
        lng: -77.0207249
    }
})

weather().then((data) => console.log(data)).catch(console.error)
