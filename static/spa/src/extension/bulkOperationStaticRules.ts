
/**
 * If set to true, this will allow a target project to be selected that is one of the projects from 
 * which the selected issues to move are already in.
 */
export const allowTheTargetProjectToMatchAnyIssueSourceProject = false;

export const allowBulkMovesAcrossProjectCategories = true;

export const allowBulkMovesFromMultipleProjects = false;

export const allowBulkEditsFromMultipleProjects = false;

export const allowBulkEditsAcrossMultipleProjects = true;

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
