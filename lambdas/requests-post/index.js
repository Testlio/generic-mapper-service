'use strict';

require('dotenv').config();
const _ = require('lodash');
const req = require('@testlio/discovered-request');
const LambdaError = require('../../lib/error');
const aws = require('aws-sdk');
const lambda = new aws.Lambda();

const issue = require('../../lib/issue');
const comment = require('../../lib/comment');
const attachment = require('../../lib/attachment');

const TYPE = require('../../constants/type');

const authorization = { Authorization: `Bearer ${process.env.AUTH_TOKEN}` };

/**
 * Gets the requested action against remote API
 *
 * @param {Integration} integration integration details
 * @param {string} method method of the action
 * @param {Object} data data of the request
 * @param {Object} resource known resource data (type, remoteId, remoteParentId)
 * @return {Promise.<Object>} response from the client API
 */
const getRequest = (integration, method, data, resource) => {
    if (resource.type === TYPE.ISSUE) {
        if (method === 'MODIFIED') return issue.modified(integration, resource, data);
        if (method === 'GET') return issue.get(integration, resource);
        if (method === 'POST') return issue.post(integration, resource, data);
        if (method === 'PUT') return issue.put(integration, resource, data);
    } else if (resource.type === TYPE.COMMENT) {
        if (method === 'GET') return comment.get(integration, resource);
        if (method === 'POST') return comment.post(integration, resource, data);
    } else if (resource.type === TYPE.ATTACHMENT) {
        if (method === 'GET') return attachment.get(integration, resource);
        if (method === 'POST') return attachment.post(integration, resource, data);
        if (method === 'DELETE') return attachment.delete(resource, data);
    }
    throw new Error(`${resource.type} does not have method ${method}`);
};

/**
 * @param {Object} request request from integration-service
 * @return {Promise.<Object>} callback response data
 */
const executeRequest = (request) =>
    getRequest(request.integration, request.method, request.payload, request.resource)
        .then(result => _.extend(result, { success: true }))
        .catch(err => ({
            success: false,
            response: {
                message: err.message
            },
            resource: request.resource
        }));

/**
 * Send request result back to integration-service
 *
 * @param {Object} request request made
 * @param {Object} data result data
 * @param {boolean} success if the request was executed successfully
 * @returns {Promise.<Object>} response to the callback invoked
 */
const invokeCallback = (request, data) => {
    console.log('-mapper.remote:', data);
    const payload = _.merge(data, {
        resource: _.extend(request.resource, { id: _.get(data, 'resource.id', null) })
    });
    console.log('-mapper.callback:', payload);
    return req({
        method: 'POST',
        headers: authorization,
        url: request.callbackHref,
        body: payload,
        json: true
    }).then(() => {
        if (!payload.success) throw new Error('Request did not succeeed in mapper.');
        return Promise.resolve();
    });
};

/**
 * Spawn itself with another event.
 *
 * @param {Array<Object>} payload payload to be passed on
 * @param {Object} context lambda context
 * @return {Promise} context lambda context
 */
function spawnItself(payload, context) {
    return lambda.invoke({
        FunctionName: context.functionName,
        InvocationType: 'Event',
        Payload: JSON.stringify({
            body: {
                spawnedItself: true,
                payload: payload
            }
        })
    }).promise();
}

exports.handler = (event, context, cb) => {
    console.log('-mapper.event:', JSON.stringify(event, null, 4));
    if (!event.body.spawnedItself) {
        const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
        return spawnItself(body, context)
            .then(() => cb(null, { body: JSON.stringify({ success: true }) }))
            .catch((err) => LambdaError.report(err)
                .then(() => cb(null, { body: JSON.stringify({ success: false }) } )));
    }
    const request = event.body.payload;

    executeRequest(request)
    .then(data => invokeCallback(request, data))
    .then(() => cb(null, { success: true }))
    .catch(err => LambdaError.report(err).then(() => cb(null, err)));
};
