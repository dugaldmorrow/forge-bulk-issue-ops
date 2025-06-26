import React, { useEffect, useState, useRef } from 'react';
import LabelsSelect from '../widget/LabelsSelect';
import { Project } from '../types/Project';
import { FormSection, Label } from '@atlaskit/form';
import Toggle from '@atlaskit/toggle';
import IssueTypesSelect from '../widget/IssueTypesSelect';
import { IssueType } from '../types/IssueType';
import { IssueSearchInfo } from '../types/IssueSearchInfo';
import { Issue } from '../types/Issue';
import { IssueSearchParameters } from '../types/IssueSearchParameters';
import JQLInputPanel from '../widget/JQLInputPanel';
import ProjectsSelect from '../widget/ProjectsSelect';
import jiraDataModel from '../model/jiraDataModel';
import bulkOperationRuleEnforcer from '../extension/bulkOperationRuleEnforcer';
import { 
  allowBulkEditsAcrossMultipleProjects,
  allowBulkMovesFromMultipleProjects,
  enableTheAbilityToBulkChangeResolvedIssues,
  advancedFilterModeEnabled,
  filterModeDefault,
  showLabelsSelect,
  excludedIssueStatuses
} from '../extension/bulkOperationStaticRules';
import { BulkOperationMode } from '../types/BulkOperationMode';
import { PanelMessage } from '../widget/PanelMessage';
import { FilterMode } from '../types/FilterMode';
import { ParsedJqlQuery } from 'src/types/ParsedJqlQuery';
import jiraUtil from 'src/controller/jiraUtil';

export type FilterPanelProps = {
  bulkOperationMode: BulkOperationMode;
  allIssueTypes: IssueType[];
  selectAllIssueTypesWhenNoneAreSelected: boolean;
  onIssueSearchInitiated: () => Promise<void>;
  onIssueSearchCompleted: (issueSearchInfo: IssueSearchInfo) => Promise<void>;
}

type IssueFilterResults = {
  filterStartTime: number;
  allowedIssues: Issue[];
  removedIssues: Issue[];
}

