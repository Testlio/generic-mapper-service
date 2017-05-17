'use strict';

const url = require('url');
const qs = require('querystring');
const apiLocation = 'https://app.asana.com/api/1.0/';
const issuesHref = url.resolve(`${apiLocation}`, 'tasks');
const workspacesHref = url.resolve(`${apiLocation}`, 'workspaces');
const storiesHref = url.resolve(`${apiLocation}`, 'stories');
const attachmentsHref = url.resolve(`${apiLocation}`, 'attachments');

/**
 * Issue CRUD endpoints. GET, PUT, DELETE have the same paths, POST is different *
 * @param {string} method method of the request
 * @param {number} id id of the task for which to create comment under
 * @returns {string} url of the endpoint
 */
exports.issue = (method, id) => {
    if (method === 'POST') return issuesHref;
    return url.resolve(`${issuesHref}/`, id);
};

/**
 * Collection endpoints
 *
 * @param {Object} params query params
 * @returns {string} url of the endpoint
 */
exports.collection = (params) => {
    return `${issuesHref}?${qs.stringify(params)}`;
};

/**
 * GET/POST all tags under workspace
 *
 * @param {number} workspaceId id of the workspace
 * @returns {string} url of the endpoint
 */
exports.tags = (workspaceId) => {
    const workspaceHref = url.resolve(`${workspacesHref}/`, workspaceId);
    return url.resolve(`${workspaceHref}/`, 'tags');
};

/**
 * Put tag changes
 *
 * @param {string} method method of the request
 * @param {number} taskId id of the task
 * @param {number} tagId id of the tag
 * @returns {string} url of the endpoint
 */
exports.putTag = (method, taskId) => {
    const taskHref = url.resolve(`${issuesHref}/`, taskId);
    const path = method === 'ADD' ? 'addTag' : 'removeTag';
    return url.resolve(`${taskHref}/`, path);
};

/**
 * Can only be created or deleted, so should be the same endpoint
 *
 * @param {string} method method of the request
 * @param {number} id id of the task for which to create comment under or commentId
 * @returns {string} url of the endpoint
 */
exports.comment = (method, id) => {
    if (method === 'GET') return url.resolve(`${storiesHref}/`, id);
    const parentHref = this.issue('GET', id);
    return url.resolve(`${parentHref}/`, 'stories');
};

/**
 * Can only be created or deleted, so should be the same endpoint
 *
 * @param {string} method method of the request
 * @param {number} id id of the task for which to create attachment under or attachmentId
 * @returns {string} url of the endpoint
 */
exports.attachment = (method, id) => {
    if (method === 'GET') return url.resolve(`${attachmentsHref}/`, id);
    const parentHref = this.issue('GET', id);
    return url.resolve(`${parentHref}/`, 'attachments');
};
