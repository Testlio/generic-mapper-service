'use strict';

require('dotenv').config();
const _ = require('lodash');
const Promise = require('bluebird');
const unmarshalItem = require('dynamodb-marshaler').unmarshalItem;
const aws = require('aws-sdk');
const lambda = new aws.Lambda();
const req = require('@testlio/discovered-request');
const LambdaError = require('../../lib/error');

const Request = require('../../models/request');
const issue = require('../../lib/issue');
const comment = require('../../lib/comment');
const attachment = require('../../lib/attachment');

const TYPE = require('../../constants/type');
const FLAG = require('../../constants/flag');
const TIMEOUT = 45000;
const NEXT_REQUEST_DELAY = 1000;

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
    return Promise.reject(new Error(`${resource.type} does not have method ${method}`));
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
            response: err.message,
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
        resource: _.extend(request.resource, { id: data.resource.id })
    });
    console.log('-mapper.callback:', payload);
    return req({
        method: 'POST',
        headers: authorization,
        url: request.callbackHref,
        body: payload,
        json: true,
        timeout: TIMEOUT
    });
};

/**
 * Spawn itself with another event.
 *
 * @param {Array<Object>} payload payload to be passed on
 * @param {Object} context lambda context
 * @return {Promise} context lambda context
 */
const spawnItself = (payload, context) => (
    _.isEmpty(payload)
        ? Promise.resolve()
        : lambda.invoke({
            FunctionName: context.functionName,
            InvocationType: 'Event',
            Payload: JSON.stringify({
                spawnedItself: true,
                payload: payload
            })
        }).promise()
);

exports.handler = (event, context, cb) => {
    console.log('-mapper.event:', JSON.stringify(event, null, 4));
    if (!event.spawnedItself) {
        const records = _(event.Records)
            .filter(row => row.eventName === 'INSERT' || row.eventName === 'MODIFY')
            .map(record => unmarshalItem(record.dynamodb.NewImage))
            .filter({ flag: FLAG.INPROGRESS });

        return Promise.map(records, record => spawnItself(record, context))
            .then(context.succeed)
            .catch(err => LambdaError.report(err).then(() => cb(null, err)));
    }
    const delay = _.get(event, 'payload.request.integration.integration.meta.delay', NEXT_REQUEST_DELAY);
    const integrationGuid = _.get(event, 'payload.integrationGuid');
    executeRequest(event.payload.request)
        .then((data) => invokeCallback(event.payload.request, data))
        .then((data) => Request.consumeAndPush(delay, event.payload.guid, integrationGuid, true).then(() => cb(null, data)))
        .catch((err) => Request.consumeAndPush(delay, event.payload.guid, integrationGuid, false, err)
            .then(() => LambdaError.report(err).then(() => cb(null, err))));
};
