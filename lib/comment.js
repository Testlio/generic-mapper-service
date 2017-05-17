'use strict';

const _ = require('lodash');
const req = require('@testlio/discovered-request');
const moment = require('moment');
const commentFormatter = require('../formatters/comment');
const apiPath = require('./api-path');
const remoteCommentType = 'comment';
const TYPE = require('../constants/type');

/**
 * Composes auth header
 *
 * @param {Integration} integration integration data
 * @returns {Object} auth header
 */
function composeAuth(integration) {
    return { Authorization: `Bearer ${integration.integration.connection.accessToken}` };
}

/**
 * Creates comment equivalent to remote system
 *
 * @param {Integration} integration data of the remote system
 * @param {Object} resource resources data (parent id and such)
 * @param {Comment} data comment data to be synced over
 * @return {Object} comment in testlio format
 */
exports.post = (integration, resource, data) => {
    const payload = commentFormatter.toRemote(data, resource);
    console.log('Creating new comment to Asana');
    console.log(payload);
    return req({
        method: 'POST',
        headers: composeAuth(integration),
        url: apiPath.comment('POST', resource.parent.id),
        body: payload,
        json: true
    })
    .then((result) => commentFormatter.toLocal(result.data));
};

/**
 * GETs comment equivalent from remote system
 *
 * @param {Integration} integration data of the remote system
 * @param {Object} resource resources data
 * @return {Object} comment in testlio format
 */
exports.get = (integration, resource) => {
    console.log(`[${resource.id}].get`);
    return req({
        method: 'GET',
        headers: composeAuth(integration),
        url: apiPath.comment('GET', resource.id),
        json: true
    })
    .then((result) => commentFormatter.toLocal(result.data));
};

/**
 * GETs comments from remote system
 *
 * @param {Integration} integration data of the remote system
 * @param {Object} resource resources data
 * @return {Object} ids
 */
exports.getAll = (integration, resource) => {
    const url = apiPath.comment('LIST', resource.id);
    console.log(`Loading comments from '${url}'`);
    return req({
        method: 'GET',
        headers: composeAuth(integration),
        url: url,
        json: true
    }).then((result) => {
        console.log(result);
        const comments = _.filter(result.data, { type: remoteCommentType });
        return _.map(comments, (comment) => {
            return {
                id: comment.id.toString(),
                type: TYPE.COMMENT,
                createdAt: moment(comment.created_at).unix()
            };
        });
    });
};
