import React, { useEffect, useState } from 'react';
import { Label } from '@atlaskit/form';
import { CheckboxSelect } from '@atlaskit/select';
import { Option } from '../types/Option'
import { IssueType } from '../types/IssueType';
import { formatIssueType } from 'src/controller/formatters';

/*
  Select docs: https://atlassian.design/components/select/examples
*/

export type IssueTypesSelectProps = {
  label: string;
  selectedIssueTypeIds: string[];
  selectableIssueTypes: IssueType[];
  menuPortalTarget?: HTMLElement;
  onIssueTypesSelect: (selectedIssueTypes: IssueType[]) => Promise<void>;
}

const IssueTypesSelect = (props: IssueTypesSelectProps) => {

  const [issueTypeInfoRetrievalTime, setIssueTypeInfoRetrievalTime] = useState<number>(0);
 
  const onChange = async (selectedOptions: Option[]): Promise<void> => {
    // console.log(`IssueTypesSelect.onChange: `, selectedOptions);
    const issueTypes: IssueType[] = props.selectableIssueTypes;;
    const selectedIssueTypes: IssueType[] = [];
    for (const selectedOption of selectedOptions) {
      const issueType = issueTypes.find(issueType => issueType.id === selectedOption.value);
      if (issueType) {
        selectedIssueTypes.push(issueType);
      }
    }
    await props.onIssueTypesSelect(selectedIssueTypes);
  }

  const renderCheckboxSelect = () => {
    const issueTypes: IssueType[] = props.selectableIssueTypes;;
    // console.log(`Rendering issue types select. project ID = ${projectId}, issueTypes.length = ${issueTypes.length}`);
    const options: Option[] = issueTypes.map((issueType: any) => ({
      label: formatIssueType(issueType),
      value: issueType.id,
    }));
    const initiallySelectedOptions: Option[] = [];
    for (const option of options) {
      const selected = props.selectedIssueTypeIds.find(selectedIssueTypeId => selectedIssueTypeId === option.value);
      // console.log(`Checking option ${option.label} / ${option.value} against ${JSON.stringify(props.selectedIssueTypeIds)}. selected = ${selected}`);
      if (selected) {
        initiallySelectedOptions.push(option);
      }
    }
    return (
      <CheckboxSelect
        key={`multi-issue-types-select-${issueTypeInfoRetrievalTime}`}
        inputId="checkbox-select-example"
        testId="issue-types-select"
        defaultValue={initiallySelectedOptions}
        options={options}
        placeholder={props.label}
        menuPortalTarget={props.menuPortalTarget}
        onChange={onChange}
      />
    );
  }

  return (
    <>
      <Label htmlFor="async-select-example">{props.label}</Label>
      {renderCheckboxSelect()}
    </>
  );
}

export default IssueTypesSelect;