export const FilterPanel = (props: FilterPanelProps) => {

  const [filterMode, setFilterMode] = useState<FilterMode>(advancedFilterModeEnabled ? filterModeDefault : 'basic');
  const [selectedFromProjects, setSelectedFromProjects] = useState<Project[]>([]);
  const [selectedFromProjectsTime, setSelectedFromProjectsTime] = useState<number>(0);
  const [selectedIssueTypes, setSelectedIssueTypes] = useState<IssueType[]>([]);
  const [selectedIssueTypesTime, setSelectedIssueTypesTime] = useState<number>(0);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedLabelsTime, setSelectedLabelsTime] = useState<number>(0);
  const [selectableIssueTypes, setSelectableIssueTypes] = useState<IssueType[]>([]);
  const [issueFilterResults, setIssueFilterResults] = useState<IssueFilterResults>({
    filterStartTime: 0,
    allowedIssues: [],
    removedIssues: []
  });
  const [errorMessage, setErrorMessage] = useState<string | null>('');
  const [parsedJqlQuery, setParsedJqlQuery] = useState<ParsedJqlQuery | undefined>(null);
  const lastInvocationNumberRef = useRef<number>(0);

  const filterProjectsForFromSelection = async (projectsToFilter: Project[]): Promise<Project[]> => {
    const allowableToProjects = await bulkOperationRuleEnforcer.filterSourceProjects(projectsToFilter, props.bulkOperationMode);
    return allowableToProjects;
  }

  const filterSourceProjectIssueTypes = async (
    issueTypes: IssueType[],
    bulkOperationMode: BulkOperationMode
  ): Promise<IssueType[]> => {
    return await bulkOperationRuleEnforcer.filterSourceProjectIssueTypes(issueTypes, selectedFromProjects, bulkOperationMode);
  }

  const filterRetrieveIssues = async (issues: Issue[]): Promise<IssueFilterResults> => {
    const issueFilterResults: IssueFilterResults = {
      filterStartTime: Date.now(),
      allowedIssues: [],
      removedIssues: []
    };
    for (const issue of issues) {
      let includeIssue = true;
      const project = issue.fields.project;
      const issueType = issue.fields.issuetype;
      const issueStatus = issue.fields.status;
      if (!project) {
        throw new Error(`Internal error: Issue ${issue.key} has no project field!`);
      }
      if (!issueType) {
        throw new Error(`Internal error: Issue ${issue.key} has no issue type field!`);
      }
      const filteredProjects = await bulkOperationRuleEnforcer.filterSourceProjects([project], props.bulkOperationMode);
      const filteredIssueTypes = await bulkOperationRuleEnforcer.filterSourceProjectIssueTypes(
        [issueType],
        selectedFromProjects,
        props.bulkOperationMode
      );

      includeIssue = includeIssue && filteredProjects.length === 1 && filteredProjects[0].key === project.key;
      includeIssue = includeIssue && filteredIssueTypes.length === 1 && filteredIssueTypes[0].id === issueType.id;
      for (const statusToExclude of excludedIssueStatuses) {
        if (!issueStatus) {
          console.warn(`FilterPanel.filterRetrieveIssues: Issue ${issue.key} has no status field!`);
          includeIssue = false;
          break;
        }
        if (issueStatus.name === statusToExclude) {
          console.log(`FilterPanel.filterRetrieveIssues: Issue ${issue.key} has status "${issueStatus.name}" which is excluded from bulk operations.`);
          includeIssue = false;
          break;
        }
      }

      if (includeIssue) {
        issueFilterResults.allowedIssues.push(issue);
      } else {
        issueFilterResults.removedIssues.push(issue);
        // console.log(`FilterPanel: filterRetrieveIssues: Issue ${issue.key} has either an unsupported issue type "${issueType.name}" or an unsupported project "${project.key}" for the selected source projects.`);
      }
    }
    return issueFilterResults;
  }

  const updateIssueTypeSelection = async (selectedIssueTypes: IssueType[]): Promise<void> => {
    if (selectedIssueTypes.length === 0) {
      if (props.selectAllIssueTypesWhenNoneAreSelected) {
        setSelectedIssueTypes(props.allIssueTypes);
      } else {
        setSelectedIssueTypes(selectedIssueTypes);
      }
    } else {
      setSelectedIssueTypes(selectedIssueTypes);
    }
    setSelectedIssueTypesTime(Date.now());
  }

  const executeSearch = async (jql: string): Promise<void> => {
    await props.onIssueSearchInitiated();
    const issueSearchInfo = await jiraDataModel.getIssueSearchInfoByJql(jql) as IssueSearchInfo;
    // console.log(`FilterPanel.executeSearch: issueSearchInfo: ${JSON.stringify(issueSearchInfo, null, 2)}`);
    const issueFilterResults = await filterRetrieveIssues(issueSearchInfo.issues);
    setIssueFilterResults(issueFilterResults);
    // console.log(`FilterPanel.executeSearch: issueFilterResults: ${JSON.stringify(issueFilterResults, null, 2)}`);
    issueSearchInfo.issues = issueFilterResults.allowedIssues;
    await props.onIssueSearchCompleted(issueSearchInfo);
  }

  const onAdvancedModeSearchIssues = async (unembelishedJql: string): Promise<void> => {
    const augmentedJql = await bulkOperationRuleEnforcer.augmentJqlWithBusinessRules(unembelishedJql, props.bulkOperationMode);
    const parsedJqlQueryInvocationResult = await jiraDataModel.parseJql(augmentedJql);
    if (parsedJqlQueryInvocationResult.ok) {
      const parsedJqlQuery = parsedJqlQueryInvocationResult.data;
      setParsedJqlQuery(parsedJqlQuery);
      // console.log(`FilterPanel.onAdvancedModeSearchIssues: parsedJqlQuery: ${JSON.stringify(parsedJqlQuery, null, 2)}`);
      if (parsedJqlQuery.errors && parsedJqlQuery.errors.length > 0) {
        // setErrorMessage(`JQL query parsing errors: ${parsedJqlQuery.errors.join(', ')}`);
      } else {
        await executeSearch(augmentedJql);
      }
    } else {
      setErrorMessage(parsedJqlQueryInvocationResult.errorMessage);
    }
  }

  const onBasicModeSearchIssues = async (projects: Project[], issueTypes: IssueType[], labels: string[]): Promise<void> => {
    const issueSearchParameters: IssueSearchParameters = {
      projects: projects,
      issueTypes: issueTypes,
      labels: labels
    }
    const unembelishedJql = await jiraDataModel.convertIssueSearchParametersToJql(issueSearchParameters, props.bulkOperationMode);
    await onAdvancedModeSearchIssues(unembelishedJql);
  }

  const onFromProjectsSelect = async (selectedProjects: Project[]): Promise<void> => {
    setSelectedFromProjects(selectedProjects);
    setSelectedFromProjectsTime(Date.now());
    updateIssueTypeSelection([]);
    const selectableIssueTypes: IssueType[] = jiraUtil.filterProjectsIssueTypes(selectedProjects);
    setSelectableIssueTypes(selectableIssueTypes);
    await onBasicModeSearchIssues(selectedProjects, selectableIssueTypes, selectedLabels);
  }

  const onIssueTypesSelect = async (selectedIssueTypes: IssueType[]): Promise<void> => {
    // console.log(`selectedIssueTypes: `, selectedIssueTypes);
    updateIssueTypeSelection(selectedIssueTypes);
    await onBasicModeSearchIssues(selectedFromProjects, selectedIssueTypes, selectedLabels);
  }

  const onLabelsSelect = async (selectedLabels: string[]): Promise<void> => {
    // console.log(`FilterPanel.onLabelsSelect: selectedLabels: `, selectedLabels);
    setSelectedLabels(selectedLabels);
    setSelectedLabelsTime(Date.now());
    await onBasicModeSearchIssues(selectedFromProjects, selectedIssueTypes, selectedLabels);
  }

  const onExecuteUnaugmentedJql = async (unembelishedJql: string): Promise<void> => {
    await onAdvancedModeSearchIssues(unembelishedJql);
  }

  const renderJQLInputPanel = () => {
    return (
      <FormSection>
       <JQLInputPanel
          initialJql={''}
          bulkOperationMode={props.bulkOperationMode}
          buildJqlAugmentationLogicText={bulkOperationRuleEnforcer.buildJqlAugmentationLogicText}
          augmentJqlWithBusinessRules={bulkOperationRuleEnforcer.augmentJqlWithBusinessRules}
          onExecuteUnaugmentedJql={onExecuteUnaugmentedJql}
        />
      </FormSection>
    );
  }

  const renderFromProjectSelect = () => {
    const isMulti =
      (props.bulkOperationMode === 'Move' && allowBulkMovesFromMultipleProjects) ||
      (props.bulkOperationMode === 'Edit' && allowBulkEditsAcrossMultipleProjects);
    return (
      <FormSection>
        <ProjectsSelect 
          label={props.bulkOperationMode === 'Move' ? "From projects" : "Projects"}
          isMulti={isMulti}
          isClearable={false}
          selectedProjects={selectedFromProjects}
          filterProjects={filterProjectsForFromSelection}
          menuPortalTarget={document.body}
          onProjectsSelect={onFromProjectsSelect}
        />
    </FormSection>
    );
  }

  const renderIssueTypesSelect = () => {
    return (
      <FormSection>
        <IssueTypesSelect
          label="Work item types"
          placeholder="Select work item types of interest"
          selectedIssueTypes={selectedIssueTypes}
          possiblySelectableIssueTypes={selectableIssueTypes}
          menuPortalTarget={document.body}
          bulkOperationMode={props.bulkOperationMode}
          isClearable={!props.selectAllIssueTypesWhenNoneAreSelected}
          filterAllowedIssueTypes={filterSourceProjectIssueTypes}
          onIssueTypesSelect={onIssueTypesSelect}
        />
      </FormSection>
    );
  }

  const renderLabelsSelect = () => {
    return (
      <FormSection>
        <LabelsSelect
          label="Labels"
          allowMultiple={true}
          selectedLabels={selectedLabels}
          menuPortalTarget={document.body}
          onLabelsSelect={onLabelsSelect}
        />
      </FormSection>
    );
  }

  const renderFilterModeSelect = () => {
    if (!advancedFilterModeEnabled) {
      return null;
    }
    return (
      <FormSection>
        <div className="filter-model-panel">
          <div>
            <Label htmlFor="filter-mode-select">Advanced</Label>
            <Toggle
              id={`toggle-filter-mode-advanced`}
              isChecked={filterMode === 'advanced'}
              onChange={(event: any) => {
                setFilterMode(filterMode === 'basic' ? 'advanced' : 'basic');
              }}
            />
          </div>
        </div>
      </FormSection>
    );
  }

  const renderBasicFieldInputs = () => {
    if (filterMode === 'advanced') {
      return null;
    } else {
      return (
        <>
          {renderFromProjectSelect()}
          {selectedFromProjects.length ? renderIssueTypesSelect() : null}
          {showLabelsSelect ? renderLabelsSelect() : null}
        </>
      );  
    }
  }

  const renderAdvancedFieldInputs = () => {
    if (filterMode === 'advanced') {
      return (
        <>
          {renderJQLInputPanel()}
        </>
      );
    } else {
      return null;      
    }
  }

  const renderOnlyUnresolvedIssuesMessage = () => {
    const jqlAugmentationLogicText = bulkOperationRuleEnforcer.buildJqlAugmentationLogicText(filterMode, props.bulkOperationMode);
    if (jqlAugmentationLogicText) {
      return (
        <div style={{marginBottom: '20px', marginTop: '20px'}}>
          <PanelMessage
            className="info-banner"
            message={`Note: ${jqlAugmentationLogicText}`} 
          />
        </div>
      );
    } else {
      return null;
    }
  }

  const renderErrorMessage = () => {
    if (errorMessage) {
      return (
        <PanelMessage
          message={errorMessage}
          className="warning-banner"
        />
      );
    } else {
      return null;
    }
  }

  const renderJqlParseError = () => {
    if (parsedJqlQuery?.errors) {
      return (
        <PanelMessage
          message={parsedJqlQuery.errors.join(', ')}
          className="warning-banner"
        />
      );
    } else {
      return null;
    }
  }

  return (
    <div className="filter-panel">
      {renderErrorMessage()}
      {renderJqlParseError()}
      {renderOnlyUnresolvedIssuesMessage()}
      {renderFilterModeSelect()}
      {renderBasicFieldInputs()}
      {renderAdvancedFieldInputs()}
    </div>
  );

}
