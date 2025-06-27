import React, { useEffect, useState, useRef } from 'react';
import { Issue } from "../types/Issue";
import { IssueType } from '../types/IssueType';
import { Project } from 'src/types/Project';
import Select from '@atlaskit/select';
import { Option } from '../types/Option'
import jiraDataModel from 'src/model/jiraDataModel';
import bulkIssueTypeMappingModel from '../model/bulkIssueTypeMappingModel';
import { formatIssueType, formatProject } from 'src/controller/formatters';
import { BulkOperationMode } from 'src/types/BulkOperationMode';
import { equalIssueSelections, expandIssueArrayToIncludeSubtasks, selectionToString } from 'src/model/issueSelectionUtil';
import { IssueSelectionState } from 'src/types/IssueSelectionState';
import { allowedBulkMoveIssueTypeMappings, bulkMoveIssueTypeMappingStrategy, restrictIssueTypeMoveMappingsToSameHierarchyLevel, subtaskMoveStrategy } from 'src/extension/bulkOperationStaticRules';
import { PanelMessage } from 'src/widget/PanelMessage';

const showDebug = false;

type RowData = {
  sourceProject: Project;
  sourceIssueType: IssueType;
}

export type IssueTypeMappingPanelProps = {
  allIssueTypes: IssueType[],
  issueSelectionState: IssueSelectionState,
  targetProject: undefined | Project;
  bulkOperationMode: BulkOperationMode;
  filterIssueTypes: (issueTypes: IssueType[], targetProject: Project, bulkOperationMode: BulkOperationMode) => IssueType[];
  onIssueTypeMappingChange: (issueSelectionState: IssueSelectionState, originalMappingCount: number, newMappingCount: number) => Promise<void>;
}

