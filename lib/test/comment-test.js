'use strict';

const sinon = require('sinon');
const assert = require('assert');
const proxyquire = require('proxyquire');

const integration = {
    integration: {
        connection: {
            accessToken: 'token'
        }
    }
};
const resource = {
    parent: {
        id: '123'
    },
    id: '456'
};

const mockResponse = {
    data: {
        id: '1',
        task: '123',
        text: 'test comment'
    }
};

describe('lib/comment', function() {
    const sandbox = sinon.sandbox.create();
    const reqStub = sandbox.stub();
    const comment = proxyquire('../comment', {
        '@testlio/discovered-request': reqStub
    });

    it('#post should trigger POST request against correct endpoint', function(done) {
        const localComment = {
            comment: 'test comment',
            attachments: [{
                assetHref: 'asset-href',
                name: 'filename'
            }]
        };
        reqStub.returns(Promise.resolve(mockResponse));
        comment.post(integration, resource, localComment).then((result) => {
            const args = reqStub.lastCall.args;
            assert(reqStub.calledOnce, 'should be called once');
            assert.equal(args[0].headers.Authorization, 'Bearer token', 'should authenticate with token');
            assert.equal(args[0].method, 'POST', 'method should be POST');
            assert.deepEqual(result.response.comment, localComment.comment, 'result should be in testlio format');
            done();
        }).catch(done);
    });

    it('#getAll should return comment ids', function(done) {
        const remoteComments = {
            data: [
                { id: 1, type: 'comment', 'created_at': '2012-02-22T02:06:58.147Z' },
                { id: 2, type: 'system' },
                { id: 3, type: 'comment', 'created_at': '2012-02-25T12:55:55.100Z' }
            ]
        };
        const correctResults = [
            { id: 1, type: 'COMMENT', createdAt: 1329876418 },
            { id: 3, type: 'COMMENT', createdAt: 1330174555 }
        ];
        reqStub.returns(Promise.resolve(remoteComments));
        comment.getAll(integration, resource).then((result) => {
            assert.deepEqual(result, correctResults, 'should return comment ids');
            done();
        }).catch(done);
    });

    it('#get should return comment in local format', function(done) {
        const remoteComment = {
            data: {
                id: 1,
                text: 'comment',
                'created_at': '2012-02-22T02:06:58.147Z'
            }
        };
        const localComment = {
            response: {
                comment: 'comment'
            },
            resource: {
                id: '1',
                createdAt: 1329876418
            },
            remoteRevision: '2012-02-22T02:06:58.147Z'
        };

        reqStub.returns(Promise.resolve(remoteComment));
        comment.get(integration, resource).then((result) => {
            assert.deepEqual(result, localComment, 'should local comment');
            done();
        }).catch(done);
    });
});
