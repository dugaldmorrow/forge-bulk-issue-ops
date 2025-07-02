import api, { APIResponse, RequestProductMethods, route } from  '@forge/api'
import { InvocationResult } from './types/InvocationResult';
import { TaskRequestOutcome } from './types/TaskRequestOutcome';
import { getBasicAuthHeader, getBulkOpsAppGroupId } from './userManagementConfig';
import { ServerInfo } from './types/ServerInfo';

// This is set to false since the app user can't be authorized to add/remove users to/from groups.
const manageUserGroupsUsingAppUserAccount = false;

const maxBulkOperationRetries = 3;
const initialRetryDelay = 2000;

export const initiateBulkMove = async (accountId: string, bulkIssueMoveRequestData: any): Promise<InvocationResult<TaskRequestOutcome>> => {
  const bulkOpsAppGroupId = getBulkOpsAppGroupId();
  let result: InvocationResult<TaskRequestOutcome>;
  const serverInfoResult = await getServerInfo(api.asUser());
  if (serverInfoResult.ok) {
    const siteUrl = removeTrailingSlashIfExistent(serverInfoResult.data.baseUrl);
    await addUserToGroup(siteUrl, accountId, bulkOpsAppGroupId);
    try {
      result = await doBulkMove(bulkIssueMoveRequestData, 0, createTraceId());
    } finally {
      await removeUserFromGroup(siteUrl, accountId, bulkOpsAppGroupId);
    }
    return result;
  } else {
    console.error(`Failed to retrieve server info: ${serverInfoResult.errorMessage}`);
    return {
      ok: false,
      status: serverInfoResult.status,
      errorMessage: `Failed to retrieve server info: ${serverInfoResult.errorMessage}`
    };
  }
}

export const initiateBulkEdit = async (accountId: string, bulkIssueEditRequestData: any): Promise<InvocationResult<TaskRequestOutcome>> => {
  const bulkOpsAppGroupId = getBulkOpsAppGroupId();
  let result: InvocationResult<TaskRequestOutcome>;
  const serverInfoResult = await getServerInfo(api.asUser());
  if (serverInfoResult.ok) {
    const siteUrl = removeTrailingSlashIfExistent(serverInfoResult.data.baseUrl);
    await addUserToGroup(siteUrl, accountId, bulkOpsAppGroupId);
    try {
      result = await doBulkEdit(bulkIssueEditRequestData, 0, createTraceId());
    } finally {
      await removeUserFromGroup(siteUrl, accountId, bulkOpsAppGroupId);
    }
    return result;
  } else {
    console.error(`Failed to retrieve server info: ${serverInfoResult.errorMessage}`);
    return {
      ok: false,
      status: serverInfoResult.status,
      errorMessage: `Failed to retrieve server info: ${serverInfoResult.errorMessage}`
    };
  }
}

const doBulkMove = async (bulkIssueMoveRequestData: any, retryNumber: number, traceId: string): Promise<InvocationResult<TaskRequestOutcome>> => {
  console.log(`[${traceId}]: Initiating bulk move with request data: ${JSON.stringify(bulkIssueMoveRequestData, null, 2)}`);
  const response = await api.asUser().requestJira(route`/rest/api/3/bulk/issues/move`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bulkIssueMoveRequestData)
  });
  console.log(`[${traceId}]:  * Response status: ${response.status}`);
  const invocationResult = await readResponse<TaskRequestOutcome>(response);
  console.log(`[${traceId}]: Bulk issue move invocation result: ${JSON.stringify(invocationResult, null, 2)}`);
  if (invocationResult.ok) {
    return invocationResult;
  } else {
    // A permission error can be the causse of an error due to the eventually consistent semantics of identity APIs, however,
    // it's not easy to be absolutely sure if the error is due to a permission issue or not because it comes back as a 400 status
    // code because it can also relate to fields being hidden. So, here we just assume we should retry all error.
    if (retryNumber < maxBulkOperationRetries) {
      const retryDelay = computeRetryDelay(retryNumber);
      console.log(`[${traceId}]: Retrying bulk move after ${retryDelay} milliseconds (${retryNumber} retries left) due to ${invocationResult.status} error status: ${invocationResult.errorMessage ? invocationResult.errorMessage : '[no error message provided]'}`);
      await delay(retryDelay);
      console.warn(`[${traceId}]: Bulk move failed with status ${invocationResult.status}. Retrying (${retryNumber} retries left)...`);
      return await doBulkMove(bulkIssueMoveRequestData, retryNumber + 1, traceId);
    } else {
      console.error(`[${traceId}]: Bulk move failed after retries with status ${invocationResult.status}. Error message: ${invocationResult.errorMessage}`);
      return invocationResult;
    }
  }
}

