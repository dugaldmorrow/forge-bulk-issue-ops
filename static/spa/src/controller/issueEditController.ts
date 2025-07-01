import { TaskOutcome, TaskStatus } from "../types/TaskOutcome";
import { IssueMoveEditRequestOutcome, OutcomeError } from "../types/IssueMoveRequestOutcome";
import jiraDataModel from "../model/jiraDataModel";
import { InvocationResult } from "../types/InvocationResult";
import { 
  BulkIssueEditRequestData,
  JiraCascadingSelectField,
  JiraDateField,
  JiraDateInput,
  JiraDateTimeField,
  JiraIssueTypeField,
  JiraLabelsField,
  JiraLabelsInput,
  JiraMultipleSelectUserPickerField,
  JiraMultiSelectComponentField,
  JiraNumberField,
  JiraPriorityField,
  JiraRichTextField,
  JiraSelectedOptionField,
  JiraSingleLineTextField,
  JiraSingleSelectField,
  JiraSingleSelectUserPickerField,
  JiraSingleVersionPickerField
} from "src/types/BulkIssueEditRequestData";
import { BulkIssueEditRequestDataBuilder, JiraIssueFieldsBuilder } from "./BulkIssueEditRequestDataBuilder";
import editedFieldsModel from "src/model/editedFieldsModel";
import { IssueBulkEditField } from "src/types/IssueBulkEditFieldApiResponse";
import { Issue } from "src/types/Issue";
import { FieldEditValue } from "src/types/FieldEditValue";
import { dateToJiraEditFormat } from "./dateTimeUtil";
import { CascadingSelectValue } from "src/widget/CascadingSelect";

const issueEditPollPeriodMillis = 1000;

class IssueEditController {

  initiateBulkEdit = async (
    bulkIssueEditRequestData: BulkIssueEditRequestData = this.buildBulkIssueEditRequestData(),
  ): Promise<IssueMoveEditRequestOutcome> => {
    // console.log(` * Initiating bulk issue edit with payload: ${JSON.stringify(bulkIssueEditRequestData, null, 2)}`);
    const invocationResult: InvocationResult<IssueMoveEditRequestOutcome> = await jiraDataModel.initiateBulkIssuesEdit(bulkIssueEditRequestData);
    if (invocationResult.ok && invocationResult.data) {
      const requestOutcome: IssueMoveEditRequestOutcome = invocationResult.data;
      if (requestOutcome.taskId) {
        console.info(` * Initiated bulk issue edit with taskId: ${requestOutcome.taskId}`);
      } else {
        console.warn(` * Initiation of bulk issue edit resulted in an error: ${requestOutcome.errors}`);
      }
      return requestOutcome;
    } else {
      console.warn(` * Initiation of bulk issue edit resulted in an API error: ${invocationResult.errorMessage}`);
      const errors: OutcomeError[] = [{
        message: invocationResult.errorMessage,
      }];
      const requestOutcome: IssueMoveEditRequestOutcome = {
        taskId: undefined,
        errors: invocationResult.errorMessage ? errors : [],
        statusCode: 500
      }
      return requestOutcome;
    }
  }

  pollMoveProgress = async (taskId: string): Promise<TaskOutcome> => {
    const params = {
      taskId: taskId,
    }
    const issueMoveOutcome = await jiraDataModel.getTaskOutcome(taskId);
    return issueMoveOutcome;
  }

