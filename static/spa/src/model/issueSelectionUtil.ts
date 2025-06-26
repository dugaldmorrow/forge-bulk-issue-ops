import { IssueSelectionState } from "../types/IssueSelectionState";

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