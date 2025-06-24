
/**
 * If set to true, this will allow a target project to be selected that is one of the projects from 
 * which the selected issues to move are already in.
 */
export const allowTheTargetProjectToMatchAnyIssueSourceProject = false;

export const allowBulkMovesAcrossProjectCategories = false;

export const allowBulkMovesFromMultipleProjects = false;

export const allowBulkEditsFromMultipleProjects = false;

export const allowBulkEditsAcrossMultipleProjects = true;

/**
 * If this is false, bulk moves and edits will not be allowed for issues that are already resolved. This
 * effectively inserts `statusCategory != Done and ` before the JQL query used to find issues for bulk operations.
 */
export const enableTheAbilityToBulkChangeResolvedIssues = false;

export const showLabelsSelect = false;

export const showLabelsEditField = true;

export const filterModeDefault: 'advanced' | 'basic' = 'basic';
