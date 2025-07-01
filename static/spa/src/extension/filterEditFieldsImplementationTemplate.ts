import { IssueBulkEditField } from "src/types/IssueBulkEditFieldApiResponse";
import { IssueType } from "src/types/IssueType";

const issueTypeNameLowersToAllowedFields: Record<string, string[]> = {
  'bug': [
    'acceptance criteria',
    'affected application',
    'assigned team',
    'assignee',
    'components',
    'description',
    'environment',
    'estimated build date',
    'executive summary',
    'fix agent',
    'fix application',
    'fix team',
    'fix type/subtype',
    'fix versions',
    'issuelinks',
    'labels',
    'priority',
    'reminder',
    'reoccurring issue',
    'reporter',
    'reporting team',
    'request for change (rfc)',
    'resolution',
    'retest failed reason',
    'return reason/subtype',
    'root cause analysis',
    'severity',
    'sprint',
    'summary',
    'test approach',
    'test category',
    'test levels',
    'test type',
    'versions',
  ],
  'feature': [
    'acceptance criteria',
    'assignee',
    'business go-live date',
    'code drop to lab',
    'components',
    'description',
    'dev/build start',
    'due date',
    'epic name',
    'feature type',
    'fix versions',
    'issuelinks',
    'labels',
    'parent',
    'planned quarter',
    'planned year',
    'priority',
    'reporter',
    'resolution',
    'scope complete',
    'solution complete',
    'sprint',
    'story points',
    'summary',
    'target end',
    'target start',
    'technical launch',
    'test complete',
    'type of work',
    'value',
    'versions',
  ],
  'story': [
    'acceptance criteria',
    'accessibility impact',
    'assignee',
    'code drop to lab',
    'components',
    'description',
    'dev/build start',
    'due date',
    'parent',
    'fix versions',
    'issuelinks',
    'labels',
    'parent',
    'priority',
    'r2d2 team',
    'reporter',
    'resolution',
    'scope complete',
    'solution complete',
    'sprint',
    'story points',
    'summary',
    'target end',
    'target start',
    'test complete',
    'value',
    'versions'
  ],
  'task': [
    'assignee',
    'components',
    'description',
    'due date',
    'parent key',
    'fix versions',
    'issuelinks',
    'labels',
    'priority',
    'reporter',
    'resolution',
    'sprint',
    'story points',
    'summary',
    'task type',
    'versions',
    'r2d2 team'
  ]
}

/**
 * This is an example implementation for filtering the allowable fields for bulk edit operations. To use this as is, simply 
 * invoke this from bulkOperationRuleEnforcer.filterEditFields.
 */
export const filterEditFieldsImplementation = async (fields: IssueBulkEditField[], issueTypes: IssueType[]): Promise<IssueBulkEditField[]> => {
  if (issueTypes.length === 0) {
    console.warn(`filterEditFieldsImplementation: issueTypes.length === 0, but this implementation expects one issue type. Returning no fields.`);
    return [];
  } else if (issueTypes.length > 1) { 
    console.warn(`filterEditFieldsImplementation: issueTypes.length > 1, but this implementation expects one issue type. Returning no fields.`);
    return [];
  } else {
    const issueType = issueTypes[0];
    const issueTypeName = issueType.name;
    const issueTypeNameLower = issueTypeName.toLowerCase();
    const allowedFields = issueTypeNameLowersToAllowedFields[issueTypeNameLower];
    if (allowedFields && allowedFields.length > 0) {
      const filteredFields = fields.filter(field => {
        const fieldNameLower = field.name.toLowerCase();
        const allow = allowedFields.includes(fieldNameLower);
        if (!allow) {
          // console.log(`filterEditFieldsImplementation: Filtering out '${issueType.name}' field '${field.name}'.`);
        }
        return allow;
      });
      return filteredFields;
    } else {
      console.warn(`filterEditFieldsImplementation: No configured allowed fields list for issue type '${issueTypeName}'. Returning no fields.`);
      return [];
    }
  }
  }
