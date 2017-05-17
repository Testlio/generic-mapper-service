'use strict';

const assert = require('assert');
const apiPath = require('../api-path');

describe('lib/api-path', function() {
    it('#collection should return correct url', function(done) {
        const integration = {
            integration: {
                meta: {
                    projectId: '2'
                }
            }
        };
        const modifiedSince = '2016-02-22T02:06:58.147Z';
        const url = apiPath.collection({
            'modified_since': modifiedSince,
            project: integration.integration.meta.projectId
        });
        assert.equal(url, 'https://app.asana.com/api/1.0/tasks?modified_since=2016-02-22T02%3A06%3A58.147Z&project=2', 'should be correct url');
        done();
    });

    it('#comment with method /GET should return the correct link', function(done) {
        const url = apiPath.comment('GET', '2');
        assert.equal(url, 'https://app.asana.com/api/1.0/stories/2', 'should be correct url');
        done();
    });

    it('#comment with method /POST should return the correct link', function(done) {
        const url = apiPath.comment('POST', '2');
        assert.equal(url, 'https://app.asana.com/api/1.0/tasks/2/stories', 'should be correct url');
        done();
    });

    it('#comment with method /LIST should return the correct link', function(done) {
        const url = apiPath.comment('LIST', '2');
        assert.equal(url, 'https://app.asana.com/api/1.0/tasks/2/stories', 'should be correct url');
        done();
    });

    it('#attachment with method /GET should return the correct link', function(done) {
        const url = apiPath.attachment('GET', '2');
        assert.equal(url, 'https://app.asana.com/api/1.0/attachments/2', 'should be correct url');
        done();
    });

    it('#attachment with method /POST should return the correct link', function(done) {
        const url = apiPath.attachment('POST', '2');
        assert.equal(url, 'https://app.asana.com/api/1.0/tasks/2/attachments', 'should be correct url');
        done();
    });

    it('#attachment with method /LIST should return the correct link', function(done) {
        const url = apiPath.attachment('LIST', '2');
        assert.equal(url, 'https://app.asana.com/api/1.0/tasks/2/attachments', 'should be correct url');
        done();
    });
});
