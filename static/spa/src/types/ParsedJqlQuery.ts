
// https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-jql/#api-rest-api-3-jql-parse-post

import { JqlQuery } from "./JqlQuery";

export type ParsedJqlQuery = {
  query: string;
  errors?: string[];
  warnings?: string[];
  structure?: JqlQuery;
}
