import React, { useEffect, useState } from "react";
import { FormSection } from "@atlaskit/form";
import { LoadingState } from "../types/LoadingState";
import { LinearProgress } from '@mui/material';
import Lozenge from "@atlaskit/lozenge";
import Toggle from "@atlaskit/toggle";
import { Radio } from '@atlaskit/radio';
import { IssueSearchInfo } from "../types/IssueSearchInfo";
import { Issue } from "../types/Issue";
import SuccessIcon from '@atlaskit/icon/core/success';
import CrossCircleIcon from '@atlaskit/icon/core/cross-circle';
import placeholderImage from './issue-filter-placeholder.png';
import jiraUtil from "src/controller/jiraUtil";

export type IssueSelectionPanelProps = {
  loadingState: LoadingState;
  issueSearchInfo: IssueSearchInfo;
  selectedIssues: Issue[];
  allowBulkMovesFromMultipleProjects: boolean;
  onIssuesSelectionChange: (selectedIssues: Issue[]) => Promise<void>;
}

type GlobalSelectionMode = 'All' | 'Some' | 'None';

export const IssueSelectionPanel = (props: IssueSelectionPanelProps) => {

  const [multipleProjectsDetected, setMultipleProjectsDetected] = useState<boolean>(
    jiraUtil.countProjectsByIssues(props.issueSearchInfo.issues) > 1);
  const [globalSelectionMode, setGlobalSelectionMode] = useState<GlobalSelectionMode>(multipleProjectsDetected ? 'Some' : 'All');

  useEffect(() => {
    setMultipleProjectsDetected(jiraUtil.countProjectsByIssues(props.issueSearchInfo.issues) > 1);
  }, [props.issueSearchInfo.issues]);


  const onToggleIssueSelection = (issueToToggle: Issue) => {
    if (globalSelectionMode === 'Some') {
      const newSelectedIssues: Issue[] = [];
      for (const issue of props.issueSearchInfo.issues) {
        const existingSelectedIssueKey = props.selectedIssues.find((selectedIssue: Issue) => {
          return selectedIssue.key === issue.key;
        });
        const issueIsSelected = !!existingSelectedIssueKey;
        if (issue.key === issueToToggle.key) {
          if (issueIsSelected) {
            // don't add
          } else {
            newSelectedIssues.push(issue);
          }
        } else if (issueIsSelected){
          newSelectedIssues.push(issue);
        }
      }
      console.log(` * IssueSelectionPanel: Computed new issue selection: ${newSelectedIssues.map(issue => issue.key).join(', ')}`);
      props.onIssuesSelectionChange(newSelectedIssues);
    }
  }

  const onGlobalSelectionModeChange = (mode: GlobalSelectionMode) => {
    setGlobalSelectionMode(mode);
    if (mode === 'All' || mode === 'None') {
      let changeDetected = false;
      const newSelectedIssues: Issue[] = [];
      for (const issue of props.issueSearchInfo.issues) {
        const currentlySelected = props.selectedIssues.find(selectedIssue => selectedIssue.key === issue.key);
        if (mode === 'All') {
          changeDetected = changeDetected || !currentlySelected;
          newSelectedIssues.push(issue);
        } else if (mode === 'None') {
          changeDetected = changeDetected || !!currentlySelected;
        } else {
          throw new Error(`Unreachable`);
        }
      }
      props.onIssuesSelectionChange(newSelectedIssues);
    }
  }

  const renderIssueLoading = () => {
    return (
      <div style={{margin: '12px 0px 12px 0px'}}>
        {props.loadingState === 'busy' ? <LinearProgress color="secondary" /> : <div style={{height: '4px'}}></div>} 
      </div>
    );
  }

  const renderGlobalRadioOption = (mode: GlobalSelectionMode, label: string) => {
    return (
      <Radio
				value={mode}
				label={mode}
				name="global-selection-mode"
				testId="global-selection-mode"
				isChecked={mode === globalSelectionMode}
        isDisabled={multipleProjectsDetected}
				onChange={() => {
          onGlobalSelectionModeChange(mode);
        }}
			/>
    );
  }

  const renderGlobalSelectionControls = () => {
    return (
      <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '12px'}}>
        {renderGlobalRadioOption('All', 'All')}
        {renderGlobalRadioOption('Some', 'Some')}
        {renderGlobalRadioOption('None', 'None')}
      </div>
    );
  }

  const renderIssueSelectionWidget = (issue: Issue) => {
    if (globalSelectionMode === 'All') {
      return (
        <div className="faked-toggle checked-faked-toggle"><div><div className="toggle-container"><SuccessIcon label="" color="currentColor" /></div></div></div>
      )
    } else if (globalSelectionMode === 'Some') {
      return (
        <div>
          <Toggle
            key={`issue-select-${issue.key}`}
            id={`toggle-${issue.key}`}
            isChecked={!!props.selectedIssues.find(selectedIssue => selectedIssue.key === issue.key)}
            isDisabled={multipleProjectsDetected || globalSelectionMode !== 'Some'}
            onChange={(event: any) => {
              onToggleIssueSelection(issue);
            }}
          />
        </div>
      )
    } else if (globalSelectionMode === 'None') {
      return (
        <div className="faked-toggle unchecked-faked-toggle"><div><div className="toggle-container"><CrossCircleIcon label="" color="currentColor" /></div></div></div>
      )
    } else {
      throw new Error(`Unreachable: globalSelectionMode = ${globalSelectionMode}`);
    }
  }

  const renderMultipleProjectsError = () => {
    return (
      <div className="error-message">
        <p>The issues are in multiple projects but this is not supported. Please select issues from a single project or enable bulk moves from multiple projects in the app settings.</p>
      </div>
    );
  }

  const renderIssuesPanel = () => {
    const hasIssues = props.issueSearchInfo.issues.length > 0;
    const renderedIssues = hasIssues ? props.issueSearchInfo.issues.map((issue: Issue) => {
      const issueIsInSelectedFromProject = true;
      return (
        <div key={`issue-key-${issue.key}`}>
          <div 
            key={`issue-select-${issue.key}`}
            className="issue-selection-panel"
          >
            <div>
              {renderIssueSelectionWidget(issue)}
            </div>
            <div key={`issue-id-type-${issue.key}-${issue.fields.issuetype.id}`} className={`issue-summary-panel ${issueIsInSelectedFromProject ? '' : 'disabled-text'}`}> 
              <Lozenge appearance="inprogress">{issue.fields.issuetype.name}</Lozenge>
            </div>
            <div key={`issue-${issue.key}`} className={`issue-summary-panel clip-text-300 ${issueIsInSelectedFromProject ? '' : 'disabled-text'}`}> 
              {issue.key}: {issue.fields.summary}
            </div>
          </div>
        </div>
      );
    }) : null;
    return (
      <>
        <div style={{marginTop: '20px', marginBottom: '-20px'}}>
          {multipleProjectsDetected ? renderMultipleProjectsError() : null}
        </div>
        {renderIssueLoading()}
        <FormSection>
          {renderGlobalSelectionControls()}
          {renderedIssues}
        </FormSection>
      </>
    );
  }

  const renderPlaceholder = () => {
    return (
      <div style={{ margin: '20px 0px' }}>
        <div style={{ opacity: 0.5 }}>
          <img src={placeholderImage} width="220px" alt="placeholder" />
        </div>
      </div>
    );
  }

  return (
    <>
      {props.issueSearchInfo.issues.length === 0 ? renderPlaceholder() : renderIssuesPanel()}
    </>
  );

}