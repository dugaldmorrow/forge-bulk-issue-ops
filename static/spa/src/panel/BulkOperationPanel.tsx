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
import { allowBulkEditsFromMultipleProjects, allowBulkMovesFromMultipleProjects, subtaskMoveStrategy, enableTheAbilityToBulkChangeResolvedIssues, advancedFilterModeEnabled, filterModeDefault, showLabelsSelect, enablePanelExpansion } from '../extension/bulkOperationStaticRules';
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
import { Destructor } from 'src/types/Destructor';

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

  const [stepNamesToCompletionStates, setStepNamesToCompletionStates] = useState<ObjectMapping<CompletionState>>(props.bulkOpsModel.getStepNamesToCompletionStates());
  const [modelUpdateTimestamp, setLastModelUpdateTime] = useState<number>(0);
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
  const [expandedPanel, setExpandedPanel] = useState<StepName | null>(null);

  // Don't use the following to trigger rendering. i.e. child components shouldn't have a useEffect dependent on this.
  const fieldMappingsState = useRef<FieldMappingsState>(nilFieldMappingsState);
  
  useEffect(() => {
    return onMount();
  }, []);

  useEffect(() => {
    setBulkOperationMode(props.bulkOperationMode);
  }, [props.bulkOperationMode]);

  const onMount = (): void | Destructor => {
    // console.log(`BulkOperationPanel.onMount: Mounting BulkOperationPanel...`);
    // console.log(`BulkOperationPanel.onMount: stepNamesToCompletionStates = ${JSON.stringify(stepNamesToCompletionStates, null, 2)}`);
    initialiseSelectedIssueTypes(2);
    if (showDebug) {
      retrieveAndSetDebugInfo();
    }
    editedFieldsModel.registerValueEditsListener(onEditedFieldsModelChange);
    props.bulkOpsModel.registerStepCompletionStateChangeListener(onStepCompletionStateChange);
    props.bulkOpsModel.registerModelUpdateChangeListener(onModelUpdateChange);
    return () => {
      // console.log(`BulkOperationPanel.onMount: Unmounting BulkOperationPanel...`);
      editedFieldsModel.unregisterValueEditsListener(onEditedFieldsModelChange);
      props.bulkOpsModel.unregisterStepCompletionStateChangeListener(onStepCompletionStateChange);
      props.bulkOpsModel.unregisterModelUpdateChangeListener(onModelUpdateChange);
    };
  }

  const onEditedFieldsModelChange = (fieldId: string, value: any) => {
    setFieldIdsToValuesTime(Date.now());
  }

  const onStepCompletionStateChange = (completionStateChangeInfo: CompletionStateChangeInfo) => {
    const stepName = completionStateChangeInfo.stepName;
    const completionState = completionStateChangeInfo.completionState;
    // console.log(`BulkOperationPanel.onStepCompletionStateChange: step "${stepName}" is now "${completionState}"`);
    updateStepCompletionState(stepName, completionState, false);
    if (completionState === 'incomplete') {
      clearStepStateAfter(stepName);
    }
  }

  const onModelUpdateChange = (modelUpdateTimestamp: number) => {
    setLastModelUpdateTime(modelUpdateTimestamp);
  }

  const handlePanelExpand = (stepName: StepName) => {
    if (!enablePanelExpansion) return;
    setExpandedPanel(expandedPanel === stepName ? null : stepName);
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!enablePanelExpansion) return;
    if (e.target === e.currentTarget) {
      setExpandedPanel(null);
    }
  }

  // Handle keyboard events for accessibility
  useEffect(() => {
    if (!enablePanelExpansion) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (expandedPanel && e.key === 'Escape') {
        setExpandedPanel(null);
      }
    };

    if (expandedPanel) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when panel is expanded
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [expandedPanel]);

  const renderExpandablePanel = (stepName: StepName, stepNumber: number, label: string, children: React.ReactNode) => {
    const completionState = getRenderingStepCompletionState(stepName);
    const isExpanded = enablePanelExpansion && expandedPanel === stepName;
    
    const panelContent = (
      <div className="content-panel">
        <PanelHeader
          stepNumber={stepNumber}
          label={label}
          completionState={completionState}
          isExpanded={isExpanded}
          onExpandToggle={enablePanelExpansion ? () => handlePanelExpand(stepName) : undefined}
        />
        {children}
      </div>
    );

    if (enablePanelExpansion && isExpanded) {
      return (
        <div className="panel-overlay" onClick={handleOverlayClick}>
          <div className="panel-expanded">
            {panelContent}
          </div>
        </div>
      );
    }

    return (
      <div className={`padding-panel ${isExpanded ? 'expanded' : ''}`}>
        {panelContent}
      </div>
    );
  }

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

  const cloneStepNamesToCompletionStates = (): ObjectMapping<CompletionState> => {
    // console.log(`BulkOperationPanel.cloneStepNamesToCompletionStates: Cloning step names to completion states...`);
    const clonedStates: ObjectMapping<CompletionState> = {};
    for (const stepName of props.bulkOpsModel.getStepSequence()) {
      const newCompletionState = props.bulkOpsModel.getStepCompletionState(stepName);
      // const newCompletionState = stepNamesToCompletionStatesRef[stepName] === 'complete' ? 'complete' : 'incomplete';
      clonedStates[stepName] = newCompletionState;
    }
    return clonedStates;
  }

  const updateStepCompletionState = (stepName: StepName, completionState: CompletionState, updateModel: boolean = true): void => {
    // console.log(`BulkOperationPanel.updateStepCompletionState: Updating step "${stepName}" state from "${getStepCompletionState(stepName, false)}" to "${completionState}".`);
    if (updateModel) {
      props.bulkOpsModel.setStepCompletionState(stepName, completionState);
    }
    const newStepNamesToCompletionStates = cloneStepNamesToCompletionStates();
    newStepNamesToCompletionStates[stepName] = completionState;
    setStepNamesToCompletionStates(newStepNamesToCompletionStates);
  }

  const onEditsValidityChange = (valid: boolean) => {
    updateStepCompletionState('edit-fields', valid ? 'complete' : 'incomplete');
  }

  const getRenderingStepCompletionState = (stepName: StepName): CompletionState => {
    return getStepCompletionState(stepName, true);
  }

  const getStepCompletionState = (stepName: StepName, rendering: boolean): CompletionState => {
    if (rendering) {
      const state = stepNamesToCompletionStates[stepName] === 'complete' ? 'complete' : 'incomplete'; // guards against an undefined state
      return state;
    } else {
      return props.bulkOpsModel.getStepCompletionState(stepName);
    }
  }

  const arePrerequisiteStepsComplete = (priorToStepName: StepName, rendering: boolean): boolean => {
    let complete = true;
    const stepSequence = props.bulkOpsModel.getStepSequence();
    for (const stepName of stepSequence) {
      if (stepName === priorToStepName) {
        break; // Stop checking once we reach the step we're interested in
      }
      const completionState = getStepCompletionState(stepName, rendering);
      if (isStepApplicableToBulkOperationMode(stepName)) {
        if (completionState !== 'complete') {
          // console.log(`BulkOperationPanel.arePrerequisiteStepsComplete: Step "${stepName}" is not complete.`);
          complete = false;
          break;
        }
      }
    }
    return complete;
  }

  const renderStepCompletionState = (): JSX.Element => {
    const stepSequence = props.bulkOpsModel.getStepSequence();
    const renderedStates = stepSequence.map((stepName: StepName) => {
      return (
        <li key={stepName}>
          {`${stepName}: ${stepNamesToCompletionStates[stepName]}`}
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
    const allPreviousStepsComplete = arePrerequisiteStepsComplete('field-mapping', false);
    if (allPreviousStepsComplete) {
      const allFieldValuesSet = targetProjectFieldsModel.areAllFieldValuesSet();
      return fieldMappingsState.current.dataRetrieved && allFieldValuesSet;
    } else {
      // console.log(`BulkOperationPanel.isFieldMappingsComplete: Previous steps are not complete, so field mappings cannot be complete.`);
      return false;
    }
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
    // console.log(`BulkOperationPanel.onIssuesLoaded: allSelected = ${allSelected}, newIssueSearchInfo = ${newIssueSearchInfo.issues.map(issue => issue.key).join(', ')}`);
    const newlySelectedIssues = newIssueSearchInfo.issues;
    const newIssueSelectionState: IssueSelectionState = {
      uuid: newIssueSelectionUuid(),
      selectedIssues: newlySelectedIssues,
      selectionValidity: computeSelectionValidity(newlySelectedIssues)
    }
    // console.log(`BulkOperationPanel.onIssuesLoaded: new issue selection state = ${selectionToString(newIssueSelectionState)}`);
    setIssueSelectionState(newIssueSelectionState);
    setSelectedIssuesTime(Date.now());
    setIssueSearchInfo(newIssueSearchInfo);
    setIssueSearchInfoTime(Date.now());
    setLastDataLoadTime(Date.now());
    // console.log(`BulkOperationPanel.onIssuesLoaded: newlySelectedIssues = ${newlySelectedIssues.map(issue => issue.key).join(', ')}`);
    await targetProjectFieldsModel.setSelectedIssues(newlySelectedIssues, allIssueTypes);
    clearFieldMappingsState();
    updateStepCompletionState('issue-selection', newIssueSelectionState.selectionValidity === 'valid' ? 'complete' : 'incomplete');
    updateMappingsCompletionStates();
  }

  const updateMappingsCompletionStates = (): void => {
    const fieldMappingsComplete = isFieldMappingsComplete();
    // console.log(`BulkOperationPanel.updateMappingsCompletionStates: fieldMappingsComplete = ${fieldMappingsComplete}`);
    setFieldMappingsComplete(fieldMappingsComplete);
    updateStepCompletionState('field-mapping', fieldMappingsComplete ? 'complete' : 'incomplete');
  }

  const onIssuesSelectionChange = async (newIssueSelectionState: IssueSelectionState): Promise<void> => {
    // console.log(`BulkOperationPanel.onIssuesSelectionChange: new issue selection state = ${selectionToString(newIssueSelectionState)}`);
    setIssueSelectionState(newIssueSelectionState);
    setSelectedIssuesTime(Date.now());
    await targetProjectFieldsModel.setSelectedIssues(newIssueSelectionState.selectedIssues, allIssueTypes);
    // Clear downstream state...
    clearStepStateAfter('issue-selection');
    updateStepCompletionState('issue-selection', newIssueSelectionState.selectionValidity === 'valid' ? 'complete' : 'incomplete');
  }

  // This routine clears the state of the current step and downstream steps. However, the import 
  // steps do not take advantage of this yet.
  const clearStepState = (stepName: StepName) => {
    // console.log(`BulkOperationPanel.clearStepState: Clearing state for step "${stepName}"`);
    let stateShouldBecomeIncomplete = true;
    if (stepName === 'filter') {
      // Do nothing
    } else if (stepName === 'issue-selection') {
      const newIssueSelectionState: IssueSelectionState = {
        uuid: newIssueSelectionUuid(),
        selectedIssues: [],
        selectionValidity: 'invalid-no-issues-selected'
      };
      // console.log(`BulkOperationPanel.clearStepState: new issue selection state = ${selectionToString(newIssueSelectionState)}`);
      setIssueSelectionState(newIssueSelectionState);
      setSelectedIssuesTime(Date.now());
    } else if (stepName === 'target-project-selection') {
      setSelectedToProject(undefined);
      setSelectedToProjectTime(Date.now());
    } else if (stepName === 'issue-type-mapping') {
      bulkIssueTypeMappingModel.clearMappings();
    } else if (stepName === 'edit-fields') {
      fieldMappingsState.current.projectFieldMappings.targetIssueTypeIdsToMappings.clear();
      // No need to clear edited fields as this would be annoying for the user.
      stateShouldBecomeIncomplete = false;
    } else if (stepName === 'field-mapping') {
      targetProjectFieldsModel.clearDefaultFieldValues();
    } else if (stepName === 'move-or-edit') {
      setIssueMoveOutcome(undefined);
    } else if (stepName === 'file-upload') {
      stateShouldBecomeIncomplete = false;
    } else if (stepName === 'column-mapping') {
      // stateShouldBecomeIncomplete = false;
    } else if (stepName === 'project-and-issue-type-selection') {
      // stateShouldBecomeIncomplete = false;
    } else if (stepName === 'import-issues') {
      // stateShouldBecomeIncomplete = false;
    } else {
      console.warn(`BulkOperationPanel.clearStepState: No action defined for step "${stepName}".`);
    }
    if (stateShouldBecomeIncomplete) {
      // console.log(`BulkOperationPanel.clearStepState: Setting step "${stepName}" to "incomplete".`);
      updateStepCompletionState(stepName, 'incomplete');
    }
    clearStepStateAfter(stepName);
  }

  const clearStepStateAfter = (stepName: StepName) => {
    // console.log(`BulkOperationPanel.clearStepStateAfter: Clearing state after step "${stepName}"`);
    const nextDownstreamStep = props.bulkOpsModel.getNextDownstreamStep(stepName);
    if (nextDownstreamStep) {
      clearStepState(nextDownstreamStep);
    }
  }

  const onIssueSearchInitiated = async (): Promise<void> => {
    updateStepCompletionState('filter', 'incomplete');
    // Clear downstream state...
    clearStepStateAfter('filter');
  }

  const onIssueSearchCompleted = async (issueSearchInfo: IssueSearchInfo): Promise<void> => {
    clearStepStateAfter('filter');

    const issueCount = issueSearchInfo.issues.length;
    const newFilterStepCompletionState = issueCount > 0 ? 'complete' : 'incomplete';
    // console.log(`BulkOperationPanel.onIssueSearchCompleted: issueCount = ${issueCount}, newFilterStepCompletionState = ${newFilterStepCompletionState}`);
    updateStepCompletionState('filter', newFilterStepCompletionState);

    // KNOWN-18: Should handle the Jira API returning an error when searching for issues.
    // if (issueSearchInfo.errorMessages && issueSearchInfo.errorMessages.length) {
    //   const joinedErrors = issueSearchInfo.errorMessages.join( );
    //   setMainWarningMessage(joinedErrors);
    // } else {
      await onIssuesLoaded(true, issueSearchInfo);
    // }
    // const issueCount = issueSearchInfo.issues.length;
    // updateStepCompletionState('filter', issueCount > 0 ? 'complete' : 'incomplete');
    setIssueLoadingState('idle');
  }

  const updateFieldMappingState = async (selectedargetProject: Project) => {
    await updateFieldMappingsIfNeeded(selectedargetProject);
    await targetProjectFieldsModel.setSelectedIssues(issueSelectionState.selectedIssues, allIssueTypes);
    const fieldMappingComplete = isFieldMappingsComplete();
    // console.log(`BulkOperationPanel.updateFieldMappingState: fieldMappingComplete = ${fieldMappingComplete}`);
    // setStepCompletionState('field-mapping', fieldMappingComplete ? 'complete' : 'incomplete');
    // setStepCompletionState('target-project-selection', selectedargetProject ? 'complete' : 'incomplete');
    updateMappingsCompletionStates();
  }

  const onToProjectSelect = async (selectedProject: undefined | Project): Promise<void> => {
    // console.log(`selectedToProject: `, selectedProject);
    setSelectedToProject(selectedProject);
    setSelectedToProjectTime(Date.now());
    // Clear downstream state...
    clearStepStateAfter('target-project-selection');
    updateStepCompletionState('target-project-selection', selectedProject ? 'complete' : 'incomplete');
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
    // console.log(`BulkOperationPanel.onInitiateFieldValueMapping: newFieldMappingsState.projectFieldMappings.targetIssueTypeIdsToMappings.size = `, newFieldMappingsState.projectFieldMappings.targetIssueTypeIdsToMappings.size);
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
    // console.log(`BulkOperationPanel.onAllDefaultValuesProvided: ${allDefaultValuesProvided}`);
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
      await targetProjectFieldsModel.setSelectedIssues(issueSelectionState.selectedIssues, allIssueTypes);
      const allIssuesAreMapped = bulkIssueTypeMappingModel.areAllIssueTypesMapped(issueSelectionState.selectedIssues);
      setAllIssueTypesMapped(allIssuesAreMapped);
      const issueTypeMappingCompletionState = issueSelectionState.selectionValidity === 'valid' && allIssuesAreMapped ? 'complete' : 'incomplete';
      updateStepCompletionState('issue-type-mapping', issueTypeMappingCompletionState);
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
    const completionState = getRenderingStepCompletionState('file-upload');
    const stepName: StepName = 'file-upload';
    const isExpanded = expandedPanel === stepName;
    
    const panelContent = (
      <div className="content-panel">
        <PanelHeader
          stepNumber={stepNumber}
          label={`File upload`}
          completionState={completionState}
          isExpanded={isExpanded}
          onExpandToggle={() => handlePanelExpand(stepName)}
        />
        <div className="step-panel-content-container">
          <FileUploadPanel
            disabled={!bulkImportEnabled}
            completionState={completionState}
          />
        </div>
      </div>
    );

    if (isExpanded) {
      return (
        <div className="panel-overlay" onClick={handleOverlayClick}>
          <div className="panel-expanded">
            {panelContent}
          </div>
        </div>
      );
    }

    return (
      <div className={`padding-panel ${isExpanded ? 'expanded' : ''}`}>
        {panelContent}
      </div>
    );
  }

  const renderProjectAndIssueTypeSelectionPanel = (stepNumber: number) => {
    const fileUploadCompletionState = getRenderingStepCompletionState('file-upload');
    const projectAndIssueTypeSelectionCompletionState = getRenderingStepCompletionState('project-and-issue-type-selection');
    
    return renderExpandablePanel('project-and-issue-type-selection', stepNumber, 'Target project selection', (
      <div className="step-panel-content-container">
        <ImportProjectAndIssueTypeSelectionPanel
          fileUploadCompletionState={fileUploadCompletionState}
          projectAndIssueTypeSelectionCompletionState={projectAndIssueTypeSelectionCompletionState}
          modelUpdateTimestamp={modelUpdateTimestamp}
        />
      </div>
    ));
  }

  const renderColumnMappingPanel = (stepNumber: number) => {
    const importProjectCompletionState = getRenderingStepCompletionState('project-and-issue-type-selection');
    const columnMappingCompletionState = getRenderingStepCompletionState('column-mapping');
    
    return renderExpandablePanel('column-mapping', stepNumber, 'Column mapping', (
      <div className="step-panel-content-container">
        <ImportColumnMappingPanel
          importProjectCompletionState={importProjectCompletionState}
          columnMappingCompletionState={columnMappingCompletionState}
          selectedIssueType={importModel.getSelectedIssueType()}
          createIssueMetadata={importModel.getSelectedProjectCreateIssueMetadata()}
          modelUpdateTimestamp={modelUpdateTimestamp}
        />
      </div>
    ));
  }

  const renderImportIssuesPanel = (stepNumber: number) => {
    const columnMappingCompletionState = getRenderingStepCompletionState('column-mapping');
    const importIssuesCompletionState = getRenderingStepCompletionState('import-issues');
    
    return renderExpandablePanel('import-issues', stepNumber, 'Import work items', (
      <div className="step-panel-content-container">
        <ImportIssuesPanel
          columnMappingCompletionState={columnMappingCompletionState}
          importIssuesCompletionState={importIssuesCompletionState}
          modelUpdateTimestamp={modelUpdateTimestamp}
        />
      </div>
    ));
  }

  const renderFilterPanel = (stepNumber: number) => {
    const completionState = getRenderingStepCompletionState('filter');
    const stepName: StepName = 'filter';
    const isExpanded = expandedPanel === stepName;
    
    const panelContent = (
      <div className="content-panel">
        <PanelHeader
          stepNumber={stepNumber}
          label={`Find work items to ${bulkOperationMode.toLowerCase()}`}
          completionState={completionState}
          isExpanded={isExpanded}
          onExpandToggle={() => handlePanelExpand(stepName)}
        />
        <FilterPanel
          bulkOperationMode={bulkOperationMode}
          allIssueTypes={allIssueTypes}
          selectAllIssueTypesWhenNoneAreSelected={selectAllIssueTypesWhenNoneAreSelected}
          onIssueSearchInitiated={onIssueSearchInitiated}
          onIssueSearchCompleted={onIssueSearchCompleted}
        />
      </div>
    );

    if (isExpanded) {
      return (
        <div className="panel-overlay" onClick={handleOverlayClick}>
          <div className="panel-expanded">
            {panelContent}
          </div>
        </div>
      );
    }

    return (
      <div className={`padding-panel ${isExpanded ? 'expanded' : ''}`}>
        {panelContent}
      </div>
    );
  }

  const renderFieldMappingIndicator = () => {
    return null;
  }

  const renderIssuesPanel = (stepNumber: number) => {
    const hasIssues = issueSearchInfo.issues.length > 0;
    const waitingMessage = new WaitingMessageBuilder()
      .addCheck(arePrerequisiteStepsComplete('issue-selection', true), 'Waiting for previous step to be completed.')
      .build();
    let panelLabel = `Select work items to ${bulkOperationMode.toLowerCase()}`;
    const completionState = getRenderingStepCompletionState('issue-selection');
    const stepName: StepName = 'issue-selection';
    const isExpanded = expandedPanel === stepName;
    
    const panelContent = (
      <div className="content-panel">
        <PanelHeader
          stepNumber={stepNumber}
          label={panelLabel}
          completionState={completionState}
          isExpanded={isExpanded}
          onExpandToggle={() => handlePanelExpand(stepName)}
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
    );

    if (isExpanded) {
      return (
        <div className="panel-overlay" onClick={handleOverlayClick}>
          <div className="panel-expanded">
            {panelContent}
          </div>
        </div>
      );
    }

    return (
      <div className={`padding-panel ${isExpanded ? 'expanded' : ''}`}>
        {panelContent}
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
      .addCheck(arePrerequisiteStepsComplete('target-project-selection', true), 'Waiting for previous steps to be completed.')
      .addCheck(issueSelectionState.selectionValidity === 'valid', 'A valid set of work items has not yet been selected.')
      .build();
    
    return renderExpandablePanel('target-project-selection', stepNumber, 'Select target project', (
      <>
        {renderPanelMessage(waitingMessage, {marginTop: '20px', marginBottom: '20px'})}
        {renderToProjectSelect()}
      </>
    ));
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
      .addCheck(arePrerequisiteStepsComplete('issue-type-mapping', true), 'Waiting for previous steps to be completed.')
      .build();
    
    return renderExpandablePanel('issue-type-mapping', stepNumber, 'Work item type mapping', (
      <>
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
      </>
    ));
  }

  const renderFieldValueMappingsPanel = (stepNumber: number) => {
    const waitingMessage = new WaitingMessageBuilder()
      .addCheck(arePrerequisiteStepsComplete('field-mapping', true), 'Waiting for previous steps to be completed.')
      .build();
    const issueTypeMappingStepCompletionState = getRenderingStepCompletionState('issue-type-mapping');
    const fieldMappingCompletionState = getRenderingStepCompletionState('field-mapping');
    
    return renderExpandablePanel('field-mapping', stepNumber, 'Map work item field values', (
      <>
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
      </>
    ));
  }

  const renderEditFieldsPanel = (stepNumber: number) => {
    return renderExpandablePanel('edit-fields', stepNumber, 'Set work item field values', (
      <FieldEditsPanel
        issueSelectionState={issueSelectionState}
        selectedIssuesTime={issueSearchInfoTime}
        onEditsValidityChange={onEditsValidityChange}
      />
    ));
  }

  const renderMoveOrEditPanel = (stepNumber: number) => {
    const lastInputConditionsChangeTime = Math.max(
      selectedToProjectTime,
      selectedIssuesTime,
      fieldIdsToValuesTime
    );
    
    return renderExpandablePanel('move-or-edit', stepNumber, `${bulkOperationMode} work items`, (
      <MoveOrEditPanel
        bulkOperationMode={bulkOperationMode}
        fieldMappingsComplete={fieldMappingsComplete}
        issueSelectionState={issueSelectionState}
        selectedToProject={selectedToProject}
        allDefaultValuesProvided={allDefaultValuesProvided}
        lastInputConditionsChangeTime={lastInputConditionsChangeTime}
        onSetStepCompletionState={updateStepCompletionState}
        onSetMainWarningMessage={setMainWarningMessage}
      />
    ));
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
      <div className={`bulk-move-main-panel ${enablePanelExpansion && expandedPanel ? 'has-expanded-panel' : ''}`}>
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