  awaitMoveCompletion = async (invoke: any, taskId: string): Promise<TaskOutcome> => {
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        const issueMoveOutcome = await this.pollMoveProgress(taskId);
        if (issueMoveOutcome) {
          // console.log(` * Found issueMoveOutcome for taskId ${taskId}`);
          resolve(issueMoveOutcome);
        } else {
          // console.log(` * Did not find issueMoveOutcome for taskId ${taskId}`);
          const outcome = await this.awaitMoveCompletion(invoke, taskId);
          resolve(outcome);
        }
      }, issueEditPollPeriodMillis);
    });
  }

  isDone = (status: TaskStatus): boolean => {
    if (status === 'ENQUEUED' || status === 'RUNNING') {
      return false;
    } else if (status === 'COMPLETE' || status === 'FAILED' || status === 'CANCEL_REQUESTED' || status === 'CANCELLED' || status === 'DEAD') {
      return true;
    } else {
      return false;
    }
  }

  private buildBulkIssueEditRequestData = (): BulkIssueEditRequestData => {
    const sendBulkNotification = editedFieldsModel.getSendBulkNotification();
    const editedFieldsInputBuilder = new JiraIssueFieldsBuilder();
    const selectedActions: string[] = [];
    const callback = (field: IssueBulkEditField, editedFieldValue: FieldEditValue) => {
      if (editedFieldValue === undefined || editedFieldValue === null) {
        // If the value is undefined or null, skip this field.
        return;
      }
      selectedActions.push(field.id);
      // console.log(` * Setting "${field.type}" field (ID = ${field.id}) with value: ${editedFieldValue.value}...`);
      switch (field.type) {
        case 'issuetype':
          const jiraIssueTypeField: JiraIssueTypeField = {
            issueTypeId: editedFieldValue.value
          }
          editedFieldsInputBuilder.setIssueType(jiraIssueTypeField);
          break;
        case 'priority':
          const jiraPriorityField: JiraPriorityField = {
            priorityId: editedFieldValue.value
          }
          editedFieldsInputBuilder.setPriority(jiraPriorityField);
          break;
        case 'com.atlassian.jira.plugin.system.customfieldtypes:float':
          const jiraNumberField: JiraNumberField = {
            fieldId: field.id,
            value: editedFieldValue.value
          }
          editedFieldsInputBuilder.addClearableNumberField(jiraNumberField);
          break;
        case 'com.atlassian.jira.plugin.system.customfieldtypes:select':
          const option: JiraSelectedOptionField = {
            optionId: editedFieldValue.value
          }
          const jiraSingleSelectField: JiraSingleSelectField = {
            fieldId: field.id,
            option: option
          }
          editedFieldsInputBuilder.addSingleSelectField(jiraSingleSelectField);
          break;
        case 'reporter':
        case 'assignee':
          const jiraSingleSelectUserPickerField: JiraSingleSelectUserPickerField = {
            fieldId: field.id,
            user: {
              accountId: editedFieldValue.value
            }
          }
          editedFieldsInputBuilder.addSingleSelectClearableUserPickerField(jiraSingleSelectUserPickerField);
          break;
        case 'labels':
          const rawLabels: string[] = editedFieldValue.value as string[];
          const bulkEditMultiSelectFieldOption = editedFieldValue.multiSelectFieldOption ?
            editedFieldValue.multiSelectFieldOption : 'ADD';
          const labels: JiraLabelsInput[] = bulkEditMultiSelectFieldOption === 'REMOVE_ALL' ?
            [] : rawLabels.map(label => ({ name: label }));
          const jiraLabelsField: JiraLabelsField = {
            fieldId: field.id,
            bulkEditMultiSelectFieldOption: bulkEditMultiSelectFieldOption,
            labels: labels
          }
          editedFieldsInputBuilder.addLabelsField(jiraLabelsField);
          break;
        case 'com.atlassian.jira.plugin.system.customfieldtypes:textfield':
        case 'text':
          const jiraTextField: JiraSingleLineTextField = {
            fieldId: field.id,
            text: editedFieldValue.value
          }
          editedFieldsInputBuilder.addSingleLineTextField(jiraTextField);
          break;
        case 'comment':
          const jiraCommentField: JiraRichTextField = {
            fieldId: field.id,
            richText: {
              adfValue: editedFieldValue.value
            }
          }
          editedFieldsInputBuilder.addRichTextField(jiraCommentField);
          break;
        case 'fixVersions':
          const jiraSingleVersionPickerField: JiraSingleVersionPickerField = {
            fieldId: field.id,
            version: {
              versionId: editedFieldValue.value as string
            }
          }
          editedFieldsInputBuilder.addSingleVersionPickerField(jiraSingleVersionPickerField);
          break;
        case 'components':
          // As per https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-bulk-operations/#api-rest-api-3-bulk-issues-fields-post,
          // the shape of the payload is as follows:
          /*
                "multiselectComponents": {
                  "bulkEditMultiSelectFieldOption": "ADD",
                  "components": [
                    {
                      "componentId": 2154
                    }
                  ],
                  "fieldId": "<string>"
                },
          */
          const componentIds = editedFieldValue.value as string[];
          const componentIdObjects = componentIds.map(id => ({ componentId: parseInt(id, 10) }));
          const jiraMultiSelectComponentField: JiraMultiSelectComponentField = {
            fieldId: field.id,
            bulkEditMultiSelectFieldOption: editedFieldValue.multiSelectFieldOption,
            components: componentIdObjects
          }
          // console.log(`   - Built jiraMultiSelectComponentField: ${JSON.stringify(jiraMultiSelectComponentField)} from editedFieldValue ${JSON.stringify(editedFieldValue)}.`);
          editedFieldsInputBuilder.setMultiselectComponents(jiraMultiSelectComponentField);
          break;
        case 'duedate':
          const jiraDueDateField: JiraDateField = {
            fieldId: field.id,
            date: {
              formattedDate: editedFieldValue.value as string
            }
          }
          editedFieldsInputBuilder.addDatePickerField(jiraDueDateField);
          break;
        case 'com.atlassian.jira.plugin.system.customfieldtypes:datetime':
          const parsedDateTime = new Date(editedFieldValue.value as string);
          const formattedDateTime = dateToJiraEditFormat(parsedDateTime);
          const jiraDateTimeField: JiraDateTimeField = {
            fieldId: field.id,
            dateTime: {
              formattedDateTime: formattedDateTime
            }
          }
          editedFieldsInputBuilder.addDateTimePickerField(jiraDateTimeField);
          break;
        case 'com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect':
          const cascadingSelectValue = editedFieldValue.value as CascadingSelectValue;
          const cascadingSelectField: JiraCascadingSelectField = {
            fieldId: field.id,
            parentOptionValue: {
              optionId: cascadingSelectValue.id
            },
            childOptionValue: {
              optionId: cascadingSelectValue.child.id
            },
          }
          editedFieldsInputBuilder.addCascadingSelectField(cascadingSelectField);
        default:
          console.warn(` * Unsupported field type: "${field.type}" (field ID ${field.id}). Skipping.`);
          return;
      }
    }
    editedFieldsModel.iterateFieldsSelectedForChange(callback);
    const issues: Issue[] = editedFieldsModel.getCurrentIssues();
    return new BulkIssueEditRequestDataBuilder()
      .setEditedFieldsInput(editedFieldsInputBuilder.build())
      .setSelectedActions(selectedActions)
      .addSelectedIssues(issues)
      .setSendBulkNotification(sendBulkNotification)
      .build();
  }

}

export default new IssueEditController();
