'use strict';

const sinon = require('sinon');
const assert = require('assert');
const proxyquire = require('proxyquire');

const integration = {
    integration: {
        connection: {
            accessToken: 'token'
        },
        remoteId: '3'
    }
};
const resource = {
    parent: {
        id: '123'
    },
    id: '456'
};
const mockTagList = {
    data: [
        { name: 'existingTag', id: 1 },
        { name: 'oldTag', id: 2 }
    ]
};

const newTag = { data: { name: 'newTag', id: 3 } };

describe('lib/tag', function() {
    const sandbox = sinon.sandbox.create();
    const req = sandbox.stub();
    const tag = proxyquire('../tag', {
        '@testlio/discovered-request': req
    });

    it('#post should trigger POST request against correct endpoint', function(done) {
        req.onCall(0).returns(Promise.resolve(mockTagList));
        req.onCall(1).returns(Promise.resolve(newTag));
        tag.tagsList(integration, ['existingTag', 'newTag']).then((result) => {
            assert(req.calledTwice, 'should be called twice');
            const args = req.lastCall.args;
            assert.equal(args[0].body.data.name, newTag.data.name, 'should create the tag that doesnt exist');
            assert.deepEqual(result, [1, 3], 'returns correct array of tags');
            done();
        }).catch(done);
    });

    it('#post should trigger POST request against correct endpoint', function(done) {
        req.onCall(0).returns(Promise.resolve(mockTagList));
        req.returns(Promise.resolve(newTag));

        tag.putTagsToTask(mockTagList.data, ['existingTag', 'newTag'], integration, resource)
            .then((result) => {
                assert.equal(result.add.length, 1, 'should add one tag');
                assert.equal(result.remove.length, 1, 'should remove one tag');
                done();
            }).catch(done);
    });
});
