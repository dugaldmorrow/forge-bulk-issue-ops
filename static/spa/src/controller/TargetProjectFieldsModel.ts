import { Issue } from "../types/Issue";
import { IssueType } from "../types/IssueType";
import { ProjectFieldMappings } from "../types/ProjectFieldMappings";
import { TargetMandatoryFields, FieldValue } from "../types/TargetMandatoryField";
import { FieldMetadata } from "src/types/FieldMetadata";
import { DefaultFieldValue } from "src/types/DefaultFieldValue";
import bulkIssueTypeMappingModel from "src/model/bulkIssueTypeMappingModel";
import { subtaskMoveStrategy } from "src/extension/bulkOperationStaticRules";
import { expandIssueArrayToIncludeSubtasks } from "src/model/issueSelectionUtil";

type FieldSettings = {
  defaultFieldValue?: DefaultFieldValue;
  retainFieldValue: boolean;
}

const defaultRetainValueSetting = true;

class TargetProjectFieldsModel {

  private projectFieldMappings: undefined | ProjectFieldMappings = undefined;
  private targetIssueTypeIdsToFieldIdsToFieldSettings = new Map<string, Map<string, FieldSettings>>();
  private selectedTargetIssueTypeIdsToTypes = new Map<string, IssueType>();
  private selectedIssueTypes: IssueType[] = [];

  clearDefaultFieldValues = (): void => {
    this.targetIssueTypeIdsToFieldIdsToFieldSettings.forEach((fieldIdsToFieldSettings: Map<string, FieldSettings>, targetIssueTypeId: string) => {
      fieldIdsToFieldSettings.forEach((fieldSettings: FieldSettings, fieldId: string) => {
        fieldSettings.defaultFieldValue = undefined; // Clear the default field value
      });
    });
  }

  getTargetIssueTypeIdsToFieldIdsToFieldSettings = (): Map<string, Map<string, FieldSettings>> => {
    return this.targetIssueTypeIdsToFieldIdsToFieldSettings;
  }

  setSelectedIssues = async (issues: Issue[], allIssueTypes: IssueType[]): Promise<void> => {
    // console.log(`TargetProjectFieldsModel.setSelectedIssues: Setting selected issue types from selected issues (allIssueTypes.length = ${allIssueTypes.length})...`);
    this.selectedTargetIssueTypeIdsToTypes.clear();
    const expandedIssues = subtaskMoveStrategy === 'move-subtasks-explicitly-with-parents' ?
      await expandIssueArrayToIncludeSubtasks(issues) : issues;
    expandedIssues.forEach(issue => {
      const sourceProjectId = issue.fields.project.id;
      const sourceIssueTypeId = issue.fields.issuetype.id;
      const targetIssueTypeId = bulkIssueTypeMappingModel.getTargetIssueTypeId(sourceProjectId, sourceIssueTypeId);
      this.selectedTargetIssueTypeIdsToTypes.set(targetIssueTypeId, issue.fields.issuetype);
      const targetIssueType = allIssueTypes.find(issueType => issueType.id === targetIssueTypeId);
      if (targetIssueType) {
        // console.log(`TargetProjectFieldsModel.setSelectedIssues: Adding target issue type ${targetIssueType.name} (${targetIssueType.id}) for source project ${sourceProjectId} and source issue type ${sourceIssueTypeId}`);
        // Ensure the target issue type is in the selected issue types
        this.selectedTargetIssueTypeIdsToTypes.set(targetIssueTypeId, targetIssueType);
      } else {
        // console.warn(`TargetProjectFieldsModel.setSelectedIssues: No target issue type found for source project ${sourceProjectId} and source issue type ${sourceIssueTypeId}`);
      }
    });

    const newlySelectedIssueTypes = Array.from(this.selectedTargetIssueTypeIdsToTypes.values());

    // if (newlySelectedIssueTypes.length === 0 && this.selectedIssueTypes.length > 0) {
    //   throw new Error("Bad request: no issue types selected. Please select at least one issue type.");
    // }

    this.selectedIssueTypes = newlySelectedIssueTypes;
    // console.log(`TargetProjectFieldsModel.setSelectedIssues: selectedIssueTypes: ${this.selectedIssueTypes.map(issue => `${issue.name} (${issue.id})`).join(', ')}`);
  }

