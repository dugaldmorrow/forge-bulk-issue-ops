import React, { useEffect, useState } from 'react';
import Button from '@atlaskit/button/new';
import LabelSelect from '../widget/LabelsSelect';
import { Project } from '../types/Project';
import { FormSection, Label } from '@atlaskit/form';
import Toggle from '@atlaskit/toggle';
import Lozenge from '@atlaskit/lozenge';
import IssueTypesSelect from '../widget/IssueTypesSelect';
import { IssueType } from '../types/IssueType';
import { IssueSearchInfo } from '../types/IssueSearchInfo';
// import { FlagOptions, showFlag } from '@forge/bridge';
import { Issue } from '../types/Issue';
// import { LinearProgress } from '@mui/material';
import { LoadingState } from '../types/LoadingState';
import { nilIssueSearchInfo } from '../model/nilIssueSearchInfo';
import { TaskOutcome } from '../types/TaskOutcome';
import issueMoveController from '../controller/issueMoveController';
import { IssueSearchParameters } from '../types/IssueSearchParameters';
import { IssueMoveRequestOutcome } from '../types/IssueMoveRequestOutcome';
import jiraUtil from '../controller/jiraUtil';
import { IssueMoveOutcomeResult } from '../types/IssueMoveOutcomeResult';
import JQLInputPanel from '../widget/JQLInputPanel';
import ProjectsSelect from '../widget/ProjectsSelect';
import jiraDataModel from '../model/jiraDataModel';
import { DataRetrievalResponse } from '../types/DataRetrievalResponse';
import { buildFieldMappingsForProject } from '../controller/bulkOperationsUtil';
import { ProjectFieldMappings } from '../types/ProjectFieldMappings';
import FieldMappingPanel, { FieldMappingsState, nilFieldMappingsState } from './FieldMappingPanel';
import targetMandatoryFieldsProvider from 'src/controller/TargetMandatoryFieldsProvider';
import { IssueSelectionPanel } from '../widget/IssueSelectionPanel';
import { TaskStatusLozenge } from '../widget/TaskStatusLozenge';
import moveRuleEnforcer from 'src/controller/moveRuleEnforcer';
import { allowBulkEditsAcrossMultipleProjects, allowBulkMovesFromMultipleProjects, taskStatusPollPeriodMillis } from 'src/model/config';
import { BulkOperationMode } from 'src/types/BulkOperationMode';
import IssueTypeMappingPanel from './IssueTypeMappingPanel';
import { ObjectMapping } from 'src/types/ObjectMapping';
import bulkIssueTypeMapping from 'src/model/bulkIssueTypeMapping';
import { renderPanelMessage } from 'src/widget/renderPanelMessage';
import { WaitingMessageBuilder } from 'src/controller/WaitingMessageBuilder';
import PanelHeader from 'src/widget/PanelHeader';
import { CompletionState } from 'src/types/CompletionState';
import { FieldEditsPanel } from './FieldEditsPanel';
import editedFieldsModel from 'src/model/editedFieldsModel';
import { MoveOrEditPanel } from './MoveOrEditPanel';
import { Activity } from 'src/types/Activity';
import { allSteps, StepName } from 'src/model/BulkOperationsWorkflow';

const showDebug = false;
const showCompletionStateDebug = false;
const implyAllIssueTypesWhenNoneAreSelected = true;
const autoShowFieldMappings = true;

export type BulkOperationPanelProps = {
  bulkOperationMode: BulkOperationMode;
}

type DebugInfo = {
  projects: Project[];
  issueTypes: IssueType[];
}

type FilterMode = 'basic' | 'advanced';

// type StepName =               'filter' | 'issue-selection' | 'target-project-selection' | 'issue-type-mapping' | 'field-mapping' | 'edit-fields' | 'move-or-edit';
// const allSteps: StepName[] = ['filter',  'issue-selection',  'target-project-selection',  'issue-type-mapping',  'field-mapping',  'edit-fields',  'move-or-edit'];




// Retain the same instance of TargetMandatoryFieldsProvider across renders
// const targetMandatoryFieldsProviderSingleton = new TargetMandatoryFieldsProvider();




