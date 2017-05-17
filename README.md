# General architecture

![Proposed architecture](https://cloud.githubusercontent.com/assets/2154171/26148664/2e25368e-3b00-11e7-9de9-cc5f8559a4d9.png)
_Order of actions_

# Mapper contracts

`integration-service` does requests against `client-mapper-service` for the following reasons:
 1. `GET` new and updated issue id-s
 2. `GET`, `POST`, `PUT` and `DELETE` resources on clients system

#### All requests from and to the mapper have the same basic structure:

## INPUTS
```
{
  "method": "GET",
  "payload: {},
  "resource: {
    "type": "ISSUE",
    "remoteId": "y"
    "parent": {
      "type": "COLLECTION",
      "remoteId": "x",
    }
  },
  "integration": {
    "integration": { ... },
    "href": "https://"
  },
  "callbackHref": "https://"
}
```

#### `method`
  Specifies what action to execute against clients API?
  * CRUD operations: GET, POST, PUT, DELETE
  * list changes: MODIFIED

#### `payload`
  Contains data to be executed against remote system. (optional)
#### `resource`
  Reference to the resource. Contains id, type and parent resource.
#### `integration`
  Contains user credentials and integration configuration.
#### `callbackHref`
  The url where to return the result once the request is done.

## OUTPUTS

After mapper is done processing the request, it sends results to `integration-service`'s callback href.

Although the `response` field varies over different methods, all the request have similar structure:

```
{
  "resource": {
    "type": "ISSUE",
    "remoteId": "y",
    "parent": {
      "type": "COLLECTION",
      "remoteId: "x",
    }
  },
  "response": {},
  "subresources": {
    "comments": {},
    "attachments": {}
  },
  "success": true
}
```

#### `resource`
reference to the remote resource.

#### `subresources`
sub-resources of an issue (optional)

#### `response`
contains data and results that were returned from clients system

#### `success`
was the request succesful or not?

## Lets break it down

It makes sense to view some of the requests more closely.

#### MODIFIED

MODIFIED requests return a list of **all changed and updated** issue id's.
 * The `payload` contains a list of all issues currently known existing in remote system.
 * It should use the `syncedAt` field in the integration configuration to query changes since.

INPUT:
```
{
  "method": "MODIFIED",
  "payload": [
    {
      "remoteId": "X"
    },
    {
      "remoteRevision": "2017-04-07T14:45:12.616Z",
      "remoteId": "Y"
    }
  ],
  "resource": {
    "type": "ISSUE"
  },
  "integration": {
    "integration": {
      "guid": "9a566139-11b2-4e5c-b6d6-c348e70e8225",
      "connection": {
        "accessToken": "0/13fb148f03389906c4421219ca37e237",
        "username": "taavirehemagi@gmail.com"
      },
      "syncedAt": "2017-04-10T12:07:52.497Z",
      "remoteId": "194571345753803",
      "meta": {
        "delay": 2000,
        "tag": "205957347914942",
        "projectId": "253072138737376"
      }
    },
    "href": "https://apigw.testlio.net/integration-v1-dev/integrations/9a566139-11b2-4e5c-b6d6-c348e70e8225"
  },
  "callbackHref": "https://apigw.testlio.net/integration-v1-dev/integrations/9a566139-11b2-4e5c-b6d6-c348e70e8225/callbacks/3fd05fce-7427-40d1-90c7-95e839a478c0"
}
```

OUTPUT:
```
{
    "resource": {
        "type": "ISSUE"
    },
    "response": {
        "changed": [
          '112',
          '1921'
        ],
        "new": [
          '20311'
        ],
        "syncedAt": "2017-04-10T13:50:52.559Z"
    },
    "success": true
}
```

`changed`: array of changed issue id's

`new`: array of new issue id's

`syncedAt`: timestamp in client-server format, gotten immediately **BEFORE** the query

#### GET

GET request querys the resource from the remote system, and returns it in **testlio**'s format.

If there are sub-resources on the resource (issue comments, issue attachments, comment attachments), it returns these in a separate field called `subresources`.


INPUT:
```
{
  "method": "GET",
  "payload": {},
  "resource": {
    "type": "ISSUE"
    "remoteId": "xx",
    "parent": {
      "type": "COLLECTION",
      "remoteId": "yy"
    }
  },
  "integration": {
    "integration": {
      "guid": "9a566139-11b2-4e5c-b6d6-c348e70e8225",
      "connection": {
        "accessToken": "0/13fb148f03389906c4421219ca37e237",
        "username": "taavirehemagi@gmail.com"
      },
      "syncedAt": "2017-04-10T12:07:52.497Z",
      "remoteId": "194571345753803",
      "meta": {
        "delay": 2000,
        "projectId": "253072138737376"
      }
    },
    "href": "https://apigw.testlio.net/integration-v1-dev/integrations/9a566139-11b2-4e5c-b6d6-c348e70e8225"
  },
  "callbackHref": "https://apigw.testlio.net/integration-v1-dev/integrations/9a566139-11b2-4e5c-b6d6-c348e70e8225/callbacks/3fd05fce-7427-40d1-90c7-95e839a478c0"
}
```

OUTPUT:
```
{
  "resource": {
    "type": "ISSUE"
    "remoteId": "xx",
    "parent": {
      "type": "COLLECTION",
      "remoteId": "yy"
    }
  },
  "response": {
    *testlio issue-service format*
  },
  "success": true
}
```

#### POST

POST request `CREATE`s the resource to clients system and returns the inserted value in **testlio** format.

INPUT:
```
{
  "method": "POST",
  "payload": {
    *issue in testlio format*
  },
  "resource": {
    "type": "ISSUE"
    "remoteId": "xx",
    "parent": {
      "type": "COLLECTION",
      "remoteId": "yy"
    }
  },
  "integration": {
    "integration": {
      ...
    },
    "href": "https://apigw.testlio.net/integration-v1-dev/integrations/9a566139-11b2-4e5c-b6d6-c348e70e8225"
  },
  "callbackHref": "https://apigw.testlio.net/integration-v1-dev/integrations/9a566139-11b2-4e5c-b6d6-c348e70e8225/callbacks/3fd05fce-7427-40d1-90c7-95e839a478c0"
}
```

OUTPUT:
```
{
  "resource": {
    "type": "ISSUE"
    "remoteId": "xx",
    "parent": {
      "type": "COLLECTION",
      "remoteId": "yy"
    }
  },
  "response": {
    *created issue, in testlio issue-service format*
  },
  "success": true
}
```
