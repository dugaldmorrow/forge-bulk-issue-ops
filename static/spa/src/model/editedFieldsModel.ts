import { IssueBulkEditField } from "src/types/IssueBulkEditFieldApiResponse";
import { ObjectMapping } from "src/types/ObjectMapping";
import ListenerGroup from "src/model/ListenerGroup";
import { Issue } from "src/types/Issue";
import jiraDataModel from "./jiraDataModel";
import bulkOperationRuleEnforcer from "src/extension/bulkOperationRuleEnforcer";
import { FieldEditValue } from "src/types/FieldEditValue";
import { OperationOutcome } from "src/types/OperationOutcome";
import jiraUtil from "src/controller/jiraUtil";
import { IssueType } from "src/types/IssueType";
import { uuid } from "./util";
import { IssueSelectionState } from "src/types/IssueSelectionState";
import { newIssueSelectionUuid } from "./issueSelectionUtil";

export type EditedFieldsModelIteratorCallback = (field: IssueBulkEditField, editedFieldValue: FieldEditValue) => void;

export type EditState = 'no-change' | 'change';
export const defaultEditState: EditState = 'no-change';

class EditedFieldsModel {

  private valueEditsListenerGroup = new ListenerGroup('EditedFieldsModel-value-edits');
  private sendBulkNotification: boolean = false;
  private issueSelectionState: IssueSelectionState = {
    uuid: newIssueSelectionUuid(),
    selectedIssues: [],
    selectionValidity: 'invalid-no-issues-selected'
  };
  private fieldIdsToEditStates: ObjectMapping<EditState> = {};
  private fieldIdsToFields: ObjectMapping<IssueBulkEditField> = {};
  private fieldIdsToValues: ObjectMapping<FieldEditValue> = {};

  getCurrentIssues = (): Issue[] => {
    return this.issueSelectionState.selectedIssues;
  }

  getEditedFields = (): ObjectMapping<FieldEditValue> => {
    const editedFields: ObjectMapping<FieldEditValue> = {};
    for (const fieldId in this.fieldIdsToValues) {
      if (this.fieldIdsToValues.hasOwnProperty(fieldId)) {
        const value = this.fieldIdsToValues[fieldId];
        const fieldState = this.fieldIdsToEditStates[fieldId];
        if (fieldState === 'change') {
          // Only include fields that have been marked for change.
          const field = this.fieldIdsToFields[fieldId];
          if (field) {
            editedFields[fieldId] = value;
          }
        }
      }
    }
    return editedFields;
  }

  getEditCount = (): number => {
    const editedFields = this.getEditedFields();
    return Object.keys(editedFields).length;
  }

  getFields = (): IssueBulkEditField[] => {
    return Object.values(this.fieldIdsToFields);
  }

  getFieldIdsToValues = (): ObjectMapping<FieldEditValue> => {
    return this.fieldIdsToValues;
  }

  getSendBulkNotification() {
    return this.sendBulkNotification;
  }

  setFieldEditState(fieldId: string, newState: EditState): void {
    this.fieldIdsToEditStates[fieldId] = newState;
  }

  setSendBulkNotification = (sendBulkNotification: boolean): void => {
    this.sendBulkNotification = sendBulkNotification;
  }

  iterateAllFields = (callback: EditedFieldsModelIteratorCallback): void => {
    this.iterateFields(false, callback);
  }

  iterateFieldsSelectedForChange = (callback: EditedFieldsModelIteratorCallback): void => {
    this.iterateFields(true, callback);
  }

  private iterateFields = (onlyFieldsSelectedForChange: boolean, callback: EditedFieldsModelIteratorCallback): void => {
    for (const fieldId in this.fieldIdsToFields) {
      if (this.fieldIdsToFields.hasOwnProperty(fieldId)) {
        if (!onlyFieldsSelectedForChange || this.fieldIdsToEditStates[fieldId] === 'change') {
          const field = this.fieldIdsToFields[fieldId];
          const value = this.fieldIdsToValues[fieldId];
          callback(field, value);
        }
      }
    }
  }

  getIssueSelectionState = (): IssueSelectionState => {
    return this.issueSelectionState;
  }

