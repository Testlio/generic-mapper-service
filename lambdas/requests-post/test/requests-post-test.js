'use strict';

const assert = require('assert');
const lambdaTester = require('lambda-tester');
const proxyquire = require('proxyquire');
const Promise = require('bluebird');
const sinon = require('sinon');

const TYPE = require('../../../constants/type');

// Stubbed
const issue = require('../../../lib/issue');
const comment = require('../../../lib/comment');

describe('requestsExecute', function() {
    const sandbox = sinon.sandbox.create();
    const reqStub = sinon.stub();
    const lambda = proxyquire('../index', {
        '@testlio/discovered-request': reqStub
    });

    it('should trigger correct action', function() {
        reqStub.returns(Promise.resolve({}));
        sandbox.stub(issue, 'post').returns(Promise.resolve({ remoteData: { id: 10 } }));
        return lambdaTester(lambda.handler).event({
            spawnedItself: true,
            payload: {
                request: {
                    integration: {},
                    resource: { type: TYPE.ISSUE },
                    method: 'POST',
                    payload: { data: true },
                    callbackHref: 'https://google.com'
                }
            }
        }).expectResult();
    });

    it('should trigger comment.post', function() {
        reqStub.returnsArg(0);
        const payload = {
            request: {
                integration: {},
                resource: { type: TYPE.COMMENT, parent: { id: 32, type: TYPE.ISSUE } },
                method: 'POST',
                payload: { data: true },
                callbackHref: 'https://google.com'
            }
        };
        const correctResponse = { response: { comment: 'comment' }, resource: { id: 1 } };

        sandbox.stub(comment, 'post').returns(Promise.resolve(correctResponse));
        return lambdaTester(lambda.handler).event({
            spawnedItself: true,
            payload: payload
        }).expectResult((result) => {
            const args = comment.post.lastCall.args;
            assert.equal(args[0], payload.request.integration, 'Integration should be correct');
            assert.equal(args[1], payload.request.resource, 'Resource should be correct');
            assert.equal(args[2], payload.request.payload, 'Payload should be correct');
            assert.equal(result.body.response.comment, 'comment');
            assert.deepEqual(
                result.body.resource,
                { id: 1, type: TYPE.COMMENT, parent: { id: 32, type: TYPE.ISSUE } }
            );
        });
    });

    it('should trigger issue.get', function() {
        reqStub.returnsArg(0);
        const payload = {
            request: {
                integration: {},
                resource: { type: TYPE.ISSUE },
                method: 'GET',
                payload: { data: true },
                callbackHref: 'https://google.com'
            }
        };

        const correctResponse = { response: {}, resource: { id: 1 }, subresources: { comments: [] } };
        sandbox.stub(issue, 'get').returns(Promise.resolve(correctResponse));
        return lambdaTester(lambda.handler).event({
            spawnedItself: true,
            payload: payload
        }).expectResult((result) => {
            const args = issue.get.lastCall.args;
            assert.equal(args[0], payload.request.integration, 'Integration should be correct');
            assert.equal(args[1], payload.request.resource, 'Resource should be correct');

            assert(result.body.success, 'success should be true');
            assert.equal(result.body.response, correctResponse.response);
            assert.equal(result.body.subresources, correctResponse.subresources);
            assert.deepEqual(result.body.resource, { id: 1, type: 'ISSUE' });
        });
    });

    it('should return error message when something throws', function() {
        reqStub.returnsArg(0);
        const payload = {
            request: {
                integration: {},
                resource: { type: 'ISSUE' },
                method: 'GET',
                payload: { data: true },
                callbackHref: 'https://google.com'
            }
        };
        issue.get.reset().returns(Promise.reject(new Error('Failure')));
        return lambdaTester(lambda.handler).event({
            spawnedItself: true,
            payload: payload
        }).expectResult((result) => {
            assert(!result.body.success, 'success should be false');
            assert.equal(result.body.response.message, 'Failure', 'error message should be returned as response');
        });
    });
});
