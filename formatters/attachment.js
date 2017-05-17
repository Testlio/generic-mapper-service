'use strict';

/**
 * Formats remote systems data to Testlio comment format
 *
 * @param {Object} remoteData data in remote system format
 * @param {Object} assetHref in local S3
 * @returns {Object} data in issue-service format
 */
exports.toLocal = (remoteData, assetHref) => {
    console.log('Converting attachment to local');
    console.log(remoteData);
    return {
        resource: {
            id: remoteData.id.toString()
        },
        response: {
            name: remoteData.name,
            assetHref: assetHref
        },
        remoteRevision: remoteData.created_at
    };
};
