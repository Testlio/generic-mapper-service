'use strict';

require('dotenv').config();
const _ = require('lodash');
const fs = require('fs');
const path = require('path');

const stage = process.env.STAGE || 'local';

/**
 * Try to load conf file
 *
 * @param {string} file file name
 * @returns {Object} configuration object
 */
function loadConfig(file) {
    try {
        return JSON.parse(fs.readFileSync(file));
    } catch (err) {
        return {};
    }
}

const basicConf = {
    aws: {
        stage: stage,
        projectName: process.env.PROJECT_NAME,
        region: process.env.REGION || 'us-east-1'
    }
};
const customConf = loadConfig(path.resolve('config/', `${stage}.json`));
module.exports = _.merge({}, customConf, basicConf);
