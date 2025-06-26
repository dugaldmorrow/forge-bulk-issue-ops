import React, { useEffect, useState, useRef } from 'react';
import { Label } from '@atlaskit/form';
import Select from '@atlaskit/select';
import { Option } from '../types/Option'
import { Project } from '../types/Project';
import jiraDataModel from '../model/jiraDataModel';
import { formatProject } from '../controller/formatters';

/*
  Select docs: https://atlassian.design/components/select/examples
*/

export type ProjectsSelectProps = {
  label: string;
  selectedProjects: Project[];
  isMulti: boolean
  isDisabled?: boolean;
  isClearable: boolean;
  targetProjectsFilterConditionsChangeTime?: number;
  menuPortalTarget?: HTMLElement;
  filterProjects?: (projectsToFilter: Project[]) => Promise<Project[]>;
  onProjectsSelect: (selectedProjects: Project[]) => Promise<void>;
}

const ProjectsSelect = (props: ProjectsSelectProps) => {

  const [loadingOptions, setLoadingOptions] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>('');
  const [foundProjects, setFoundProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const lastInvocationNumberRef = useRef<number>(0);

  const filterProjects = async (projectsToFilter: Project[]): Promise<Project[]> => {
    let filteredProjects = projectsToFilter;
    if (props.filterProjects) {
      filteredProjects = await props.filterProjects(projectsToFilter);
      // console.log(`ProjectsSelect.filterProjects: filteredProjects = ${filteredProjects.map(project => project.key).join(', ')}`);
    }
    setFilteredProjects(filteredProjects);
    return filteredProjects;
  }

  const filterFoundProjects = async (foundProjects: Project[]): Promise<Project[]> => {
    // console.log(`ProjectsSelect.filterFoundProjects: foundProjects = ${foundProjects.map(project => project.key).join(', ')}`);
    setLoadingOptions(true);
    try {
      const filteredProjects = await filterProjects(foundProjects);
      setFilteredProjects(filteredProjects);
      return filteredProjects;
    } finally {
      setLoadingOptions(false);
    } 
  }

  useEffect(() => {
    filterFoundProjects(foundProjects);
  }, [props.targetProjectsFilterConditionsChangeTime]);

  const onChange = async (selection: undefined | Option | Option[]): Promise<void> => {
    // console.log(`ProjectsSelect.onChange: ${selection ? JSON.stringify(selection) : 'undefined'}`);
    let selectedProjects: Project[] = [];
    if (!selection) {
      selectedProjects = [];
    } else if (props.isMulti) {
      const selectedOptions = selection as Option[];
      selectedProjects = await rebuildSelectedProjects(selectedOptions);
    } else {
      const selectedOption = selection as Option;
      selectedProjects = await rebuildSelectedProjects([selectedOption]);
    }
    
    // Reset the user input since the UI clears the text in the select field...
    await promiseOptions('');
    await props.onProjectsSelect(selectedProjects);
  }

  const rebuildSelectedProjects = async (selectedOptions: Option[]): Promise<Project[]> => {
    const selectedProjects: Project[] = [];
    for (const selectedOption of selectedOptions) {
      const projectInFilteredProjects = filteredProjects.find(project => project.id === selectedOption.value);
      if (projectInFilteredProjects) {
        selectedProjects.push(projectInFilteredProjects);
      } else {
        const projectInExistingSelectedProjects = props.selectedProjects.find(project => project.id === selectedOption.value);
        if (projectInExistingSelectedProjects) {
          selectedProjects.push(projectInExistingSelectedProjects);
        } else {
          // console.log(`ProjectsSelect.rebuildSelectedProjects: Could not find project with id ${selectedOption.value} in filteredProjects or selectedProjects`);
          const projectInvocationResult = await jiraDataModel.getProjectByIdOrKey(selectedOption.value);
          if (projectInvocationResult.ok) {
            selectedProjects.push(projectInvocationResult.data);
          } else {
            console.error(`ProjectsSelect.rebuildSelectedProjects: Could not find project with id ${selectedOption.value} in filteredProjects or selectedProjects`);
          }
        }
      }
    }
    return selectedProjects;
  }

  const projectToOption = (project: Project): Option => {
    const option: Option = {
      label: formatProject(project),
      value: project.id,
    };
    return option;
  }

  const projectsToOptions = (projects: Project[]): Option[] => {
    return projects.map(projectToOption);
  }

  const promiseOptions = async (inputValue: string): Promise<Option[]> => {
    lastInvocationNumberRef.current = lastInvocationNumberRef.current + 1;
    const myInvocationNumber = lastInvocationNumberRef.current;
    // console.log(`ProjectsSearhSelect: In promiseOptions(inputValue = '${inputValue}')`);
    setLoadingOptions(true);
    try {
      setUserInput(inputValue);
      const retrevedProjectsInfo = await jiraDataModel.pageOfProjectSearchInfo(inputValue);
      // console.log(`ProjectsSelect.promiseOptions: retrevedProjectsInfo for inputValue = ${inputValue} (userInput = ${userInput})`);
      if (myInvocationNumber >= lastInvocationNumberRef.current) {
        // console.log(`ProjectsSelect.promiseOptions: userInput is still '${inputValue}', applying results...`);
        const foundProjects = retrevedProjectsInfo.values;
        setFoundProjects(foundProjects);
        const filteredProjects = await filterFoundProjects(foundProjects);
        if (myInvocationNumber >= lastInvocationNumberRef.current) {
          setFilteredProjects(filteredProjects);
          const options = projectsToOptions(filteredProjects);
          return options;
        } else {
          // Return options from filteredProjects since this invocation is stale.
          // console.log(`ProjectsSelect.promiseOptions: after filtering, userInput changed from '${userInput}' to '${inputValue}', ignoring results`);
          const options = projectsToOptions(filteredProjects);
          return options;
        }
      } else {
        // Return options from filteredProjects since this invocation is stale.
        // console.log(`ProjectsSelect.promiseOptions: userInput changed from '${userInput}' to '${inputValue}', ignoring results`);
        const options = projectsToOptions(filteredProjects);
        return options;
      }
    } finally {
      setLoadingOptions(false);
    } 
  }

  const renderSelect = () => {
    return (
      <Select
        inputId="checkbox-select-example"
        testId="projects-select"
        isMulti={props.isMulti}
        isRequired={true}
        defaultOptions
        cacheOptions
        isDisabled={props.isDisabled}
        isClearable={props.isClearable}
        isLoading={loadingOptions}
				loadOptions={promiseOptions}
        placeholder={props.label}
        menuPortalTarget={props.menuPortalTarget}
        onChange={onChange}
      />
    );
  }

  return (
    <>
      <Label htmlFor="projects-select">{props.label}</Label>
      {renderSelect()}
    </>
  );
}

export default ProjectsSelect;


