import { Issue } from "./Issue"

// https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/#api-rest-api-3-search-jql-get

export type IssueSearchInfo = {
  isLast: boolean; // e.g. true,
  issues: Issue[];
  names?: string[]; // e.g. ["key", "summary", "status", "issuetype", "assignee", "reporter", "created", "updated"]
  nextPageToken: string; 
  schema?: string;
}
