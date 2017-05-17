'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const req = require('@testlio/discovered-request');
const issueFormatter = require('../formatters/issue');
const apiPath = require('./api-path');
const comment = require('./comment');
const attachment = require('./attachment');
const tag = require('./tag');

const TESTLIO_TAG = 'testlio';

/**
 * Composes auth header
 *
 * @param {Integration} integration integration data
 * @returns {Object} auth header
 */
const composeAuth = (integration) => (
    { Authorization: `Bearer ${integration.integration.connection.accessToken}` }
);

/**
* Retrieves subresources for issue
*
* @param {Integration} integration integration data
* @param {Object} resource resources data
* @returns {Object} issue with subresources
*/
const getSubResources = (integration, resource) => Promise.props({
    comments: comment.getAll(integration, resource),
    attachments: attachment.getAll(integration, resource)
}).then(data => _.concat(data.comments, data.attachments));

/**
 * Creates issue equivalent to remote system
 *
 * @param {Integration} integration data of the remote system
 * @param {Object} resource resources data (parent id and such)
 * @param {Issue} data issue data to be synced over
 * @return {Object} issue in testlio format
 */
exports.post = (integration, resource, data) => {
    const payload = issueFormatter.toRemote(data, integration, resource);
    console.log(`[${resource.parent.id}].post`);
    console.log(`[${resource.parent.id}].post-payload: `, JSON.stringify(payload, null, 4));
    return tag.tagsList(integration, payload.tags).then(tags => req({
        method: 'POST',
        headers: composeAuth(integration),
        url: apiPath.issue('POST'),
        body: { data: _.extend(payload.data, { tags }) },
        json: true
    })).then(result => {
        console.log(`[${resource.parent.id}].post-result: `, JSON.stringify(result, null, 4));
        return issueFormatter.toLocal(result);
    });
};

/**
 * GETs issue equivalent from remote system
 *
 * @param {Integration} integration data of the remote system
 * @param {string} remoteId remote id
 * @return {Object} issue in testlio format
 */
const getRemoteIssue = (integration, remoteId) => req({
    method: 'GET',
    headers: composeAuth(integration),
    url: apiPath.issue('GET', remoteId),
    json: true
}).then(issueFormatter.toLocal);

/**
 * GETs issue equivalent from remote system and includes subresources
 *
 * @param {Integration} integration data of the remote system
 * @param {Object} resource resources data
 * @return {Object} issue in testlio format
 */
exports.get = (integration, resource) => {
    console.log(`[${resource.id}].get`);
    return getRemoteIssue(integration, resource.id).then(result => {
        console.log(`[${resource.id}].get-result: `, JSON.stringify(result, null, 4));
        return getSubResources(integration, resource)
            .then(subresources => _.extend(result, { subresources: subresources }));
    });
};

/**
 * PUT issue changes to remote system
 *
 * @param {Integration} integration data of the remote system
 * @param {Object} resource resources data
 * @param {Issue} data issue data
 * @return {Object} issue in testlio format
 */
exports.put = (integration, resource, data) => {
    const payload = issueFormatter.toRemote(data, integration, resource);
    delete payload.data.workspace;
    delete payload.data.projects;
    console.log(`[${resource.id}].put`);
    console.log(`[${resource.id}].put-payload: `, JSON.stringify(payload, null, 4));
    return req({
        method: 'PUT',
        headers: composeAuth(integration),
        url: apiPath.issue('PUT', resource.id),
        body: { data: payload.data },
        json: true
    }).then(result => {
        console.log(`[${resource.id}].put-result: `, JSON.stringify(result, null, 4));
        return tag.putTagsToTask(result.data.tags, payload.tags, integration, resource)
            .then(() => result);
    }).then(issueFormatter.toLocal);
};

/**
 * Find modified issues, by intersecting all modified
 * issues with the ones we track in this integration.
 *
 * @param {Array} tracked list of tracked ids
 * @param {Array} modifiedWithTag tasks, modified in asana
 * @returns {Array} list of issues that have been changed
 */
const findModified = (tracked, modifiedWithTag) => _.intersection(tracked, modifiedWithTag);

/**
 * Find new issues with testlio tag, appeared in the project we track
 *
 * @param {Array} tracked list of tracked ids
 * @param {Array} modifiedWithTag tasks, modified in asana
 * @param {Array} modifiedInProject tasks, modified in project (with any tag)
 * @returns {Array} list of issues that have been changed
 */
const findNew = (tracked, modifiedWithTag, modifiedInProject) =>
    _.difference(_.intersection(modifiedInProject, modifiedWithTag), tracked);


/**
 * Get all issues with testlio tag, that have been modified since the last request
 *
 * @param {Object} integration integration
 * @param {string} modifiedSince last modified time
 * @throws {Error} when no modified since is present
 * @return {Array.<string>} list of modified issues
 */
const getModifiedWithTag = (integration) => {
    const modifiedSince = _.get(integration, 'integration.syncedAt', 0);
    if (!modifiedSince) return new Error('syncedAt is missing');

    return tag.resolveTagToId(TESTLIO_TAG, integration).then(tagId =>{
        return req({
            method: 'GET',
            headers: composeAuth(integration),
            url: apiPath.collection({
                tag: tagId,
                modified_since: modifiedSince // eslint-disable-line camelcase
            }),
            json: true
        });
    }).then(response => _.map(response.data, row => row.id.toString()));
};

/**
 * Get all issues in project, that have been modified since the last request
 *
 * @param {Object} integration integration
 * @param {string} modifiedSince last modified time
 * @return {Array.<string>} list of modified issues
 */
const getModifiedInProject = (integration) =>
    req({
        method: 'GET',
        headers: composeAuth(integration),
        url: apiPath.collection({
            project: integration.integration.meta.projectId,
            modified_since: _.get(integration, 'integration.syncedAt', 0) // eslint-disable-line camelcase
        }),
        json: true
    }).then(response => _.map(response.data, row => row.id.toString()));


/**
 * Emulate current time in Asana server
 *
 * @returns {string} current timestamp
 */
const currentServerTime = () => new Date().toISOString();

/**
 * Returns issues modified since given timestamp
 *
 * @param {Integration} integration data of the remote system
 * @param {Array.<Object>} tracked issues currently tracked
 * @return {Object} response object
 */
const getNewAndModified = (integration, tracked) =>
    Promise.props({
        syncedAt: currentServerTime(), // time must be generated before the network requests
        modifiedInProject: getModifiedInProject(integration),
        modifiedWithTag: getModifiedWithTag(integration)
    }).then(result => ({
        changed: findModified(tracked, result.modifiedWithTag),
        new: findNew(tracked, result.modifiedWithTag, result.modifiedInProject),
        syncedAt: result.syncedAt
    }));


/**
 * Checks if any issue have been modified in the remote system.
 *
 * @param {Integration} integration data of the remote system
 * @param {Object} resource known resource data (type, remoteId, remoteParentId)
 * @param {Object} trackedIssues issues monitored by the integrations
 * @return {array.<string>} array of issues modified after last sync
 */
exports.modified = (integration, resource, trackedIssues) => {
    console.log(`[${integration.integration.guid}].modified`);
    return getNewAndModified(integration, _.map(trackedIssues, 'remoteId'))
        .then(response => ({ resource, response }));
};
