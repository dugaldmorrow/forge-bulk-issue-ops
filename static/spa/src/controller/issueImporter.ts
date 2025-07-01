import { requestJira } from '@forge/bridge';
import { IssueType } from "../types/IssueType";
import { Project } from "../types/Project";
import { CreateIssuePayload, CreateIssuePayloadField } from "src/types/CreateIssuePayload";
import { ObjectMapping } from "src/types/ObjectMapping";
import { CsvLine, CsvParseResult, ImportColumnMatchInfo } from "src/model/importModel";
import { textToAdf } from "./textToAdf";
import { IssueFieldType } from "src/types/IssueFieldType";
import { Issue } from 'src/types/Issue';

export type ImportInstructions = {
  targetProject: Project,
  targetIssueType: IssueType,
  columnNamesToIndexes: ObjectMapping<number>,
  fieldKeysToMatchInfos: ObjectMapping<ImportColumnMatchInfo>,
  csvParseResult: CsvParseResult;
}

const buildFieldsForCvsLine = async (
  importInstructions: ImportInstructions,
  csvLine: CsvLine,
  lineIndex: number
) => {
  const columns = csvLine.cells;
  const createIssueFields: ObjectMapping<CreateIssuePayloadField> = {};
  const fieldKeys = Object.keys(importInstructions.fieldKeysToMatchInfos);
  for (const fieldKey of fieldKeys) {
    const matchInfo = importInstructions.fieldKeysToMatchInfos[fieldKey];
    const fieldName = matchInfo.fieldMetadata.name;
    const columnName = matchInfo.columnName;
    const columnIndex = importInstructions.columnNamesToIndexes[columnName];
    const rawColumnValue = columns[columnIndex];
    if (rawColumnValue === undefined) {
      throw new Error(`issueImporter.importIssues: No value found for column "${columnName}" (index ${columnIndex}) in line ${lineIndex + 1}. Skipping field "${fieldName}".`);
    } else {
      const columnValue = rawColumnValue.trim();
      const field = await buildField(matchInfo, columnValue);
      if (field) {
        createIssueFields[matchInfo.fieldMetadata.key] = field;
      }
    }
  }
  return createIssueFields;
} 

export const importIssues = async (
  importInstructions: ImportInstructions,
  onProgressUpdate: (importCount: number, lineSkipCount: number, failCount: number, totalCount: number) => Promise<void>
): Promise<void> => {
  // console.log(`issueImporter.importIssues called with importInstructions: ${JSON.stringify(importInstructions, null, 2)}`);
  let importCount: number = 0;
  let lineSkipCount: number = 0;
  let failCount: number = 0;
  let totalCount: number = importInstructions.csvParseResult.bodyLines.length;
  let lineIndex = 0;
  for (const csvLine of importInstructions.csvParseResult.bodyLines) {
    let skipLineMessage = '';
    if (skipLineMessage) {
      console.warn(skipLineMessage);
      lineIndex++;
      lineSkipCount++;
      continue;
    }
    // console.log(`issueImporter.importIssues processing line ${lineIndex + 1} of ${totalCount}`);
    const createIssueFields = await buildFieldsForCvsLine(importInstructions, csvLine, lineIndex);
    createIssueFields['project'] = {
      id: importInstructions.targetProject.id
    }
    createIssueFields['issuetype'] = {
      id: importInstructions.targetIssueType.id
    }
    const createIssuePayload: CreateIssuePayload = {
      fields: createIssueFields
    };
    // console.log(`issueImporter.importIssues built payload: ${JSON.stringify(createIssuePayload, null, 2)}`);
    const issue = await createIssue(createIssuePayload, 1, 3);
    if (issue) {
      importCount++;
      // console.log(`Issue created successfully: ${issue.key}`);
    } else {
      failCount++;
      console.error('Error creating issue');
    }
    await onProgressUpdate(importCount, lineSkipCount, failCount, totalCount);
    lineIndex++;
  }
}

