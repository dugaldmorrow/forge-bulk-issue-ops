import React, { useEffect, useState, useRef } from 'react';
import Toggle from '@atlaskit/toggle';
import { CustomFieldOption } from "../types/CustomFieldOption";
import { IssueTypeFieldMappings, ProjectFieldMappings } from "../types/ProjectFieldMappings";
import { Issue } from "../types/Issue";
import { IssueType } from '../types/IssueType';
import { Field } from 'src/types/Field';
import jiraDataModel from 'src/model/jiraDataModel';
import FieldValuesSelect from 'src/widget/FieldValuesSelect';
import targetProjectFieldsModel from 'src/controller/TargetProjectFieldsModel';
import { FieldMetadata } from 'src/types/FieldMetadata';
import { Project } from 'src/types/Project';
import Textfield from '@atlaskit/textfield';
import { DefaultFieldValue } from 'src/types/DefaultFieldValue';
import { FieldMappingInfo } from 'src/types/FieldMappingInfo';
import { BulkOperationMode } from 'src/types/BulkOperationMode';
import bulkIssueTypeMappingModel from 'src/model/bulkIssueTypeMappingModel';
import { ObjectMapping } from 'src/types/ObjectMapping';
import { mapToObjectMap } from 'src/model/util';
import { formatIssueType } from 'src/controller/formatters';
import { PanelMessage, renderPanelMessage } from 'src/widget/PanelMessage';
import { textToAdf } from 'src/controller/textToAdf';
import { bulkMoveShowRetainOption } from 'src/model/config';
import { CompletionState } from 'src/types/CompletionState';
import { subtaskMoveStrategy } from 'src/extension/bulkOperationStaticRules';
import { expandIssueArrayToIncludeSubtasks } from 'src/model/issueSelectionUtil';

const showDebug = false;
const showUnsupportedFields = false;

export type FieldMappingsState = {
  dataRetrieved: boolean;
  project: undefined | Project;
  projectFieldMappings: ProjectFieldMappings;
}
export const nilFieldMappingsState: FieldMappingsState = {
  dataRetrieved: false,
  project: undefined,
  projectFieldMappings: {
    targetIssueTypeIdsToMappings: new Map<string, IssueTypeFieldMappings>()
  }
}

export type FieldMappingPanelProps = {
  bulkOperationMode: BulkOperationMode;
  issueTypeMappingStepCompletionState: CompletionState,
  allIssueTypes: IssueType[];
  issues: Issue[];
  fieldMappingsState: FieldMappingsState;
  targetProject: Project;
  showDebug?: boolean;
  onAllDefaultValuesProvided: (allDefaultsProvided: boolean) => Promise<void>;
}

type FieldValueProviderRenderer = (fieldId: string, targetIssueType: IssueType, fieldMappingInfo: FieldMappingInfo) => JSX.Element;

