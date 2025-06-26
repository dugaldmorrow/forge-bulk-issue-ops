import { IssueLink } from './IssueLink';
import {IssueStatus} from './IssueStatus';
import { IssueSubtask } from './IssueSubtask';
import {IssueType} from './IssueType';
import { Project } from './Project';

export interface IssueFields {
  summary: string;
  description: string;
  issuetype: IssueType;
  project: Project;
  status: IssueStatus;
  issuelinks?: IssueLink[];
  assignee?: any;
  labels?: string[];
  subtasks?: IssueSubtask[];
}