const createIssue = async (createIssuePayload: CreateIssuePayload, attemptNumber: number, allowedRetryCount: number): Promise<Issue | undefined> => {
  const response = await requestJira(`/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createIssuePayload)
  });
  if (response.ok) {
    const data = await response.json();
    // console.log('Issue created successfully:', data);
    return data as Issue;
  } else {
    const status = response.status;
    const retryAfter = response.headers.get('Retry-After');
    if (retryAfter) {
      // response.status is probably a 429 or 500, but it doesn't matter, just delay and retry.
      console.warn(`Rate limit exceeded. Retry after ${retryAfter} seconds.`);
      let secondsToDelay = parseInt(retryAfter);
      if (isNaN(secondsToDelay)) {
        secondsToDelay = 5;
      }
      // Exponential backoff: double the delay with each successive attempt
      for (let i = 1; i < attemptNumber; i++) {
        secondsToDelay = secondsToDelay * 2;
      }
      await delay(secondsToDelay * 1000);
      return createIssue(createIssuePayload, attemptNumber + 1, allowedRetryCount - 1);
    } else {
      console.warn(`Failed to create issue. Status: ${status}`);
      return undefined;
    }
  }
}

const delay = (milliseconds: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

const buildField = async (
  matchInfo: ImportColumnMatchInfo,
  columnValue: any
): Promise<undefined | CreateIssuePayloadField> => {
  const fieldSchema = matchInfo.fieldMetadata.schema;
  const fieldType = fieldSchema.type;
  if (fieldType === 'issuetype') {
    /* 
      Example of what fieldMetadata may look like:
      {
        "required": true,
        "schema": {
          "type": "issuetype",
          "system": "issuetype"
        },
        "name": "Issue Type",
        "key": "issuetype",
        "hasDefaultValue": false,
        "operations": [],
        "allowedValues": [
          {
            "self": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/issuetype/10002",
            "id": "10002",
            "description": "A small, distinct piece of work.",
            "iconUrl": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/2/universal_avatar/view/type/issuetype/avatar/10318?size=medium",
            "name": "Task",
            "subtask": false,
            "avatarId": 10318,
            "hierarchyLevel": 0
          }
        ]
      }
    */
    console.warn(`Ignoring field type "${fieldType}" field since the user selects the issue type.`);
    return undefined;
  } else if (fieldType === 'issuelink') {
    /* 
      Example of what fieldMetadata may look like:
      {
        "required": false,
        "schema": {
          "type": "issuelink",
          "system": "parent"
        },
        "name": "Parent",
        "key": "parent",
        "hasDefaultValue": false,
        "operations": [
          "set"
        ]
      }
    */
    console.warn(`Ignoring field type "${fieldType}" field - not handled yet.`);
    return undefined;
  } else if (fieldType === 'option') {
    /* 
     Example of what fieldMetadata may look like:
     {
        "required": true,
        "schema": {
          "type": "option",
          "custom": "com.atlassian.jira.plugin.system.customfieldtypes:select",
          "customId": 10091
        },
        "name": "R2D2 Team",
        "key": "customfield_10091",
        "hasDefaultValue": false,
        "operations": [
          "set"
        ],
        "allowedValues": [
          {
            "self": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/customFieldOption/10020",
            "value": "A",
            "id": "10020"
          },
          {
            "self": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/customFieldOption/10021",
            "value": "B",
            "id": "10021"
          }
        ]
      }
     */
    const allowedValues = matchInfo.fieldMetadata.allowedValues;
    return buildFieldFromAllowedValue(matchInfo.fieldMetadata.schema.type, allowedValues, columnValue);
  } else if (fieldType === 'array') {
    /* 
     Example of what fieldMetadata may look like:
     {
        "required": false,
        "schema": {
          "type": "array",
          "items": "component",
          "system": "components"
        },
        "name": "Components",
        "key": "components",
        "hasDefaultValue": false,
        "operations": [
          "add",
          "set",
          "remove"
        ],
        "allowedValues": []
      }
     */
    const allowedValues = matchInfo.fieldMetadata.allowedValues;
    return buildFieldFromAllowedValue(matchInfo.fieldMetadata.schema.type, allowedValues, columnValue);
  } else if (fieldType === 'string') {
    /* 
      Example of what fieldMetadata may look like:
      {
        "required": false,
        "schema": {
          "type": "string",
          "system": "description"
        },
        "name": "Description",
        "key": "description",
        "hasDefaultValue": false,
        "operations": [
          "set"
        ]
      }
    */
    if (matchInfo.fieldMetadata.schema.custom) {
      const customId = matchInfo.fieldMetadata.schema.customId;
      console.warn(`Ignoring field type "${fieldType}" field - customId = ${customId}.`);
      return undefined;
    } else if (matchInfo.fieldMetadata.schema.system) {
      const isRichText = matchInfo.fieldMetadata.schema.system === 'description' || matchInfo.fieldMetadata.schema.system === 'comment';
      if (isRichText) {
        const columnValueAsAdf = textToAdf(columnValue);
        return columnValueAsAdf;
      } else {
        return columnValue;
      }
    } else {
      console.warn(`Ignoring field type "${fieldType}" field - unrecognised schema: ${JSON.stringify(matchInfo.fieldMetadata.schema)}.`);
      return undefined;
    }
  } else if (fieldType === 'project') {
    /* 
      Example of what fieldMetadata may look like:
      {
        "required": true,
        "schema": {
          "type": "project",
          "system": "project"
        },
        "name": "Project",
        "key": "project",
        "hasDefaultValue": false,
        "operations": [
          "set"
        ],
        "allowedValues": [
          {
            "self": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/project/10000",
            "id": "10000",
            "key": "FEAT",
            "name": "Features",
            "projectTypeKey": "software",
            "simplified": false,
            "avatarUrls": {
              "48x48": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/universal_avatar/view/type/project/avatar/10413",
              "24x24": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/universal_avatar/view/type/project/avatar/10413?size=small",
              "16x16": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/universal_avatar/view/type/project/avatar/10413?size=xsmall",
              "32x32": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/universal_avatar/view/type/project/avatar/10413?size=medium"
            },
            "projectCategory": {
              "self": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/projectCategory/10000",
              "id": "10000",
              "description": "",
              "name": "R2D2"
            }
          }
        ]
      }
    */
    const allowedValues = matchInfo.fieldMetadata.allowedValues;
    return buildFieldFromAllowedValue(matchInfo.fieldMetadata.schema.type, allowedValues, columnValue);
  } else if (fieldType === 'priority') {
    /* 
      Example of what fieldMetadata may look like:
      {
        "required": false,
        "schema": {
          "type": "priority",
          "system": "priority"
        },
        "name": "Priority",
        "key": "priority",
        "hasDefaultValue": true,
        "operations": [
          "set"
        ],
        "allowedValues": [
          {
            "self": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/priority/1",
            "iconUrl": "https://workflow-enforcer-demo.atlassian.net/images/icons/priorities/highest_new.svg",
            "name": "Highest",
            "id": "1"
          },
          {
            "self": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/priority/2",
            "iconUrl": "https://workflow-enforcer-demo.atlassian.net/images/icons/priorities/high_new.svg",
            "name": "High",
            "id": "2"
          },
          {
            "self": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/priority/3",
            "iconUrl": "https://workflow-enforcer-demo.atlassian.net/images/icons/priorities/medium_new.svg",
            "name": "Medium",
            "id": "3"
          },
          {
            "self": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/priority/4",
            "iconUrl": "https://workflow-enforcer-demo.atlassian.net/images/icons/priorities/low_new.svg",
            "name": "Low",
            "id": "4"
          },
          {
            "self": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/priority/5",
            "iconUrl": "https://workflow-enforcer-demo.atlassian.net/images/icons/priorities/lowest_new.svg",
            "name": "Lowest",
            "id": "5"
          }
        ],
        "defaultValue": {
          "self": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/priority/3",
          "iconUrl": "https://workflow-enforcer-demo.atlassian.net/images/icons/priorities/medium_new.svg",
          "name": "Medium",
          "id": "3"
        }
      }
    */
    const allowedValues = matchInfo.fieldMetadata.allowedValues;
    return buildFieldFromAllowedValue(matchInfo.fieldMetadata.schema.type, allowedValues, columnValue);
  } else if (fieldType === 'team') {
    /* 
      Example of what fieldMetadata may look like:
      {
        "required": false,
        "schema": {
          "type": "team",
          "custom": "com.atlassian.jira.plugin.system.customfieldtypes:atlassian-team",
          "customId": 10001,
          "configuration": {
            "com.atlassian.jira.plugin.system.customfieldtypes:atlassian-team": true
          }
        },
        "name": "Team",
        "key": "customfield_10001",
        "autoCompleteUrl": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/gateway/api/v1/recommendations",
        "hasDefaultValue": false,
        "operations": [
          "set"
        ]
      }
    */
    const allowedValues = matchInfo.fieldMetadata.allowedValues;
    return buildFieldFromAllowedValue(matchInfo.fieldMetadata.schema.type, allowedValues, columnValue);
  } else if (fieldType === 'number') {
    /* 
      Example of what fieldMetadata may look like:
      {
        "required": true,
        "schema": {
          "type": "number",
          "custom": "com.atlassian.jira.plugin.system.customfieldtypes:float",
          "customId": 10124
        },
        "name": "My Test Number Field",
        "key": "customfield_10124",
        "hasDefaultValue": false,
        "operations": [
          "set"
        ]
      }
    */
    // console.warn(`Ignoring field type "${fieldType}" field - not handled yet.`);
    try {
      const parsedNumber = parseFloat(columnValue);
      if (isNaN(parsedNumber)) {
        console.warn(`Ignoring field type "${fieldType}" field - could not parse number from column value "${columnValue}".`);
        return undefined;
      } else {
        return parsedNumber;
      }
    } catch (error) {
      console.error(`Ignoring field type "${fieldType}" field - error parsing number from column value "${columnValue}":`, error);
      return undefined;
    }
  } else if (fieldType === 'date') {
    /* 
      Example of what fieldMetadata may look like:
      {
        "required": false,
        "schema": {
          "type": "date",
          "system": "duedate"
        },
        "name": "Due date",
        "key": "duedate",
        "hasDefaultValue": false,
        "operations": [
          "set"
        ]
      }
    */
    // Assume the date is in the right format
    return columnValue;
  } else if (fieldType === 'labels') {
    /* 
      Example of what fieldMetadata may look like:
      {
        "required": false,
        "schema": {
          "type": "array",
          "items": "string",
          "system": "labels"
        },
        "name": "Labels",
        "key": "labels",
        "autoCompleteUrl": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/1.0/labels/suggest?query=",
        "hasDefaultValue": false,
        "operations": [
          "add",
          "set",
          "remove"
        ]
      }
    */
    console.warn(`Ignoring field type "${fieldType}" field - not handled yet.`);
    return undefined;
  } else if (fieldType === 'user') {
    /* 
      Example of what fieldMetadata may look like:
      {
        "required": false,
        "schema": {
          "type": "user",
          "system": "assignee"
        },
        "name": "Assignee",
        "key": "assignee",
        "autoCompleteUrl": "https://api.atlassian.com/ex/jira/d5798e84-0911-42ba-8965-1ede16eb86bd/rest/api/3/user/assignable/search?project=FEAT&query=",
        "hasDefaultValue": false,
        "operations": [
          "set"
        ]
      }
    */
    // Assume the value is an Atlassian account ID.
    return columnValue;
  } else {
    console.warn(`Ignoring field type "${fieldType}" field - not handled yet.`);
    return undefined;
  }
}

const buildFieldFromAllowedValue = async (
  fieldType: IssueFieldType,
  allowedValues: any[],
  columnValue: any
): Promise<undefined | CreateIssuePayloadField> => {
  if (!allowedValues || allowedValues.length === 0) {
    console.warn(`Ignoring field type "${fieldType}" field - no allowed values defined.`);
    return undefined;
  } else {
    const allowedValue = allowedValues.find((value: any) => value.value === columnValue || value.id === columnValue);
    if (!allowedValue) {
      console.warn(`Ignoring field type "${fieldType}" field - no matching allowed value found for "${columnValue}".`);
      return undefined;
    } else {
      const field: CreateIssuePayloadField = {
        id: allowedValue.id
      };
      return field;
    }
  }

}