  setProjectFieldMappings = (projectFieldMappings: ProjectFieldMappings): void => {
    this.projectFieldMappings = projectFieldMappings;
  }

  getFieldSettings = (targetIssueTypeId: string, fieldId: string): FieldSettings | undefined => {
    const fieldIdsToDefaultFieldSettings = this.targetIssueTypeIdsToFieldIdsToFieldSettings.get(targetIssueTypeId);
    return fieldIdsToDefaultFieldSettings?.get(fieldId);
  }

  getSelectedDefaultFieldValue = (targetIssueTypeId: string, fieldId: string): DefaultFieldValue | undefined => {
    const fieldSettings = this.getFieldSettings(targetIssueTypeId, fieldId);
    return fieldSettings?.defaultFieldValue;
  }

  getRetainFieldValue = (targetIssueTypeId: string, fieldId: string): boolean => {
    const fieldSettings = this.getFieldSettings(targetIssueTypeId, fieldId);
    return fieldSettings ? fieldSettings.retainFieldValue : defaultRetainValueSetting;
  }

  isIssueTypeSelected = (targetIssueTypeId: string): boolean => {
    return this.selectedTargetIssueTypeIdsToTypes.has(targetIssueTypeId);
  }

  areAllFieldValuesSet = (): boolean => {
    const fieldMappingIncompletenessReason = this.getFieldMappingIncompletenessReason();
    if (fieldMappingIncompletenessReason) {
      // console.log(`TargetProjectFieldsModel.areAllFieldValuesSet: Field mapping incompleteness reason: ${fieldMappingIncompletenessReason}`);
      return false;
    } else {
      return true;
    }
  }

  getFieldMappingIncompletenessReason = (): string => {
    if (!this.projectFieldMappings) {
      // console.log(`TargetProjectFieldsModel.areAllFieldValuesSet: projectFieldMappings is not set.`);
      return `projectFieldMappings is not set`;
    }
    if (this.selectedIssueTypes.length === 0) {
      // console.log(`TargetProjectFieldsModel.areAllFieldValuesSet: no issue types are selected.`);
      return `no issue types are selected`;
    }
    for (const selectedIssueType of this.selectedIssueTypes) {
      const issueTypeFieldMappings = this.projectFieldMappings.targetIssueTypeIdsToMappings.get(selectedIssueType.id);
      if (issueTypeFieldMappings) {
        const fieldIds = Array.from(issueTypeFieldMappings.fieldIdsToFieldMappingInfos.keys());
        for (const fieldId of fieldIds) {
          const defaultValue = this.getSelectedDefaultFieldValue(selectedIssueType.id, fieldId);
          if (!defaultValue) {
            // console.log(`TargetProjectFieldsModel.areAllFieldValuesSet: no default value found for issue type ${selectedIssueType.id} and field ${fieldId}.`);
            // return `no default value found for work item type ${selectedIssueType.id} and field ${fieldId}.`;




            const fieldMappingInfo = this.projectFieldMappings.targetIssueTypeIdsToMappings.get(selectedIssueType.id)?.fieldIdsToFieldMappingInfos.get(fieldId);
            if (fieldMappingInfo && fieldMappingInfo.fieldMetadata.required) {
              return `no default value found for work item type ${selectedIssueType.id} and mandatory field ${fieldId}: ${JSON.stringify(fieldMappingInfo)}`; 
            }



          }
        }
      } else {
        // console.log(`TargetProjectFieldsModel.areAllFieldValuesSet: no field mappings found for issue type ${selectedIssueType.id}. Maybe the issue type is not yest mapped in the previous step.`);
        // return `no field mappings found for issue type ${selectedIssueType.id}. Maybe the issue type is not yet mapped in the previous step.`;
      }
    }
    // console.log(`TargetProjectFieldsModel.areAllFieldValuesSet: all field values are set.`);
    return '';
  }

