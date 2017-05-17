'use strict';

const assert = require('assert');
const issueFormatter = require('../issue');

const resource = {
    parent: {
        id: 3
    }
};

const integration = {
    integration: {
        meta: {
            projectId: 2
        }
    }
};

/**
 * Helper function to test local issue state
 *
 * @param {array.<string>} tags - array of tags
 * @param {boolean} completed - true when remote task is completed
 * @returns {string} local issue state
 */
function getLocalIssueState(tags, completed) {
    const remoteData = {
        data: {
            id: 1,
            tags: tags,
            completed: completed,
            'modified_at': '2016-02-22T02:06:58.147Z'
        }
    };
    return issueFormatter.toLocal(remoteData).response.state;
}

/**
 * Helper function to test remote task state
 *
 * @param {string} localState - local issue state
 * @returns {boolean} true when remote task is completed
 */
function isRemoteTaskCompleted(localState) {
    const issue = {
        state: localState,
        issueData: {
            title: 'title',
            description: 'description',
            labels: []
        }
    };
    return issueFormatter.toRemote(issue, integration, resource).data.completed;
}

describe('formatters/issue', function() {
    it('#issue.toLocal should create correct result', function(done) {
        const remoteData = {
            data: {
                id: 1,
                name: 'someName',
                notes: 'description',
                tags: [
                    { name: 'testlio', id: 1 },
                    { name: 'tag', id: 2 }, { name: 'P3', id: 3 },
                    { name: 'fixed', id: 4 }
                ],
                'modified_at': '2016-02-22T02:06:58.147Z'
            }
        };
        const localData = {
            resource: { id: '1' },
            response: {
                issueData: {
                    title: 'someName',
                    description: 'description',
                    severity: 'low',
                    labels: ['tag', 'fixed']
                },
                state: 'verification'
            },
            remoteRevision: '2016-02-22T02:06:58.147Z'
        };
        const result = issueFormatter.toLocal(remoteData);
        assert.deepEqual(result, localData, 'toLocal should return Testlio format');
        done();
    });

    it('#issue.toLocal should return empty array if there are no labels', function(done) {
        const remoteData = {
            data: {
                id: 1,
                tags: []
            }
        };
        const result = issueFormatter.toLocal(remoteData);
        assert.deepEqual(result.response.issueData.labels, [], 'labels should be empty array');
        done();
    });

    it('#issue.toRemote should create correct result', function(done) {
        const remoteData = {
            data: {
                name: 'someName',
                notes: 'description',
                workspace: 3,
                completed: false,
                projects: [2]
            },
            tags: ['tag', 'fixed', 'P3', 'testlio']
        };
        const issue = {
            issueData: {
                title: 'someName',
                description: 'description',
                severity: 'low',
                labels: ['tag', 'fixed']
            }
        };
        const result = issueFormatter.toRemote(issue, integration, resource);
        assert.deepEqual(result, remoteData, 'toRemote should return remote format');
        done();
    });

    it('#issue.toRemote should return completed task when local issue is closed', function(done) {
        assert(isRemoteTaskCompleted('closed'), 'remote issue should be completed');
        done();
    });

    it('#issue.toRemote should return completed task when local issue is fixed', function(done) {
        assert(isRemoteTaskCompleted('fixed'), 'remote issue should be completed');
        done();
    });

    it('#issue.toRemote should return not completed task when local issue is in verification', function(done) {
        assert(!isRemoteTaskCompleted('verification'), 'remote issue should not be completed');
        done();
    });

    it('#issue.toRemote should return not completed task when local issue is open', function(done) {
        assert(!isRemoteTaskCompleted('open'), 'remote issue should not be completed');
        done();
    });

    it('#issue.toLocal should return issue in OPEN state', function(done) {
        assert.equal(getLocalIssueState([], false), 'open', 'state should be OPEN');
        done();
    });

    it('#issue.toLocal should return issue in VERIFICATION state', function(done) {
        assert.equal(getLocalIssueState([{ name: 'Fixed' }], false), 'verification', 'state should be VERIFICATION');
        done();
    });

    it('#issue.toLocal should return issue in FIXED state', function(done) {
        assert.equal(getLocalIssueState([{ name: 'Fixed' }], true), 'fixed', 'state should be FIXED');
        done();
    });

    it('#issue.toLocal should return issue in CLOSED state', function(done) {
        assert.equal(getLocalIssueState([], true), 'closed', 'state should be CLOSED');
        done();
    });

    it('#issue.toLocal should return placeholder for empty title and description', function(done) {
        const remoteData = {
            data: {
                id: 1,
                name: ''
            }
        };
        const result = issueFormatter.toLocal(remoteData);
        assert.deepEqual(result.response.issueData.title, '(no title)', 'title should be replaced');
        assert.deepEqual(result.response.issueData.description, '(no description)', 'description should be replaced');
        done();
    });

    it('#issue.toRemote should return empty if placeholders', function(done) {
        const issue = {
            state: 'open',
            issueData: {
                description: '(no description)',
                title: '(no title)'
            }
        };
        const result = issueFormatter.toRemote(issue, integration, resource);
        assert.deepEqual(result.data.name, '', 'title should be empty');
        assert.deepEqual(result.data.notes, '', 'description should be empty');
        done();
    });
});