const FieldMappingPanel = (props: FieldMappingPanelProps) => {

  const determineTargetIssueTypeIdsToTargetIssueTypesBeingMapped = async (
    issues: Issue[],
    allIssueTypes: IssueType[]
  ): Promise<Map<string, IssueType>> => {
    const targetIssueTypeIdsToTargetIssueTypes = new Map<string, IssueType>();
    const expandedIssues = subtaskMoveStrategy === 'move-subtasks-explicitly-with-parents' ?
      await expandIssueArrayToIncludeSubtasks(issues) : issues;
    expandedIssues.forEach(issue => {
      const sourceProjectId = issue.fields.project.id;
      const sourceIssueTypeId = issue.fields.issuetype.id;
      const targetIssuetypeId = bulkIssueTypeMappingModel.getTargetIssueTypeId(sourceProjectId, sourceIssueTypeId);
      const targetIssueType = allIssueTypes.find(issueType => issueType.id === targetIssuetypeId);
      // console.log(` * FieldMappingPanel: ${sourceProjectId},${sourceIssueTypeId} maps to ${targetIssuetypeId}`);
      if (targetIssueType === undefined) {
        // console.warn(`FieldMappingPanel.determineTargetIssueTypeIdsToTargetIssueTypesBeingMapped: No target issue type found for source project ${sourceProjectId} and source issue type ${sourceIssueTypeId}`);
      } else {
        targetIssueTypeIdsToTargetIssueTypes.set(targetIssuetypeId, targetIssueType);
      }
    });
    return targetIssueTypeIdsToTargetIssueTypes;
  }

  const [targetIssueTypeIdsToTargetIssueTypesBeingMapped, setTargetIssueTypeIdsToTargetIssueTypesBeingMapped] =
    useState<Map<string, IssueType>>(new Map<string, IssueType>());
  const [fieldIdsToFields, setFieldIdsToFields] = useState< Map<string, Field>>(new Map<string, Field>());
  const [allDefaultsProvided, setAllDefaultsProvided] = useState<boolean>(false);
  const lastNotfiedAllDefaultsProvidedValueRef = useRef<boolean>(false);

  useEffect(() => {
    onMount();
  }, []);

  useEffect(() => {
    refreshFromIssues();
  }, [props.issues, props.allIssueTypes, props.targetProject, props.issueTypeMappingStepCompletionState]);

  useEffect(() => {
    loadFieldInfo();
  }, [props.fieldMappingsState]);

  const onMount = async (): Promise<void> => {
    loadFieldInfo();
    await refreshTargetIssueTypeIdsToTargetIssueTypesBeingMapped();
  }

  const refreshTargetIssueTypeIdsToTargetIssueTypesBeingMapped = async (): Promise<void> => {
    const targetIssueTypeIdsToTargetIssueTypesBeingMapped = await determineTargetIssueTypeIdsToTargetIssueTypesBeingMapped(
      props.issues, props.allIssueTypes);
    setTargetIssueTypeIdsToTargetIssueTypesBeingMapped(targetIssueTypeIdsToTargetIssueTypesBeingMapped);
    // console.log(`FieldMappingPanel.refreshTargetIssueTypeIdsToTargetIssueTypesBeingMapped: targetIssueTypeIdsToTargetIssueTypesBeingMapped = ${JSON.stringify(Array.from(targetIssueTypeIdsToTargetIssueTypesBeingMapped.entries()), null, 2)}`);
  }

  const loadFieldInfo = async (): Promise<void> => {
    const allFields = await jiraDataModel.getAllFields();
    const fieldIdsToFields = new Map<string, Field>();
    allFields.forEach(field => {
      fieldIdsToFields.set(field.id, field);
    });
    setFieldIdsToFields(fieldIdsToFields);

    // 
    await refreshFromIssues();
  }

  const refreshFromIssues = async (): Promise<void> => {
    await refreshTargetIssueTypeIdsToTargetIssueTypesBeingMapped();
    const allDefaultValuesProvided = targetProjectFieldsModel.areAllFieldValuesSet();
    if (allDefaultValuesProvided === lastNotfiedAllDefaultsProvidedValueRef.current) {
      // console.log(`FieldMappingPanel.refreshFromIssues: No change in all default values provided state, skipping notification.`);
    } else {
      if (allDefaultValuesProvided) {
        // console.log(`FieldMappingPanel.refreshFromIssues: All default values are provided, notifying parent.`);
        setTimeout(async () => {
          // Send the notification to the parent after a short delay and different thread, otherwise it seems it leads to 
          // an infinite re-rendering loop.
          lastNotfiedAllDefaultsProvidedValueRef.current = allDefaultValuesProvided;
          await props.onAllDefaultValuesProvided(allDefaultValuesProvided);
        }, 1000);    
      }
    }
  }

  const onSelectDefaultFieldValue = async (targetIssueType: IssueType, fieldId: string, fieldMetadata: FieldMetadata, defaultValue: DefaultFieldValue): Promise<void> => {
    // console.log(`FieldMappingPanel.onSelectDefaultFieldValue: targetIssueType = ${targetIssueType.id}, fieldId = ${fieldId}, defaultValue = ${JSON.stringify(defaultValue)}`);
    targetProjectFieldsModel.onSelectDefaultValue(targetIssueType, fieldId, fieldMetadata, defaultValue);
    const allDefaultValuesProvided = targetProjectFieldsModel.areAllFieldValuesSet();
    setAllDefaultsProvided(allDefaultValuesProvided);
    lastNotfiedAllDefaultsProvidedValueRef.current = allDefaultValuesProvided;
    await props.onAllDefaultValuesProvided(allDefaultValuesProvided);
  }

  const onDeselectDefaultFieldValue = async (targetIssueType: IssueType, fieldId: string, fieldMetadata: FieldMetadata): Promise<void> => {
    targetProjectFieldsModel.onDeselectDefaultValue(targetIssueType, fieldId, fieldMetadata);
    const allDefaultValuesProvided = targetProjectFieldsModel.areAllFieldValuesSet();
    setAllDefaultsProvided(allDefaultValuesProvided);
    lastNotfiedAllDefaultsProvidedValueRef.current = allDefaultValuesProvided;
    await props.onAllDefaultValuesProvided(allDefaultValuesProvided);
  }

  const onRetainFieldValueSelection = (targetIssueType: IssueType, fieldId: string, fieldMetadata: FieldMetadata, retainFieldValue: boolean): void => {
    targetProjectFieldsModel.onSelectRetainFieldValue(targetIssueType, fieldId, fieldMetadata, retainFieldValue);
  }

  // KNOWN-8: Only a limited set of field types are supported for default values in bulk move operations.
  const getFieldValueEditRenderer = (fieldMappingInfo: FieldMappingInfo): undefined | FieldValueProviderRenderer => {
    const fieldMetadata: FieldMetadata = fieldMappingInfo.fieldMetadata;
    if (fieldMetadata.schema.type === 'option' || fieldMetadata.schema.type === 'options') {
      return renderFieldValuesSelect;
    } else if (fieldMetadata.schema.type === 'array') {
      return renderArrayFieldValuesSelect;
    } else if (fieldMetadata.schema.type === 'number') {
      return renderNumberFieldEntryWidget;
    } else if (fieldMetadata.schema.type === 'string') {
      return renderStringFieldEntryWidget;
    } else if (showUnsupportedFields) {
      return renderFieldNotSupported;
    } else {
      return undefined;
    }
  }

  const renderArrayFieldValuesSelect = (fieldId: string, targetIssueType: IssueType, fieldMappingInfo: FieldMappingInfo): JSX.Element => {
    const fieldMetadata: FieldMetadata = fieldMappingInfo.fieldMetadata;
    console.log(`renderArrayFieldValuesSelect: fieldMetadata = ${JSON.stringify(fieldMetadata, null, 2)}`);
    const selectedDefaultFieldValue = targetProjectFieldsModel.getSelectedDefaultFieldValue(targetIssueType.id, fieldId);
    console.log(`renderArrayFieldValuesSelect: selectedDefaultFieldValue = ${JSON.stringify(selectedDefaultFieldValue)}`);
    const selectableCustomFieldOptions: CustomFieldOption[] = [];
    let selectedCustomFieldOption: CustomFieldOption | undefined = undefined;
    if (fieldMetadata.allowedValues && fieldMetadata.allowedValues.length) {
      for (const allowedValue of fieldMetadata.allowedValues) {
        if (allowedValue.name) {
          const customFieldOption: CustomFieldOption = {
            id: allowedValue.id,
            name: allowedValue.name,
          };
          selectableCustomFieldOptions.push(customFieldOption);
          // console.log(`renderArrayFieldValuesSelect: allowedValue = ${JSON.stringify(allowedValue)}`);
          if (selectedDefaultFieldValue && selectedDefaultFieldValue.value.length && allowedValue.name && allowedValue.id === selectedDefaultFieldValue.value[0]) {
            selectedCustomFieldOption = customFieldOption;
          }
        } else {
          // console.log(`renderArrayFieldValuesSelect: Skipping allowed value without a value: ${JSON.stringify(allowedValue)}`);
        }
      }
    }
    return (
      <FieldValuesSelect
        label={undefined}
        selectableCustomFieldOptions={selectableCustomFieldOptions}
        selectedCustomFieldOption={selectedCustomFieldOption}
        menuPortalTarget={document.body}
        onSelect={async (selectedCustomFieldOption: CustomFieldOption): Promise<void> => {
          const defaultValue: DefaultFieldValue = {
            retain: false,
            type: "raw",
            value: [selectedCustomFieldOption.id]
          };
          await onSelectDefaultFieldValue(targetIssueType, fieldId, fieldMetadata, defaultValue);
        }}
      />
    );
  }

  const renderFieldValuesSelect = (fieldId: string, targetIssueType: IssueType, fieldMappingInfo: FieldMappingInfo): JSX.Element => {
    const fieldMetadata: FieldMetadata = fieldMappingInfo.fieldMetadata;
    const selectedDefaultFieldValue = targetProjectFieldsModel.getSelectedDefaultFieldValue(targetIssueType.id, fieldId);
    // console.log(`renderFieldValuesSelect: selectedDefaultFieldValue = ${JSON.stringify(selectedDefaultFieldValue)}`);
    const selectableCustomFieldOptions: CustomFieldOption[] = [];
    let selectedCustomFieldOption: CustomFieldOption | undefined = undefined;
    for (const allowedValue of fieldMetadata.allowedValues) {
      if (allowedValue.value) {
        const customFieldOption: CustomFieldOption = {
          id: allowedValue.id,
          name: allowedValue.value,
        };
        selectableCustomFieldOptions.push(customFieldOption);
        // console.log(`renderFieldValuesSelect: allowedValue = ${JSON.stringify(allowedValue)}`);
        if (selectedDefaultFieldValue && selectedDefaultFieldValue.value.length && allowedValue.value && allowedValue.id === selectedDefaultFieldValue.value[0]) {
          selectedCustomFieldOption = customFieldOption;
        }
      } else {
        // console.log(`renderFieldValuesSelect: Skipping allowed value without a value: ${JSON.stringify(allowedValue)}`);
      }
    }
    return (
      <FieldValuesSelect
        label={undefined}
        selectableCustomFieldOptions={selectableCustomFieldOptions}
        selectedCustomFieldOption={selectedCustomFieldOption}
        menuPortalTarget={document.body}
        onSelect={async (selectedCustomFieldOption: CustomFieldOption): Promise<void> => {
          const defaultValue: DefaultFieldValue = {
            retain: false,
            type: "raw",
            value: [selectedCustomFieldOption.id]
          };
          await onSelectDefaultFieldValue(targetIssueType, fieldId, fieldMetadata, defaultValue);
        }}
      />
    );
  }

  const renderNumberFieldEntryWidget = (fieldId: string, targetIssueType: IssueType, fieldMappingInfo: FieldMappingInfo): JSX.Element => {
    const fieldMetadata: FieldMetadata = fieldMappingInfo.fieldMetadata;
    const selectedDefaultFieldValue = targetProjectFieldsModel.getSelectedDefaultFieldValue(targetIssueType.id, fieldId);
    // console.log(`renderNumberFieldEntryWidget: selectedDefaultFieldValue = ${JSON.stringify(selectedDefaultFieldValue)}`);
    return (
      <Textfield
        id={`number--for-${fieldId}`}
        name={fieldId}
        defaultValue={selectedDefaultFieldValue && selectedDefaultFieldValue.value.length > 0 ? selectedDefaultFieldValue.value[0] : ''}
        type="number"
        onChange={async (event): Promise<void> => {
          let fieldValue: number | undefined = undefined;
          try {
            fieldValue = parseInt(event.currentTarget.value.trim());
          } catch (error) {
            console.error(`Error parsing number field value for field ID ${fieldId}:`, error);
          }
          if (fieldValue === undefined || isNaN(fieldValue)) {
            console.warn(`Invalid number field value for field ID ${fieldId}:`, event.currentTarget.value);
            await onDeselectDefaultFieldValue(targetIssueType, fieldId, fieldMetadata);
            return;
          } else {
            // console.log(`Setting default value for field ID ${fieldId} to ${fieldValue}`);
            const defaultValue: DefaultFieldValue = {
              retain: false,
              type: "raw",
              value: [fieldValue]
            };
            await onSelectDefaultFieldValue(targetIssueType, fieldId, fieldMetadata, defaultValue);
          }
        }}
      />
    );
  }

  const renderStringFieldEntryWidget = (fieldId: string, targetIssueType: IssueType, fieldMappingInfo: FieldMappingInfo): JSX.Element => {
    const fieldMetadata: FieldMetadata = fieldMappingInfo.fieldMetadata;
    // console.log(`renderNumberFieldEntryWidget: selectedDefaultFieldValue = ${JSON.stringify(selectedDefaultFieldValue)}`);
    return (
      <Textfield
        id={`string--for-${fieldId}`}
        name={fieldId}
        type="text"
        onChange={async (event): Promise<void> => {
          const enteredText = event.currentTarget.value;
          // KNOWN-6: Rich text fields in bulk move operations only supports plain text where each new line is represented as a new paragraph.
          const adf = textToAdf(enteredText);
          // console.log(`Setting default value for field ID ${fieldId} to ${JSON.stringify(adf, null, 2)}`);
          const defaultValue: DefaultFieldValue = {
            retain: false,
            type: "adf",
            value: adf as any
          };
          await onSelectDefaultFieldValue(targetIssueType, fieldId, fieldMetadata, defaultValue);
        }}
      />
    );
  }

  const renderFieldNotSupported = (fieldId: string, targetIssueType: IssueType, fieldMappingInfo: FieldMappingInfo): JSX.Element => {
    const fieldMetadata: FieldMetadata = fieldMappingInfo.fieldMetadata;
    return (
      <div>
        <p className="inline-error-message">Unexpected field type: {fieldMetadata.schema.type}.</p>
        <pre style={{width: '300px'}}>{JSON.stringify(fieldMetadata, null, 2)}</pre>
      </div>
    );
  }

  const renderFieldValuesEntryWidget = (fieldId: string, targetIssueType: IssueType, fieldMappingInfo: FieldMappingInfo): JSX.Element => {
    const renderer = getFieldValueEditRenderer(fieldMappingInfo);
    return renderer ? renderer(fieldId, targetIssueType, fieldMappingInfo) : null;
  }

  const renderRetainFieldValueWidget = (
    fieldId: string,
    targetIssueType: IssueType,
    fieldMappingInfo: FieldMappingInfo
  ): JSX.Element => {
    const fieldMetadata: FieldMetadata = fieldMappingInfo.fieldMetadata;
    const isChecked = targetProjectFieldsModel.getRetainFieldValue(targetIssueType.id, fieldId);
    return (
      <Toggle
        id={`toggle-filter-mode-advanced`}
        defaultChecked={isChecked}
        onChange={(event: any) => {
          onRetainFieldValueSelection(targetIssueType, fieldId, fieldMetadata, event.currentTarget.checked);
        }}
      />
    )
  }

  const renderFieldClearingWarningMessage = () => {
    return (
      <div style={{marginBottom: '10px'}}>
        <PanelMessage
          className="info-banner"
          message={`Note: Moving work items will result in fields being cleared where current values do not match destination field options.`}
        />
      </div>
    );
  }

  const renderFieldMappingsState = () => {
    const renderedRows: JSX.Element[] = [];
    // console.log(`FieldMappingPanel.renderFieldMappingsState: props.fieldMappingsState = ${JSON.stringify(props.fieldMappingsState, null, 2)}`);
    const entries = Array.from(props.fieldMappingsState.projectFieldMappings.targetIssueTypeIdsToMappings.entries());
    entries.forEach(([targetIssueTypeId, fieldOptionMappings]) => {
      // console.log(`FieldMappingPanel.renderFieldMappingsState:  * targetIssueTypeId = ${targetIssueTypeId}`);
      const targetIssueType = targetIssueTypeIdsToTargetIssueTypesBeingMapped.get(targetIssueTypeId);
      if (targetIssueType) {
        return Array.from(fieldOptionMappings.fieldIdsToFieldMappingInfos.entries()).map(([fieldId, fieldMappingInfo]) => {
          const renderer = getFieldValueEditRenderer(fieldMappingInfo);
          if (renderer) {
            const renderedRow = (
              <tr key={`mapping-${targetIssueTypeId}-${fieldId}`}>
                <td>{formatIssueType(targetIssueType)}</td>
                <td>{fieldIdsToFields.get(fieldId)?.name || fieldId}</td>
                <td style={{width: 'min-content'}} colSpan={2}>
                  {renderFieldValuesEntryWidget(fieldId, targetIssueType, fieldMappingInfo)}
                </td>
                <td>
                  {bulkMoveShowRetainOption ? renderRetainFieldValueWidget(fieldId, targetIssueType, fieldMappingInfo) : null}
                </td>
              </tr>
            );
            renderedRows.push(renderedRow);
          }
        });
      } else {
        // console.warn(`FieldMappingPanel.renderFieldMappingsState: No target issue type found for ID: ${targetIssueTypeId}`);
      }
    });
    const renderedTable = (
      <div className="data-table-container">
        <table className="field-mapping-table data-table">
          <thead>
            <tr>
              <th className="no-break">Type</th>
              <th className="no-break">Field</th>
              <th className="no-break">Value</th>
              <th className="no-break">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</th>
              {bulkMoveShowRetainOption ? <th className="no-break">Retain</th> : null}
            </tr>
          </thead>
          <tbody>
            {renderedRows}
          </tbody>
        </table>
      </div>
    );
    if (renderedRows.length > 0) {
      return (
        <div>
          {renderFieldClearingWarningMessage()}
          {renderedTable}
        </div>
      );
    } else {
      return renderPanelMessage(`There are no fields that need default values to be set.`);      
    }
  }

  const renderDebug = () => {
    const targetIssueTypeIdsToFieldIdsToFieldSettings = targetProjectFieldsModel.getTargetIssueTypeIdsToFieldIdsToFieldSettings();
    const targetIssueTypeIdsToFieldIdsToFieldSettingsObject: any = mapToObjectMap(targetIssueTypeIdsToFieldIdsToFieldSettings);
    const targetIssueTypeIds = Object.keys(targetIssueTypeIdsToFieldIdsToFieldSettingsObject);
    for (const targetIssueTypeId of targetIssueTypeIds) {
      const fieldIdsToFieldSettings = targetIssueTypeIdsToFieldIdsToFieldSettings.get(targetIssueTypeId);
      if (fieldIdsToFieldSettings) {
        const fieldIdsToFieldSettingsObject: ObjectMapping<any> =
          mapToObjectMap<any>(fieldIdsToFieldSettings);
        targetIssueTypeIdsToFieldIdsToFieldSettingsObject[targetIssueTypeId] = fieldIdsToFieldSettingsObject;
      } else {
        console.warn(`No field settings found for target issue type ID: ${targetIssueTypeId}`);
      }
    }

    const clonedFieldMappingsState = JSON.parse(JSON.stringify(props.fieldMappingsState));
    const targetIssueTypeIdsToMappings = props.fieldMappingsState.projectFieldMappings.targetIssueTypeIdsToMappings;
    // Replace the Map with and object so JSON.stringify includes it...
    if (targetIssueTypeIdsToMappings) {
      const targetIssueTypeIdsToMappingsObject: ObjectMapping<IssueTypeFieldMappings> =
        mapToObjectMap<IssueTypeFieldMappings>(targetIssueTypeIdsToMappings);
      const targetIssueTypeIds = Object.keys(targetIssueTypeIdsToMappingsObject);
      for (const targetIssueTypeId of targetIssueTypeIds) {
        const issueTypeFieldMappings: IssueTypeFieldMappings | undefined =
          targetIssueTypeIdsToMappings.get(targetIssueTypeId);
        if (issueTypeFieldMappings) {
          const fieldIdsToFieldMappingInfos: Map<string, FieldMappingInfo> = issueTypeFieldMappings.fieldIdsToFieldMappingInfos;
          const fieldIdsToFieldMappingInfosObject: ObjectMapping<FieldMappingInfo> = mapToObjectMap<FieldMappingInfo>(fieldIdsToFieldMappingInfos);
          targetIssueTypeIdsToMappings[targetIssueTypeId] = fieldIdsToFieldMappingInfosObject;
        }
      }
      // clonedFieldMappingsState.projectFieldMappings.targetIssueTypeIdsToMappings = targetIssueTypeIdsToMappingsObject;
    } else {
      clonedFieldMappingsState.projectFieldMappings.targetIssueTypeIdsToMappings = '????';
    }

    return (
      <div>
        <h3>Debug Information</h3>
        <p>All Defaults Provided: {allDefaultsProvided ? 'Yes' : 'No'}</p>
        <p>targetIssueTypeIdsToFieldIdsToFieldSettings:</p>
        <pre>{JSON.stringify(targetIssueTypeIdsToFieldIdsToFieldSettingsObject, null, 2)}</pre>
        {/* <p>fieldMappingsState:</p>
        <pre>{JSON.stringify(clonedFieldMappingsState, null, 2)}</pre> */}
      </div>
    );
  }

  return (
    <div style={{margin: '20px 0px'}}>
      {props.fieldMappingsState.dataRetrieved ? renderFieldMappingsState() : null}
      <div>
        {showDebug || props.showDebug ? renderDebug() : null}
      </div>
    </div>
  )

}
export default FieldMappingPanel;
