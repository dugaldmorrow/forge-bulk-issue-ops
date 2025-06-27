import { IssueSearchInfo } from "../types/IssueSearchInfo"

export const nilIssueSearchInfo = (): IssueSearchInfo => {
  return {
    nextPageToken: '',
    isLast: false,
    issues: []
  }
}
