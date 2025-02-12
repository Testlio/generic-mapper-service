'use strict';

const _ = require('lodash');
const SEVERITY = require('../constants/severity');
const STATE = require('../constants/state');
const TESTLIO_TAG = 'testlio';
const EMPTY_TITLE = '(no title)';
const EMPTY_DESCRIPTION = '(no description)';

/**
 * Map testlio issue severity to tag
 *
 * @param {string} severity severity of issue
 * @returns {string} tag severity
 */
function toRemoteSeverity(severity) {
    if (SEVERITY.LOCAL.HIGH === severity) return SEVERITY.REMOTE.HIGH;
    if (SEVERITY.LOCAL.MEDIUM === severity) return SEVERITY.REMOTE.MEDIUM;
    return SEVERITY.REMOTE.LOW;
}

/**
 * Checks if value is in array (case insensitive mode)
 *
 * @param {array.<string>} array from where to find the value
 * @param {string} value to look for
 * @returns {boolean} true when array contained the value
 */
function includes(array, value) {
    return _.some(array, (item) => {
        return _.toLower(item) === _.toLower(value);
    });
}

/**
 * Map asana issue severity to tag
 *
 * @param {Array.<string>} tags list of tags to search severity from
 * @returns {string} tag severity
 */
function detectSeverity(tags) {
    if (includes(tags, SEVERITY.REMOTE.HIGH)) return SEVERITY.LOCAL.HIGH;
    if (includes(tags, SEVERITY.REMOTE.MEDIUM)) return SEVERITY.LOCAL.MEDIUM;
    return SEVERITY.LOCAL.LOW;
}

/**
 * Converts remote state to local state
 *
 * @param {Object} remoteData data in remote system format
 * @returns {string} state
 */
function getLocalState(remoteData) {
    return remoteData.data.completed ? STATE.FIXED : STATE.OPEN;
}

/**
 * Formats remote systems data to Testlio issue format
 *
 * @param {Object} remoteData data in remote system format
 * @returns {Object} data in issue-service format
 */
exports.toLocal = (remoteData) => {
    console.log(`[${remoteData.data.id}].remote: `, JSON.stringify(remoteData, null, 4));
    const tags = _.map(remoteData.data.tags, tag => tag.name);
    const severity = detectSeverity(tags);
    const labels = _.compact(_.pull(tags, TESTLIO_TAG, toRemoteSeverity(severity)));
    return {
        resource: {
            id: remoteData.data.id.toString()
        },
        response: {
            state: getLocalState(remoteData),
            issueData: {
                title: remoteData.data.name || EMPTY_TITLE,
                description: remoteData.data.notes || EMPTY_DESCRIPTION,
                severity: severity,
                labels: labels
            }
        },
        remoteRevision: remoteData.data.modified_at
    };
};

/**
 * Formats Testlios data to remote system format
 *
 * @param {Object} issue in Testlio format
 * @param {Object} integration settings
 * @param {Object} resource remote reosource data of the issue
 * @returns {Object} data in remote service format
 */
exports.toRemote = (issue, integration, resource) => {
    const title = issue.issueData.title === EMPTY_TITLE ? '' : issue.issueData.title;
    const description = issue.issueData.description === EMPTY_DESCRIPTION ? '' : issue.issueData.description;
    const tags = _.concat(issue.issueData.labels, [toRemoteSeverity(issue.issueData.severity), TESTLIO_TAG]);
    return {
        data: {
            workspace: Number(resource.parent.id),
            projects: [Number(integration.integration.meta.projectId)],
            name: title,
            notes: description,
            completed: issue.state === STATE.FIXED || issue.state === STATE.CLOSED
        },
        tags: tags
    };
};