const doBulkEdit = async (bulkIssueMoveRequestData: any, retryNumber: number, traceId: string): Promise<InvocationResult<TaskRequestOutcome>> => {
  console.log(`[${traceId}]: Initiating bulk edit with request data: ${JSON.stringify(bulkIssueMoveRequestData, null, 2)}`);
  const response = await api.asUser().requestJira(route`/rest/api/3/bulk/issues/fields`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bulkIssueMoveRequestData)
  });
  console.log(`[${traceId}]:  * Response status: ${response.status}`);
  const invocationResult = await readResponse<TaskRequestOutcome>(response);
  console.log(`[${traceId}]: Bulk issue edit invocation result: ${JSON.stringify(invocationResult, null, 2)}`);
  if (invocationResult.ok) {
    return invocationResult;
  } else {
    // A permission error can be the causse of an error due to the eventually consistent semantics of identity APIs, however,
    // it's not easy to be absolutely sure if the error is due to a permission issue or not because it comes back as a 400 status
    // code because it can also relate to fields being hidden. So, here we just assume we should retry all error.
    if (retryNumber < maxBulkOperationRetries) {
      const retryDelay = computeRetryDelay(retryNumber);
      console.log(`[${traceId}]: Retrying bulk edit after ${retryDelay} milliseconds (${retryNumber} retries left) due to ${invocationResult.status} error status: ${invocationResult.errorMessage ? invocationResult.errorMessage : '[no error message provided]'}`);
      await delay(retryDelay);
      console.warn(`[${traceId}]: Bulk edit failed with status ${invocationResult.status}. Retrying (${retryNumber} retries left)...`);
      return await doBulkEdit(bulkIssueMoveRequestData, retryNumber + 1, traceId);
    } else {
      console.error(`[${traceId}]: Bulk edit failed after retries with status ${invocationResult.status}. Error message: ${invocationResult.errorMessage}`);
      return invocationResult;
    }
  }
}

const createTraceId = (): string => {
  const randomPart = Math.floor(Math.random() * 100000); // Random number between 0 and 99999
  return `${randomPart}`;
}

const computeRetryDelay = (retryNumber: number): number => {
  // Exponential backoff with a maximum delay of 10 seconds starting with a 2 second delay, yielding delays of 2s, 4s, 8s, 10s, 10s, etc.
  const maxDelay = 30000;
  const delay = initialRetryDelay * Math.pow(2, retryNumber);
  return Math.min(delay, maxDelay);
}

const delay = (milliseconds: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

const addUserToGroup = async (siteUrl: string, accountId: string, groupId: string): Promise<any> => {
  console.log(`Adding user with accountId: ${accountId} to group with groupId: ${groupId}`);
  const requestData = {
    accountId: accountId
  }
  // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-groups/#api-rest-api-3-group-user-post
  let response: APIResponse;
  if (manageUserGroupsUsingAppUserAccount) {
    response = await api.asApp().requestJira(route`/rest/api/3/group/user?groupId=${groupId}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
  } else {
    response = await fetch(`${siteUrl}/rest/api/3/group/user?groupId=${groupId}`, {
      method: 'POST',
      headers: {
        'Authorization': `${getBasicAuthHeader()}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
  }
  console.log(` * Response status: ${response.status}`);
  const result = await readResponse<any>(response);
  return result;
}

const removeUserFromGroup = async (siteUrl: string, accountId: string, groupId: string): Promise<number> => {
  console.log(`Removing user with accountId: ${accountId} from group with groupId: ${groupId}`);
  // https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-groups/#api-rest-api-3-group-user-delete
  let response: APIResponse;
  if (manageUserGroupsUsingAppUserAccount) {
    response = await api.asApp().requestJira(route`/rest/api/3/group/user?groupId=${groupId}&accountId=${accountId}`, {
      method: 'DELETE'
    });
  } else {
    response = await fetch(`${siteUrl}/rest/api/3/group/user?groupId=${groupId}&accountId=${accountId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `${getBasicAuthHeader()}`,
      }
    });
  }
  console.log(` * Response status: ${response.status}`);
  return response.status;
}

const getServerInfo = async (asPrincipal: RequestProductMethods): Promise<InvocationResult<ServerInfo>> => {
  const response = await asPrincipal.requestJira(route`/rest/api/3/serverInfo`, {
    headers: {
      'Accept': 'application/json'
    }
  });
  return await readResponse<ServerInfo>(response);
}

const readResponse = async <T>(response: any): Promise<InvocationResult<T>> => {
  const invocationResult: InvocationResult<T> = {
    ok: response.ok,
    status: response.status
  }
  if (response.ok) {
    const data = await response.json();
    invocationResult.data = data as T;
  } else {
    const errorMessage = await response.text();
    console.error(` * Error response: ${errorMessage}`);
    invocationResult.errorMessage = errorMessage;
  }
  return invocationResult;
}

const removeTrailingSlashIfExistent = (url: string): string => {
  if (url.endsWith('/')) {
    return url.slice(0, -1);
  } else {
    return url;
  }
}
