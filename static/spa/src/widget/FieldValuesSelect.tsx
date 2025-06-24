import React from 'react';
import { Label } from '@atlaskit/form';
import Tooltip from "@atlaskit/tooltip";
import { components, OptionProps } from "@atlaskit/select"
import { Option } from '../types/Option'
import Select from '@atlaskit/select';
import { CustomFieldOption } from 'src/types/CustomFieldOption';

/*
  Select docs: https://atlassian.design/components/select/examples
*/

// Minimum length of label to show tooltip
const minimumLabelLengthForTooltip = 4;

export type FieldValuesSelectProps = {
  label: string;
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

  const SelectContainer = ({
    children,
    ...props
  }: any) => {
    console.log(`SelectContainer props: ${JSON.stringify(props, null, 2)}`);
    const currentValueLabel = props.selectProps && props.selectProps.value && props.selectProps.value.label ? props.selectProps.value.label : undefined;
    return currentValueLabel && currentValueLabel.length > minimumLabelLengthForTooltip ? (
      <Tooltip content={currentValueLabel} delay={0} position="auto">
        <components.SelectContainer {...props}>
          {children}
        </components.SelectContainer>
      </Tooltip>
    ) : (
      <components.SelectContainer {...props}>
        {children}
      </components.SelectContainer>
    );
  };

  // See https://react-select.com/components
  const Option = (props: OptionProps<any>) => {
    const currentValueLabel = props.data && props.data.label ? props.data.label : undefined;
    return currentValueLabel && currentValueLabel.length > minimumLabelLengthForTooltip ? (
      <Tooltip content={currentValueLabel} position="auto">
        <components.Option {...props} />
      </Tooltip>
    ) : (
      <components.Option {...props} />
    );
  };

  const defaultValue = props.selectedCustomFieldOption ? customFieldOptionToOption(props.selectedCustomFieldOption) : undefined;

  return (
    <>
      {props.label ? <Label htmlFor="async-select-example">{props.label}</Label> : null}
      <Select
        key={`field-options-select`}
        inputId="radio-select-example"
        testId="react-select"
        defaultValue={defaultValue}
        options={options}
        placeholder={props.label}
        menuPortalTarget={props.menuPortalTarget}
        components={{ Option, SelectContainer }} // See https://react-select.com/components
        styles={{
          option: (base) => ({
            ...base,
          }),
        }}
        onChange={onSingleSelectChange}
      />
    </>
  );
  
}

export default FieldValuesSelect;
