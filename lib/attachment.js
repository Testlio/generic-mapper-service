'use strict';

const _ = require('lodash');
const request = require('request-promise');
const attachmentFormatter = require('../formatters/attachment');
const apiPath = require('./api-path');
const TYPE = require('../constants/type');
const s3 = require('./s3');
const Promise = require('bluebird');

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
 * Contert remote attachment to local Testlio format.
 *
 * @param {Integration} integration data of the remote system
 * @param {Object} resource resources data
 * @param {Object} remoteAttachment attachment in remote format
 * @return {Object} attachment in testlio format
 */
function convertToLocalAttachment(integration, resource, remoteAttachment) {
    return s3.copy('integration', remoteAttachment.name, remoteAttachment.download_url)
        .then((assetHref) => attachmentFormatter.toLocal(remoteAttachment, assetHref));
}

/**
 * Returns parent task id for the comment given
 *
 * @param {Integration} integration data of the remote system
 * @param {string} commentId comment id equivalent in Asana
 * @return {string} taskId
 */
function getTaskId(integration, commentId) {
    return request({
        method: 'GET',
        headers: composeAuth(integration),
        url: apiPath.comment('GET', commentId),
        json: true
    }).then((result) => result.data.target.id.toString());
}

/**
 * Posts attachment to Asana
 *
 * @param {Integration} integration data of the remote system
 * @param {string} taskId task id
 * @param {string} downloadUrl attachment href
 * @param {string} filename name of the file
 * @return {object} Asana response
 */
function postData(integration, taskId, downloadUrl, filename) {
    return request({
        method: 'POST',
        headers: composeAuth(integration),
        url: apiPath.attachment('POST', taskId),
        json: true,
        formData: {
            file: {
                value: request(downloadUrl),
                options: {
                    filename: filename
                }
            }
        }
    });
}
/**
 * GETs attachment equivalent from remote system
 *
 * @param {Integration} integration data of the remote system
 * @param {Object} resource resources data
 * @return {Object} attachment in testlio format
 */
exports.get = (integration, resource) => {
    console.log(`[${resource.id}].get`);
    return request({
        method: 'GET',
        headers: composeAuth(integration),
        url: apiPath.attachment('GET', resource.id),
        json: true
    })
    .then((result) => {
        console.log(`[${resource.id}].get-result: `, JSON.stringify(result, null, 4));
        return convertToLocalAttachment(integration, resource, result.data);
    });
};

/**
 * Creates attachment equivalent to remote system
 *
 * @param {Integration} integration data of the remote system
 * @param {Object} resource resources data (parent id and such)
 * @param {Comment} data comment data to be synced over
 * @return {Object} attachment in Testlio format
 */
exports.post = (integration, resource, data) => {
    console.log('Creating new attachment to Asana');
    console.log(data);

    const taskIdPromise = resource.parent.type === TYPE.COMMENT
        ? getTaskId(integration, resource.parent.id)
        : Promise.resolve(resource.parent.id);

    return taskIdPromise
        .then((taskid) => postData(integration, taskid, data.assetHref, data.name))
        .then((result) => attachmentFormatter.toLocal(result.data, data.assetHref));
};

/**
 * Deletes attachment equivalent from remote system
 *
 * @param {Object} resource resources data (parent id and such)
 * @param {Comment} data comment data to be synced over
 * @return {Object} attachment in Testlio format
 */
exports.delete = (resource, data) => {
    console.log('Deleting attachment from Asana');
    console.log(data);
    return Promise.resolve(attachmentFormatter.toLocal({ id: resource.id, name: data.name }, data.assetHref));
};

/**
 * GETs attachments from remote system
 *
 * @param {Integration} integration data of the remote system
 * @param {Object} resource resources data
 * @return {Object} ids
 */
exports.getAll = (integration, resource) => {
    const url = apiPath.attachment('LIST', resource.id);
    console.log(`Loading attachments from '${url}'`);
    return request({
        method: 'GET',
        headers: composeAuth(integration),
        url: url,
        json: true
    }).then((result) => {
        console.log(result);
        return _.map(result.data, (attachment) => {
            return {
                id: attachment.id.toString(),
                type: TYPE.ATTACHMENT
            };
        });
    });
};
