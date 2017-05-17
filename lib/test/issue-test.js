'use strict';

const sinon = require('sinon');
const assert = require('assert');
const proxyquire = require('proxyquire');
const _ = require('lodash');

const integration = {
    integration: {
        guid: 'aGuid',
        connection: {
            accessToken: 'token'
        },
        meta: {
            projectId: 2
        },
        syncedAt: '2016-02-22T02:06:58.147Z'
    }
};
const resource = {
    parent: {
        id: '123'
    },
    id: '456',
    type: 'ISSUE'
};
const localIssue = {
    issueData: {
        id: '1',
        title: 'test title',
        description: 'description'
    }
};
const mockResponse = {
    data: {
        id: 1,
        name: 'test title',
        notes: 'description'
    }
};

describe('lib/issue', function() {
    const sandbox = sinon.sandbox.create();
    const req = sandbox.stub();
    const commentStub = sandbox.stub();
    const attachmentStub = sandbox.stub();
    const tagStub = sandbox.stub();
    const issue = proxyquire('../issue', {
        '@testlio/discovered-request': req,
        './comment': commentStub,
        './attachment': attachmentStub,
        './tag': tagStub
    });
    it('#post should trigger POST request against correct endpoint', function(done) {
        req.returns(Promise.resolve(mockResponse));
        tagStub.tagsList = sandbox.stub().returns(Promise.resolve([]));
        issue.post(integration, resource, localIssue).then((result) => {
            const args = req.lastCall.args; //         assert(req.calledOnce, 'should be called once');
            assert.equal(args[0].headers.Authorization, 'Bearer token', 'should authenticate with token');
            assert.equal(args[0].method, 'POST', 'method should be POST');
            assert.equal(result.response.issueData.title, localIssue.issueData.title, 'result should be in testlio format');
            done();
        }).catch(done);
    });

    it('#put should trigger PUT request against correct endpoint', function(done) {
        req.reset().returns(Promise.resolve(mockResponse));
        tagStub.putTagsToTask = sandbox.stub().returns(Promise.resolve());
        issue.put(integration, resource, localIssue).then((result) => {
            const args = req.lastCall.args;
            assert(req.calledOnce, 'should be called once');
            assert.equal(args[0].headers.Authorization, 'Bearer token', 'should authenticate with token');
            assert.equal(args[0].method, 'PUT', 'method should be PUT');
            assert.equal(result.response.issueData.title, localIssue.issueData.title, 'should be in testlio format');
            done();
        }).catch(done);
    });

    it('#get should trigger GET request against correct endpoint', function(done) {
        req.reset().returns(Promise.resolve(mockResponse));

        const validComments = [
            { id: 1, type: 'COMMENT' },
            { id: 2, type: 'COMMENT' }
        ];
        commentStub.getAll = (int, res) => {
            assert.equal(int, integration, 'should be the same as integration in get params');
            assert.equal(res, resource, 'should be the same as resource in get params');
            return Promise.resolve(validComments);
        };
        const validAttachments = [
            { id: 3, type: 'ATTACHMENT' },
            { id: 4, type: 'ATTACHMENT' }
        ];
        attachmentStub.getAll = (int, res) => {
            assert.equal(int, integration, 'should be the same as integration in get params');
            assert.equal(res, resource, 'should be the same as resource in get params');
            return Promise.resolve(validAttachments);
        };
        const allResources = _.concat(validComments, validAttachments);
        issue.get(integration, resource, localIssue).then((result) => {
            const args = req.lastCall.args;
            assert(req.calledOnce, 'should be called once');
            assert.equal(args[0].headers.Authorization, 'Bearer token', 'should authenticate with token');
            assert.equal(args[0].method, 'GET', 'method should be GET');
            assert.equal(result.response.issueData.title, localIssue.issueData.title, 'result should be in testlio format');
            assert.deepEqual(result.subresources, allResources, 'should contain all the resources');
            done();
        }).catch(done);
    });

    it('#modified should query changed tasks using latest revision', function(done) {
        const modifiedWithTag = {
            data: [
                { id: 1, name: 'other project issue' },
                { id: 2, name: 'tracked and changed issue' },
                { id: 5, name: 'second other project issue' },
                { id: 7, name: 'new issue' }
            ]
        };
        const modifiedInProject = {
            data: [
                { id: 2, name: 'tracked issue' },
                { id: 7, name: 'new issue' }
            ]
        };

        req.reset();
        req.onCall(0).returns(Promise.resolve(modifiedInProject));
        req.onCall(1).returns(Promise.resolve(modifiedWithTag));
        tagStub.resolveTagToId = sandbox.stub().returns(Promise.resolve(10));

        const trackedIssues = [
            { remoteId: '3', remoteRevision: '2012-02-22T02:06:58.147Z' },
            { remoteId: '2', remoteRevision: '2016-02-22T02:06:58.147Z' },
            { remoteId: '4', remoteRevision: '2014-02-22T02:06:58.147Z' }
        ];
        issue.modified(integration, resource, trackedIssues).then((result) => {
            const getModifiedCall = req.firstCall.args[0];
            assert.equal(getModifiedCall.headers.Authorization, 'Bearer token', 'should authenticate with token');
            assert.equal(getModifiedCall.method, 'GET', 'should be GET');
            assert.equal(getModifiedCall.url, 'https://app.asana.com/api/1.0/tasks?project=2&modified_since=2016-02-22T02%3A06%3A58.147Z', 'should be correct get modified url');

            assert.deepEqual(result.response.changed, ['2'], 'should return only tracked issue');
            assert.deepEqual(result.response.new, ['7'], 'should return only tracked issue');
            assert.deepEqual(result.resource, resource, 'should return resource');
            done();
        }).catch(done);
    });
});
