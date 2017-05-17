# Integration service overview

> Integration service handles issue syncing between the Testlio platform and various client bug-trackers.

### General

Testlio integrations depend of the following services:
1. `issue-service` - API for storing all `ISSUES`, `COMMENTS` and `ATTACHMENTS`.
2. `integration-service` - responsible for detecting and syncing resources between Testlio and client bug trackers.
3. `*-mapper-service` - formatting Testlio CRUD requests sent by `integration-service` to client API.

`integration-service` is a micro-service that is built with lambda-tools framework.

Currently integration-service supports the sync of following types of resources:
  * `ISSUE`
  * `COMMENT`
  * `ATTACHMENT`
  * `COMMENT ATTACHMENT`

### General workflow
![Architecture](https://cloud.githubusercontent.com/assets/2154171/26148664/2e25368e-3b00-11e7-9de9-cc5f8559a4d9.png)
_Order of actions_

**Issues are kept in sync the following way:**
 1. Periodic CloudWatch event triggers a lambda that invokes a `project-lambda` for each active integration.
 2. The `project-lambda` queries all `SYNCED` `ISSUE` `remoteId`s from the `integrated-resources` DynamoDB table and makes a request to `*-mapper-service`.
 3. `*-mapper-service` detects new and changed issues from the last query and returns to the href provided by the `integration-service`.
 4. `integrations-callback-post` is triggered once the result of changed and new issues is returned by the mapper.
    1. lambda iterates over the `issue-service` collection and detects changes on Testlio's side as well.
    2. then all the  changed resources (from testlio's side and mapper side) are changed in `integrated-resources` table to UNSYNCED state
 5. `integrated-resources` stream event triggers `integrations-resource-lambda` on every change.
    1. The lambda then validates if the event should be synced (if the state is `UNSYCNED`)
    2. Valid stream events trigger one of `GET`, `DELETE` or `POST` against the mapper.
 6. Mapper executes the request and returns the result to given callback.
 7.
    1. `POST`, `PUT` and `DELETE` methods are returned to `resources-callback-lambda`:
      1. the resources are then marked as SYNCED and the syncing of these resources is complete.
  2.`GET` `ISSUE` requests are returned to `resources-conflict-lambda`.
    1. The issue is retrieved from the `issue-service` and matched to it's remote equivalent.
    2. The changes are calculated. Local changes are executed against issue-service and a `PUT` request is sent to the mapper.
 8. Mapper executes the PUT requests on the clients API
 9. `resources-callback-lambda` is triggered, marking the `ISSUE` as synced.

## `integration-service`

### periodic-integrations-lambda

Starting point: periodic CloudWatch event (every 5 minutes)

    1. Fetch all enabled integrations from `integrations` table
    2. Invoke **integrations-project-lambda** for each integration

### integrations-project-lambda

Starting point: invoked by **periodic-integrations-lambda**

Sends all remote issue id's and their remoteRevisions to mapper.

Input parameters:
* Specific integration guid

1. Querys `integrated-resources` table for all integration resources
2. Filter all **issues** of the integration that have a remoteId
3. Make bulk get (MODIFIED) request against mapper in format of:

```
{
	"integration": {
      "href": "https://api.testlio.com/...",
      "integration": {... }
    },
    "method": "MODIFIED",
    "payload": [
      {
        "remoteId": "231471949776582",
        "remoteRevision": "2016-12-15T14:55:34.469Z"
      },
      {
        "remoteId": "231434493693728",
        "remoteRevision": "2016-12-15T10:17:56.819Z"
      },
			...
    ],
    "resource": {
      "type": "ISSUE"
    }
}
```

### [API endpoint]integrations-callbacks-post
`/integrations/{integrationGuid}/resources/{resourceGuid}/callbacks/{callbackGuid}`

Expected request body format:

```
{
    "remoteRevision": "2017-01-18T14:09:07.746Z",
    "resource": {
      "type": "ISSUE"
    },
    "response": {
      "new": [
        "249090811512816",
        "249086133471133"
      ],
      "changed": [
        "2490908115",
        "2490861334"
      ],
      "syncedAt": "2017-05-16 09:37"
    },
    "success": true
}
```

### integrations-callback-post

Starting point: **[endpoint]integrations-callbacks-post**

```
{
    "resource": {
      "type": "ISSUE"
    },
    "response": [
      "249090811512816",
      "249086133471133",
      ...
    ],
    "success": true
  }
```

The resources **changed** in remote system are in response array.

1. Consumes callback, invokes itself
2. Fetches collection page by page, changes state to UNSYNCED for remote or local updates

### integrations-resource-lambda

Makes HTTP POST requests against mapper with similar data.

```
{
  "integration": {
    "href": "/integrations/a42f5225-e787-40fc-80b1-b0fb363fdda9",
    "integration": {
      "collectionHref": "http://local.testlio:3055/collections/b0424c1c-d9f5-49ff-8d47-e89af802e4cb",
      "connection": {
        "username": "test@testlio.com",
        "password": "xxx"
      },
      "enabled": true,
      "guid": "a42f5225-e787-40fc-80b1-b0fb363fdda9",
      "mapperPath": "integration-mapper.salesforce.v1",
      "meta": {
        "environment": "Mobile2",
        "externalIdPrefix": "a",
        "mapperPath": "integration-mapper.salesforce.v1"
      },
      "remoteId": "sales-remote"
    }
  },
  "method": "POST",
  "payload": {
    "state": "open",
    "issueData": {
      "labels": [],
      "assignedTo": null,
      "isStarred": false,
      "severity": "high",
      "reportQualityHasTitle": true,
      "reportFeedback": "Awesome! You did a great job!",
      "number": "24305",
      "isDeleted": false,
      "fixVersion": null,
      "closeExplanation": null,
      "title": "This is another test for Testlio integration."
      "testCycleId": null,
      "description": "description",
      "reportQualityHasAttachments": true,
      "feature": null,
      "reportQualityHasBody": true,
      "isApproved": true,
      "isClosed": true,
      "reportQuality": "5",
      "closeReason": "Works as Designed",
      "feedbackSeen": false,
      "buildVersion": "160.store.3"
    }
  },
  "resource": {
    "id": "remote_id2",
    "parent": {
      "id": "remote_id1",
      "type": "COLLECTION"
    },
    "type": "ISSUE"
  }
}
```

Input parameters:
* `integrated-resources` table stream events

1. Sits on top of the `integrated-resources` table
2. Expects **INSERT** or **MODIFY** events
3. Only processes rows in UNSYNCED state
4. Generates a callback and updates `integrated-resources` row with callback
5. Builds request, including integration data, callback data, method, resource and payload
5. For **NEW** transactions, makes POST request against mapper
6. For **UPDATE** transactions, make GET request against mapper


### [API endpoint]integrations-resources-callback-post
`/integrations/{integrationGuid}/resources/{resourceGuid}/callbacks/{callbackGuid}`

Expected request body format:

```
{
    "resource": {
        "id": "18",
        "type": "ISSUE",
        "parent": {
            "id": "400",
            "type": "COLLECTION"
        }
    },
    "response": {
        "state": "open",
        "issueData": {
            "title": "some title",
            "description": "some description",
            "severity": "low"
        }
    },
    "subresources": [
        {
            "id": "37318.40555",
            "type": "COMMENT",
            "createdAt": 1494743052
        },
        {
            "id": "37318.30931",
            "type": "ATTACHMENT"
        }
    ],
    "remoteRevision": "2017-05-15T08:52:25.665-0400",
    "success": true
}
```

### integrations-resources-callbacks-post

Starting point: **[endpoint]callback-post**

Consume callbacks from integration-mapper. Callback may be from POST|UPDATE|DELETE requests.

`POST|UPDATE|DELETE` request callbacks are the final step in flow, and require updating `integrated-resources` row to SYNCED state

1. Check if callback exists and is current.
2. Update requests state in Callbacks table
2. update `integrated-resources` with remoteId and synced state
3. in case of `POST`, check for eligible children from `integrated-resources`, and push them to **request-sync-lambda**
4. if `GET` call **integrationts-conflict-lambda**

### [endpoint]callback-conflict-post
`/integrations/{integrationGuid}/resources/{resourceGuid}/callbacks/{callbackGuid}/conflict/`

```
{
    "resource": {
        "id": "18",
        "type": "ISSUE",
        "parent": {
            "id": "400",
            "type": "COLLECTION"
        }
    },
    "response": {
        "state": "open",
        "issueData": {
            "title": "some title",
            "description": "some description",
            "severity": "low"
        }
    },
    "subresources": [
        {
            "id": "37318.40555",
            "type": "COMMENT",
            "createdAt": 1494743052
        },
        {
            "id": "37318.30931",
            "type": "ATTACHMENT"
        }
    ],
    "remoteRevision": "2017-05-15T08:52:25.665-0400",
    "success": true
}
```

### integrationts-resources-callback-conflict-post

Starting point: **[endpoint]callback-conflict-post**

A `GET` request callback means that client service has gotten back to us with its version of the data. We need to compare it against our version
and calculate changes to be applied first to our system and then the clients. Clients changes must be prioritized over local changes.

Input parameters: **issue** from remote system in Testlios issue-service format

1. Fetches the last known synced state of the issue (head)
2. Fetches the current state of the resource in issue-service
3. Diffs out fields updated in remote system and in our system since the last sync
4. Updates local data with remote changes
5. Update remote system with changes on issue-service side (remote system changes have priority over issue-service)

## mapper-service

mapper-service is the connecting link between clients remote system and integration-service. It's task is to take in CRUD requests in issue-service format and carry them out on the remote systems API and then return to integration-service with results.

 * Every single CRUD request has its own unique callback href for returning results
 * communication between integration-service and mapper must be authenticated with **mapper secrets** so that they couldn't be used by other services directly
 * with integration mappers we always **MUST** assume that everything is completely asynchronous, even issue fetching from clients system.

## DynamoDB resources

### integrations

holds info about integrations that have been set up

It is important to note here, that connection data is encrypted using Amazon KMS before it's stored to the database.

- guid (guid, require)
- type (enum[jira, asana, github...], required)
- collection href (guid, required)
- connection (object, required)
- enabled (boolean, required)

### integrated-resources

holds data about testlio resources (about to be) synced

- guid (guid, required)
- integrationGuid (guid, required)
- resourceHref (issue, collection or attachment href) (string, optional)
- parentResourceHref (href of a parent resource) (href, required)
- remoteId  (string, optional)
- remoteParentId (string, optional)
- callbackGuid (guid, optional)
- type (enum[ISSUE, COMMENT, ATTACHMENT], required)
- transaction (enum[NEW, UPDATE, DELETE], required)
- state (enum[SYNCED, UNSYNCED, INPROGRESS, ERROR, CONFLICT])
- headRevisionHref (last successfully synced version of data) (href, optional)
- lastRevisionHref (current requests version of data) (href, optional)

### callbacks

holds info about callbacks

- guid (guid, required)
- resourceGuid (guid, required)
- consumed (boolean, true)
- method (string, required)
- request (schema of the request made against mapper) (object, required)
- requestResponse (mappers response to the request) (string, required)
- response (mappers async response for the request containing data and success) (string, required)

### integrations-replica

- targetHash (guid, required)
- data (object, required)
- isDeleted (boolean, required)

### integrated-resources-replica

- targetHash (guid, required)
- data (object, required)
-