  setIssueSelectionState = async (issueSelectionState: IssueSelectionState) => {
    // console.log(`editedFieldsModel.setIssueSelectionState: Loading fields for state '${issueSelectionState.selectionValidity}', issues: ${JSON.stringify(issueSelectionState.selectedIssues.map(issue => issue.key))}...`);
    this.issueSelectionState = issueSelectionState;
    if (issueSelectionState.selectionValidity === 'valid') {
      this.setFields([]);
      const issueTypeMap: Map<string, IssueType> = jiraUtil.getIssueTypesFromIssues(issueSelectionState.selectedIssues);
      const issueTypes = Array.from(issueTypeMap.values());
      // console.log(`editedFieldsModel.setIssueSelectionState: Found ${issueTypes.length} issue types from selected issues;- ${issueTypes.map(it => it.name).join(', ')}`);
      const fields = await jiraDataModel.getAllIssueBulkEditFields(issueSelectionState.selectedIssues);
      // console.log(`editedFieldsModel.setIssueSelectionState: Loaded ${fields.length} fields.`);
      const filteredFields = await bulkOperationRuleEnforcer.filterEditFields(fields, issueTypes);
      const sortedFields = this.sortFields(filteredFields);
      this.setFields(sortedFields);
    } else {
      this.setFields([]);
    }
  }

  setFieldValue = async (field: IssueBulkEditField, value: FieldEditValue): Promise<OperationOutcome> => {
    const otherEditedFieldIdsToValues: ObjectMapping<FieldEditValue> = {
      ...this.fieldIdsToValues,
      [field.id]: value,
    };
    delete otherEditedFieldIdsToValues[field.id];

    // Validate the field value against the field's validation rules.
    const operationOutcome = await bulkOperationRuleEnforcer.validateFieldValue(
      field,
      value,
      this.fieldIdsToFields,
      otherEditedFieldIdsToValues);
    if (!operationOutcome.success) {
      return operationOutcome;
    }

    // Create a new copy of the object since this is designed to be used in a React context
    // where the state should not be mutated directly.
    const newFieldIdsToValues: ObjectMapping<any> = {
      ...this.fieldIdsToValues,
      [field.id]: value,
    };
    if (value === undefined || value === null) {
      // If the value is undefined or null, remove the field from the map.
      delete newFieldIdsToValues[field.id];
    }
    this.fieldIdsToValues = newFieldIdsToValues;

    const keys = Object.keys(this.fieldIdsToValues);
    for (const key of keys) {
      if (this.fieldIdsToValues[key] === undefined || this.fieldIdsToValues[key] === null) {
        throw new Error(`EditedFieldsModel.setFieldChange: Value for field ${key} is undefined or null.`);
      }
    }

    this.notifyValueEditsListeners();
    return operationOutcome;
  }

  haveValuesBeenSpecified = (): boolean => {
    return Object.keys(this.fieldIdsToValues).length > 0;
  }

  registerValueEditsListener = (listener: any) => {
    this.valueEditsListenerGroup.registerListener(listener);
  };

  unregisterValueEditsListener = (listener: any) => {
    this.valueEditsListenerGroup.unregisterListener(listener);
  };

  private notifyValueEditsListeners = () => {
    this.valueEditsListenerGroup.notifyListeners(undefined);
  };

  private setFields = (fields: IssueBulkEditField[]): void => {
    const newFieldIdsToFields: ObjectMapping<IssueBulkEditField> = {};
    for (const field of fields) {
      newFieldIdsToFields[field.id] = field;
    }
    this.fieldIdsToFields = newFieldIdsToFields;
    this.notifyValueEditsListeners();
  }

  private sortFields = (fields: IssueBulkEditField[]) => {
    // Put the required firelds first since they are the most important.
    return fields.sort((a, b) => {
      const requirementComparison = a.isRequired === b.isRequired ? 0 : (a.isRequired ? -1 : 1);
      if (requirementComparison === 0) {
        const idComparison = a.id.localeCompare(b.id);
        const nameComparison = a.name.localeCompare(b.name);
        if (nameComparison === 0) {
          return idComparison;
        } else {
          return nameComparison;
        }
      } else {
        return requirementComparison;
      }
    });
  }

}

export default new EditedFieldsModel();