const BulkOperationPanel = (props: BulkOperationPanelProps) => {

  const [stepNamesToCompletionState, setStepNamesToCompletionState] = useState<ObjectMapping<CompletionState>>({});
  const [stepOrder, setStepOrder] = useState<StepName[]>([])
  const [bulkOperationMode, setBulkOperationMode] = useState<BulkOperationMode>(props.bulkOperationMode);
  const [mainWarningMessage, setMainWarningMessage] = useState<string>('');
  const [lastDataLoadTime, setLastDataLoadTime] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<FilterMode>('basic');
  const [enteredJql, setEnteredJql] = useState<string>('');
  const [allIssueTypes, setAllIssueTypes] = useState<IssueType[]>([]);
  const [allIssueTypesTime, setAllIssueTypesTime] = useState<number>(0);
  const [issueLoadingState, setIssueLoadingState] = useState<LoadingState>('idle');
  const [selectedFromProjects, setSelectedFromProjects] = useState<Project[]>([]);
  const [selectedFromProjectsTime, setSelectedFromProjectsTime] = useState<number>(0);
  const [selectedToProject, setSelectedToProject] = useState<undefined | Project>(undefined);
  const [selectedToProjectTime, setSelectedToProjectTime] = useState<number>(0);
  const [selectedIssueTypes, setSelectedIssueTypes] = useState<IssueType[]>([]);
  const [selectedIssueTypesTime, setSelectedIssueTypesTime] = useState<number>(0);
  const [issueSearchInfo, setIssueSearchInfo] = useState<IssueSearchInfo>(nilIssueSearchInfo);
  const [issueSearchInfoTime, setIssueSearchInfoTime] = useState<number>(0);
  const [selectedIssues, setSelectedIssues] = useState<Issue[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [selectedLabelsTime, setSelectedLabelsTime] = useState<number>(0);
  const [allIssueTypesMapped, setAllIssueTypesMapped] = useState<boolean>(false);
  const [fieldMappingsState, setFieldMappingsState] = useState<FieldMappingsState>(nilFieldMappingsState);
  // const [targetMandatoryFieldsProvider, setTargetMandatoryFieldsProvider] = useState<TargetMandatoryFieldsProvider>(targetMandatoryFieldsProvider);
  const [targetMandatoryFieldsProviderUpdateTime, setTargetMandatoryFieldsProviderUpdateTime] = useState<number>(0);
  const [allDefaultValuesProvided, setAllDefaultValuesProvided] = useState<boolean>(false);
  const [currentFieldMappingActivity, setCurrentFieldMappingActivity] = useState<undefined | Activity>(undefined);
  // const [currentMoveActivity, setCurrentMoveActivity] = useState<undefined | Activity>(undefined);
  // const [issueMoveRequestOutcome, setIssueMoveRequestOutcome] = useState<undefined | IssueMoveRequestOutcome>(undefined);
  // const [issueMoveOutcome, setIssueMoveOutcome] = useState<undefined | TaskOutcome>(undefined);
  const [selectableIssueTypes, setSelectableIssueTypes] = useState<IssueType[]>([]);
  // const [lastMoveCompletionTaskId, setLastMoveCompletionTaskId] = useState<string>('none');
  // const [fieldIdsToValues, setFieldIdsToValues] = React.useState<ObjectMapping<any>>({});
  const [fieldIdsToValuesTime, setFieldIdsToValuesTime] = React.useState<number>(0);
  const [fieldMappingsComplete, setFieldMappingsComplete] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({ projects: [], issueTypes: [] });



  // TODO: can this and the issueMoveOutcome state above be deleted now?
  const setIssueMoveOutcome = (issueMoveOutcome: undefined | TaskOutcome) => {

  }



  useEffect(() => {
    setBulkOperationMode(props.bulkOperationMode);
  }, [props.bulkOperationMode]);

  const onEditedFieldsModelChange = (fieldId: string, value: any) => {
    // setFieldIdsToValues(editedFieldsModel.getFieldIdsToValues());
    setFieldIdsToValuesTime(Date.now());
  }

  useEffect(() => {
    editedFieldsModel.registerListener(onEditedFieldsModelChange);
    return () => {
      editedFieldsModel.unregisterListener(onEditedFieldsModelChange);
    };
  }, []);

  const isStepApplicableToBulkOperationMode = (stepName: StepName): boolean => {
    if (bulkOperationMode === 'Move') {
      if (stepName === 'edit-fields') {
        return false;
      }
    } else if (bulkOperationMode === 'Edit') {
      if (stepName === 'issue-type-mapping' || stepName === 'field-mapping' || stepName === 'target-project-selection') {
        return false;
      }
    }
    return true;
  }

  const defineSteps = () => {
    const steps: StepName[] = [];
    for (const step of allSteps) {
      if (isStepApplicableToBulkOperationMode(step)) {
        steps.push(step);
      }
    }
    setStepOrder(steps);
  }

  const setStepCompletionState = (stepName: StepName, completionState: CompletionState) => {
    setStepNamesToCompletionState(prevState => ({
      ...prevState,
      [stepName]: completionState
    }));
  }

  const getStepCompletionState = (stepName: StepName): CompletionState => {
    return stepNamesToCompletionState[stepName];
  }

  const arePrerequisiteStepsComplete = (priorToStepName: StepName): boolean => {
    let complete = true;
    for (const stepName of stepOrder) {
      if (stepName === priorToStepName) {
        break; // Stop checking once we reach the step we're interested in
      }
      const completionState = stepNamesToCompletionState[stepName];
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
    const renderedStates = stepOrder.map((stepName: StepName) => {
      const completionState = stepNamesToCompletionState[stepName];
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
    setFieldMappingsState(nilFieldMappingsState);
    targetMandatoryFieldsProvider.setProjectFieldMappings(nilFieldMappingsState.projectFieldMappings);
    setTargetMandatoryFieldsProviderUpdateTime(Date.now());
  }

  const isFieldMappingsComplete = () => {
    const allFieldValuesSet = targetMandatoryFieldsProvider.areAllFieldValuesSet();
    return fieldMappingsState.dataRetrieved && allFieldValuesSet;
  }

  const retrieveAndSetDebugInfo = async (): Promise<void> => {
    const debugInfo: DebugInfo = {
      projects: (await jiraDataModel.pageOfProjectSearchInfo()).values,
      issueTypes: await jiraDataModel.getissueTypes()
    }
    setDebugInfo(debugInfo);
  }

  const initialiseSelectedIssueTypes = async (): Promise<void> => {
    const allIssueTypes: IssueType[] = await jiraDataModel.getissueTypes();
    setAllIssueTypes(allIssueTypes);
    setAllIssueTypesTime(Date.now());
    setLastDataLoadTime(Date.now());
    if (selectedIssueTypesTime === 0) {
      setSelectedIssueTypes(allIssueTypes);
    } else {
      // Don't override if there's already a selection
    }
  }

  useEffect(() => {
    defineSteps();
    // updateAllProjectInfo();
    initialiseSelectedIssueTypes();
    if (showDebug) {
      retrieveAndSetDebugInfo();
    }
  }, []);

  const filterProjectsForFromSelection = async (projectsToFilter: Project[]): Promise<Project[]> => {
    const allowableToProjects = await moveRuleEnforcer.filterSourceProjects(projectsToFilter);
    return allowableToProjects;
  }

  const filterProjectsForToSelection = async (projectsToFilter: Project[]): Promise<Project[]> => {
    const allowableToProjects = await moveRuleEnforcer.filterTargetProjects(selectedIssues, projectsToFilter);
    return allowableToProjects;
  }

  const onClearMainWarningMessage = () => {
    setMainWarningMessage('');
  }

  const onIssuesLoaded = (allSelected: boolean, newIssueSearchInfo: IssueSearchInfo) => {
    const newlySelectedIssues = newIssueSearchInfo.issues;
    setSelectedIssues(newlySelectedIssues);
    targetMandatoryFieldsProvider.setSelectedIssues(newlySelectedIssues, allIssueTypes);
    setIssueSearchInfo(newIssueSearchInfo);
    setIssueSearchInfoTime(Date.now());
    setLastDataLoadTime(Date.now());
    clearFieldMappingsState();
    setStepCompletionState('issue-selection', newlySelectedIssues.length > 0 ? 'complete' : 'incomplete');
    updateMappingsCompletionStates(allDefaultValuesProvided, newlySelectedIssues);
  }

  const updateMappingsCompletionStates = (allDefaultsProvided: boolean, newlySelectedIssues: Issue[] = selectedIssues): void => {
    // const issueTypeIdsToIssueTypes = jiraUtil.getIssueTypesFromIssues(newlySelectedIssues);


    const allIssueTypesMapped = bulkIssueTypeMapping.areAllIssueTypesMapped(newlySelectedIssues);
    // console.log(`BulkOperationPanel: updateIssueTypeMappingCompletionState: allIssueTyesMapped = ${allIssueTyesMapped}`);
    // setStepCompletionState('issue-type-mapping', selectedIssueTypes.length > 0 && allIssueTyesMapped ? 'complete' : 'incomplete');

    const fieldMappingsComplete = isFieldMappingsComplete();
    const fieldMappingComplete = allDefaultValuesProvided;
    setFieldMappingsComplete(fieldMappingsComplete);
    setStepCompletionState('field-mapping', fieldMappingsComplete ? 'complete' : 'incomplete');
  }

  const onIssuesSelectionChange = async (selectedIssues: Issue[]): Promise<void> => {
    // console.log(`BulkOperationPanel: onIssuesSelectionChange: selected issues = ${selectedIssues.map(issue => issue.key).join(', ')}`);
    setSelectedIssues(selectedIssues);
    targetMandatoryFieldsProvider.setSelectedIssues(selectedIssues, allIssueTypes);
    updateFieldMappingsIfNeeded(selectedToProject);
    updateMappingsCompletionStates(allDefaultValuesProvided, selectedIssues);
  }

  const onBasicModeSearchIssues = async (projects: Project[], issueTypes: IssueType[], labels: string[]): Promise<void> => {
    setIssueMoveOutcome(undefined);
    const noIssues = nilIssueSearchInfo();
    onIssuesLoaded(true, noIssues);
    if (projects.length === 0) {
      onIssuesLoaded(true, nilIssueSearchInfo());
    } else {
      setIssueLoadingState('busy');
      setTimeout(async () => {
        const issueSearchParameters: IssueSearchParameters = {
          projects: projects,
          issueTypes: issueTypes,
          labels: labels
        }
        const issueSearchInfo = await jiraDataModel.getIssueSearchInfo(issueSearchParameters) as IssueSearchInfo;
        if (issueSearchInfo.errorMessages && issueSearchInfo.errorMessages.length) {
          const joinedErrors = issueSearchInfo.errorMessages.join( );
          setMainWarningMessage(joinedErrors);
        } else {
          onIssuesLoaded(true, issueSearchInfo);
        }
        setIssueLoadingState('idle');
      }, 0);
    }
  }

  const onAdvancedModeSearchIssues = async (jql: string): Promise<void> => {
    const noIssues = nilIssueSearchInfo();
    onIssuesLoaded(true, noIssues);
    setIssueLoadingState('busy');
    setTimeout(async () => {
      const issueSearchInfo = await jiraDataModel.getIssueSearchInfoByJql(jql) as IssueSearchInfo;
      // onIssuesLoaded(true, issueSearchInfo);
      const issueCount = issueSearchInfo.issues.length;
      onIssuesLoaded(issueCount > 0, issueSearchInfo);
      setStepCompletionState('filter', issueCount > 0 ? 'complete' : 'incomplete');
      setIssueLoadingState('idle');
    }, 0);
  }

  const onJQLChange = async (jql: string): Promise<void> => {
    setEnteredJql(jql);
  }

  const onExecuteJQL = async (jql: string): Promise<void> => {
    setIssueMoveOutcome(undefined);
    setEnteredJql(jql);
    await onAdvancedModeSearchIssues(jql);
  }

  const onFromProjectsSelect = async (selectedProjects: Project[]): Promise<void> => {
    // console.log(`onFromProjectsSelect.selectedProjects: ${JSON.stringify(selectedProjects, null, 2)}`);
    setIssueMoveOutcome(undefined);
    setSelectedFromProjects(selectedProjects);
    setSelectedFromProjectsTime(Date.now());
    if (bulkOperationMode === 'Edit') {
      setSelectedToProject(selectedProjects[0]);
      setSelectedToProjectTime(Date.now());
    }
    setStepCompletionState('filter', selectedProjects.length > 0 ? 'complete' : 'incomplete');
    await onBasicModeSearchIssues(selectedProjects, selectedIssueTypes, selectedLabels);
    const selectableIssueTypes: IssueType[] = jiraUtil.filterProjectsIssueTypes(selectedFromProjects, allIssueTypes)
    setSelectableIssueTypes(selectableIssueTypes);
  }

  const updateFieldMappingState = (selectedargetProject: Project) => {
    updateFieldMappingsIfNeeded(selectedargetProject);
    targetMandatoryFieldsProvider.setSelectedIssues(selectedIssues, allIssueTypes);
    setStepCompletionState('field-mapping', isFieldMappingsComplete() ? 'complete' : 'incomplete');
    setStepCompletionState('target-project-selection', selectedargetProject ? 'complete' : 'incomplete');
    updateMappingsCompletionStates(allDefaultValuesProvided, selectedIssues);
  }

  const onToProjectSelect = async (selectedProject: undefined | Project): Promise<void> => {
    // console.log(`selectedToProject: `, selectedProject);
    setIssueMoveOutcome(undefined);
    setSelectedToProject(selectedProject);
    setSelectedToProjectTime(Date.now());
    updateFieldMappingState(selectedProject);
    // updateFieldMappingsIfNeeded(selectedProject);
    // targetMandatoryFieldsProvider.setSelectedIssues(selectedIssues, allIssueTypes);
    // setStepCompletionState('field-mapping', isFieldMappingsComplete() ? 'complete' : 'incomplete');
    // setStepCompletionState('target-project-selection', selectedProject ? 'complete' : 'incomplete');
    // updateMappingsCompletionStates(allDefaultValuesProvided, selectedIssues);
  }

  const onIssueTypesSelect = async (selectedIssueTypes: IssueType[]): Promise<void> => {
    // console.log(`selectedIssueTypes: `, selectedIssueTypes);
    setIssueMoveOutcome(undefined);
    if (selectedIssueTypes.length === 0) {
      if (implyAllIssueTypesWhenNoneAreSelected) {
        setSelectedIssueTypes(allIssueTypes);
      } else {
        setSelectedIssueTypes(selectedIssueTypes);
      }
    } else {
      setSelectedIssueTypes(selectedIssueTypes);
    }
    setSelectedIssueTypesTime(Date.now());
    await onBasicModeSearchIssues(selectedFromProjects, selectedIssueTypes, selectedLabels);
  }

  const onLabelsSelect = async (selectedLabels: string[]): Promise<void> => {
    console.log(`selectedLabels: `, selectedLabels);
    setSelectedLabels(selectedLabels);
    setSelectedLabelsTime(Date.now());
    await onBasicModeSearchIssues(selectedFromProjects, selectedIssueTypes, selectedLabels);
  }

  // const pollPollMoveOutcome = async (taskId: string): Promise<void> => {
  //   if (taskId) {
  //     const outcome: TaskOutcome = await issueMoveController.pollMoveProgress(taskId);
  //     setIssueMoveOutcome(outcome);
  //     if (issueMoveController.isDone(outcome.status)) {
  //       if (taskId !== lastMoveCompletionTaskId) {
  //         setLastMoveCompletionTaskId(taskId);
  //         // console.log(`BulkOperationPanel: pollPollMoveOutcome: Move completed with taskId ${taskId}`);
  //         const options: FlagOptions = {
  //           id: taskId,
  //           type: outcome.status === 'COMPLETE' ? 'info' : 'error',
  //           title: outcome.status === 'COMPLETE' ? 'Move completed' : `Move ended with status ${outcome.status}`,
  //           description: outcome.status === 'COMPLETE' ? 'The issues have been moved successfully.' : 'There were problems moving the issues.',
  //           isAutoDismiss: outcome.status === 'COMPLETE',
  //           actions: outcome.status === 'COMPLETE' ? [] : [{
  //             text: 'Got it',
  //             onClick: async () => {
  //               flag.close();
  //             },
  //           }]
  //         }
  //         const flag = showFlag(options);
  //       }
  //       setCurrentMoveActivity(undefined);
  //       setStepCompletionState('move-or-edit', 'complete');
  //     } else {
  //       asyncPollMoveOutcome(taskId);
  //       setStepCompletionState('move-or-edit', 'incomplete');
  //     }
  //   } else {
  //     setMainWarningMessage(`No taskId provided for polling move outcome.`);
  //     console.warn(`BulkOperationPanel: pollPollMoveOutcome: No taskId provided, cannot poll for move outcome.`);
  //     setCurrentMoveActivity(undefined);
  //     setStepCompletionState('move-or-edit', 'incomplete');
  //   }
  // }

  // const asyncPollMoveOutcome = async (taskId: string): Promise<void> => {
  //   setTimeout(async () => {
  //     await pollPollMoveOutcome(taskId);
  //   }, taskStatusPollPeriodMillis);
  // }

  const buildFieldMappingsState = async (selectedToProject: undefined | Project): Promise<FieldMappingsState> => {
    if (!selectedToProject) {
      return nilFieldMappingsState; 
    }
    setCurrentFieldMappingActivity({taskId: 'non-jira-activity', description: 'Checking for mandatory fields...'});
    try {
      const projectFieldMappings: DataRetrievalResponse<ProjectFieldMappings> = await buildFieldMappingsForProject(
        selectedToProject.id
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
    const fieldMappingsState = await buildFieldMappingsState(selectedToProject);
    setFieldMappingsState(fieldMappingsState);
    targetMandatoryFieldsProvider.setProjectFieldMappings(fieldMappingsState.projectFieldMappings);
    setTargetMandatoryFieldsProviderUpdateTime(Date.now());
  }

  const updateFieldMappingsIfNeeded = async (selectedToProject: undefined | Project): Promise<void> => {
    if (autoShowFieldMappings) {
      if (selectedToProject) {
        await onInitiateFieldValueMapping(selectedToProject);
      } else {
        setFieldMappingsState(nilFieldMappingsState)
      }
    }
  }

  const onAllDefaultValuesProvided = (allDefaultValuesProvided: boolean) => {
    // console.log(`BulkOperationPanel: onAllDefaultValuesProvided: ${allDefaultValuesProvided}`);
    setAllDefaultValuesProvided(allDefaultValuesProvided);
    updateFieldMappingState(selectedToProject);
  }

  const onIssueTypeMappingChange = async (): Promise<void> => {
    // console.log(`BulkOperationPanel: onIssueTypeMappingChange: }`);
    targetMandatoryFieldsProvider.setSelectedIssues(selectedIssues, allIssueTypes);
    const allIssueTypesMapped = bulkIssueTypeMapping.areAllIssueTypesMapped(selectedIssues);
    setAllIssueTypesMapped(allIssueTypesMapped);
    // setStepCompletionState('issue-type-mapping', allIssueTypesMapped ? 'complete' : 'incomplete');
    setStepCompletionState('issue-type-mapping', selectedIssues.length > 0 && selectedIssueTypes.length > 0 && allIssueTypesMapped ? 'complete' : 'incomplete');
    updateFieldMappingState(selectedToProject);
  }

  // const buildTaskOutcomeErrorMessage = (taskOutcome: IssueMoveRequestOutcome): string => {
  //   if (taskOutcome.errors && taskOutcome.errors.length) {
  //     let combinedErrorMessages = '';
  //     for (const error of taskOutcome.errors) {
  //       const separator = combinedErrorMessages.length > 0 ? ', ' : '';
  //       combinedErrorMessages += `${separator}${error.message}`;
  //     }
  //     return combinedErrorMessages;
  //   } else {
  //     return '';
  //   }
  // }

  // const onMoveIssues = async (): Promise<void> => {
  //   // Step 1: Initiate the move request...
  //   const destinationProjectId: string = selectedToProject.id;
  //   setIssueMoveRequestOutcome(undefined);
  //   setCurrentMoveActivity({taskId: 'non-jira-activity', description: 'Initiating move request...'});
  //   const targetIssueTypeIdsToTargetMandatoryFields = targetMandatoryFieldsProvider.buildIssueTypeIdsToTargetMandatoryFields();
  //   const initiateOutcome: IssueMoveRequestOutcome = await issueMoveController.initiateMove(
  //     destinationProjectId,
  //     selectedIssues,
  //     issueSearchInfo,
  //     targetIssueTypeIdsToTargetMandatoryFields
  //   );
  //   setCurrentMoveActivity(undefined);
  //   console.log(`BulkOperationPanel: issue move request outcome: ${JSON.stringify(initiateOutcome, null, 2)}`);
  //   const taskOutcomeErrorMessage = buildTaskOutcomeErrorMessage(initiateOutcome);
  //   if (taskOutcomeErrorMessage) {
  //     const fullErrorMessage = `Failed to initiate move request: ${taskOutcomeErrorMessage}`;
  //     setMainWarningMessage(fullErrorMessage);
  //     console.warn(fullErrorMessage);
  //     setIssueMoveRequestOutcome(undefined);
  //     setCurrentMoveActivity(undefined);
  //   } else {
  //     // Step 2: Start polling for the outcome...
  //     setCurrentMoveActivity({taskId: initiateOutcome.taskId, description: 'Polling for move outcome...'});
  //     pollPollMoveOutcome(initiateOutcome.taskId);

  //     // Step 2: (now redundant since we switched to the polling approach) Wait for the outcome...
  //     // setIssueMoveRequestOutcome(initiateOutcome);
  //     // if (initiateOutcome.statusCode === 201 && initiateOutcome.taskId) {
  //     //   setCurrentIssueMoveTaskId(initiateOutcome.taskId);
  //     //   setIssueMoveOutcome(undefined);
  //     //   const issueMoveOutcome = await issueMoveController.awaitMoveCompletion(props.invoke, initiateOutcome.taskId);
  //     //   setIssueMoveOutcome(issueMoveOutcome);
  //     //   setCurrentIssueMoveTaskId(undefined);  
  //     // }
  //   }
  // }

  const renderJQLInputPanel = () => {
    return (
      <FormSection>
       <JQLInputPanel
          label="JQL"
          placeholder="JQL query"
          initialJql={enteredJql}
          onJQLChange={onJQLChange}
          onExecute={onExecuteJQL} />
      </FormSection>
    )
  }

  const renderFromProjectSelect = () => {
    const isMulti =
      (bulkOperationMode === 'Move' && allowBulkMovesFromMultipleProjects) ||
      (bulkOperationMode === 'Edit' && allowBulkEditsAcrossMultipleProjects);
    return (
      <FormSection>
        <ProjectsSelect 
          // key={`from-project=${allProjectSearchInfoTime}`}
          label="From projects"
          isMulti={isMulti}
          isClearable={false}
          selectedProjects={selectedFromProjects}
          filterProjects={filterProjectsForFromSelection}
          onProjectsSelect={onFromProjectsSelect}
        />
      </FormSection>
    );
  }

  const renderToProjectSelect = () => {
    const allowSelection = selectedIssues.length > 0;
    return (
      <FormSection>
        <ProjectsSelect 
          key={`to-project`}
          label="To project"
          isMulti={false}
          isClearable={false}
          isDisabled={!allowSelection}
          selectedProjects={[selectedToProject]}
          filterProjects={filterProjectsForToSelection}
          onProjectsSelect={async (selected: Project[]): Promise<void> => {
            // console.log(`Selected to projects: ${JSON.stringify(selected, null, 2)}`);
            const selectedToProject: undefined | Project = selected.length > 0 ? selected[0] : undefined;
            onToProjectSelect(selectedToProject);
          }}
        />
      </FormSection>
    );
  }

  const renderIssueTypesSelect = () => {
    const selectableIssueTypes: IssueType[] = jiraUtil.filterProjectsIssueTypes(selectedFromProjects, allIssueTypes)

    const issueTypesAlreadySelected = selectedIssueTypes.length !== allIssueTypes.length;
    // console.log(`BulkOperationPanel: renderIssueTypesSelect: issueTypesAlreadySelected: ${issueTypesAlreadySelected}`);
    const candidateIssueTypes: IssueType[] = issueTypesAlreadySelected ?
      selectedIssueTypes :
      [];
    // console.log(`BulkOperationPanel: renderIssueTypesSelect: candidateIssueTypes: ${JSON.stringify(candidateIssueTypes, null, 2)}`);
    const selectedIssueTypeIds = candidateIssueTypes.length ? candidateIssueTypes.map(issueType => issueType.id) : [];
    // console.log(`BulkOperationPanel: renderIssueTypesSelect: selectedIssueTypeIds: ${JSON.stringify(selectedIssueTypeIds, null, 2)}`);
    return (
      <FormSection>
        <IssueTypesSelect 
          key={`issue-type-select-${selectedFromProjectsTime}-${selectedIssueTypesTime}`}
          label="Issue types"
          selectedIssueTypeIds={selectedIssueTypeIds}
          selectableIssueTypes={selectableIssueTypes}
          onIssueTypesSelect={onIssueTypesSelect}
        />
      </FormSection>
    );
  }

  const renderLabelsSelect = () => {
    return (
      <FormSection>
        <LabelSelect 
          label="Labels"
          allowMultiple={true}
          selectedLabels={selectedLabels}
          onLabelsSelect={onLabelsSelect}
        />
      </FormSection>
    );
  }

  const renderFlexboxEqualWidthGrowPanel = () => {
    return (
      <div className="flex-box-equal-width-grow-panel"></div>
    );
  }

  const renderFilterModeSelect = () => {
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
          {renderLabelsSelect()}
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

  const renderFilterPanel = (stepNumber: number) => {
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label="Select issue filter options"
            completionState={getStepCompletionState('filter')}
          />
          {renderFilterModeSelect()}
          {renderBasicFieldInputs()}
          {renderAdvancedFieldInputs()}
          {renderFlexboxEqualWidthGrowPanel()}
        </div>
      </div>
    );
  }

  const renderFieldMappingIndicator = () => {
    return null;
  }

  // const renderIssueMoveActivityIndicator = () => {
  //   if (currentMoveActivity || issueMoveOutcome) {
  //     const description = currentMoveActivity ? currentMoveActivity.description : issueMoveOutcome ? issueMoveOutcome.status : 'No activity';
  //     // https://mui.com/material-ui/api/linear-progress/
  //     const progressPercent = issueMoveOutcome ? issueMoveOutcome.progress : 0;
  //     return (
  //       <div>
  //         <Label htmlFor={''}>{description}</Label>
  //         <LinearProgress variant="determinate" value={progressPercent} color="secondary" />
  //       </div>
  //     );
  //   } else {
  //     return null;
  //   }
  // }

  // const renderIssueMoveRequestOutcome = () => {
  //   if (issueMoveRequestOutcome) {
  //     const renderedErrors = issueMoveRequestOutcome.errors ? issueMoveRequestOutcome.errors.map((error: Error, index: number) => {
  //       return (
  //         <div key={`issue-move-request-error-${index}`} className="error-message">
  //           {error.message}
  //         </div>
  //       );
  //     }) : null;
  //     return (
  //       <div>
  //         {renderedErrors}
  //       </div>
  //     );
  //   } else {
  //     return null;
  //   }
  // }

  // const renderIssueMoveOutcome = () => {
  //   if (issueMoveOutcome) {
  //     const moveResult: IssueMoveOutcomeResult | undefined = issueMoveOutcome.result;
  //     const movedCount = moveResult ? moveResult.successfulIssues.length : -1;
  //     const failedCount = moveResult ? moveResult.totalIssueCount - movedCount : -1;
  //     const renderedIssuesMovedResult = issueMoveOutcome.result ? <span># issues moved: <Lozenge appearance="success">{movedCount}</Lozenge></span> : null;
  //     const renderedIssuesNotMovedResult = issueMoveOutcome.result ? <span># issues not moved: <Lozenge appearance="removed">{failedCount}</Lozenge></span> : null;
  //     const renderedOutcomeDebugJson = showDebug ? <pre>{JSON.stringify(issueMoveOutcome, null, 2)}</pre> : null;
  //     const progressPercent = issueMoveOutcome.progress ?? 0;
  //     const renderedProgress = <div>Progress: {progressPercent}%</div>;
  //     return (
  //       <div key={`issue-move-outcome-${allDefaultValuesProvided}`} style={{margin: '20px 0px'}}>
  //         <Label htmlFor="none">Issues moved to the {selectedToProject?.name} ({selectedToProject?.key}) project</Label>
  //         <ul>
  //           <li>Status: <TaskStatusLozenge status={issueMoveOutcome.status} /></li>
  //           <li>{renderedIssuesMovedResult}</li>
  //           <li>{renderedIssuesNotMovedResult}</li>
  //           <li>{renderedProgress}</li>
  //         </ul>
  //         {renderedOutcomeDebugJson}
  //       </div>
  //     );
  //   } else {
  //     return null;
  //   }
  // }

  const renderIssuesPanel = (stepNumber: number) => {
    const hasIssues = issueSearchInfo.issues.length > 0;
    const waitingMessage = new WaitingMessageBuilder()
      .addCheck(arePrerequisiteStepsComplete('issue-selection'), 'Waiting for previous step to be completed.')
      .build();
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label={`Confirm issues to ${bulkOperationMode.toLowerCase()}`}
            completionState={getStepCompletionState('issue-selection')}
          />
          {renderPanelMessage(waitingMessage, {marginTop: '20px', marginBottom: '20px'})}
          <IssueSelectionPanel
            loadingState={issueLoadingState}
            issueSearchInfo={issueSearchInfo}
            selectedIssues={selectedIssues}
            allowBulkMovesFromMultipleProjects={allowBulkMovesFromMultipleProjects}
            onIssuesSelectionChange={async (selectedIssues: Issue[]): Promise<void> => {
              await onIssuesSelectionChange(selectedIssues);
            }}
          />
          {renderFlexboxEqualWidthGrowPanel()}
        </div>
      </div>
    );
  }

  const renderStartFieldValueMappingsButton = () => {
    const allowValidation = selectedToProject && selectedToProject.id && selectedIssues.length > 0;
    // const buttonEnabled = !currentMoveActivity && allowValidation;
    const buttonEnabled = allowValidation;
    return (
      <Button
        appearance={fieldMappingsState.dataRetrieved ? 'default' : 'primary'}
        isDisabled={!buttonEnabled}
        onClick={() => {
          onInitiateFieldValueMapping(selectedToProject);
        }}
      >
        Start field value mapping
      </Button>
    );
  }

  // const renderStartMoveOrEditButton = () => {
  //   let waitingMessage = '';
  //   if (bulkOperationMode === 'Move') {
  //     const debugReasonForFieldMappingIncompleteness = false;
  //     const fieldMappingIncompletenessReason = debugReasonForFieldMappingIncompleteness ? targetMandatoryFieldsProvider.getFieldMappingIncompletenessReason() : '';
  //     waitingMessage = new WaitingMessageBuilder()
  //       .addCheck(fieldMappingIncompletenessReason === '', fieldMappingIncompletenessReason)
  //       .addCheck(isFieldMappingsComplete(), 'Field value mapping is not yet complete.')
  //       // .addCheck(allDefaultValuesProvided, 'Field value mapping is not yet complete.')
  //       .addCheck(!!selectedToProject && !!selectedToProject.id, 'Target project is not selected.')
  //       .addCheck(selectedIssues.length > 0, 'No issues selected.')
  //       .addCheck(!currentMoveActivity, 'Current move activity is not yet complete.')
  //       .build();
  //   } else if (bulkOperationMode === 'Edit') {
  //     // const dd = fieldIdsToValues;
  //     const editValuesSpecified = editedFieldsModel.haveValuesBeenSpecified();
  //     waitingMessage = new WaitingMessageBuilder()
  //       .addCheck(editValuesSpecified, 'Waiting for at least one new field value.')
  //       .build();
  //   }
  //   const buttonEnabled = waitingMessage === '';
  //   return (
  //     <div 
  //       key={`field-mapping-panel-${lastDataLoadTime}-${targetMandatoryFieldsProviderUpdateTime}-${allDefaultValuesProvided}`}
  //     >
  //       {renderPanelMessage(waitingMessage, {marginTop: '-6px', marginBottom: '20px'})}
  //       <Button
  //         key={`move-edit-button-${lastDataLoadTime}-${targetMandatoryFieldsProviderUpdateTime}-${allDefaultValuesProvided}-${fieldIdsToValuesTime}`}
  //         appearance={buttonEnabled ? 'primary' : 'default'}
  //         isDisabled={!buttonEnabled}
  //         onClick={() => {
  //           if (bulkOperationMode === 'Move') {
  //             onMoveIssues();
  //           } else if (bulkOperationMode === 'Edit') {
  //             // onEditIssues();
  //           }
  //         }}
  //       >
  //         {bulkOperationMode} issues
  //       </Button>
  //     </div>
  //   );
  // }

  // const renderEditButton = () => {
  //   const debugReasonForFieldMappingIncompleteness = false;
  //   const fieldMappingIncompletenessReason = debugReasonForFieldMappingIncompleteness ? targetMandatoryFieldsProvider.getFieldMappingIncompletenessReason() : '';
  //   const waitingMessage = new WaitingMessageBuilder()
  //     .addCheck(fieldMappingIncompletenessReason === '', fieldMappingIncompletenessReason)
  //     .addCheck(isFieldMappingsComplete(), 'Field value mapping is not yet complete.')
  //     // .addCheck(allDefaultValuesProvided, 'Field value mapping is not yet complete.')
  //     .addCheck(!!selectedToProject && !!selectedToProject.id, 'Target project is not selected.')
  //     .addCheck(selectedIssues.length > 0, 'No issues selected.')
  //     .addCheck(!currentMoveActivity, 'Current move activity is not yet complete.')
  //     .build();
  //   const buttonEnabled = waitingMessage === '';
  //   return (
  //     <div 
  //       key={`field-mapping-panel-${lastDataLoadTime}-${targetMandatoryFieldsProviderUpdateTime}-${allDefaultValuesProvided}`}
  //     >
  //       {renderPanelMessage(waitingMessage, {marginTop: '-6px', marginBottom: '20px'})}
  //       <Button
  //         key={`move-button-${lastDataLoadTime}-${targetMandatoryFieldsProviderUpdateTime}-${allDefaultValuesProvided}`}
  //         appearance={buttonEnabled ? 'primary' : 'default'}
  //         isDisabled={!buttonEnabled}
  //         onClick={onMoveIssues}
  //       >
  //         {bulkOperationMode} issues
  //       </Button>
  //     </div>
  //   );
  // }

  const renderTargetProjectPanel = (stepNumber: number) => {
    const waitingMessage = new WaitingMessageBuilder()
      .addCheck(arePrerequisiteStepsComplete('target-project-selection'), 'Waiting for previous steps to be completed.')
      .addCheck(selectedIssues.length > 0, 'Issues are yet to be selected.')
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
          {renderFlexboxEqualWidthGrowPanel()}
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
            label="Issue Type Mapping"
            // completionState={'incomplete'}
            completionState={getStepCompletionState('issue-type-mapping')}
          />
          {renderPanelMessage(waitingMessage, {marginTop: '20px', marginBottom: '20px'})}
          {renderStartFieldMappingButton()}
          {renderFieldMappingIndicator()}
          <IssueTypeMappingPanel
            key={`issue-type-mapping-panel-${lastDataLoadTime}-${selectedIssues.length}-${selectedToProjectTime}`}
            selectedIssues={selectedIssues}
            targetProject={selectedToProject}
            onIssueTypeMappingChange={onIssueTypeMappingChange}
          />
          {renderFlexboxEqualWidthGrowPanel()}
        </div>
      </div>
    );
  }

  const renderFieldValueMappingsPanel = (stepNumber: number) => {
    const waitingMessage = new WaitingMessageBuilder()
      .addCheck(arePrerequisiteStepsComplete('field-mapping'), 'Waiting for previous steps to be completed.')
      .build();
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label="Map field values"
            completionState={getStepCompletionState('field-mapping')}
          />
          {renderPanelMessage(waitingMessage, {marginTop: '20px', marginBottom: '20px'})}
          {renderStartFieldMappingButton()}
          {renderFieldMappingIndicator()}
          <FieldMappingPanel
            key={`field-mapping-panel-${lastDataLoadTime}-${targetMandatoryFieldsProviderUpdateTime}`}
            bulkOperationMode={bulkOperationMode}
            allIssueTypes={allIssueTypes}
            issues={selectedIssues}
            fieldMappingsState={fieldMappingsState}
            showDebug={showDebug}
            onAllDefaultValuesProvided={onAllDefaultValuesProvided}
          />
          {renderFlexboxEqualWidthGrowPanel()}
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
            label={`Set field values`}
            completionState={getStepCompletionState('edit-fields')}
          />
          <FieldEditsPanel
            selectedIssues={selectedIssues}
            selectedIssuesTime={issueSearchInfoTime}
          />
          {renderFlexboxEqualWidthGrowPanel()}
        </div>
      </div>
    );
  }

  const renderMoveOrEditPanel = (stepNumber: number) => {
    return (
      <div className="padding-panel">
        <div className="content-panel">
          <PanelHeader
            stepNumber={stepNumber}
            label={`${bulkOperationMode} issues`}
            completionState={getStepCompletionState('move-or-edit')}
          />
          <MoveOrEditPanel
            bulkOperationMode={bulkOperationMode}
            fieldMappingsComplete={fieldMappingsComplete}
            selectedIssues={selectedIssues}
            selectedToProject={selectedToProject}
            allDefaultValuesProvided={allDefaultValuesProvided}
            setStepCompletionState={setStepCompletionState}
            setMainWarningMessage={setMainWarningMessage}
          />
          {renderFlexboxEqualWidthGrowPanel()}
        </div>
      </div>
    );
  }

  // const renderMoveOrEditPanel = (stepNumber: number) => {
  //   return (
  //     <div className="padding-panel">
  //       <div className="content-panel">
  //         <PanelHeader
  //           stepNumber={stepNumber}
  //           label={`${bulkOperationMode} issues`}
  //           completionState={getStepCompletionState('move-or-edit')}
  //         />
  //         <FormSection>
  //           {renderStartMoveOrEditButton()}
  //         </FormSection>
  //         <FormSection>
  //           {renderIssueMoveActivityIndicator()}
  //         </FormSection>
  //         {renderIssueMoveRequestOutcome()}
  //         {renderIssueMoveOutcome()}
  //         {renderFlexboxEqualWidthGrowPanel()}
  //       </div>
  //     </div>
  //   );
  // }

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

    const renderedSelectedIssueTypes = selectedIssueTypes.map((issueType: IssueType) => {
      return (
        <li key={issueType.id}>
          <strong>{issueType.name}</strong> ({issueType.id})
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
          <ul>
            {renderedSelectedIssueTypes}
          </ul>

          <h4>Projects</h4>
          <pre>
            {JSON.stringify(debugInfo.projects, null, 2)}
          </pre>

          <h4>Issue types</h4>
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
        <div className="warning-message">
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
      <h3>Bulk {bulkOperationMode} Issues</h3>
      {showCompletionStateDebug ? renderStepCompletionState() : null}
      {rendermainWarningMessage()}
      <div className="bulk-move-main-panel">
        {isStepApplicableToBulkOperationMode('filter') ? renderFilterPanel(lastStepNumber++) : null}
        {isStepApplicableToBulkOperationMode('issue-selection') ? renderIssuesPanel(lastStepNumber++) : null}
        {isStepApplicableToBulkOperationMode('issue-type-mapping') ? renderTargetProjectPanel(lastStepNumber++) : null}
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
