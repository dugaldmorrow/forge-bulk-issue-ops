import {IssueStatus} from './IssueStatus';
import {IssueType} from './IssueType';

export interface IssueSubtaskFields {
  summary: string;
  status: IssueStatus;
  issuetype: IssueType;

  // Possibly more fields
}
