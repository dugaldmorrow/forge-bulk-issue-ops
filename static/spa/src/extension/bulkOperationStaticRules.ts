
/**
 * This constant defines the maximum number of issues that can be selected for bulk operations. Make
 * sure this dow not exceed the maximum number of issues that can be processed in a single bulk operation
 * request in Jira Cloud. Since a maximum of 100 issues can searched in a single JQL query, going over
 * this limit will result in multiple API requests and may make the UI less responsive.
 */
export const maximumNumberOfIssuesToBulkActOn = 100;

/**
 * If set to true, this will allow a target project to be selected that is one of the projects from 
 * which the selected issues to move are already in.
 */
export const allowTheTargetProjectToMatchAnyIssueSourceProject = false;

export const allowBulkMovesAcrossProjectCategories = true;

export const allowBulkMovesFromMultipleProjects = false;

export const allowBulkEditsFromMultipleProjects = false;

export const allowBulkEditsAcrossMultipleProjects = true;

export const bulkMoveIssueTypeMappingStrategy: BulkMoveIssueTypeMappingStrategy = 'exact-matches-and-allow-listed-mappings'; 
export type BulkMoveIssueTypeMappingStrategy =
  'all-mappings-at-same-level-allowed' | // Any issue type can be mapped to any other of the same hierarchy level
  'exact-matches-and-allow-listed-mappings' |
  'only-allow-listed-mappings'; // When active, the allow list is defined by allowedBulkMoveIssueTypeMappings

/**
 * This is a mapping of source issue types to target issue types for bulk move operations.
 */
export const allowedBulkMoveIssueTypeMappings = {
  // The following are just examples that have been used for testing. Change these mappings as needed.
  // 'Story': 'Story',
  // 'Story': 'Task',
  'Bug': 'THE Bug'
};

/**
 * If this is false, bulk moves and edits will not be allowed for issues that are already resolved. This
 * effectively inserts `statusCategory != Done and ` before the JQL query used to find issues for bulk operations.
 */
export const enableTheAbilityToBulkChangeResolvedIssues = false;

/**
 * This is a list of issue statuses that will be excluded from being selected for bulk operations. Change this 
 * as necessary. For example, if statuses like "On-Hold" or "Cancelled" should not be included in bulk operations,
 * set `excludedIssueStatuses` to `['On-Hold', 'Cancelled']`.
 */
export const excludedIssueStatuses: string[] = [];

/**
 * The following type and associated constant defines the strategy for moving subtasks during bulk operations.
 */
export type SubtaskMoveStrategy =
  'issues-with-subtasks-can-not-be-moved' |
  'move-subtasks-explicitly-with-parents';
export const subtaskMoveStrategy: SubtaskMoveStrategy = 'move-subtasks-explicitly-with-parents';

/**
 * This constant determines whether the issue type move mappings are restricted to the same hierarchy level. Bulk moves
 * will fail if this is false and the user has selected issues with subtasks, but has mapped the subtask to an issue type
 * with a higher hierarchy level.
 */
export const restrictIssueTypeMoveMappingsToSameHierarchyLevel = true;

export const showLabelsSelect = false;

export const showLabelsEditField = true;

export const advancedFilterModeEnabled = true;
export const filterModeDefault: 'advanced' | 'basic' = 'basic';

/**
 * This is the default value that will be applied to the "retain" field parameter for each default parameter value object
 * in the bulk move operation. See the Jira API, https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-bulk-operations/#api-rest-api-3-bulk-issues-move-post, 
 * for more details.
 */
export const defaultRetainValueSetting = true;

/**
 * 
 * ATTENTION: This feature is unreliable as it appears Jira does not always set the values of optional fields.
 *            The Jira API, https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-bulk-operations/#api-rest-api-3-bulk-issues-move-post, 
 *            says the following under the description of the targetMandatoryFields parameter:
 * 
 *            The new values will only be applied if the field is mandatory in the target project and at least one issue from the
 *            source has that field empty, or if the field context is different in the target project (e.g. project-scoped version
 *            fields). 
 * 
 * 
 * Fields with these names will be included in the bulk move operation to allow all moved work items to be mapped to 
 * the values for these fields as provided by the user.
 * 
 * Note: As per KNOWN-8, all types of fields are not supported.
 * 
 * This feature mitigates KNOWN-7 (see README.md).
 */
export const optionalFieldNamesToIncludeInMoves: string[] = [


  // Example entries are as follows (change as necessary):
  'Components',
  'Affects versions',
  'Fix versions'
]

