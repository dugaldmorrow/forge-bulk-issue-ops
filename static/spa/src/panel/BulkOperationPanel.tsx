import React, { useEffect, useState, useRef } from 'react';
import Button from '@atlaskit/button/new';
import { Project } from '../types/Project';
import { FormSection } from '@atlaskit/form';
import { IssueType } from '../types/IssueType';
import { IssueSearchInfo } from '../types/IssueSearchInfo';
import { Issue } from '../types/Issue';
import { LoadingState } from '../types/LoadingState';
import { nilIssueSearchInfo } from '../model/nilIssueSearchInfo';
import { TaskOutcome } from '../types/TaskOutcome';
import jiraUtil from '../controller/jiraUtil';
import ProjectsSelect from '../widget/ProjectsSelect';
import jiraDataModel from '../model/jiraDataModel';
import { DataRetrievalResponse } from '../types/DataRetrievalResponse';
import { buildFieldMappingsForProject } from '../controller/bulkOperationsUtil';
import { ProjectFieldMappings } from '../types/ProjectFieldMappings';
import FieldMappingPanel, { FieldMappingsState, nilFieldMappingsState } from './FieldMappingPanel';
import targetProjectFieldsModel from 'src/controller/TargetProjectFieldsModel';
import { IssueSelectionPanel } from '../widget/IssueSelectionPanel';
import bulkOperationRuleEnforcer from 'src/extension/bulkOperationRuleEnforcer';
import { allowBulkEditsFromMultipleProjects, allowBulkMovesFromMultipleProjects, subtaskMoveStrategy, enableTheAbilityToBulkChangeResolvedIssues, advancedFilterModeEnabled, filterModeDefault, showLabelsSelect } from '../extension/bulkOperationStaticRules';
import { BulkOperationMode } from 'src/types/BulkOperationMode';
import IssueTypeMappingPanel from './IssueTypeMappingPanel';
import { ObjectMapping } from 'src/types/ObjectMapping';
import bulkIssueTypeMappingModel from 'src/model/bulkIssueTypeMappingModel';
import { renderPanelMessage } from 'src/widget/PanelMessage';
import { WaitingMessageBuilder } from 'src/controller/WaitingMessageBuilder';
import PanelHeader from 'src/widget/PanelHeader';
import { CompletionState } from 'src/types/CompletionState';
import { FieldEditsPanel } from './FieldEditsPanel';
import editedFieldsModel from 'src/model/editedFieldsModel';
import { MoveOrEditPanel } from './MoveOrEditPanel';
import { Activity } from 'src/types/Activity';
import { StepName } from 'src/model/BulkOperationsWorkflow';
import FileUploadPanel from './FileUploadPanel';
import { BulkOpsModel, CompletionStateChangeInfo } from 'src/model/BulkOpsModel';
import ImportColumnMappingPanel from './ImportColumnMappingPanel';
import ImportIssuesPanel from './ImportIssuesPanel';
import ImportProjectAndIssueTypeSelectionPanel from './ImportProjectAndIssueTypeSelectionPanel';
import importModel from 'src/model/importModel';
import { bulkImportEnabled } from 'src/model/config';
import { InvocationResult } from 'src/types/InvocationResult';
import { FilterPanel } from './FilterPanel';
import { IssueSelectionState } from 'src/types/IssueSelectionState';
import { IssueSelectionValidity } from 'src/types/IssueSelectionValidity';
import { equalIssueSelections, newIssueSelectionUuid, selectionToString } from 'src/model/issueSelectionUtil';

const showDebug = false;
const showCompletionStateDebug = false;
const selectAllIssueTypesWhenNoneAreSelected = false;
const autoShowFieldMappings = true;

export type BulkOperationPanelProps<StepNameSubtype extends StepName> = {
  bulkOperationMode: BulkOperationMode;
  bulkOpsModel: BulkOpsModel<StepNameSubtype>;
}

type DebugInfo = {
  projects: Project[];
  issueTypes: IssueType[];
}

