'use strict';

const assert = require('assert');
const commentFormatter = require('../comment');

describe('formatters/comment', function() {
    it('#comment.toLocal should create correct result', function(done) {
        const remoteData = {
            id: 100,
            task: 500,
            text: 'comment',
            'created_at': '2012-02-22T02:06:58.147Z'
        };
        const localData = {
            response: {
                comment: 'comment'
            },
            resource: {
                id: '100',
                createdAt: 1329876418
            },
            remoteRevision: '2012-02-22T02:06:58.147Z'
        };

        const result = commentFormatter.toLocal(remoteData, '1');
        assert.deepEqual(result, localData, 'toLocal should return Testlio format');
        done();
    });

    it('#comment.toRemote should create correct result', function(done) {
        const localData = {
            comment: 'comment'
        };
        const resource = {
            parent: {
                id: 500
            }
        };
        const remoteData = {
            data: {
                task: 500,
                text: 'comment'
            }
        };
        const result = commentFormatter.toRemote(localData, resource);
        assert.deepEqual(result, remoteData, 'toRemote should return Asana format');
        done();
    });
});
