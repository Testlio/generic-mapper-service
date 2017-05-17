'use strict';

const _ = require('lodash');
const Raygun = require('./raygun');
const Promise = require('bluebird');
const pjson = require('../../package.json');

/**
 * Report an error, with optional additional tags
 *
 * @param {Object} error error to report
 * @param {Array.<string>} additionalTags optional additional tags to report
 * @param {Object} extra optional extra metadata to include in the error report
 * @returns {Promise.<Object>} promise which resolves into the passed in error
 */
function report(error, additionalTags, extra) {
    const tags = [pjson.name].concat(additionalTags);

    return Promise.resolve(tags).then(function(t) {
        return new Promise(function(resolve) {
            const sentError = error.nativeError ? error.nativeError : error;
            Raygun.send(sentError, _.merge(extra || {}, error.extra), function(res) {
                if (res) {
                    if (res.statusCode !== 202) {
                        console.log('Failed to report error to Raygun', res);
                    } else {
                        console.log('Reported error to Raygun', error.message);
                    }
                }
                resolve(error);
            }, error.request, t);
        });
    }).catch(function(err) {
        console.error(err);
        return error;
    });
}

/**
 * Create a new error object
 *
 * @param {number} code code for the error (for example HTTP response code)
 * @param {string} message error message
 * @param {Object} extra additional metadata sent when reporting the error
 * @param {Object} request optional request information sent when reporting
 * @returns {Object} error
 */
function LambdaError(code, message, extra, request) {
    Error.captureStackTrace(this, this.constructor);
    this.name = 'LambdaError';
    this.message = `${code}: ${message}`;
    this.code = code;
    this.extra = extra;
    this.request = request;
    this.nativeError = new Error(this.message);
    Error.captureStackTrace(this.nativeError, this.constructor);
}

require('util').inherits(LambdaError, Error);
LambdaError.prototype.report = function(additionalTags) {
    report(this, additionalTags);
};
LambdaError.report = report;

module.exports = LambdaError;
