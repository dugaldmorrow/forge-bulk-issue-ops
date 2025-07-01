import React, { useEffect, useState, useRef } from 'react';
import { Label } from '@atlaskit/form';
import { Option } from '../types/Option'
import { RadioSelect, CheckboxSelect } from '@atlaskit/select';
import jiraDataModel from 'src/model/jiraDataModel';
import { JiraLabel } from 'src/types/JiraLabel';

/*
  Select docs: https://atlassian.design/components/select/examples
*/

export type LabelsSelectProps = {
  label: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  isClearable?: boolean;
  allowMultiple: boolean;
  selectedLabel?: string;
  selectedLabels?: string[],
  menuPortalTarget?: HTMLElement;
  onLabelsSelect: (selectedLabels: string[]) => Promise<void>;
}

const LabelsSelect = (props: LabelsSelectProps) => {

  const [loadingLabels, setLoadingLabels] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>('');
  const [labels, setLabels] = useState<JiraLabel[]>([]);
  const [labelInfoRetrievalTime, setLabelInfoRetrievalTime] = useState<number>(0);
  const lastInvocationNumberRef = useRef<number>(0);

  const labelToOption = (label: JiraLabel): Option => {
    return {
      // label: label.displayName,
      label: label.value,
      value: label.value,
    };
  }

  const labelsToOptions = (labels: JiraLabel[]): Option[] => {
    return labels.map(labelToOption);
  }

  const options = labelsToOptions(labels);

  const filterLabels = (labels: JiraLabel[]): JiraLabel[] => {
    // return labels.filter((label: JiraLabel) => {
    //   const labelValue = label.value.toLowerCase();
    //   const inputValue = userInput.toLowerCase();
    //   return labelValue.includes(inputValue);
    // });
    return labels;
  }

  const promiseOptions = async (inputValue: string): Promise<Option[]> => {
    lastInvocationNumberRef.current = lastInvocationNumberRef.current + 1;
    const myInvocationNumber = lastInvocationNumberRef.current;
    // console.log(`LabelsSelect: In promiseOptions (inputValue = '${inputValue}')`);
    setLoadingLabels(true);
    try {
      setUserInput(inputValue);
      const retreveLabelInvocationResult = await jiraDataModel.suggestLabels(inputValue);
      if (retreveLabelInvocationResult.ok) {
        const retrevedLabels: JiraLabel[] = retreveLabelInvocationResult.data.results;
        // console.log(`LabelsSelect.promiseOptions: retrevedLabels for inputValue = ${inputValue} (userInput = ${userInput})`);
        if (myInvocationNumber >= lastInvocationNumberRef.current) {
          // console.log(`LabelsSelect.promiseOptions: userInput is still '${inputValue}', applying results: ${JSON.stringify(retrevedLabels)}`);
          const foundLabels = filterLabels(retrevedLabels);
          setLabels(foundLabels);
          return labelsToOptions(foundLabels);
        } else {
          // Return options from filteredProjects since this invocation is stale.
          // console.log(`LabelsSelect.promiseOptions: userInput changed from '${userInput}' to '${inputValue}', ignoring results`);
          const options = labelsToOptions(labels);
          return options;
        }
      } else {
        console.error(`LabelsSelect.promiseOptions: Error retrieving labels for inputValue = ${inputValue}: ${retreveLabelInvocationResult.errorMessage}`);
      }
    } finally {
      setLoadingLabels(false);
    } 
  }

  const onSingleSelectChange = async (selectedOption: undefined | Option): Promise<void> => {
    return await onChange(selectedOption);
  }

  const onMultiSelectChange = async (selectedOptions: Option[]) => {
    return await onChange(selectedOptions);
  }

  const onChange = async (selection: undefined | Option | Option[]) => {
    let selectedLabels: string[] = [];
    if (!selection) {
      selectedLabels = [];
    } else if (props.allowMultiple) {
      const selectedOptions = selection as Option[];
      selectedLabels = await rebuildSelectedLabels(selectedOptions);
    } else {
      const selectedOption = selection as Option;
      selectedLabels = await rebuildSelectedLabels([selectedOption]);
    }
    
    // Reset the user input since the UI clears the text in the select field...
    // console.log(`LabelsSelect.onChange: selectedLabels = ${JSON.stringify(selectedLabels)}, resetting userInput...`);
    await promiseOptions('');
    await props.onLabelsSelect(selectedLabels);
  }

  const rebuildSelectedLabels = async (selectedOptions: Option[]): Promise<string[]> => {
    const selectedLabels: string[] = [];
    for (const selectedOption of selectedOptions) {
      selectedLabels.push(selectedOption.value);
    }
    return selectedLabels;
  }

  const determineDefaultMultipleOptions = (initiallySelectedLabels: string[]): Option[] => {
    const initialOptions: Option[] = options.map(option => {
      const foundLabel = initiallySelectedLabels.find((initiallySelectedOption) => {
        return option.value === initiallySelectedOption;
      });
      return foundLabel ? option : null;
    });
    return initialOptions;
  }

  const determineDefaultSingleOption = (initiallySelectedLabel: string): Option => {
    const option = options.find((option: Option) => option.value === initiallySelectedLabel);
    return option;
  }

  const defaultValue = props.allowMultiple && props.selectedLabels ? 
    determineDefaultMultipleOptions(props.selectedLabels) :
    !props.allowMultiple && props.selectedLabel ?
    determineDefaultSingleOption(props.selectedLabel) : undefined;

  const renderSingleSelect = () => {
    return (
      <RadioSelect
        key={`single-label-select-${labelInfoRetrievalTime}`}
        inputId="radio-select-example"
        testId="react-select"
        isDisabled={props.isDisabled}
        isInvalid={props.isInvalid}
        noOptionsMessage={() => `Start typing to search for labels...`}
        // defaultValue={defaultValue}
        // defaultOptions
        cacheOptions
        // options={options}
        // defaultValue={options}
        isLoading={loadingLabels}
				loadOptions={promiseOptions}
        isClearable={props.isClearable}
        placeholder={props.label}
        menuPortalTarget={props.menuPortalTarget}
        onChange={onSingleSelectChange}
      />
    );
  }

  const renderMultiSelect = () => {
    return (
      <CheckboxSelect
        key={`multi-label-select-${labelInfoRetrievalTime}`}
        inputId="checkbox-select-example"
        testId="select"
        isDisabled={props.isDisabled}
        isInvalid={props.isInvalid}
        noOptionsMessage={() => `Start typing to search for labels...`}
        // defaultValue={defaultValue}
        // defaultOptions
        cacheOptions
        // options={options}
        // defaultValue={options}
        isLoading={loadingLabels}
				loadOptions={promiseOptions}
        isClearable={props.isClearable}
        placeholder={props.label}
        menuPortalTarget={props.menuPortalTarget}
        onChange={onMultiSelectChange}
      />
    )
  }

  return (
    <>
      <Label htmlFor="async-select-example">{props.label}</Label>
      {props.allowMultiple ? renderMultiSelect() : renderSingleSelect()}
    </>
  );
}

export default LabelsSelect;
