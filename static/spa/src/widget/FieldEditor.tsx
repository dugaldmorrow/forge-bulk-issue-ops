import React, { useState } from 'react';
import { 
  CascadingSelectField,
  CommentField,
  DueDateField,
  IssueBulkEditField,
  IssueTypeField,
  LabelsField,
  MultiSelectOption,
  NumberField,
  PriorityField,
  SelectField
} from "../types/IssueBulkEditFieldApiResponse";
import { Option } from '../types/Option'
import Select from '@atlaskit/select';
import TextArea from '@atlaskit/textarea';
import Textfield from '@atlaskit/textfield';
import { DatePicker, DateTimePicker } from '@atlaskit/datetime-picker';
import UsersSelect from './UserSelect';
import { User } from 'src/types/User';
import LabelsSelect from './LabelsSelect';
import FixedOptionsSelect from './FixedOptionsSelect';
import { FieldEditValue, MultiSelectFieldEditOption } from 'src/types/FieldEditValue';
import { adfToText, textToAdf } from 'src/controller/textToAdf';
import { Label } from '@atlaskit/form';
import { OperationOutcome } from 'src/types/OperationOutcome';
import { FlagOptions, showFlag } from '@forge/bridge';
import { uuid } from 'src/model/util';
import { requireFieldEditErrorAcknowledgement } from 'src/model/config';
import { CascadingSelect, CascadingSelectValue } from './CascadingSelect';
import { IssueSelectionState } from '../types/IssueSelectionState';
import { FixVersionEditor, FixVersionEditorValue } from './FixVersionEditor';
import { ComponentsEditor, ComponentsEditorValue } from './ComponentsEditor';
import { EditOptionSelect } from './EditOptionSelect';
import { showLabelsEditField } from 'src/extension/bulkOperationStaticRules';

// KNOWN-5: Note all fields types are supported since each type of field requires custome UI to edit it. To extend
//          support, start by setting the following constant to true since this will render the unsupported field types
//          within the UI for debugging purposes. Then, for each new field type, (a) add a case statement to the renderFieldEditor
//          function, (b) implement the new field edit render function, (c) include the new field type in the isFieldTypeEditingSupported
//          function, and (d) add support for the new field type in issueEditController.ts.
export const renderUnsupportedFieldTypesDebug = false;

export interface FieldEditorProps {
  field: IssueBulkEditField;
  issueSelectionState: IssueSelectionState;
  enabled: boolean;
  maybeEditValue?: FieldEditValue;
  onChange: (value: FieldEditValue) => Promise<OperationOutcome>;
}

export const isFieldTypeEditingSupported = (fieldType: string): boolean => {
  switch (fieldType) {
    case 'issuetype':
    case 'com.atlassian.jira.plugin.system.customfieldtypes:float':
    case 'com.atlassian.jira.plugin.system.customfieldtypes:select':
    case 'reporter':
    case 'assignee':
    case 'priority':
    case 'com.atlassian.jira.plugin.system.customfieldtypes:textfield':
    case 'text':
    case 'comment':
    case 'fixVersions':
    case 'components':
    case 'duedate':
    case 'com.atlassian.jira.plugin.system.customfieldtypes:datetime':
    case 'com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect':
      return true;
    case 'labels':
      // KNOWN-16: The labels field is only supported if the showLabelsEditField constant is set to true.
      return showLabelsEditField;
  }
  return false;
}

