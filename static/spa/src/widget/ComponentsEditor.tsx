import React, { useEffect } from 'react';
import { Option } from '../types/Option'
import { ComponentsField, IssueBulkEditField, MultiSelectOption } from '../types/IssueBulkEditFieldApiResponse';
import Select from '@atlaskit/select';
import jiraDataModel from 'src/model/jiraDataModel';
import { EditOptionSelect } from './EditOptionSelect';
import { FieldEditValue, MultiSelectFieldEditOption } from 'src/types/FieldEditValue';
import { Label } from '@atlaskit/form';
import { ProjectComponent } from 'src/types/ProjectComponent';

export type ComponentsEditorValue = {
  componentIds: string[];
  multiSelectFieldOption: MultiSelectFieldEditOption
}

export type ComponentsEditorProps = {
  value?: ComponentsEditorValue;
  field: IssueBulkEditField;
  maybeEditValue: FieldEditValue;
  projectId: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  menuPortalTarget?: HTMLElement;
  onChange: (value: ComponentsEditorValue) => void;
}

export const ComponentsEditor = (props: ComponentsEditorProps) => {

  const [components, setComponents] = React.useState<ProjectComponent[] | undefined>(undefined);
  const [componentsOptions, setComponentsOptions] = React.useState<Option[]>([]);

  const loadData = async () => {
    let projectComponents: ProjectComponent[] = [];
    if (props.projectId) {
      const projectComponentsInvocationResult = await jiraDataModel.getProjectComponents(props.projectId);
      if (projectComponentsInvocationResult.ok && projectComponentsInvocationResult.data) {
        projectComponents = projectComponentsInvocationResult.data;
      }
    } else {
      console.warn(`ComponentsEditor: No projectId provided, cannot load project versions.`);
      setComponentsOptions([]);
    }
    setComponents(projectComponents);
    const options: Option[] = projectComponents.map(component => ({
      value: component.id,
      label: component.name,
    }));
    setComponentsOptions(options);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadData();
  }, [props.projectId]);

  const determineSelectedOptions = (): Option[] => {
    // console.log(`ComponentsEditor.determineSelectedOptions: props.value = ${JSON.stringify(props.value)}`);
    const selectedOptions: Option[] = [];
    if (props.value && props.value.componentIds) {
      for (const componentsOption of componentsOptions) {
        if (componentsOption.value && props.value.componentIds.includes(componentsOption.value)) {
          // console.log(`ComponentsEditor.determineSelectedOptions: Adding option ${componentsOption.label} / ${componentsOption.value}`);
          selectedOptions.push(componentsOption);
        }
      }
    }
    return selectedOptions;
  }

  const onComponentsSelect = (selectedOptions: Option[]) => {
    const fixVersionEditorValue: ComponentsEditorValue = {
      componentIds: selectedOptions.map(option => option.value),
      multiSelectFieldOption: props.maybeEditValue?.multiSelectFieldOption || 'ADD',
    }
    props.onChange(fixVersionEditorValue);
  }

  const componentsField = props.field as ComponentsField;
  const multiSelectFieldOptions = componentsField.multiSelectFieldOptions;
  // KNOWN-2: Filter out the 'REPLACE' option if it exists, as it is not supported in the UI.
  const supportedMultiSelectFieldOptions: MultiSelectFieldEditOption[] = multiSelectFieldOptions.filter(option => option !== 'REPLACE');
  const selectedMultiSelectFieldOption = props.maybeEditValue?.multiSelectFieldOption || 'ADD';
  // const selectedComponents = props.maybeEditValue?.value;
  return (
    <div className='edit-options-panel'>
      <EditOptionSelect
        multiSelectFieldOptions={supportedMultiSelectFieldOptions}
        selectedMultiSelectFieldOption={selectedMultiSelectFieldOption}
        isDisabled={props.isDisabled}
        isInvalid={props.isInvalid}
        onChange={(multiSelectFieldOption: MultiSelectOption): void => {
          const fixVersionEditorValue: ComponentsEditorValue = {
            componentIds: props.maybeEditValue?.value || [],
            multiSelectFieldOption: multiSelectFieldOption,
          }
          props.onChange(fixVersionEditorValue);
        }}
      />
      <div>
        <Label htmlFor="async-select-example">Components</Label>
        <Select
          key={`components-${props.projectId}`}
          id={`components-${props.projectId}`}
          name={`components-${props.projectId}`}
          isMulti={true}
          isDisabled={props.isDisabled}
          isInvalid={props.isInvalid}
          defaultOptions={componentsOptions}
          value={determineSelectedOptions()}
          menuPortalTarget={props.menuPortalTarget}
          onChange={onComponentsSelect}
        />
      </div>
    </div>
  )

}
