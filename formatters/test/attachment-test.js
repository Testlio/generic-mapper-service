'use strict';

const assert = require('assert');
const attachmentFormatter = require('../attachment');

describe('formatters/attachment', function() {
    it('#attachment.toLocal should create correct result', function(done) {
        const remoteData = {
            id: 100,
            name: 'foo.pdf',
            'created_at': '2012-02-22T02:06:58.147Z'
        };
        const assetHref = 'https://testlio.com/foo.pdf';
        const localData = {
            resource: {
                id: '100'
            },
            response: {
                name: 'foo.pdf',
                assetHref: 'https://testlio.com/foo.pdf'
            },
            remoteRevision: '2012-02-22T02:06:58.147Z'
        };

        const result = attachmentFormatter.toLocal(remoteData, assetHref);
        assert.deepEqual(result, localData, 'toLocal should return Testlio format');
        done();
    });
});