export const FieldEditor = (props: FieldEditorProps) => {

  const [operationOutcome, setOperationOutcome] = useState<OperationOutcome>({success: true});

  const { field } = props;

  /**
   * @returns This can be used to render the field information for debugging purposes. It is not used 
   *          in production. To enable this, set the renderUnsupportedFieldTypesDebug constant to true.
   */
  const renderDebugFieldInfo = () => {
    return <pre>{JSON.stringify(field, null, 2)}</pre>;
  }

  const showFieldEditErrorFlag = (errorMessage: string): void => {
    const actions = requireFieldEditErrorAcknowledgement ? [{
        text: 'Acknowledge',
        onClick: async () => {
          flag.close();
        },
      }] : [];
    const flagOptions: FlagOptions = {
      id: uuid(),
      type: 'error',
      title: `Field edit error`,
      description: errorMessage,
      isAutoDismiss: requireFieldEditErrorAcknowledgement,
      actions: actions
    }
    const flag = showFlag(flagOptions);
  }

  const onChange = async (value: FieldEditValue): Promise<OperationOutcome> => {
    console.log(` * Setting "${field.type}" field (ID = ${field.id}) with value: ${JSON.stringify(value)}...`);
    const operationOutcome: OperationOutcome = await props.onChange(value);
    if (!operationOutcome) {
      throw new Error(`No operation outcome returned from onChange for field ${field.name}.`);
    }
    setOperationOutcome(operationOutcome);
    if (!operationOutcome.success) {
      showFieldEditErrorFlag(operationOutcome.errorMessage || `Failed to set field value for field ${field.name}.`);
    }
    return operationOutcome
  }

  const renderIssueTypeFieldEditor = () => {
    const issueTypeField = field as IssueTypeField;
    const options: Option[] = [];
    let selectedOption: Option | undefined = undefined;
    for (const fieldOption of issueTypeField.fieldOptions) {
      const option: Option = {
        value: fieldOption.id,
        label: fieldOption.issueType,
      };
      options.push(option);
      if (props.maybeEditValue?.value === fieldOption.id) {
        selectedOption = option;
      }
    }
    return (
      <Select
        inputId="checkbox-select-example"
        testId="projects-select"
        isMulti={false}
        isRequired={true}
        isInvalid={!operationOutcome.success}
        defaultValue={selectedOption}
        options={options}
        cacheOptions
        isDisabled={!props.enabled}
        menuPortalTarget={document.body}
        onChange={(selectedOption: Option) => {
          const newValue: FieldEditValue = {
            value: selectedOption.value,
          }
          onChange(newValue);
        }}
      />
    );
  }

  const renderPriorityFieldEditor = () => {
    // console.log(`FieldEditor.renderPriorityFieldEditor: maybeEditValue.value = ${props.maybeEditValue?.value}`);
    const priorityField = field as PriorityField;
    const options: Option[] = [];
    let selectedOption: Option | undefined = undefined;
    for (const fieldOption of priorityField.fieldOptions) {
      const option: Option = {
        value: fieldOption.id,
        label: fieldOption.priority,
      };
      options.push(option);
      if (props.maybeEditValue?.value === fieldOption.id) {
        selectedOption = option;
      }
    }
    return (
      <Select
        inputId="checkbox-select-example"
        testId="projects-select"
        isMulti={false}
        isRequired={true}
        isInvalid={!operationOutcome.success}
        defaultValue={selectedOption}
        options={options}
        cacheOptions
        isDisabled={!props.enabled}
        menuPortalTarget={document.body}
        onChange={(selectedOption: Option) => {
          const newValue: FieldEditValue = {
            value: selectedOption.value,
          }
          onChange(newValue);
        }}
      />
    );
  }

  const renderNumberFieldEditor = () => {
    const numberField: NumberField = field as NumberField;
    let defaultValue: number = NaN;
    try {
      const value = props.maybeEditValue?.value;
      if (typeof value === 'number') {
        defaultValue = value;
      }
      defaultValue = parseFloat(value);
    } catch (error) {
      console.warn(`Error parsing number field value for field ID ${numberField.id}:`, error);
      defaultValue = NaN;
    }
    return (
      <Textfield
        id={`number-for-${numberField.id}`}
        name={numberField.id}
        isDisabled={!props.enabled}
        isInvalid={!operationOutcome.success}
        defaultValue={isNaN(defaultValue) ? '' : defaultValue.toString()}
        type="number"
        onChange={(event) => {
          let fieldValue: number | undefined = undefined;
          try {
            const fieldText = event.currentTarget.value.trim();
            if (fieldText === '' || fieldText === 'null') {
              fieldValue = undefined;
            } else {
              fieldValue = parseInt(event.currentTarget.value.trim());
            }
          } catch (error) {
            console.error(`Error parsing number field value for field ID ${numberField.id}:`, error);
          }
          const newValue: FieldEditValue = {
            value: fieldValue,
          }
          onChange(newValue);
        }}
      />
    );
  }

  const renderLabelsFieldEditor = () => {
    const labelsField = field as LabelsField;
    const multiSelectFieldOptions = labelsField.multiSelectFieldOptions;
    // KNOWN-2: Filter out the 'REPLACE' option if it exists, as it is not supported in the UI.
    const supportedMultiSelectFieldOptions: MultiSelectFieldEditOption[] = multiSelectFieldOptions.filter(option => option !== 'REPLACE');
    const selectedMultiSelectFieldOption = props.maybeEditValue?.multiSelectFieldOption || 'ADD';
    const selectedLabels = props.maybeEditValue?.value;
    // KNOWN-3: Labels can not be created within the bulk edit form. The LabelsSelect component needs to be enhanced to support 
    //          this (the underlying Select component supports this. See https://atlassian.design/components/select/code).
    return (
      <div className='edit-options-panel'>
        <EditOptionSelect
          multiSelectFieldOptions={supportedMultiSelectFieldOptions}
          selectedMultiSelectFieldOption={selectedMultiSelectFieldOption}
          isDisabled={!props.enabled}
          isInvalid={!operationOutcome.success}
          onChange={(multiSelectFieldOption: MultiSelectOption): void => {
            const newValue: FieldEditValue = {
              value: selectedLabels,
              multiSelectFieldOption: multiSelectFieldOption as MultiSelectFieldEditOption,
            }
            onChange(newValue);
          }}
        />
        <div className='edit-value'>
          <LabelsSelect
            label="Labels"
            allowMultiple={true}
            isDisabled={!props.enabled || selectedMultiSelectFieldOption === 'REMOVE_ALL'}
            isInvalid={!operationOutcome.success}
            selectedLabels={selectedLabels}
            menuPortalTarget={document.body}
            onLabelsSelect={async (selectedLabels: string[]): Promise<void> => {
              const newValue: FieldEditValue = {
                value: selectedLabels,
                multiSelectFieldOption: props.maybeEditValue?.multiSelectFieldOption,
              }
              onChange(newValue);
            }}
          />
        </div>
      </div>
    );
  }

  const renderSelectFieldEditor = () => {
    const selectField: SelectField = field as SelectField;
    const options: Option[] = [];
    let selectedOption: Option | undefined = undefined;
    for (const fieldOption of selectField.fieldOptions) {
      const option: Option = {
        value: fieldOption.optionId,
        label: fieldOption.value,
      };
      options.push(option);
      if (props.maybeEditValue?.value === fieldOption.optionId) {
        selectedOption = option;
      }
    }
    return (
      <Select
        inputId="checkbox-select-example"
        testId="projects-select"
        isMulti={false}
        isRequired={true}
        isInvalid={!operationOutcome.success}
        defaultValue={selectedOption}
        options={options}
        cacheOptions
        isDisabled={!props.enabled}
        menuPortalTarget={document.body}
        onChange={(selectedOption: Option) => {
          const newValue: FieldEditValue = {
            value: selectedOption.value,
          }
          onChange(newValue);
        }}
      />
    );
  }

  const renderSingleUserSelectFieldEditor = () => {
    const selectedUserAccountIds: string[] = props.maybeEditValue?.value ? [props.maybeEditValue.value] : [];
    return (
      <UsersSelect
        label=""
        isDisabled={!props.enabled}
        isInvalid={!operationOutcome.success}
        isMulti={false}
        isClearable={true}
        includeAppUsers={false}
        selectedUserAccountIds={selectedUserAccountIds}
        menuPortalTarget={document.body}
        onUsersSelect={async (selectedUsers: User[]) => {
          if (selectedUsers.length === 0) {
            onChange(undefined);
          } else {
            const newValue: FieldEditValue = {
              value: selectedUsers[0].accountId,
            }
            onChange(newValue);
          }
        }}
      />
    );
    // return <div>Reporter field editor not implemented yet.</div>;
  }

  const renderTextFieldEditor = () => {
    // return <input type="text" defaultValue={''} />;
    return (
      <Textfield
        name='text-field'
        placeholder={undefined  }
        defaultValue={props.maybeEditValue?.value || ''}
        isDisabled={!props.enabled}
        isCompact={true}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
          const newText = event.target.value;
            const newValue: FieldEditValue = {
              value: newText
            }
            onChange(newValue);
        }}
      />
    );
  }

  const renderCommentFieldEditor = () => {
    const initialValue = props.maybeEditValue?.value || '';
    // KNOWN-4: Bulk comment editing only supports plain text where each new line is represented as a new paragraph.
    const initialText = adfToText(initialValue);
    return (
      <div>
        <Label htmlFor="bulk-edit-comment">Plain text comment</Label>
        <TextArea
          id="bulk-edit-comment"
          resize="auto"
          minimumRows={3}
          name="area"
          defaultValue={initialText}
          isDisabled={!props.enabled}
          isInvalid={!operationOutcome.success}
          onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
            // KNOWN-4: Bulk comment editing only supports plain text where each new line is represented as a new paragraph.
            const adf = textToAdf(event.target.value);
            const newValue: FieldEditValue = {
              value: adf
            }
            onChange(newValue);
          }}
        />
      </div>
    )
  }

  const renderFixVersionsFieldEditor = () => {
    const initialValue = props.maybeEditValue?.value;
    const projectIds: string[] = [];
    if (props.issueSelectionState && props.issueSelectionState.selectedIssues) {
      for (const issue of props.issueSelectionState.selectedIssues) {
        if (issue.fields.project.id && !projectIds.includes(issue.fields.project.id)) {
          projectIds.push(issue.fields.project.id);
        }
      }
    }
    if (projectIds.length > 0) {
      return (
        <div>
          <FixVersionEditor
            field={field}
            projectId={projectIds[0]}
            isDisabled={!props.enabled}
            isInvalid={!operationOutcome.success}
            menuPortalTarget={document.body}
            onChange={(fixVersionEditorValue: FixVersionEditorValue) => {
              const newValue: FieldEditValue = {
                value: fixVersionEditorValue.versionId,
              }
              onChange(newValue);
            }}
          />
        </div>
      );
    } else {
      return null;
    }
  }

  const renderComponentsFieldEditor = () => {
    const initialValue = props.maybeEditValue?.value;
    const projectIds: string[] = [];
    if (props.issueSelectionState && props.issueSelectionState.selectedIssues) {
      for (const issue of props.issueSelectionState.selectedIssues) {
        if (issue.fields.project.id && !projectIds.includes(issue.fields.project.id)) {
          projectIds.push(issue.fields.project.id);
        }
      }
    }
    if (projectIds.length > 0) {
      return (
        <div>
          <ComponentsEditor
            field={field}
            maybeEditValue={props.maybeEditValue}
            projectId={projectIds[0]}
            isDisabled={!props.enabled}
            isInvalid={!operationOutcome.success}
            menuPortalTarget={document.body}
            onChange={(componentsEditorValue: ComponentsEditorValue) => {
              const newValue: FieldEditValue = {
                value: componentsEditorValue.componentIds,
                multiSelectFieldOption: componentsEditorValue.multiSelectFieldOption
              }
              onChange(newValue);
            }}
          />
        </div>
      );
    } else {
      return null;
    }
  }

  const renderDateFieldEditor = () => {
    const initialValue = props.maybeEditValue?.value;
    return (
      <div style={{width: '200px'}}>
        <DatePicker
          id={`date-for-${field.id}`}
          name={field.id}
          isDisabled={!props.enabled}
          isInvalid={!operationOutcome.success}
          shouldShowCalendarButton={true}
          defaultValue={initialValue}
          onChange={(isoTimeOrEmpty: string) => {
            const newValue: FieldEditValue = {
              value: isoTimeOrEmpty,
            }
            onChange(newValue);
          }}
        />
      </div>
    );
  }

  const renderDateTimeFieldEditor = () => {
    const initialValue = props.maybeEditValue?.value;
    return (
      <div style={{width: '200px'}}>
        <DateTimePicker
          id={`date-for-${field.id}`}
          name={field.id}
          isDisabled={!props.enabled}
          isInvalid={!operationOutcome.success}
          defaultValue={initialValue}
          onChange={(isoTimeOrEmpty: string) => {
            const newValue: FieldEditValue = {
              value: isoTimeOrEmpty,
            }
            onChange(newValue);
          }}
        />
      </div>
    );
  }

  const renderCascadingSelectFieldEditor = () => {
    // console.log(`renderCascadingSelectFieldEditor: ${JSON.stringify(props.field, null, 2)}`);
    const field = props.field as CascadingSelectField;
    /*
       If set, props.maybeEditValue will look something like the following:
       {
         "value": "Marsupial",
          "id": "10054",
         "child": {
           "value": "Quokka",
           "id": "10058"
         }
       }
     */
    const value = props.maybeEditValue?.value as undefined | any;
    const cascadingSelectValue: undefined | CascadingSelectValue = value ? {
      value: value,
      id: value?.id,
      child: {
        value: value?.child?.value,
        id: value?.child?.id,
      }
    } : undefined;

    return (
      <CascadingSelect
        value={cascadingSelectValue}
        field={field}
        isDisabled={!props.enabled}
        isInvalid={!operationOutcome.success}
        menuPortalTarget={document.body}
        onChange={(newValue: CascadingSelectValue) => {
          if (newValue) {
            const updatedValue: FieldEditValue = {
              value: {
                id: newValue.id,
                value: newValue.value,
                child: {
                  id: newValue.child.id,
                  value: newValue.child.value,
                }
              },
            }
            onChange(updatedValue);
          } else {
            // If the newValue is undefined, we clear the field value.
            onChange(undefined);
          }
        }}
      />
    );
  }

  const renderUnsupportedFieldEditor = () => {
    if (renderUnsupportedFieldTypesDebug) {
      return <div>Unsupported field type: {field.type}</div>;
    } else {
      return null;
    }
  }

  const renderFieldEditor = () => {
    const fieldType = field.type;
    switch (fieldType) {
      case 'issuetype':
        return renderIssueTypeFieldEditor();
      case 'com.atlassian.jira.plugin.system.customfieldtypes:float':
        return renderNumberFieldEditor();
      case 'com.atlassian.jira.plugin.system.customfieldtypes:select':
        return renderSelectFieldEditor();
      case 'reporter':
      case 'assignee':
        return renderSingleUserSelectFieldEditor();
      case 'labels':
        return renderLabelsFieldEditor();
      case 'priority':
        return renderPriorityFieldEditor();
      case 'com.atlassian.jira.plugin.system.customfieldtypes:textfield':
        return renderTextFieldEditor();
      case 'text':
        return renderTextFieldEditor();
      case 'comment':
        return renderCommentFieldEditor();
      case 'fixVersions':
        return renderFixVersionsFieldEditor();
      case 'components':
        return renderComponentsFieldEditor();
      case 'duedate':
        return renderDateFieldEditor();
      case 'com.atlassian.jira.plugin.system.customfieldtypes:datetime':
        return renderDateTimeFieldEditor();
      case 'com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect':
        return renderCascadingSelectFieldEditor();
      default:
        return renderUnsupportedFieldEditor();
    }
  }

  return (
    <div>
      {renderFieldEditor()}
    </div>
  );

}
