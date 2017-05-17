'use strict';


const request = require('request-promise');
const discoveredRequest = require('@testlio/discovered-request');
const contentDisposition = require('content-disposition');
const config = require('./config');

/**
 * Register urls in upload-service
 *
 * @param {string} prefix in S3
 * @param {string} contentType of the file that is going to be uploaded
 * @returns {Object} urls
 */
function getUrls(prefix, contentType) {
    return discoveredRequest({
        servicePath: 'upload.v1.files',
        api: config.apiUrl,
        headers: { Authorization: `Bearer ${process.env.AUTH_TOKEN}` },
        method: 'POST',
        body: { prefix, contentType },
        json: true
    });
}

/**
 * Downloads content from specific url
 *
 * @param {string} url get url
 * @returns {Promise.<Response>} promise to get content that resolves to Response
 */
function downloadContent(url) {
    return request.get({
        url: url,
        resolveWithFullResponse: true,
        encoding: null
    });
}

/**
 * Uploads data to specific url
 *
 * @param {string} url where to upload
 * @param {string} filename name of the file
 * @param {string} contentType content type
 * @param {binary} data content to upload
 * @returns {Promise} promise to upload content
 */
function uploadContent(url, filename, contentType, data) {
    return request({
        method: 'PUT',
        url: url,
        headers: {
            'Content-Type': contentType,
            'Content-Disposition': contentDisposition(filename)
        },
        body: data
    });
}

/**
 * Copy remote attachment to S3 and return its url
 *
 * @param {string} prefix that is going to be used in S3
 * @param {string} filename e.g 'foo.pdf'
 * @param {string} downloadUrl address from where to load the content
 * @returns {string} assetHref
 */
exports.copy = (prefix, filename, downloadUrl) => {
    return downloadContent(downloadUrl)
        .then((response) => {
            const contentType = response.headers['content-type'];
            return getUrls(prefix, contentType).then((urls) => {
                return uploadContent(urls.put.href, filename, contentType, response.body)
                    .then(() => urls.get.href);
            });
        });
};