const IssueTypeMappingPanel = (props: IssueTypeMappingPanelProps) => {

  const [targetProjectIssueTypes, setTargetProjectIssueTypes] = useState<IssueType[]>([]);
  const [allRowData, setAllRowData] = useState<RowData[]>([]);
  const [clonedSourceToTargetIssueTypeIds, setClonedSourceToTargetIssueTypeIds] = useState<Map<string, string>>(
    bulkIssueTypeMappingModel.cloneSourceToTargetIssueTypeIds());
  const issueSelectionStateRef = useRef<IssueSelectionState>(props.issueSelectionState);
  const autoSelectIdRef = useRef<number>(0);

  useEffect(() => {
    onMount();
    return () => {
      onUnmount();
    };
  }, []);

  useEffect(() => {
    onTargetProjectTypeChanged(props.targetProject);
  }, [props.targetProject]);

  useEffect(() => {
    autoSelectMatchingTargetIssueTypes();
  }, [targetProjectIssueTypes, props.issueSelectionState.uuid]);

  const onMount = async (): Promise<void> => {
    setClonedSourceToTargetIssueTypeIds(bulkIssueTypeMappingModel.cloneSourceToTargetIssueTypeIds());
    // bulkIssueTypeMapping.registerListener(onBulkIssueTypeMappingChange);
    const rowData = await buildAllRowData(props.issueSelectionState.selectedIssues);
    setAllRowData(rowData);
  }

  const onUnmount = (): void => {
    // bulkIssueTypeMapping.unregisterListener(onBulkIssueTypeMappingChange);
  }

  const onTargetProjectTypeChanged = async (targetProject: Project): Promise<void> => {
    await loadTargetProjectIssueTypes();
    await autoSelectMatchingTargetIssueTypes();
  }

  const buildAllRowData = async (issues: Issue[]): Promise<RowData[]> => {
    const expandedIssues = subtaskMoveStrategy === 'move-subtasks-explicitly-with-parents' ?
      await expandIssueArrayToIncludeSubtasks(issues) : issues;
    const allRowData: RowData[] = [];
    const consumedProjectIssueTypePairs = new Set<string>();
    for (const issue of expandedIssues) {
      const project = issue.fields.project;
      const issueType = issue.fields.issuetype;
      const projectIssuTypePair = `${project.id},${issueType.id}`;
      if (!consumedProjectIssueTypePairs.has(projectIssuTypePair)) {
        consumedProjectIssueTypePairs.add(projectIssuTypePair);
        const rowData: RowData = {
          sourceProject: project,
          sourceIssueType: issueType
        };
        allRowData.push(rowData);
      }
    }
    return allRowData;
  }

  const autoSelectMatchingTargetIssueTypes = async (): Promise<void> => {
    autoSelectIdRef.current++;
    const myAutoSelectId = autoSelectIdRef.current;

    setClonedSourceToTargetIssueTypeIds(new Map<string, string>());

    issueSelectionStateRef.current = props.issueSelectionState;
    if (!props.targetProject) {
      // console.log(`IssueTypeMappingPanel.autoSelectMatchingTargetIssueTypes: skipping auto selection since target project is not defined.`);
      return;
    }

    const originalMappingCount = bulkIssueTypeMappingModel.getMappingsCount();
    // console.log(`IssueTypeMappingPanel.autoSelectMatchingTargetIssueTypes: Auto selecting matching target issue types for ${props.selectedIssues.length} selected issues.`);
    const rowData = await buildAllRowData(issueSelectionStateRef.current.selectedIssues);
    if (autoSelectIdRef.current !== myAutoSelectId) {
      // console.log(`IssueTypeMappingPanel.autoSelectMatchingTargetIssueTypes: Skipping auto selection since the autoSelectId has changed from ${myAutoSelectId} to ${autoSelectIdRef.current}.`);
      return;
    }
    // console.log(`IssueTypeMappingPanel.autoSelectMatchingTargetIssueTypes: Auto selection is still current.`);
    setAllRowData(rowData);
    let newMappingsCount = 0;
    let unmappedCount = 0;
    const expandedIssues = subtaskMoveStrategy === 'move-subtasks-explicitly-with-parents' ?
      await expandIssueArrayToIncludeSubtasks(issueSelectionStateRef.current.selectedIssues) : issueSelectionStateRef.current.selectedIssues;
    for (const issue of expandedIssues) {
      const sourceProject = issue.fields.project;
      const sourceIssueType = issue.fields.issuetype;
      const existingTargetIssueTypeId = bulkIssueTypeMappingModel.getTargetIssueTypeId(sourceProject.id, sourceIssueType.id);
      if (existingTargetIssueTypeId) {
        // Do nothing - don't override existing mappings.
        // console.log(`IssueTypeMappingPanel.autoSelectMatchingTargetIssueTypes: Existing mapping found for source project: ${sourceProject.key}, source issue type: ${sourceIssueType.name} (${sourceIssueType.id}) - target issue type: ${existingTargetIssueTypeId}.`);
      } else {
        // Auto select the same issue type if possible where the source and target issue type names match.
        const matchingTargetIssueType = targetProjectIssueTypes.find(issueType => issueType.name === sourceIssueType.name);
        if (matchingTargetIssueType) {
          // console.log(`IssueTypeMappingPanel.autoSelectMatchingTargetIssueTypes: Auto selecting target issue type: ${matchingTargetIssueType.name} (${matchingTargetIssueType.name}) for source project: ${sourceProject.key}, source issue type: ${sourceIssueType.name}`);

          const mappingAllowed = isMappingAllowed(sourceProject.id, sourceIssueType.id, matchingTargetIssueType.id);

          if (mappingAllowed) {
            bulkIssueTypeMappingModel.addMapping(sourceProject.id, sourceIssueType.id, matchingTargetIssueType.id);
            newMappingsCount++;``
          } else {
            // console.log(`IssueTypeMappingPanel.autoSelectMatchingTargetIssueTypes: Mapping not allowed for source project: ${sourceProject.key}, source issue type: ${sourceIssueType.name} (${sourceIssueType.id}) - target issue type: ${matchingTargetIssueType.name} (${matchingTargetIssueType.id}).`);
          }
        } else {
          unmappedCount++;
          // console.log(`IssueTypeMappingPanel.autoSelectMatchingTargetIssueTypes: No matching target issue type found for source project: ${sourceProject.id}, source issue type: ${sourceIssueType.id}.`);
        }
      }
    }
    const newMappingCount =  bulkIssueTypeMappingModel.getMappingsCount();
    const clonedSourceToTargetIssueTypeIds = bulkIssueTypeMappingModel.cloneSourceToTargetIssueTypeIds();
    setClonedSourceToTargetIssueTypeIds(clonedSourceToTargetIssueTypeIds);
    // console.log(`autoSelectMatchingTargetIssueTypes: Finished auto selecting - unmappedCount = ${unmappedCount}.`);
    // console.log(`autoSelectMatchingTargetIssueTypes: newMappingsCount = ${newMappingsCount}.`);
    const originalIssueSelectionState = Object.assign({}, issueSelectionStateRef.current);
    // Since this occurs when there's a prop change, we only notify the parent after a delay to prevent the risk of a tight
    // infinite loop of prop and rendering changes.
    const notificationDelay = 1000;
    // The following random delay was use to test for timing issues that could potentially result in the field mapping panel 
    // remaining blank due to not getting the right notification.
    // const notificationDelay = 30000 + Math.floor(Math.random() * 20000);
    setTimeout(async () => {
      if (equalIssueSelections(issueSelectionStateRef.current, originalIssueSelectionState)) {
        // console.log(`IssueTypeMappingPanel.autoSelectMatchingTargetIssueTypes: Calling onIssueTypeMappingChange with originalMappingCount=${originalMappingCount}, newMappingCount=${newMappingCount}`);
        await props.onIssueTypeMappingChange(issueSelectionStateRef.current, originalMappingCount, newMappingCount);
      } else {
        // console.log(`IssueTypeMappingPanel.autoSelectMatchingTargetIssueTypes: Skipping onIssueTypeMappingChange since the issueSelectionState has changed:\n * originalIssueSelectionState = ${selectionToString(originalIssueSelectionState)};\n * issueSelectionStateRef.current = ${selectionToString(issueSelectionStateRef.current)};`);
      }
    }, notificationDelay);
  }

  const getTargetIssueTypeId = (sourceProjectId: string, sourceIssueTypeId: string): string | undefined => {
    const key = buildKey(sourceProjectId, sourceIssueTypeId);
    return clonedSourceToTargetIssueTypeIds.get(key);
  }

  const buildKey = (sourceProjectId: string, sourceIssueTypeId: string): string => {
    return `${sourceProjectId},${sourceIssueTypeId}`;
  }

  const onTargetIssueTypeChange = (sourceProjectId: string, sourceIssueTypeId: string, targetIssueTypeId: string) => {
    const originalMappingCount = bulkIssueTypeMappingModel.getMappingsCount();
    // console.log(`IssueTypeMappingPanel.onTargetIssueTypeChange: sourceProjectId=${sourceProjectId}, sourceIssueTypeId=${sourceIssueTypeId}, targetIssueTypeId=${targetIssueTypeId}`);
    bulkIssueTypeMappingModel.addMapping(sourceProjectId, sourceIssueTypeId, targetIssueTypeId);
    const clonedSourceToTargetIssueTypeIds = bulkIssueTypeMappingModel.cloneSourceToTargetIssueTypeIds();
    setClonedSourceToTargetIssueTypeIds(clonedSourceToTargetIssueTypeIds);
    const newMappingCount =  bulkIssueTypeMappingModel.getMappingsCount();
    props.onIssueTypeMappingChange(props.issueSelectionState, originalMappingCount, newMappingCount);
    // setTimeout(async () => {
    //   props.onIssueTypeMappingChange(props.issueSelectionState, originalMappingCount, newMappingCount);
    // }, 1000);
  }

  const determineInitiallySelectedOption = (
      sourceProjectId: string,
      sourceIssueTypeId: string,
      options: Option[]
  ): undefined | Option => {
    // console.log(`Determining initially selected option for source project: ${sourceProjectId}, source issue type: ${sourceIssueTypeId}`);
    const targetIssueTypeId = getTargetIssueTypeId(sourceProjectId, sourceIssueTypeId);
    const option = options.find((option: Option) => option.value === targetIssueTypeId);
    // console.log(` * initially selected option: ${option ? option.label : 'none'}`);
    return option && !option.isDisabled ? option : undefined;
  }

  const isMappingAllowed = (sourceProjectId: string, sourceIssueTypeId: string, targetIssueTypeId: string): boolean => {
    const sourceIssueType = props.allIssueTypes.find(issueType => issueType.id === sourceIssueTypeId);
    const targetIssueType = props.allIssueTypes.find(issueType => issueType.id === targetIssueTypeId);
    let allowed = false;
    if (sourceIssueType && targetIssueType) {
      allowed = !restrictIssueTypeMoveMappingsToSameHierarchyLevel || targetIssueType.hierarchyLevel === sourceIssueType.hierarchyLevel;
      if (bulkMoveIssueTypeMappingStrategy === 'exact-matches-and-allow-listed-mappings' || bulkMoveIssueTypeMappingStrategy === 'only-allow-listed-mappings') {
        if (bulkMoveIssueTypeMappingStrategy === 'exact-matches-and-allow-listed-mappings' && sourceIssueType.name === targetIssueType.name) {
          allowed = true;
        } else {
          const mappingKeys = Object.keys(allowedBulkMoveIssueTypeMappings);
          if (sourceIssueType && mappingKeys.includes(sourceIssueType.name) && allowedBulkMoveIssueTypeMappings[sourceIssueType.name] === targetIssueType.name) {
            allowed = true;
          } else {
            allowed = false;
          }
        }
      }
    } else {
      console.warn(`IssueTypeMappingPanel.isMappingAllowed: Mapping not allowed for source project: ${sourceProjectId}, source issue type: ${sourceIssueTypeId} (${sourceIssueType ? sourceIssueType.name : 'unknown'}) - target issue type: ${targetIssueTypeId} (${targetIssueType ? targetIssueType.name : 'unknown'}).`);
    }
    return allowed;    
  }

  const isIssueTypeSelectable = (sourceIssueType: IssueType | undefined, targetIssueType: IssueType): boolean => {
    let isIssueTypeSelectable = !restrictIssueTypeMoveMappingsToSameHierarchyLevel || (sourceIssueType && targetIssueType.hierarchyLevel === sourceIssueType.hierarchyLevel);
    if (bulkMoveIssueTypeMappingStrategy === 'exact-matches-and-allow-listed-mappings' || bulkMoveIssueTypeMappingStrategy === 'only-allow-listed-mappings') {
      if (bulkMoveIssueTypeMappingStrategy === 'exact-matches-and-allow-listed-mappings' && sourceIssueType.name === targetIssueType.name) {
        isIssueTypeSelectable = true;
      } else {
        const mappingKeys = Object.keys(allowedBulkMoveIssueTypeMappings);
        if (sourceIssueType && mappingKeys.includes(sourceIssueType.name) && allowedBulkMoveIssueTypeMappings[sourceIssueType.name] === targetIssueType.name) {
          isIssueTypeSelectable = true;
        } else {
          isIssueTypeSelectable = false;
        }
      }
    }
    return isIssueTypeSelectable;
  }

  const renderTargetProjectIssueTypeSelect = (sourceProjectId: string, sourceIssueTypeId: string) => {
    const options: Option[] = [];
    const sourceIssueType = props.allIssueTypes.find(issueType => issueType.id === sourceIssueTypeId);
    const filteredIssueTypes = props.filterIssueTypes(targetProjectIssueTypes, props.targetProject, props.bulkOperationMode);
    for (const targetIssueType of filteredIssueTypes) {
      const optionSelectable = isIssueTypeSelectable(sourceIssueType, targetIssueType);
      const option: Option = {
        label: `${formatIssueType(targetIssueType)}`,
        value: targetIssueType.id,
        isDisabled: !optionSelectable
      };
      options.push(option);
    }
    const defaultValue = determineInitiallySelectedOption(sourceProjectId, sourceIssueTypeId, options);
    // console.log(`renderTargetProjectIssueTypeSelect: defaultValue for source project ${sourceProjectId}, source issue type ${sourceIssueTypeId} is "${defaultValue ? defaultValue.label : 'none'}" (${defaultValue ? defaultValue.value : 'none'})`);
    return (
      <div>
        <Select
          key={`target-issue-type-select-${props.targetProject ? props.targetProject.id : 'none'}-${defaultValue ? defaultValue.value : 'none'}`}
          inputId="target-issue-type-select"
          isMulti={false}
          isRequired={true}
          // isDisabled={bulkMoveIssueTypeMappingStrategy === 'only-allow-listed-mappings'}
          options={options}
          value={defaultValue}
          // defaultValue={defaultValue}
          placeholder="Select issue type"
          menuPortalTarget={document.body}
          onChange={(option: Option) => {
            console.log(`Selected target issue type: "${option.label} (${option.value})" for source project: ${sourceProjectId}, source issue type: ${sourceIssueTypeId}`);
            const issueTypeId = option.value;
            onTargetIssueTypeChange(sourceProjectId, sourceIssueTypeId, issueTypeId);
          }}
        />
      </div>
    );
  }

  const loadTargetProjectIssueTypes = async () => {
    // console.log(`loadTargetProjectIssueTypes: Loading issue types for target project: ${props.targetProject ? props.targetProject.id : 'none'}`);
    if (props.targetProject) {
      const projectInvocationResult = await jiraDataModel.getProjectByIdOrKey(props.targetProject.id);
      if (projectInvocationResult.data) {
        const issueTypes = projectInvocationResult.data.issueTypes;
        setTargetProjectIssueTypes(issueTypes);
      } else {
        console.error('loadTargetProjectIssueTypes: Failed to load issue types for target project: ', projectInvocationResult.errorMessage);
        setTargetProjectIssueTypes([]);
      }
    } else {
      setTargetProjectIssueTypes([]);
    }
  }

  // const onBulkIssueTypeMappingChange = () => {
  //   console.log('IssueTypeMappingPanel: bulkIssueTypeMapping changed, rebuilding all row data.');
  //   setAllRowData(buildAllRowData(props.selectedIssues));
  //   setClonedSourceToTargetIssueTypeIds(cloneSourceToTargetIssueTypeIds());
  // }
 
  const renderMappings = () => {
    return (
      <div
        key={`mapping-panel-${props.targetProject ? props.targetProject.id : 'none'}`}
        className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="no-break">Project</th>
              <th className="no-break">Work item type</th>
              <th className="no-break">New work item type</th>
            </tr>
          </thead>
          <tbody>
            {
              allRowData.map(row => (
                <tr key={`source-issue-type-${row.sourceProject.id}-${row.sourceIssueType.id}`}>
                  <td>{formatProject(row.sourceProject)}</td>
                  <td>{formatIssueType(row.sourceIssueType)}</td>
                  <td>{renderTargetProjectIssueTypeSelect(row.sourceProject.id, row.sourceIssueType.id)}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    );
  }

  const renderChangeIssueTypesMessage = () => {
    if (bulkMoveIssueTypeMappingStrategy === 'all-mappings-at-same-level-allowed') {
      return null;
    } else {
      const mappingKeys = Object.keys(allowedBulkMoveIssueTypeMappings);
      let message = '';
      if (mappingKeys.length === 0) {
        message = 'No work item type mappings are allowed for this operation.';          
      } else {
        message = `Only ${bulkMoveIssueTypeMappingStrategy === 'exact-matches-and-allow-listed-mappings' ? 'exact matches and ' : ''}the following work item type mappings are allowed;- ${mappingKeys.map(mappingKey => `${mappingKey} → ${allowedBulkMoveIssueTypeMappings[mappingKey]}`).join(', ')}`;
      }
      return (
        <div style={{marginBottom: '10px'}}>
          <PanelMessage
            className="info-banner"
            message={`Note: ${message}`}
          />
        </div>
      );
    }
  }

  const renderPanel = () => {
    if (props.targetProject && props.issueSelectionState.selectedIssues.length > 0) {
      return (
        <div>
          {renderChangeIssueTypesMessage()}
          {renderMappings()}
        </div>
      );
    } else {
      return null;
      // return renderPanelMessage('Waiting for previous steps to be completed.');
    }
  }

  const renderDebug = () => {
    const clonedSourceToTargetIssueTypeIdsAsObject = Object.fromEntries(clonedSourceToTargetIssueTypeIds);
    const targetIssueTypeInfo = targetProjectIssueTypes.map(issueType => ({
      id: issueType.id,
      name: issueType.name,
    }));
    return (
      <div>
        <h3>Debug Information</h3>
        <p>Time = {new Date().toISOString()}</p>
        <p>Target project = {props.targetProject ? props.targetProject.name : 'none'}</p>
        <p>Target project issue types:</p>

        <pre>
          {JSON.stringify(targetIssueTypeInfo, null, 2)}
        </pre>
        <p>Cloned source project:issueType to issue types:</p>
        <pre>
          {JSON.stringify(clonedSourceToTargetIssueTypeIdsAsObject)}
        </pre>
      </div>
    );
  }

  return (
    <div style={{margin: '20px 0px'}}>
      {renderPanel()}
      {showDebug ? renderDebug() : null}
    </div>
  )

}
export default IssueTypeMappingPanel;
