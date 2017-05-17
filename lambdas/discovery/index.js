'use strict';

require('dotenv').config();
const _ = require('lodash');
const Promise = require('bluebird');
const url = require('url');
const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const discovery = require('../../discovery.json');

/**
 * Iterate through discovery tree and expose hrefs
 *
 * @param {Object} object tree of paths
 * @param {string} prefix current href
 * @param {boolean} skipSelf if to make href for current element
 * @returns {Object} object with normal hrefs
 */
function resolveObject(object, prefix, skipSelf) {
    const results = {};

    if (!skipSelf) {
        results.href = prefix;
    }

    _.forOwn(object, function(value, key) {
        if (_.isEmpty(value)) {
            _.set(results, `${key}.href`, url.resolve(prefix, key));
        } else if (_.isObject(value) && value.resources) {
            results[key] = resolveObject(value.resources, url.reslove(prefix, key), value.passthrough);
        }
    });

    return results;
}

exports.handler = (event, context, cb) => {
    console.log(JSON.stringify(event, null, 4));
    Promise.resolve({ resources: resolveObject(discovery.resources, baseUrl, true) })
        .then(context.succeed)
        .then(cb).catch(cb);
};
