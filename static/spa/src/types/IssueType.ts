
export type IssueTypeScope = {
  type: string // e.g.  "PROJECT",
  project: {
    id: string // e.g. "10033"
  }
}

export type IssueType = {
  id: string // e.g. "10036",
  description: string // e.g. "Subtasks track small pieces of work that are part of a larger task.",
  iconUrl: string // e.g. "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/2/universal_avatar/view/type/issuetype/avatar/10316?size=medium",
  name: string // e.g. "Subtask",
  untranslatedName: string // e.g. "Subtask",
  subtask: boolean // e.g. true,
  avatarId?: number // e.g. 10316,
  hierarchyLevel: number // e.g. -1 for Sub-task, 0 for Story, 1 for Epic, etc.
  scope?: IssueTypeScope // Details of the next-gen projects the issue type is available in.
}