  onSelectDefaultValue = (targetIssueType: IssueType, fieldId: string, fieldMetadata: FieldMetadata, defaultValue: DefaultFieldValue): void => {
    let fieldIdsToDefaultFieldSettings = this.targetIssueTypeIdsToFieldIdsToFieldSettings.get(targetIssueType.id);
    if (!fieldIdsToDefaultFieldSettings) {
      fieldIdsToDefaultFieldSettings = new Map<string, FieldSettings>();
      this.targetIssueTypeIdsToFieldIdsToFieldSettings.set(targetIssueType.id, fieldIdsToDefaultFieldSettings);
    }
    let fieldSettings = fieldIdsToDefaultFieldSettings.get(fieldId);
    if (!fieldSettings) {
      fieldSettings = {
        retainFieldValue: defaultRetainValueSetting,
      };
      fieldIdsToDefaultFieldSettings.set(fieldId, fieldSettings);
    }
    fieldSettings.defaultFieldValue = defaultValue;
  }

  onDeselectDefaultValue = (targetIssueType: IssueType, fieldId: string, fieldMetadata: FieldMetadata): void => {
    let fieldIdsToDefaultFieldSettings = this.targetIssueTypeIdsToFieldIdsToFieldSettings.get(targetIssueType.id);
    if (fieldIdsToDefaultFieldSettings) {
      fieldIdsToDefaultFieldSettings.delete(fieldId);
    }

    if (!fieldIdsToDefaultFieldSettings) {
      fieldIdsToDefaultFieldSettings = new Map<string, FieldSettings>();
      this.targetIssueTypeIdsToFieldIdsToFieldSettings.set(targetIssueType.id, fieldIdsToDefaultFieldSettings);
    }
    let fieldSettings = fieldIdsToDefaultFieldSettings.get(fieldId);
    if (fieldSettings) {
      fieldSettings.defaultFieldValue = undefined;
      fieldIdsToDefaultFieldSettings.delete(fieldId);
    }
  }

  onSelectRetainFieldValue = (targetIssueType: IssueType, fieldId: string, fieldMetadata: FieldMetadata, retainFieldValue: boolean): void => {
    let fieldIdsToDefaultFieldSettings = this.targetIssueTypeIdsToFieldIdsToFieldSettings.get(targetIssueType.id);
    if (!fieldIdsToDefaultFieldSettings) {
      fieldIdsToDefaultFieldSettings = new Map<string, FieldSettings>();
      this.targetIssueTypeIdsToFieldIdsToFieldSettings.set(targetIssueType.id, fieldIdsToDefaultFieldSettings);
    }
    let fieldSettings = fieldIdsToDefaultFieldSettings.get(fieldId);
    if (!fieldSettings) {
      fieldSettings = {
        retainFieldValue: defaultRetainValueSetting,
      };
      fieldIdsToDefaultFieldSettings.set(fieldId, fieldSettings);
    }
    fieldSettings.retainFieldValue = retainFieldValue;
  }

  buildIssueTypeIdsToTargetMandatoryFields = (): Map<string, TargetMandatoryFields> => {
    if (!this.areAllFieldValuesSet()) {
      throw new Error("Bad request: not all default field options have been provided.");
    }
    if (!this.projectFieldMappings) {
      throw new Error("Bad request: projectFieldMappings has not been set.");
    }
    const targetIssueTypeIdsToTargetMandatoryFields = new Map<string, TargetMandatoryFields>();
    this.projectFieldMappings.targetIssueTypeIdsToMappings.forEach((targetIssueTypeFieldMappings, targetIssueTypeId) => {
      const fields: { [key: string]: FieldValue } = {};
      targetIssueTypeFieldMappings.fieldIdsToFieldMappingInfos.forEach((fieldMappingInfo, fieldId) => {
        const retainValue = this.getRetainFieldValue(targetIssueTypeId, fieldId);
        const defaultValue = this.getSelectedDefaultFieldValue(targetIssueTypeId, fieldId);
        if (defaultValue) {
          // Clone to avoid tampering within the original option...
          const clonedDefaultValue: FieldValue = Object.assign({}, defaultValue);
          clonedDefaultValue.retain = retainValue;
          fields[fieldId] = clonedDefaultValue;
        }
      });
      targetIssueTypeIdsToTargetMandatoryFields.set(targetIssueTypeId, { fields });
    });
    return targetIssueTypeIdsToTargetMandatoryFields;
  }

}

export default new TargetProjectFieldsModel();
