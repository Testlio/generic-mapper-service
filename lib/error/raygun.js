'use strict';

require('dotenv').config();
const Raygun = require('raygun');

let RaygunClient;
const apiKey = process.env.RAYGUN_API_KEY;

if (apiKey) {
    RaygunClient = new Raygun.Client().init({ apiKey: apiKey });
} else {
    console.log('Raygun not initialized. Missing API key.');
    RaygunClient = {
        send: function(error, extra, cb) {
            cb();
        }
    };
}

module.exports = {
    send: function(error, extra, cb, request, tags) {
        RaygunClient.send(error, extra, cb, request, tags);
    }
};
