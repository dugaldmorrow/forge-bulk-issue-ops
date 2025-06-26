import { Issue } from "src/types/Issue";
import { IssueSelectionState } from "../types/IssueSelectionState";
import jiraDataModel from "./jiraDataModel";

export const equalIssueSelections = (selectionA: IssueSelectionState, selectionB: IssueSelectionState): boolean => {
  const equal = selectionA.uuid === selectionB.uuid;
  if (!equal) {
    console.warn(`Issue selections are not equal:\n * ${selectionToString(selectionA)}\n * ${selectionToString(selectionB)}`);
  }
  return equal;
}
// The following is a less strict version of the equality check that compares the selected issues.
// export const equalIssueSelections = (selectionA: IssueSelectionState, selectionB: IssueSelectionState): boolean => {
//   const equal = selectionA.selectedIssues.length === selectionB.selectedIssues.length &&
//           selectionA.selectedIssues.every(issueA => {
//             const issueB = selectionB.selectedIssues.find(issueB => issueB.key === issueA.key);
//             return issueB !== undefined;
//           });
//   if (!equal) {
//     console.warn(`Issue selections are not equal:\n * ${selectionToString(selectionA)}\n * ${selectionToString(selectionB)}`);
//   }
//   return equal;
// }

let nextId = 1;

export const newIssueSelectionUuid = (): string => {
  // return `issue-selection-${uuid()}`;
  return `issue-selection-${nextId++}`;
}

export const selectionToString = (issueSelection: IssueSelectionState): string => {
  const issueKeys = issueSelection.selectedIssues.map(issue => issue.key).join(', ');
  return `IssueSelectionState(uuid=${issueSelection.uuid}, issues=[${issueKeys}], validity=${issueSelection.selectionValidity})`;
}

export const expandIssueArrayToIncludeSubtasks = async (issues: Issue[]): Promise<Issue[]> => {
  const expandedIssuesArray: Issue[] = [];
  for (const issue of issues) {
    expandedIssuesArray.push(issue);
    if (issue.fields.subtasks && issue.fields.subtasks.length > 0) {
      for (const subtask of issue.fields.subtasks) {
        const subtaskIssue: Issue = await jiraDataModel.getIssueByIdOrKey(subtask.id);
        if (subtaskIssue) {
          expandedIssuesArray.push(subtaskIssue);
        } else {
          // KNOWN-17: This may not be handled fully and may lead to errors
          console.error(`Failed to fetch subtask with ID ${subtask.id} for issue ${issue.key}`);
        }
      }
    }
  }
  return expandedIssuesArray;
}

export const extractSubtasks = async (issues: Issue[]): Promise<Issue[]> => {
  const subtasks: Issue[] = [];
  for (const issue of issues) {
    if (issue.fields.subtasks && issue.fields.subtasks.length > 0) {
      for (const subtask of issue.fields.subtasks) {
        const subtaskIssue: Issue = await jiraDataModel.getIssueByIdOrKey(subtask.id);
        if (subtaskIssue) {
          subtasks.push(subtaskIssue);
        } else {
          // KNOWN-17: This may not be handled fully and may lead to errors
          console.error(`Failed to fetch subtask with ID ${subtask.id} for issue ${issue.key}`);
        }
      }
    }
  }
  return subtasks;
}
