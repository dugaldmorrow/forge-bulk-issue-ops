import Resolver from '@forge/resolver';
import { webTrigger } from "@forge/api";
import { initiateBulkEdit, initiateBulkMove } from './initiateBulkOperations';

const resolver = new Resolver();

resolver.define('initiateBulkMove', async (request: any) => {
  // console.log(`initiateBulkMove request: ${JSON.stringify(request, null, 2)}`);
  const context = request.context;
  const payload = request.payload;
  const accountId = context.accountId;
  // console.log(`initiateBulkMove payload: ${JSON.stringify(payload, null, 2)}`);
  const bulkIssueMoveRequestData = payload.bulkIssueMoveRequestData;
  return await initiateBulkMove(accountId, bulkIssueMoveRequestData);
});

resolver.define('initiateBulkEdit', async (request: any) => {
  console.log(`initiateBulkEdit request: ${JSON.stringify(request, null, 2)}`);
  const context = request.context;
  const payload = request.payload;
  const accountId = context.accountId;
  // console.log(`initiateBulkEdit payload: ${JSON.stringify(payload, null, 2)}`);
  const bulkIssueEditRequestData = payload.bulkIssueEditRequestData;
  return await initiateBulkEdit(accountId, bulkIssueEditRequestData);
});

/**
 *  This resolver is used to log messages from the client side. This is generally only used to log errors or warnings.
 */
resolver.define('logMessage', async (request: any): Promise<void> => {
  // console.log(`initiateBulkEdit request: ${JSON.stringify(request, null, 2)}`);
  const context = request.context;
  const payload = request.payload;
  const accountId = context.accountId;
  const message = payload.message;
  const level = context.level;
  const formattedMessage = `[${accountId}] ${message}`;
  if (level === 'error') {
    console.error(formattedMessage);
  } else if (level === 'warn') {
    console.warn(formattedMessage);
  } else if (level === 'info') {
    console.info(formattedMessage);
  } else {
    console.log(formattedMessage);
  }
});

export const handler = resolver.getDefinitions();
