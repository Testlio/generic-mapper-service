'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const req = require('@testlio/discovered-request');
const apiPath = require('./api-path');

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
 * Query all tags under workspace
 *
 * @param {Object} integration workspace info
 * @returns {Promise.<Array.<Object>>} list of existing tags
 */
function getWorkspaceTags(integration) {
    console.time('getWorkspaceTags');
    return req({
        method: 'GET',
        headers: composeAuth(integration),
        url: apiPath.tags(integration.integration.remoteId),
        json: true
    }).then((wsTags) => {
        console.timeEnd('getWorkspaceTags');
        return wsTags;
    });
}

/**
 * Creates tags to specified workspace.
 *
 * @param {Array.<string>} tags tags to be added
 * @param {Object} integration workspace for tags to be created to
 * @returns {Promise.<Array.<Object>>} list of added tags
 */
function createTags(tags, integration) {
    const promises = _.map(tags, (tag) => req({
        method: 'POST',
        headers: composeAuth(integration),
        url: apiPath.tags(integration.integration.remoteId),
        body: { data: { name: tag } },
        json: true
    }));
    return Promise.all(promises).then((result) => _.map(result, (row) => {
        return { id: row.data.id, name: row.data.name };
    }));
}

/**
 * Add tag to task
 *
 * @param {string} action add or remove
 * @param {Object} integration current integration
 * @param {number} taskId id of a task a add tag to be added to
 * @param {number} tagId id of tag to be added
 * @return {Promise} request
 */
function putTag(action, integration, taskId, tagId) {
    return req({
        method: 'POST',
        headers: composeAuth(integration),
        url: apiPath.putTag(action, taskId),
        body: { data: { tag: tagId } },
        json: true
    });
}

/**
 * Adds tags to task, first determining which tags already exist and reusing them.
 * Creates new tags if they dont exist.
 *
 * @param {Array.<string>} additions list of new tags
 * @param {Object} resource task to add tags to
 * @param {Object} integration workspace to create tags to
 * @returns {Promise.<Array.<Object>>}
 */
function addTags(additions, resource, integration) {
    return getWorkspaceTags(integration).then((existing) => {
        const reusable = _.filter(existing.data, tag => _.includes(additions, tag.name));
        const creations = _.filter(additions, tag => !_.find(reusable, { name: tag }));
        const createPromise = _.isEmpty(creations) ? Promise.resolve([]) : createTags(creations, integration);
        return createPromise.then((created) => {
            const add = _.compact(_.concat(reusable, created));
            return Promise.map(add, (tag) => putTag('ADD', integration, resource.id, tag.id));
        });
    });
}

/**
 * Look for required tags in preset tags
 *
 * @param {Object} integration integration at work
 * @param {Array.<string>} tags array of desired tags in plain text
 * @returns {Array.<int>} array of tag id-s
 */
function matchPresetTags(integration, tags) {
    const presetTags = _.get(integration.integration.meta, 'presetTags', []);
    const tagTexts = _.map(presetTags, 'name');
    const presets = _.intersection(tags, tagTexts);
    return _.map(presets, tagText => _.find(presetTags, { name: tagText }));
}

/**
 * Produces array of id's to be attached to a new task on creation
 *
 * @param {Object} integration integration at work
 * @param {Array.<string>} tags array of desired tags in plain text
 * @returns {Array.<int>} array of tag id-s
 */
exports.tagsList = (integration, tags) => {
    const presetTags = matchPresetTags(integration, tags);
    const existingIds = _.map(presetTags, 'id');
    if (existingIds.length === tags.length) {
        console.log('using only existings', JSON.stringify(_.map(presetTags, 'name'), null, 4));
        return existingIds;
    } else {
        const presetNames = _.map(presetTags, 'name');
        console.log('found and using existing', presetNames);
        const notPreset = _.difference(tags, presetNames);
        return getWorkspaceTags(integration).then((result) => {
            const existingTags = _.filter(result.data, tag => _.includes(notPreset, tag.name));
            const tagsToBeCreated = _.filter(notPreset, tag => !_.find(result.data, { name: tag }));
            return createTags(tagsToBeCreated, integration)
                .then((newTags) => _.map(_.concat(presetTags, existingTags, newTags), tag => tag.id));
        });
    }
};

/**
 * Makes necessary additions and deletions to task tags
 *
 * @param {Array.<Object>} currentTags current remote tags
 * @param {Array.<string>} desiredTags to be added tags
 * @param {Object} integration integration
 * @param {Object} resource task resource
 * @returns {Promise} promise of the action
 */
exports.putTagsToTask = (currentTags, desiredTags, integration, resource) => {
    const additions = _.filter(desiredTags, tag => !_.find(currentTags, { name: tag }));
    const removals = _.filter(currentTags, (tag) => !_.includes(desiredTags, tag.name));
    const additionPromise = _.isEmpty(additions) ? Promise.resolve([]) : addTags(additions, resource, integration);
    console.log('Adding tags to task:', additions);
    console.log('Removing tags from task:', removals);
    return Promise.props({
        add: additionPromise,
        remove: Promise.map(removals, (tag) => putTag('REMOVE', integration, resource.id, tag.id))
    });
};

exports.resolveTagToId = (tagName, integration) => {
    const presetTags = _.get(integration.integration.meta, 'presetTags', []);
    const presetMatch = _.find(presetTags, { name: tagName });
    if (presetMatch) {
        console.log('using preset match');
        return Promise.resolve(presetMatch.id);
    }

    return getWorkspaceTags(integration).then((response) => {
        const tagObject = _.find(response.data, { name: tagName });
        if (tagObject) return tagObject.id;
    });
};
