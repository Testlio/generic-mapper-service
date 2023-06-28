'use strict';

const moment = require('moment');

/**
 * Formats remote systems data to Testlio comment format
 *
 * @param {Object} remoteData data in remote system format
 * @returns {Object} data in issue-service format
 */
exports.toLocal = (remoteData) => {
    return {
        resource: {
            id: remoteData.id.toString(),
            createdAt: moment(remoteData.created_at).unix()
        },
        response: {
            comment: remoteData.text
        },
        remoteRevision: remoteData.created_at
    };
};

/**
 * Formats Testlios data to remote system format
 *
 * @param {Object} data comment in Testlio format
 * @param {Object} resource remote reosource data of the comment
 * @returns {Object} data in remote service format
 */
exports.toRemote = (data, resource) => {
    return {
        data: {
            task: Number(resource.parent.id),
            text: data.comment
        }
    };
};