const BulkOperationPanel = (props: BulkOperationPanelProps<any>) => {

  const [stepNamesToCompletionStates, setStepNamesToCompletionStates] = useState<ObjectMapping<CompletionState>>({});
  const [modelUpdateTimestamp, setLastModelUpdateTime] = useState<number>(0);
  const [stepSequence, setStepSequence] = useState<StepName[]>([])
  const [bulkOperationMode, setBulkOperationMode] = useState<BulkOperationMode>(props.bulkOperationMode);
  const [mainWarningMessage, setMainWarningMessage] = useState<string>('');
  const [lastDataLoadTime, setLastDataLoadTime] = useState<number>(0);
  const [allIssueTypes, setAllIssueTypes] = useState<IssueType[]>([]);
  const [issueLoadingState, setIssueLoadingState] = useState<LoadingState>('idle');
  const [selectedToProject, setSelectedToProject] = useState<undefined | Project>(undefined);
  const [selectedToProjectTime, setSelectedToProjectTime] = useState<number>(0);
  const [issueSearchInfo, setIssueSearchInfo] = useState<IssueSearchInfo>(nilIssueSearchInfo);
  const [issueSearchInfoTime, setIssueSearchInfoTime] = useState<number>(0);
  const [issueSelectionState, setIssueSelectionState] = useState<IssueSelectionState>({uuid: newIssueSelectionUuid(), selectedIssues: [], selectionValidity: 'invalid-no-issues-selected'})
  const [selectedIssuesTime, setSelectedIssuesTime] = useState<number>(0);
  const [allIssueTypesMapped, setAllIssueTypesMapped] = useState<boolean>(false);
  const [allDefaultValuesProvided, setAllDefaultValuesProvided] = useState<boolean>(false);
  const [currentFieldMappingActivity, setCurrentFieldMappingActivity] = useState<undefined | Activity>(undefined);
  const [selectableIssueTypes, setSelectableIssueTypes] = useState<IssueType[]>([]);
  const [fieldIdsToValuesTime, setFieldIdsToValuesTime] = React.useState<number>(0);
  const [fieldMappingsComplete, setFieldMappingsComplete] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({ projects: [], issueTypes: [] });

  // Don't use the following to trigger rendering. i.e. child components shouldn't have a useEffect dependent on this.
  const fieldMappingsState = useRef<FieldMappingsState>(nilFieldMappingsState);

  useEffect(() => {
    setBulkOperationMode(props.bulkOperationMode);
  }, [props.bulkOperationMode]);

  const onEditedFieldsModelChange = (fieldId: string, value: any) => {
    setFieldIdsToValuesTime(Date.now());
  }

  const onImportModelStepCompletionStateChange = (completionStateChangeInfo: CompletionStateChangeInfo) => {
    const stepName = completionStateChangeInfo.stepName;
    const completionState = completionStateChangeInfo.completionState;
    console.log(`BulkOperationPanel.onImportModelStepCompletionStateChange: step "${stepName}" is now "${completionState}"`);
    setStepNamesToCompletionStates(prevState => ({
      ...prevState,
      [stepName]: completionState
    }));
  }

  const onModelUpdateChange = (modelUpdateTimestamp: number) => {
    setLastModelUpdateTime(modelUpdateTimestamp);
  }

  useEffect(() => {
    editedFieldsModel.registerValueEditsListener(onEditedFieldsModelChange);
    props.bulkOpsModel.registerStepCompletionStateChangeListener(onImportModelStepCompletionStateChange);
    props.bulkOpsModel.registerModelUpdateChangeListener(onModelUpdateChange);
    return () => {
      editedFieldsModel.unregisterValueEditsListener(onEditedFieldsModelChange);
      props.bulkOpsModel.unregisterStepCompletionStateChangeListener(onImportModelStepCompletionStateChange);
      props.bulkOpsModel.unregisterModelUpdateChangeListener(onModelUpdateChange);
    };
  }, []);

  const setIssueMoveOutcome = (issueMoveOutcome: undefined | TaskOutcome) => {
    // Do nothing - this is now obsolte
  }

  const isStepApplicableToBulkOperationMode = (stepName: StepName): boolean => {
    const bulkOperationMode = props.bulkOperationMode;
    const stepSequence = props.bulkOpsModel.getStepSequence();
    if (!stepSequence) {
      console.warn(`BulkOperationPanel: isStepApplicableToBulkOperationMode: No step sequence defined for bulk operation mode "${bulkOperationMode}".`);
      return false;
    }
    const stepIndex = stepSequence.indexOf(stepName);
    return stepIndex >= 0;
  }

  const defineSteps = () => {
    const stepSequence = props.bulkOpsModel.getStepSequence();
    setStepSequence(stepSequence);
  }

  const setStepCompletionState = (stepName: StepName, completionState: CompletionState) => {
    setStepNamesToCompletionStates(prevState => ({
      ...prevState,
      [stepName]: completionState
    }));
  }

  const onEditsValidityChange = (valid: boolean) => {
    setStepCompletionState('edit-fields', valid ? 'complete' : 'incomplete');
  }

  const getStepCompletionState = (stepName: StepName): CompletionState => {
    return stepNamesToCompletionStates[stepName];
  }

  const arePrerequisiteStepsComplete = (priorToStepName: StepName): boolean => {
    let complete = true;
    for (const stepName of stepSequence) {
      if (stepName === priorToStepName) {
        break; // Stop checking once we reach the step we're interested in
      }
      const completionState = stepNamesToCompletionStates[stepName];
      if (isStepApplicableToBulkOperationMode(stepName)) {
        if (completionState !== 'complete') {
          complete = false;
          break;
        }
      }
    }
    return complete;
  }

  const renderStepCompletionState = (): JSX.Element => {
    const renderedStates = stepSequence.map((stepName: StepName) => {
      const completionState = stepNamesToCompletionStates[stepName];
      return (
        <li key={stepName}>
          {`${stepName}: `} 
          {isStepApplicableToBulkOperationMode(stepName) ? completionState === 'complete' ? 'COMPLETE' : 'INCOMPLETE' : 'N/A'}
        </li>
      );
    });
    return (
      <div>
        <ul>
          {renderedStates}
        </ul>
      </div>
    );
  }

  const clearFieldMappingsState = () => {
    fieldMappingsState.current = nilFieldMappingsState;
    targetProjectFieldsModel.setProjectFieldMappings(nilFieldMappingsState.projectFieldMappings);
  }

  const isFieldMappingsComplete = () => {
    const allFieldValuesSet = targetProjectFieldsModel.areAllFieldValuesSet();
    return fieldMappingsState.current.dataRetrieved && allFieldValuesSet;
  }

  const retrieveAndSetDebugInfo = async (): Promise<void> => {
    const projectSearchInfo = await jiraDataModel.pageOfProjectSearchInfo();
    const issueTypesInvocationResult: InvocationResult<IssueType[]> = await jiraDataModel.getIssueTypes();
    const debugInfo: DebugInfo = {
      projects: projectSearchInfo.values,
      issueTypes: issueTypesInvocationResult.ok ? issueTypesInvocationResult.data : []
    }
    setDebugInfo(debugInfo);
  }

  const initialiseSelectedIssueTypes = async (allowedRetryCount: number): Promise<void> => {
    const issueTypesInvocationResult: InvocationResult<IssueType[]> = await jiraDataModel.getIssueTypes();
    if (issueTypesInvocationResult.ok) {
      const allIssueTypes = issueTypesInvocationResult.data;
      setAllIssueTypes(allIssueTypes);
      setLastDataLoadTime(Date.now());
    } else if (allowedRetryCount > 0) {
      console.warn(`BulkOperationPanel: initialiseSelectedIssueTypes: Error retrieving issue types: ${issueTypesInvocationResult.errorMessage}`);
      // Delay and retry...
      setTimeout(() => initialiseSelectedIssueTypes(allowedRetryCount - 1), 2000);
    } else {
      console.error(`BulkOperationPanel: initialiseSelectedIssueTypes: Max retries exceeded: ${issueTypesInvocationResult.errorMessage}`);
    }
  }

  useEffect(() => {
    defineSteps();
    // updateAllProjectInfo();
    initialiseSelectedIssueTypes(2);
    if (showDebug) {
      retrieveAndSetDebugInfo();
    }
  }, []);

  const filterProjectsForToSelection = async (projectsToFilter: Project[]): Promise<Project[]> => {
    const allowableToProjects = await bulkOperationRuleEnforcer.filterTargetProjects(issueSelectionState.selectedIssues, projectsToFilter);
    return allowableToProjects;
  }

  const onClearMainWarningMessage = () => {
    setMainWarningMessage('');
  }

  const computeSelectionValidity = (selectedIssues: Issue[]): IssueSelectionValidity => {
    if (selectedIssues.length === 0) {
      return "invalid-no-issues-selected";
    }
    const multipleProjectsDetected = jiraUtil.countProjectsByIssues(selectedIssues) > 1;
    const multipleIssueTypesDetected = jiraUtil.countIssueTypesByIssues(selectedIssues) > 1;
    if (props.bulkOperationMode === 'Move' && !allowBulkMovesFromMultipleProjects) {
      // Don't allow moves from multiple projects
      if (multipleProjectsDetected) {
        return "multiple-projects";
      }
    }
    if (props.bulkOperationMode === 'Move') {
      // Don't allow multiple issue types to be selected when moving issues
      if (multipleIssueTypesDetected) {
        return "multiple-issue-types";
      }
    }
    if (props.bulkOperationMode === 'Edit' && !allowBulkEditsFromMultipleProjects) {
      // Don't allow edits from multiple projects
      if (multipleProjectsDetected) {
        return "multiple-projects";
      }
    }
    if (props.bulkOperationMode === 'Edit') {
      // Don't allow multiple issue types to be selected when editing issues
      if (multipleIssueTypesDetected) {
        return "multiple-issue-types";
      }
    }
    if (subtaskMoveStrategy === 'issues-with-subtasks-can-not-be-moved' && props.bulkOperationMode === 'Move') {
      const issuesWithSubtasks = jiraUtil.getIssuesWithSubtasks(selectedIssues);
      if (issuesWithSubtasks.length > 0) {
        return "invalid-subtasks-selected";
      }
    }
    return "valid";
  }

  const onIssuesLoaded = async (allSelected: boolean, newIssueSearchInfo: IssueSearchInfo) => {
    const newlySelectedIssues = newIssueSearchInfo.issues;
    const newIssueSelectionState: IssueSelectionState = {
      uuid: newIssueSelectionUuid(),
      selectedIssues: newlySelectedIssues,
      selectionValidity: computeSelectionValidity(newlySelectedIssues)
    }
    // console.log(`BulkOperationPanel.onIssuesLoaded: new issue selection state = ${selectionToString(newIssueSelectionState)}`);
    setIssueSelectionState(newIssueSelectionState);
    setSelectedIssuesTime(Date.now());
    // console.log(`BulkOperationPanel: onIssuesLoaded: newlySelectedIssues = ${newlySelectedIssues.map(issue => issue.key).join(', ')}`);
    await targetProjectFieldsModel.setSelectedIssues(newlySelectedIssues, allIssueTypes);
    setIssueSearchInfo(newIssueSearchInfo);
    setIssueSearchInfoTime(Date.now());
    setLastDataLoadTime(Date.now());
    clearFieldMappingsState();
    setStepCompletionState('issue-selection', newIssueSelectionState.selectionValidity === 'valid' ? 'complete' : 'incomplete');
    updateMappingsCompletionStates();
  }

  const updateMappingsCompletionStates = (): void => {
    const fieldMappingsComplete = isFieldMappingsComplete();
    setFieldMappingsComplete(fieldMappingsComplete);
    setStepCompletionState('field-mapping', fieldMappingsComplete ? 'complete' : 'incomplete');
  }

  const onIssuesSelectionChange = async (newIssueSelectionState: IssueSelectionState): Promise<void> => {
    // console.log(`BulkOperationPanel.onIssuesSelectionChange: new issue selection state = ${selectionToString(newIssueSelectionState)}`);
    setIssueSelectionState(newIssueSelectionState);
    setSelectedIssuesTime(Date.now());
    await targetProjectFieldsModel.setSelectedIssues(newIssueSelectionState.selectedIssues, allIssueTypes);
    // Clear downstream state...
    clearStepStateAfter('issue-selection');
    setStepCompletionState('issue-selection', newIssueSelectionState.selectionValidity === 'valid' ? 'complete' : 'incomplete');
  }

  // This routine clears the state of the current step and downstream steps. However, the import 
  // steps do not take advantage of this yet.
  const clearStepState = (stepName: StepName) => {
    // console.log(`BulkOperationPanel.clearStepState: Clearing state for step "${stepName}"`);
    let stateShouldBecomeIncomplete = true;
    if (stepName === 'filter') {
      // Do nothing
    } else if (stepName === 'issue-selection') {
      const newIssueSelectionState: IssueSelectionState = {uuid: newIssueSelectionUuid(), selectedIssues: [], selectionValidity: 'invalid-no-issues-selected'};
      // console.log(`BulkOperationPanel.clearStepState: new issue selection state = ${selectionToString(newIssueSelectionState)}`);
      setIssueSelectionState(newIssueSelectionState);
      setSelectedIssuesTime(Date.now());
    } else if (stepName === 'target-project-selection') {
      setSelectedToProject(undefined);
      setSelectedToProjectTime(Date.now());
    } else if (stepName === 'issue-type-mapping') {
      bulkIssueTypeMappingModel.clearMappings();
      fieldMappingsState.current.projectFieldMappings.targetIssueTypeIdsToMappings.clear();
    } else if (stepName === 'edit-fields') {
      // No need to clear edited fields as this would be annoying for the user.
      stateShouldBecomeIncomplete = false;
    } else if (stepName === 'field-mapping') {
      targetProjectFieldsModel.clearDefaultFieldValues();
    } else if (stepName === 'move-or-edit') {
      setIssueMoveOutcome(undefined);
    } else if (stepName === 'file-upload') {
      // This is yet to be implemented
    } else if (stepName === 'column-mapping') {
      // This is yet to be implemented
    } else if (stepName === 'project-and-issue-type-selection') {
      // This is yet to be implemented
    } else if (stepName === 'import-issues') {
      // This is yet to be implemented
    } else {
      console.warn(`BulkOperationPanel.clearStepState: No action defined for step "${stepName}".`);
    }
    if (stateShouldBecomeIncomplete) {
      setStepCompletionState(stepName, 'incomplete');
    }
    clearStepStateAfter(stepName);
  }

  const clearStepStateAfter = (stepName: StepName) => {
    const nextDownstreamStep = props.bulkOpsModel.getNextDownstreamStep(stepName);
    if (nextDownstreamStep) {
      clearStepState(nextDownstreamStep);
    }
  }

  const onIssueSearchInitiated = async (): Promise<void> => {
    setStepCompletionState('filter', 'incomplete');
    // Clear downstream state...
    clearStepStateAfter('filter');
  }

  const onIssueSearchCompleted = async (issueSearchInfo: IssueSearchInfo): Promise<void> => {
    clearStepStateAfter('filter');

    if (issueSearchInfo.errorMessages && issueSearchInfo.errorMessages.length) {
      const joinedErrors = issueSearchInfo.errorMessages.join( );
      setMainWarningMessage(joinedErrors);
    } else {
      await onIssuesLoaded(true, issueSearchInfo);
    }
    const issueCount = issueSearchInfo.issues.length;
    setStepCompletionState('filter', issueCount > 0 ? 'complete' : 'incomplete');
    setIssueLoadingState('idle');
  }
  
  const updateFieldMappingState = async (selectedargetProject: Project) => {
    updateFieldMappingsIfNeeded(selectedargetProject);
    await targetProjectFieldsModel.setSelectedIssues(issueSelectionState.selectedIssues, allIssueTypes);
    setStepCompletionState('field-mapping', isFieldMappingsComplete() ? 'complete' : 'incomplete');
    setStepCompletionState('target-project-selection', selectedargetProject ? 'complete' : 'incomplete');
    updateMappingsCompletionStates();
  }

  const onToProjectSelect = async (selectedProject: undefined | Project): Promise<void> => {
    // console.log(`selectedToProject: `, selectedProject);
    setSelectedToProject(selectedProject);
    setSelectedToProjectTime(Date.now());
    // Clear downstream state...
    clearStepStateAfter('target-project-selection');
    // Automatically update field mappings if possible
    await updateFieldMappingState(selectedProject);
  }

  const buildFieldMappingsState = async (selectedToProject: undefined | Project): Promise<FieldMappingsState> => {
    if (!selectedToProject) {
      return nilFieldMappingsState; 
    }
    setCurrentFieldMappingActivity({taskId: 'non-jira-activity', description: 'Checking for mandatory fields...'});
    try {
      // KNOWN-7: Bulk move operations only allow values to be specified for required custom fields.
      const onlyIncludeCustomFields = true;
      const onlyIncludeRequiredFields = true;
      const projectFieldMappings: DataRetrievalResponse<ProjectFieldMappings> = await buildFieldMappingsForProject(
        selectedToProject.id,
        onlyIncludeCustomFields,
        onlyIncludeRequiredFields
      );
      if (projectFieldMappings.errorMessage) {
        console.warn(`BulkOperationPanel: validateMandatoryFieldsAreFilled: Error retrieving field options: ${projectFieldMappings.errorMessage}`);
        return nilFieldMappingsState;
      } else if (projectFieldMappings.data) {
        const fieldMappingsState: FieldMappingsState = {
          dataRetrieved: true,
          project: selectedToProject,
          projectFieldMappings: projectFieldMappings.data
        }
        return fieldMappingsState;
      } else {
        throw new Error(`BulkOperationPanel: validateMandatoryFieldsAreFilled: No data retrieved for field options.`);
      }
    } finally {
      setCurrentFieldMappingActivity(undefined);
    }
  }

  const onInitiateFieldValueMapping = async (selectedToProject: Project): Promise<void> => {
    const newFieldMappingsState = await buildFieldMappingsState(selectedToProject);
    fieldMappingsState.current = newFieldMappingsState;
    targetProjectFieldsModel.setProjectFieldMappings(newFieldMappingsState.projectFieldMappings);
  }

  const updateFieldMappingsIfNeeded = async (selectedToProject: undefined | Project): Promise<void> => {
    if (autoShowFieldMappings) {
      if (selectedToProject) {
        await onInitiateFieldValueMapping(selectedToProject);
      } else {
        fieldMappingsState.current = nilFieldMappingsState;
      }
    }
  }

  const onAllDefaultValuesProvided = async (allDefaultValuesProvided: boolean): Promise<void> => {
    // console.log(`BulkOperationPanel: onAllDefaultValuesProvided: ${allDefaultValuesProvided}`);
    setAllDefaultValuesProvided(allDefaultValuesProvided);
    await updateFieldMappingState(selectedToProject);
  }

  const onIssueTypeMappingChange = async (
    thisIssueSelectionState: IssueSelectionState,
    originalMappingCount: number,
    newMappingCount: number,
  ): Promise<void> => {
    if (equalIssueSelections(thisIssueSelectionState, issueSelectionState)) {
      // console.log(`BulkOperationPanel.onIssueTypeMappingChange: Received onIssueTypeMappingChange with the current issue selection state.`);
      // const allIssuesAreMapped = bulkIssueTypeMappingModel.areAllIssueTypesMapped(issueSelectionState.selectedIssues);
      // console.log(`BulkOperationPanel.onIssueTypeMappingChange:\n * originalMappingCount = ${originalMappingCount};\n * newMappingCount = ${newMappingCount};\n * allIssuesAreMapped = ${allIssuesAreMapped};\n * selectedIssues = ${issueSelectionState.selectedIssues.map(issue => issue.key).join(', ')};`);
      await targetProjectFieldsModel.setSelectedIssues(issueSelectionState.selectedIssues, allIssueTypes);
      const allIssueTypesMapped = bulkIssueTypeMappingModel.areAllIssueTypesMapped(issueSelectionState.selectedIssues);
      setAllIssueTypesMapped(allIssueTypesMapped);
      const issueTypeMappingCompletionState = issueSelectionState.selectionValidity === 'valid' && allIssueTypesMapped ? 'complete' : 'incomplete';
      setStepCompletionState('issue-type-mapping', issueTypeMappingCompletionState);
      await updateFieldMappingState(selectedToProject);
    } else {
      // console.log(`BulkOperationPanel.onIssueTypeMappingChange: Received onIssueTypeMappingChange with a stale issue selection state.`);
    }
  }

  const renderToProjectSelect = () => {
    const allowSelection = issueSelectionState.selectionValidity === 'valid';
    const targetProjectsFilterConditionsChangeTime = selectedIssuesTime;
    return (
      <FormSection>
        <ProjectsSelect 
          key={`to-project-select-${selectedIssuesTime}`}
          label="To project"
          isMulti={false}
          isClearable={false}
          isDisabled={!allowSelection}
          selectedProjects={[selectedToProject]}
          filterProjects={filterProjectsForToSelection}
          targetProjectsFilterConditionsChangeTime={targetProjectsFilterConditionsChangeTime}
          menuPortalTarget={document.body}
          onProjectsSelect={async (selected: Project[]): Promise<void> => {
            // console.log(`Selected to projects: ${JSON.stringify(selected, null, 2)}`);
            const selectedToProject: undefined | Project = selected.length > 0 ? selected[0] : undefined;
            onToProjectSelect(selectedToProject);
          }}
        />
      </FormSection>
    );
  }

  const renderFileUploadPanel = (stepNumber: number) => {
    const completionState = getStepCompletionState('file-upload');
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label={`File upload`}
            completionState={completionState}
          />
          <div className="step-panel-content-container">
            <FileUploadPanel
              disabled={!bulkImportEnabled}
              completionState={completionState}
            />
          </div>
        </div>
      </div>
    );
  }

  const renderProjectAndIssueTypeSelectionPanel = (stepNumber: number) => {
    const fileUploadCompletionState = getStepCompletionState('file-upload');
    const projectAndIssueTypeSelectionCompletionState = getStepCompletionState('project-and-issue-type-selection');
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label={`Target project selection`}
            completionState={projectAndIssueTypeSelectionCompletionState}
          />
          <div className="step-panel-content-container">
            <ImportProjectAndIssueTypeSelectionPanel
              fileUploadCompletionState={fileUploadCompletionState}
              projectAndIssueTypeSelectionCompletionState={projectAndIssueTypeSelectionCompletionState}
              modelUpdateTimestamp={modelUpdateTimestamp}
            />
          </div>
        </div>
      </div>
    );
  }

  const renderColumnMappingPanel = (stepNumber: number) => {
    const importProjectCompletionState = getStepCompletionState('project-and-issue-type-selection');
    const columnMappingCompletionState = getStepCompletionState('column-mapping');
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label={`Column mapping`}
            completionState={columnMappingCompletionState}
          />
          <div className="step-panel-content-container">
            <ImportColumnMappingPanel
              importProjectCompletionState={importProjectCompletionState}
              columnMappingCompletionState={columnMappingCompletionState}
              selectedIssueType={importModel.getSelectedIssueType()}
              createIssueMetadata={importModel.getSelectedProjectCreateIssueMetadata()}
              modelUpdateTimestamp={modelUpdateTimestamp}
            />
          </div>
        </div>
      </div>
    );
  }

  const renderImportIssuesPanel = (stepNumber: number) => {
    const columnMappingCompletionState = getStepCompletionState('column-mapping');
    const importIssuesCompletionState = getStepCompletionState('import-issues');
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label={`Import work items`}
            completionState={importIssuesCompletionState}
          />
          <div className="step-panel-content-container">
            <ImportIssuesPanel
              columnMappingCompletionState={columnMappingCompletionState}
              importIssuesCompletionState={importIssuesCompletionState}
              modelUpdateTimestamp={modelUpdateTimestamp}
            />
          </div>
        </div>
      </div>
    );
  }

  const renderFilterPanel = (stepNumber: number) => {
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label={`Find work items to ${bulkOperationMode.toLowerCase()}`}
            completionState={getStepCompletionState('filter')}
          />
          <FilterPanel
            bulkOperationMode={bulkOperationMode}
            allIssueTypes={allIssueTypes}
            selectAllIssueTypesWhenNoneAreSelected={selectAllIssueTypesWhenNoneAreSelected}
            onIssueSearchInitiated={onIssueSearchInitiated}
            onIssueSearchCompleted={onIssueSearchCompleted}
          />
        </div>
      </div>
    );
  }

  const renderFieldMappingIndicator = () => {
    return null;
  }

  const renderIssuesPanel = (stepNumber: number) => {
    const hasIssues = issueSearchInfo.issues.length > 0;
    const waitingMessage = new WaitingMessageBuilder()
      .addCheck(arePrerequisiteStepsComplete('issue-selection'), 'Waiting for previous step to be completed.')
      .build();
    let panelLabel = `Select work items to ${bulkOperationMode.toLowerCase()}`;
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label={panelLabel}
            completionState={getStepCompletionState('issue-selection')}
          />
          {renderPanelMessage(waitingMessage, {marginTop: '20px', marginBottom: '20px'})}
          <IssueSelectionPanel
            loadingState={issueLoadingState}
            issueSearchInfo={issueSearchInfo}
            selectedIssues={issueSelectionState.selectedIssues}
            bulkOperationMode={bulkOperationMode}
            computeSelectionValidity={computeSelectionValidity}
            onIssuesSelectionChange={onIssuesSelectionChange}
          />
        </div>
      </div>
    );
  }

  const renderStartFieldValueMappingsButton = () => {
    const buttonEnabled = selectedToProject && selectedToProject.id && issueSelectionState.selectedIssues.length > 0;
    return (
      <Button
        appearance={fieldMappingsState.current.dataRetrieved ? 'default' : 'primary'}
        isDisabled={!buttonEnabled}
        onClick={() => {
          onInitiateFieldValueMapping(selectedToProject);
        }}
      >
        Start field value mapping
      </Button>
    );
  }

  const renderTargetProjectPanel = (stepNumber: number) => {
    const waitingMessage = new WaitingMessageBuilder()
      .addCheck(arePrerequisiteStepsComplete('target-project-selection'), 'Waiting for previous steps to be completed.')
      .addCheck(issueSelectionState.selectionValidity === 'valid', 'A valid set of work items has not yet been selected.')
      .build();
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label="Select target project"
            completionState={getStepCompletionState('target-project-selection')}
          />
          {renderPanelMessage(waitingMessage, {marginTop: '20px', marginBottom: '20px'})}
          {renderToProjectSelect()}
        </div>
      </div>
    );
  }

  const renderStartFieldMappingButton = () => {
    if (autoShowFieldMappings) {
      return null;
    } else {
      return (
        <FormSection>
          {renderStartFieldValueMappingsButton()}
        </FormSection>
      );
    }
  }

  const renderIssueTypeMappingPanel = (stepNumber: number) => {
    const waitingMessage = new WaitingMessageBuilder()
      .addCheck(arePrerequisiteStepsComplete('issue-type-mapping'), 'Waiting for previous steps to be completed.')
      .build();
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label="Work item type mapping"
            // completionState={'incomplete'}
            completionState={getStepCompletionState('issue-type-mapping')}
          />
          {renderPanelMessage(waitingMessage, {marginTop: '20px', marginBottom: '20px'})}
          {renderStartFieldMappingButton()}
          {renderFieldMappingIndicator()}
          <IssueTypeMappingPanel
            allIssueTypes={allIssueTypes}
            issueSelectionState={issueSelectionState}
            targetProject={selectedToProject}
            bulkOperationMode={bulkOperationMode}
            filterIssueTypes={bulkOperationRuleEnforcer.filterIssueTypes}
            onIssueTypeMappingChange={onIssueTypeMappingChange}
          />
        </div>
      </div>
    );
  }

  const renderFieldValueMappingsPanel = (stepNumber: number) => {
    const waitingMessage = new WaitingMessageBuilder()
      .addCheck(arePrerequisiteStepsComplete('field-mapping'), 'Waiting for previous steps to be completed.')
      .build();
    const issueTypeMappingStepCompletionState = getStepCompletionState('issue-type-mapping');
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label="Map work item field values"
            completionState={getStepCompletionState('field-mapping')}
          />
          {renderPanelMessage(waitingMessage, {marginTop: '20px', marginBottom: '20px'})}
          {renderStartFieldMappingButton()}
          {renderFieldMappingIndicator()}
          <FieldMappingPanel
            bulkOperationMode={bulkOperationMode}
            issueTypeMappingStepCompletionState={issueTypeMappingStepCompletionState}
            allIssueTypes={allIssueTypes}
            issues={issueSelectionState.selectedIssues}
            targetProject={selectedToProject}
            fieldMappingsState={fieldMappingsState.current}
            showDebug={showDebug}
            onAllDefaultValuesProvided={onAllDefaultValuesProvided}
          />
        </div>
      </div>
    );
  }

  const renderEditFieldsPanel = (stepNumber: number) => {
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label={`Set work item field values`}
            completionState={getStepCompletionState('edit-fields')}
          />
          <FieldEditsPanel
            issueSelectionState={issueSelectionState}
            selectedIssuesTime={issueSearchInfoTime}
            onEditsValidityChange={onEditsValidityChange}
          />
        </div>
      </div>
    );
  }

  const renderMoveOrEditPanel = (stepNumber: number) => {
    const lastInputConditionsChangeTime = Math.max(
      selectedToProjectTime,
      selectedIssuesTime,
      fieldIdsToValuesTime
    );
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label={`${bulkOperationMode} work items`}
            completionState={getStepCompletionState('move-or-edit')}
          />
          <MoveOrEditPanel
            bulkOperationMode={bulkOperationMode}
            fieldMappingsComplete={fieldMappingsComplete}
            issueSelectionState={issueSelectionState}
            selectedToProject={selectedToProject}
            allDefaultValuesProvided={allDefaultValuesProvided}
            lastInputConditionsChangeTime={lastInputConditionsChangeTime}
            onSetStepCompletionState={setStepCompletionState}
            onSetMainWarningMessage={setMainWarningMessage}
          />
        </div>
      </div>
    );
  }


  const renderDebugPanel = () => {
    const projectsToIssueTypes: {} = {};
    if (debugInfo.projects && debugInfo.projects.length) {
      for (const project of debugInfo.projects) {
        const issueTypes = jiraUtil.filterProjectIssueTypes(project, debugInfo.issueTypes);
        for (const issueType of issueTypes) {
          const issueTypeRepresentation = `${issueType.name} (${issueType.id})`;
          if (projectsToIssueTypes[project.name]) {
            projectsToIssueTypes[project.name].push(issueTypeRepresentation);
          } else {
            projectsToIssueTypes[project.name] = [issueTypeRepresentation];
          }
        }
      }
    }
    const renderedProjectsTossueTypes = Object.keys(projectsToIssueTypes).map((projectName: string) => {
      return (
        <li key={projectName}>
          <strong>{projectName}</strong>: {projectsToIssueTypes[projectName].join(', ')}
        </li>
      );
    });

    if (showDebug) {
      return (
        <div className="debug-panel">
          <h3>Debug</h3>

          <h4>Projects to issue types</h4>
          <ul>
            {renderedProjectsTossueTypes}
          </ul>

          <h4>Selected issue types</h4>

          <h4>Projects</h4>
          <pre>
            {JSON.stringify(debugInfo.projects, null, 2)}
          </pre>

          <h4>Work item types</h4>
          <pre>
            {JSON.stringify(debugInfo.issueTypes, null, 2)}
          </pre>

        </div>
      );
    } else {
      return null;
    }
  }

  const rendermainWarningMessage = () => {
    if (mainWarningMessage) {
      return (
        <div className="warning-banner">
          <div
            className="fake-button"
            style={{border: '1px solid #ccc'}}
            onClick={() => {
              onClearMainWarningMessage();
            }}
            >
            Clear
          </div>
          <div>
            {mainWarningMessage}              
          </div>
        </div>
      );
    } else {
      return null;
    }
  }

  let lastStepNumber = 1;
  return (
    <div>
      <h3>Bulk {bulkOperationMode} Work Items</h3>
      {showCompletionStateDebug ? renderStepCompletionState() : null}
      {rendermainWarningMessage()}
      <div className="bulk-move-main-panel">
        {isStepApplicableToBulkOperationMode('file-upload') ? renderFileUploadPanel(lastStepNumber++) : null}
        {isStepApplicableToBulkOperationMode('project-and-issue-type-selection') ? renderProjectAndIssueTypeSelectionPanel(lastStepNumber++) : null}
        {isStepApplicableToBulkOperationMode('column-mapping') ? renderColumnMappingPanel(lastStepNumber++) : null}
        {isStepApplicableToBulkOperationMode('import-issues') ? renderImportIssuesPanel(lastStepNumber++) : null}
        {isStepApplicableToBulkOperationMode('filter') ? renderFilterPanel(lastStepNumber++) : null}
        {isStepApplicableToBulkOperationMode('issue-selection') ? renderIssuesPanel(lastStepNumber++) : null}
        {isStepApplicableToBulkOperationMode('target-project-selection') ? renderTargetProjectPanel(lastStepNumber++) : null}
        {isStepApplicableToBulkOperationMode('issue-type-mapping') ? renderIssueTypeMappingPanel(lastStepNumber++) : null}
        {isStepApplicableToBulkOperationMode('field-mapping') ? renderFieldValueMappingsPanel(lastStepNumber++) : null}
        {isStepApplicableToBulkOperationMode('edit-fields') ? renderEditFieldsPanel(lastStepNumber++) : null}
        {isStepApplicableToBulkOperationMode('move-or-edit') ? renderMoveOrEditPanel(lastStepNumber++) : null}
      </div>
      {renderDebugPanel()}
    </div>
  );
}

export default BulkOperationPanel;
