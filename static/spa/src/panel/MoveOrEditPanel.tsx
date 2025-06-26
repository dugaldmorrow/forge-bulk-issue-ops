import React, { useState, useEffect, useRef } from 'react';
import { FormSection, Label } from '@atlaskit/form';
import Button from '@atlaskit/button/new';
import Toggle from '@atlaskit/toggle';
import { FlagOptions, showFlag, invoke } from '@forge/bridge';
import { LinearProgress } from '@mui/material';
import issueMoveController from 'src/controller/issueMoveController';
import { WaitingMessageBuilder } from 'src/controller/WaitingMessageBuilder';
import { StepName } from 'src/model/BulkOperationsWorkflow';
import { taskStatusPollPeriodMillis } from 'src/model/config';
import editedFieldsModel from 'src/model/editedFieldsModel';
import { Activity } from 'src/types/Activity';
import { BulkOperationMode } from 'src/types/BulkOperationMode';
import { CompletionState } from 'src/types/CompletionState';
import { IssueMoveEditRequestOutcome } from 'src/types/IssueMoveRequestOutcome';
import { TaskOutcome } from 'src/types/TaskOutcome';
import { renderPanelMessage } from 'src/widget/PanelMessage';
import targetProjectFieldsModel from '../controller/TargetProjectFieldsModel';
import { Project } from 'src/types/Project';
import { IssueMoveEditOutcomeResult } from 'src/types/IssueMoveOutcomeResult';
import Lozenge from '@atlaskit/lozenge';
import { TaskStatusLozenge } from 'src/widget/TaskStatusLozenge';
import { formatProject } from 'src/controller/formatters';
import issueEditController from 'src/controller/issueEditController';
import { uuid } from 'src/model/util';
import { IssueSelectionState } from '../types/IssueSelectionState';

const showDebug = false;

export type MoveOrEditPanelProps = {
  bulkOperationMode: BulkOperationMode;
  fieldMappingsComplete: boolean;
  issueSelectionState: IssueSelectionState,
  selectedToProject: Project | undefined;
  allDefaultValuesProvided: boolean;
  lastInputConditionsChangeTime: number;
  onSetStepCompletionState: (stepName: StepName, completionState: CompletionState) => void;
  onSetMainWarningMessage: (message: string) => void;
}

