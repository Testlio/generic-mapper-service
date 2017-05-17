'use strict';

require('dotenv').config();
const _ = require('lodash');
const jwt = require('jsonwebtoken');

/**
 * Checks if jwt token is valid
 *
 * @param {string} token jwt token to be validated
 * @throws {Error} if token is invalid
 * @returns {string} decoded token
 */
function validateToken(token) {
    if (!token) return 'deny';

    if (_.startsWith(token, 'Bearer')) {
        token = token.substring(6).trim();
    }
    try {
        const secret = process.env.AUTH_SECRET || 'default_secret';
        jwt.verify(token, secret, { algorithms: ['HS256'] });
        return 'allow';
    } catch (err) {
        return 'unauthorized';
    }
}

const generatePolicy = function(principalId, effect, resource) {
    const authResponse = {};
    authResponse.principalId = principalId;
    if (effect && resource) {
        const policyDocument = {};
        policyDocument.Version = '2012-10-17';
        policyDocument.Statement = [];
        const statementOne = {};
        statementOne.Action = 'execute-api:Invoke';
        statementOne.Effect = effect;
        statementOne.Resource = resource;
        policyDocument.Statement[0] = statementOne;
        authResponse.policyDocument = policyDocument;
    }
    return authResponse;
};

exports.handler = (event, context, callback) => {
    const token = validateToken(event.authorizationToken);
    switch (token) {
    case 'allow':
        callback(null, generatePolicy('user', 'Allow', event.methodArn));
        break;
    case 'deny':
        callback(null, generatePolicy('user', 'Deny', event.methodArn));
        break;
    case 'unauthorized':
        callback('Unauthorized');
        break;
    default:
        callback('Error');
    }
};
