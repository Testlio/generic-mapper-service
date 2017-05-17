'use strict';

const sinon = require('sinon');
const assert = require('assert');
const proxyquire = require('proxyquire');

const integration = {
    integration: {
        guid: '{integration-guid}',
        connection: {
            accessToken: 'token'
        }
    }
};
const resource = {
    parent: {
        id: '123',
        type: 'ISSUE'
    },
    id: '456',
    type: 'ATTACHMENT'
};
const localAttachment = {
    assetHref: 'asset-href',
    name: 'filename'
};
const mockResponse = {
    data: {
        id: 123,
        name: 'filename'
    }
};
const attachmentContent = [1, 2, 3];

describe('attachmentHelper', function() {
    const sandbox = sinon.sandbox.create();
    const request = sandbox.stub();
    const discoveredRequest = sandbox.stub();
    const s3Stub = sandbox.stub();

    const attachmentHelper = proxyquire('../attachment', {
        'request-promise': request,
        '@testlio/discovered-request': discoveredRequest,
        './s3': s3Stub
    });

    it('#post should trigger POST request against correct endpoint', function(done) {
        const formData = {
            file: {
                value: attachmentContent,
                options: {
                    filename: localAttachment.name
                }
            }
        };
        request.onCall(0).returns(attachmentContent);
        request.onCall(1).returns(Promise.resolve(mockResponse));
        attachmentHelper.post(integration, resource, localAttachment).then((result) => {
            const args = request.lastCall.args;
            assert.equal(args[0].headers.Authorization, 'Bearer token', 'should authenticate with token');
            assert.equal(args[0].method, 'POST', 'method should be POST');
            assert.deepEqual(args[0].formData, formData, 'formdata should be correct');
            assert.equal(args[0].url, 'https://app.asana.com/api/1.0/tasks/123/attachments', 'url should be correct');
            assert.equal(result.response.name, localAttachment.name, 'result should be in testlio format');
            done();
        }).catch(done);
    });

    it('#post should retrieve task id and then trigger POST request against correct endpoint', function(done) {
        const resourceWithComment = {
            parent: {
                id: '123',
                type: 'COMMENT'
            },
            id: '456',
            type: 'ATTACHMENT'
        };

        const formData = {
            file: {
                value: attachmentContent,
                options: {
                    filename: localAttachment.name
                }
            }
        };

        const getCommentResponse = {
            data: {
                target: {
                    id: 432
                }
            }
        };

        request.reset();
        request.onCall(0).returns(Promise.resolve(getCommentResponse));
        request.onCall(1).returns(attachmentContent);
        request.onCall(2).returns(Promise.resolve(mockResponse));
        attachmentHelper.post(integration, resourceWithComment, localAttachment).then((result) => {
            assert.equal(request.firstCall.args[0].url, 'https://app.asana.com/api/1.0/stories/123', 'getComment url should be correct');
            const args = request.lastCall.args;
            assert.equal(args[0].headers.Authorization, 'Bearer token', 'should authenticate with token');
            assert.equal(args[0].method, 'POST', 'method should be POST');
            assert.equal(args[0].url, 'https://app.asana.com/api/1.0/tasks/432/attachments', 'url should be correct');
            assert.deepEqual(args[0].formData, formData, 'formdata should be correct');
            assert.equal(result.response.name, localAttachment.name, 'result should be in testlio format');
            done();
        }).catch(done);
    });

    it('#delete should return attachment', function(done) {
        request.onCall(0).returns(attachmentContent);
        request.onCall(1).returns(Promise.resolve(mockResponse));
        attachmentHelper.delete(resource, localAttachment).then((result) => {
            assert.equal(result.resource.id, resource.id, 'should be correct id');
            assert.equal(result.response.name, localAttachment.name, 'result should be in testlio format');
            done();
        }).catch(done);
    });

    it('#getAll should return attachment ids', function(done) {
        const remoteAttachments = {
            data: [
                { id: 1 },
                { id: 2 }
            ]
        };
        const correctResults = [
            { id: 1, type: 'ATTACHMENT' },
            { id: 2, type: 'ATTACHMENT' }
        ];
        request.returns(Promise.resolve(remoteAttachments));
        attachmentHelper.getAll(integration, resource).then((result) => {
            assert.deepEqual(result, correctResults, 'should return attachment ids');
            done();
        }).catch(done);
    });

    it('#get should copy remote attachment to s3 and return its href', function(done) {
        request.reset();
        const remoteAttachment = {
            data: {
                id: 1,
                name: '{name}',
                'download_url': '{remote-href}',
                'created_at': '2012-02-22T02:06:58.147Z'
            }
        };
        request.onCall(0).returns(Promise.resolve(remoteAttachment));
        s3Stub.copy = sandbox.stub().returns(Promise.resolve('{get-href}'));

        // Act
        attachmentHelper.get(integration, resource).then((result) => {
            const correctResult = {
                response: {
                    name: '{name}',
                    assetHref: '{get-href}'
                },
                resource: {
                    id: '1'
                },
                remoteRevision: '2012-02-22T02:06:58.147Z'
            };
            assert.deepEqual(result, correctResult, 'should return comment in local format');

            const getAttachentRequest = request.firstCall.args[0];
            assert.equal(getAttachentRequest.headers.Authorization, 'Bearer token', 'should authenticate with token');
            assert.equal(getAttachentRequest.method, 'GET', 'method should be GET');
            assert.deepEqual(getAttachentRequest.url, 'https://app.asana.com/api/1.0/attachments/456', 'should be correct get url');

            const copyToS3Args = s3Stub.copy.firstCall.args;
            assert.equal(copyToS3Args[0], 'integration', 'should be correct prefix');
            assert.equal(copyToS3Args[1], '{name}', 'should be correct name');
            assert.equal(copyToS3Args[2], '{remote-href}', 'should be correct download url');
            done();
        }).catch(done);
    });
});