export const MoveOrEditPanel = (props: MoveOrEditPanelProps) => {

  const [sendBulkNotification, setSendBulkNotification] = useState<boolean>(false);
  const [currentMoveEditActivity, setCurrentMoveEditActivity] = useState<undefined | Activity>(undefined);
  const [issueMoveEditRequestOutcome, setIssueMoveEditRequestOutcome] = useState<undefined | IssueMoveEditRequestOutcome>(undefined);
  const [issueMoveEditOutcome, setIssueMoveEditOutcome] = useState<undefined | TaskOutcome>(undefined);
  const [issueMoveEditCompletionTime, setIssueMoveEditCompletionTime] = useState<number>(0);
  const [lastMoveEditCompletionTaskId, setLastMoveEditCompletionTaskId] = useState<string>('none');
  const countOfIssuesToMoveOrEdit = useRef<number>(0);

  const crossCheckIssueSelectionState = (): boolean => {
    const issueSelectionState = editedFieldsModel.getIssueSelectionState();
    const providedIssues = props.issueSelectionState.selectedIssues;
    if (providedIssues.length !== issueSelectionState.selectedIssues.length) {
      console.warn(`BulkOperationPanel: crossCheckIssueSelectionState: Provided issues length (${providedIssues.length}) does not match selected issues length (${issueSelectionState.selectedIssues.length}).`);
      console.warn(`BulkOperationPanel: providedIssues                     = ${JSON.stringify(providedIssues.map(issue => issue.key))}`);
      console.warn(`BulkOperationPanel: issueSelectionState.selectedIssues = ${JSON.stringify(issueSelectionState.selectedIssues.map(issue => issue.key))}`);
      return false;
    } else {
      console.log(`BulkOperationPanel: crossCheckIssueSelectionState: Provided issues length matches selected issues length (${providedIssues.length}).`);
      return true;
    }
  }

  useEffect(() => {
    if (issueMoveEditCompletionTime < props.lastInputConditionsChangeTime) {
      // Reset the completion time if the last input conditions change time is greater than the current completion time.
      setIssueMoveEditCompletionTime(0);
      setIssueMoveEditOutcome(undefined);
      setIssueMoveEditRequestOutcome(undefined);
      setCurrentMoveEditActivity(undefined);
      props.onSetStepCompletionState('move-or-edit', 'incomplete');
    }
  }, [props.lastInputConditionsChangeTime]);

  const buildTaskOutcomeErrorMessage = (taskOutcome: IssueMoveEditRequestOutcome): string => {
    if (taskOutcome.errors && taskOutcome.errors.length) {
      let combinedErrorMessages = '';
      for (const error of taskOutcome.errors) {
        const separator = combinedErrorMessages.length > 0 ? ', ' : '';
        combinedErrorMessages += `${separator}${error.message}`;
      }
      return combinedErrorMessages;
    } else {
      return '';
    }
  }

  const onMoveOrEditCompletion = async (taskId: string, outcome: TaskOutcome): Promise<void> => {
    setLastMoveEditCompletionTaskId(taskId);
    const description = outcome.status === 'COMPLETE' ?
      `Work items ${props.bulkOperationMode === 'Move' ? 'moved' : 'edited'} successfully.` :
      `There were problems ${props.bulkOperationMode === 'Move' ? 'moving' : 'editing'} the work items.`;
    // console.log(`BulkOperationPanel: pollPollMoveOutcome: Move completed with taskId ${taskId}`);
    const flagOptions: FlagOptions = {
      id: taskId,
      type: outcome.status === 'COMPLETE' ? 'info' : 'error',
      title: outcome.status === 'COMPLETE' ? `${props.bulkOperationMode} completed` : `${props.bulkOperationMode} ended with status ${outcome.status}`,
      description: description,
      isAutoDismiss: outcome.status === 'COMPLETE',
      actions: outcome.status === 'COMPLETE' ? [] : [{
        text: 'Got it',
        onClick: async () => {
          flag.close();
        },
      }]
    }
    const flag = showFlag(flagOptions);
  }

  const pollPollMoveOrEditOutcome = async (
    taskId: string,
    onCompletionCallback: (taskId: string, outcome: TaskOutcome) => Promise<void>
  ): Promise<void> => {
    if (taskId) {
      const outcome: TaskOutcome = await issueMoveController.pollMoveProgress(taskId);
      setIssueMoveEditOutcome(outcome);
      if (issueMoveController.isDone(outcome.status)) {
        setIssueMoveEditCompletionTime(Date.now());
        if (taskId !== lastMoveEditCompletionTaskId) {
          await onCompletionCallback(taskId, outcome);
        }
        setCurrentMoveEditActivity(undefined);
        props.onSetStepCompletionState('move-or-edit', 'complete');
      } else {
        asyncPollMoveOrEditOutcome(taskId);
        props.onSetStepCompletionState('move-or-edit', 'incomplete');
      }
    } else {
      props.onSetMainWarningMessage(`No taskId provided for polling move outcome.`);
      console.warn(`BulkOperationPanel: pollPollMoveOutcome: No taskId provided, cannot poll for move outcome.`);
      setCurrentMoveEditActivity(undefined);
      props.onSetStepCompletionState('move-or-edit', 'incomplete');
    }
  }

  const onMoveIssues = async (issueSelectionState: IssueSelectionState): Promise<void> => {
    console.log(`BulkOperationPanel: onMoveIssuesForLevel: Moving ${issueSelectionState.selectedIssues.length} issues. Issues being moved = ${issueSelectionState.selectedIssues.map(issue => issue.key).join(', ')}`);
    // Step 1: Initiate the bulk move request...
    countOfIssuesToMoveOrEdit.current = issueSelectionState.selectedIssues.length;
    const destinationProjectId: string = props.selectedToProject.id;
    setIssueMoveEditRequestOutcome(undefined);
    setCurrentMoveEditActivity({taskId: 'non-jira-activity', description: 'Initiating bulk move request...'});
    const targetIssueTypeIdsToTargetMandatoryFields = targetProjectFieldsModel.buildIssueTypeIdsToTargetMandatoryFields();
    const initiateOutcome: IssueMoveEditRequestOutcome = await issueMoveController.initiateMove(
      destinationProjectId,
      props.issueSelectionState.selectedIssues,
      targetIssueTypeIdsToTargetMandatoryFields,
      sendBulkNotification
    );
    setCurrentMoveEditActivity(undefined);
    console.log(`BulkOperationPanel: bulk issue move request outcome: ${JSON.stringify(initiateOutcome, null, 2)}`);
    const taskOutcomeErrorMessage = buildTaskOutcomeErrorMessage(initiateOutcome);
    if (taskOutcomeErrorMessage) {
      const fullErrorMessage = `Failed to initiate bulk move request: ${taskOutcomeErrorMessage}`;
      props.onSetMainWarningMessage(fullErrorMessage);
      console.warn(fullErrorMessage);
      setIssueMoveEditRequestOutcome(undefined);
      setCurrentMoveEditActivity(undefined);
      showBulkOperationErrorFlag(fullErrorMessage);
    } else {
      // Step 2: Start polling for the outcome...
      setCurrentMoveEditActivity({taskId: initiateOutcome.taskId, description: `Moving ${issueSelectionState.selectedIssues.length} selected work items...`});
      pollPollMoveOrEditOutcome(initiateOutcome.taskId, onMoveOrEditCompletion);
    }
  }

  const onEditIssues = async (issueSelectionState: IssueSelectionState): Promise<void> => {
    // Step 1: Update the model with final inputs...
    countOfIssuesToMoveOrEdit.current = issueSelectionState.selectedIssues.length;
    editedFieldsModel.setSendBulkNotification(sendBulkNotification);

    const crossCheckOk = crossCheckIssueSelectionState();
    if (!crossCheckOk) {
      const errorMessage = `BulkOperationPanel.onEditIssues: Selected issues do not match the issues in the edited fields model. Please check your selection.`;
      console.warn(errorMessage);
      await invoke('logMessage', { message: errorMessage, level: 'warn' });
      await editedFieldsModel.setIssueSelectionState(issueSelectionState);
    }

    // Step 2: Initiate the bulk edit request...
    setIssueMoveEditRequestOutcome(undefined);
    setCurrentMoveEditActivity({taskId: 'non-jira-activity', description: 'Initiating bulk edit request...'});
    const initiateOutcome = await issueEditController.initiateBulkEdit();
    setCurrentMoveEditActivity(undefined);
    console.log(`BulkOperationPanel: bulk issue edit request outcome: ${JSON.stringify(initiateOutcome, null, 2)}`);
    const taskOutcomeErrorMessage = buildTaskOutcomeErrorMessage(initiateOutcome);
    if (taskOutcomeErrorMessage) {
      const fullErrorMessage = `Failed to initiate bulk edit request: ${taskOutcomeErrorMessage}`;
      props.onSetMainWarningMessage(fullErrorMessage);
      console.warn(fullErrorMessage);
      setIssueMoveEditRequestOutcome(undefined);
      setCurrentMoveEditActivity(undefined);
      showBulkOperationErrorFlag(fullErrorMessage);
    } else {
      // Step 3: Start polling for the outcome...
      setCurrentMoveEditActivity({taskId: initiateOutcome.taskId, description: `Editing ${issueSelectionState.selectedIssues.length} work items...`});
      pollPollMoveOrEditOutcome(initiateOutcome.taskId, onMoveOrEditCompletion);
    }
  }

  const asyncPollMoveOrEditOutcome = async (taskId: string): Promise<void> => {
    setTimeout(async () => {
      await pollPollMoveOrEditOutcome(taskId, onMoveOrEditCompletion);
    }, taskStatusPollPeriodMillis);
  }

  const buildButtonLabel = (): string => {
    if (props.issueSelectionState.selectedIssues.length === 0) {
      return `${props.bulkOperationMode} work items`;
    } else if (props.bulkOperationMode === 'Move') {
      let label = `Move ${props.issueSelectionState.selectedIssues.length} issue${props.issueSelectionState.selectedIssues.length > 1 ? 's' : ''}`;
      if (props.selectedToProject) {
        label += ` to ${formatProject(props.selectedToProject)}`;
      }
      return label;
    } else if (props.bulkOperationMode === 'Edit') {
      const editedFieldsCount = editedFieldsModel.getEditCount();
      let label = 'Edit';
      if (editedFieldsCount > 0) {
        label += ` ${editedFieldsCount} field${editedFieldsCount > 1 ? 's' : ''} for`;
      }
      if (props.issueSelectionState.selectedIssues.length > 0) {
        label += ` ${props.issueSelectionState.selectedIssues.length} issue${props.issueSelectionState.selectedIssues.length > 1 ? 's' : ''}`;
      }
      return label;
    }
    throw new Error(`Unsupported bulk operation mode: ${props.bulkOperationMode}`);
  }

  const showBulkOperationErrorFlag = (errorMessage: string): void => {
    const flagOptions: FlagOptions = {
      id: uuid(),
      type: 'error',
      title: `Bulk edit error`,
      description: errorMessage,
      isAutoDismiss: false,
      actions: [{
        text: 'Acknowledge',
        onClick: async () => {
          flag.close();
        },
      }]
    }
    const flag = showFlag(flagOptions);
  }

  const renderEditSummary = () => {
    if (props.bulkOperationMode === 'Edit') {
      const editCount = editedFieldsModel.getEditCount();
      if (editCount > 0) {
        let editFieldNames = '';
        editedFieldsModel.iterateFieldsSelectedForChange((field, value) => {
          if (editFieldNames.length > 0) {
            editFieldNames += ', ';
          }
          editFieldNames += field.name;
        });
        return (
          <div>
            <FormSection>
              <Label htmlFor="edit-summary">Fields that will be edited: </Label>
              <div>
                {editFieldNames}
              </div>
            </FormSection>
          </div>
        );
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  const renderSendBulkNotificationToggle = () => {
    return (
      <div style={{display: 'flex', alignItems: 'center', marginBottom: '10px'}}>
        <Toggle
          id={`send-bulk-notification-toggle`}
          isChecked={sendBulkNotification}
          onChange={(event: any) => {
            setSendBulkNotification(event.target.checked);
          }}
        />
        <div>
          <Label htmlFor="send-bulk-notification-toggle">Send bulk notification</Label>
        </div>
      </div>
    );
  }

  const renderStartMoveOrEditButton = () => {
    let waitingMessage = '';
    if (props.bulkOperationMode === 'Move') {
      const debugReasonForFieldMappingIncompleteness = false;
      const fieldMappingIncompletenessReason = debugReasonForFieldMappingIncompleteness ? targetProjectFieldsModel.getFieldMappingIncompletenessReason() : '';
      waitingMessage = new WaitingMessageBuilder()
        .addCheck(fieldMappingIncompletenessReason === '', fieldMappingIncompletenessReason)
        .addCheck(props.fieldMappingsComplete, 'Field value mapping is not yet complete.')
        // .addCheck(allDefaultValuesProvided, 'Field value mapping is not yet complete.')
        .addCheck(!!props.selectedToProject && !!props.selectedToProject.id, 'Target project is not selected.')
        // .addCheck(selectedIssues.length > 0, 'No issues selected.')
        .addCheck(!currentMoveEditActivity, 'Current move activity is not yet complete.')
        .build();
    } else if (props.bulkOperationMode === 'Edit') {
      const editValuesSpecified = editedFieldsModel.haveValuesBeenSpecified();
      waitingMessage = new WaitingMessageBuilder()
        // .addCheck(isStepComplete('edit-fields'), 'Waiting for edits to be specified.')
        .addCheck(editedFieldsModel.getEditCount() > 0, 'Waiting for at least one field edit to be specified.')
        .addCheck(editValuesSpecified, 'Waiting for at least one new field value.')
        .build();
    }
    const buttonEnabled = waitingMessage === '';
    return (
      <div>
        {renderPanelMessage(waitingMessage, {marginTop: '-6px', marginBottom: '20px'})}
        <Button
          appearance={buttonEnabled ? 'primary' : 'default'}
          isDisabled={!buttonEnabled}
          onClick={() => {
            setIssueMoveEditOutcome(undefined);
            if (props.bulkOperationMode === 'Move') {
              onMoveIssues(props.issueSelectionState);
            } else if (props.bulkOperationMode === 'Edit') {
              onEditIssues(props.issueSelectionState);
            }
          }}
        >
          {buildButtonLabel()}
        </Button>
      </div>
    );
  }

  const renderIssueMoveActivityIndicator = () => {
    if (currentMoveEditActivity || issueMoveEditOutcome) {
      const description = currentMoveEditActivity ? currentMoveEditActivity.description : issueMoveEditOutcome ? issueMoveEditOutcome.status : 'No activity';
      // https://mui.com/material-ui/api/linear-progress/
      const progressPercent = issueMoveEditOutcome ? issueMoveEditOutcome.progress : 0;
      return (
        <div>
          <Label htmlFor={''}>{description}</Label>
          <LinearProgress variant="determinate" value={progressPercent} color="secondary" />
        </div>
      );
    } else {
      return null;
    }
  }

  const renderIssueMoveEditRequestOutcome = () => {
    if (issueMoveEditRequestOutcome) {
      const renderedErrors = issueMoveEditRequestOutcome.errors ? issueMoveEditRequestOutcome.errors.map((error: Error, index: number) => {
        return (
          <div key={`issue-move-request-error-${index}`} className="inline-error-message">
            {error.message}
          </div>
        );
      }) : null;
      return (
        <div>
          {renderedErrors}
        </div>
      );
    } else {
      return null;
    }
  }

  const renderIssueMoveEditOutcome = () => {
    if (issueMoveEditOutcome) {
      const moveResult: IssueMoveEditOutcomeResult | undefined = issueMoveEditOutcome.result;
      const movedCount = moveResult ? moveResult.successfulIssues.length : -1;
      const failedCount = moveResult ? moveResult.totalIssueCount - movedCount : -1;
      const renderedMovedSuffix = movedCount > countOfIssuesToMoveOrEdit.current ? <span>{' '}(some work items had children that were also moved)</span> : null;
      const renderedIssuesMovedResult = issueMoveEditOutcome.result ? <span># work items {props.bulkOperationMode === 'Move' ? 'moved' : 'edited'}: <><Lozenge appearance="success">{movedCount}</Lozenge>{renderedMovedSuffix}</></span> : null;
      const renderedIssuesNotMovedResult = issueMoveEditOutcome.result ? <span># work items not {props.bulkOperationMode === 'Move' ? 'moved' : 'edited'}: <Lozenge appearance="removed">{failedCount}</Lozenge></span> : null;
      const renderedOutcomeDebugJson = showDebug ? <pre>{JSON.stringify(issueMoveEditOutcome, null, 2)}</pre> : null;
      const progressPercent = issueMoveEditOutcome.progress ?? 0;
      const renderedProgress = <div>Progress: {progressPercent}%</div>;
      return (
        <div key={`issue-move-outcome-${props.allDefaultValuesProvided}`} style={{margin: '20px 0px'}}>
          <Label htmlFor="none">Issues moved to the {props.selectedToProject?.name} ({props.selectedToProject?.key}) project</Label>
          <ul>
            <li>Status: <TaskStatusLozenge status={issueMoveEditOutcome.status} /></li>
            <li>{renderedIssuesMovedResult}</li>
            <li>{renderedIssuesNotMovedResult}</li>
            <li>{renderedProgress}</li>
          </ul>
          {renderedOutcomeDebugJson}
        </div>
      );
    } else {
      return null;
    }
  }

  return (
    <div>
      <FormSection>
        {renderSendBulkNotificationToggle()}
      </FormSection>
      {renderEditSummary()}
      <FormSection>
        {renderStartMoveOrEditButton()}
      </FormSection>
      <FormSection>
        {renderIssueMoveActivityIndicator()}
      </FormSection>
      {renderIssueMoveEditRequestOutcome()}
      {renderIssueMoveEditOutcome()}
    </div>
  );

}
