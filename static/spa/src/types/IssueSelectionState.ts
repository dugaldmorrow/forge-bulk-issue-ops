import { Issue } from "./Issue";
import { IssueSelectionValidity } from "./IssueSelectionValidity";

export type IssueSelectionState = {
  uuid: string;
  selectedIssues: Issue[];
  selectionValidity: IssueSelectionValidity;
}
