import React from 'react';
import { Label } from '@atlaskit/form';
import { Option } from '../types/Option'
import { RadioSelect } from '@atlaskit/select';
import { CustomFieldOption } from 'src/types/CustomFieldOption';

/*
  Select docs: https://atlassian.design/components/select/examples
*/

export type FieldValuesSelectProps = {
  label: string;
  isRequired?: boolean;
  noOptionsMessage?: string;
  selectableCustomFieldOptions: CustomFieldOption[];
  selectedCustomFieldOption?: CustomFieldOption;
  menuPortalTarget?: HTMLElement;
  onSelect: (selectedCustomFieldOption: CustomFieldOption) => Promise<void>;
}

const FieldValuesSelect = (props: FieldValuesSelectProps) => {

  const options = props.selectableCustomFieldOptions.map((customFieldOption: CustomFieldOption) => ({
    value: customFieldOption.id,
    label: customFieldOption.name,
  }));

  const customFieldOptionToOption = (customFieldOption: CustomFieldOption): Option => {
    const option = {
      value: customFieldOption.id,
      label: customFieldOption.name,
    }
    return option;
  }

  const optionToCustomFieldOption = (option: Option): undefined | CustomFieldOption => {
    for (const customFieldOption of props.selectableCustomFieldOptions) {
      if (customFieldOption.id === option.value) {
        return customFieldOption;
      }
    }
    return undefined;
  }

  const onSingleSelectChange = async (selectedOption: undefined | Option): Promise<void> => {
    // console.log(`LabelSelect.onChange: `, selectedOption);
    const selectedCustomFieldOption = optionToCustomFieldOption(selectedOption);
    if (selectedCustomFieldOption) {
      await props.onSelect(selectedCustomFieldOption);
    }
  }

  const defaultValue = props.selectedCustomFieldOption ? customFieldOptionToOption(props.selectedCustomFieldOption) : undefined;

  return (
    <>
      {props.label ? <Label htmlFor="async-select-example">{props.label}</Label> : null}
      <RadioSelect
        key={`field-options-select`}
        inputId="radio-select-example"
        testId="react-select"
        isRequired={props.isRequired}
        // noOptionsMessage={props.noOptionsMessage}
        noOptionsMessage={({inputValue}) => !inputValue ? props.noOptionsMessage : "No results found"} 
        defaultValue={defaultValue}
        options={options}
        placeholder={props.isRequired ? "Required field" : "Optional field"}
        menuPortalTarget={props.menuPortalTarget}
        onChange={onSingleSelectChange}
      />
    </>
  );
}

export default FieldValuesSelect;
