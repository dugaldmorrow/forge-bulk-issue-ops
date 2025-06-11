import React, { useEffect, useState } from 'react';
import { Issue } from "../types/Issue";
import { IssueType } from '../types/IssueType';
import { Project } from 'src/types/Project';
import Select from '@atlaskit/select';
import { Option } from '../types/Option'
import jiraDataModel from 'src/model/jiraDataModel';
import bulkIssueTypeMappingModel from '../model/bulkIssueTypeMappingModel';
import { formatIssueType, formatProject } from 'src/controller/formatters';

const showDebug = false;

type RowData = {
  sourceProject: Project;
  sourceIssueType: IssueType;
}

export type IssueTypeMappingPanelProps = {
  selectedIssues: Issue[];
  targetProject: undefined | Project;
  filterIssueTypes: (issueTypes: IssueType[], targetProject: Project) => IssueType[];
  onIssueTypeMappingChange: () => Promise<void>;
}

const IssueTypeMappingPanel = (props: IssueTypeMappingPanelProps) => {

  const buildAllRowData = (issues: Issue[]): RowData[] => {
    const allRowData: RowData[] = [];
    const consumedProjectIssueTypePairs = new Set<string>();
    for (const issue of issues) {
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

  const [targetProjectIssueTypes, setTargetProjectIssueTypes] = useState<IssueType[]>([]);
  const [allRowData, setAllRowData] = useState<RowData[]>(buildAllRowData(props.selectedIssues));
  const [clonedSourceToTargetIssueTypeIds, setClonedSourceToTargetIssueTypeIds] = useState<Map<string, string>>(
    bulkIssueTypeMappingModel.cloneSourceToTargetIssueTypeIds());

  const autoSelectMatchingTargetIssueTypes = (): void => {
    // console.log('autoSelectMatchingTargetIssueTypes: Auto selecting matching target issue types for selected issues.');
    let unmappedCount = 0;
    for (const issue of props.selectedIssues) {
      const sourceProject = issue.fields.project;
      const sourceIssueType = issue.fields.issuetype;
      const existingTargetIssueTypeId = bulkIssueTypeMappingModel.getTargetIssueTypeId(sourceProject.id, sourceIssueType.id);
      if (existingTargetIssueTypeId) {
        // Do nothing - don't override existing mappings.
      } else {
        // Auto select the same issue type if possible where the source and target issue type names match.
        const matchingTargetIssueType = targetProjectIssueTypes.find(issueType => issueType.name === sourceIssueType.name);
        if (matchingTargetIssueType) {
          // console.log(`autoSelectMatchingTargetIssueTypes: Auto selecting target issue type: ${matchingTargetIssueType.name} (${matchingTargetIssueType.name}) for source project: ${sourceProject.key}, source issue type: ${sourceIssueType.name}`);
          bulkIssueTypeMappingModel.addMapping(sourceProject.id, sourceIssueType.id, matchingTargetIssueType.id);
        } else {
          unmappedCount++;
          // console.log(`autoSelectMatchingTargetIssueTypes: No matching target issue type found for source project: ${sourceProject.id}, source issue type: ${sourceIssueType.id}.`);
        }
      }
    }
    const clonedSourceToTargetIssueTypeIds = bulkIssueTypeMappingModel.cloneSourceToTargetIssueTypeIds();
    setClonedSourceToTargetIssueTypeIds(clonedSourceToTargetIssueTypeIds);
    // console.log(`autoSelectMatchingTargetIssueTypes: clonedSourceToTargetIssueTypeIds = ${JSON.stringify(clonedSourceToTargetIssueTypeIds, null, 2)}.`);
    // console.log(`autoSelectMatchingTargetIssueTypes: clonedSourceToTargetIssueTypeIds = ${JSON.stringify(mapToObjectMap(clonedSourceToTargetIssueTypeIds), null, 2)}.`);
    // console.log(`autoSelectMatchingTargetIssueTypes: Finished auto selecting - unmappedCount = ${unmappedCount}.`);
    props.onIssueTypeMappingChange();
  }

  useEffect(() => {
    autoSelectMatchingTargetIssueTypes();
  }, [targetProjectIssueTypes, props.selectedIssues]);

  const getTargetIssueTypeId = (sourceProjectId: string, sourceIssueTypeId: string): string | undefined => {
    const key = buildKey(sourceProjectId, sourceIssueTypeId);
    return clonedSourceToTargetIssueTypeIds.get(key);
  }

  const buildKey = (sourceProjectId: string, sourceIssueTypeId: string): string => {
    return `${sourceProjectId},${sourceIssueTypeId}`;
  }

  const onTargetIssueTypeChange = (sourceProjectId: string, sourceIssueTypeId: string, targetIssueTypeId: string) => {
    bulkIssueTypeMappingModel.addMapping(sourceProjectId, sourceIssueTypeId, targetIssueTypeId);
    const clonedSourceToTargetIssueTypeIds = bulkIssueTypeMappingModel.cloneSourceToTargetIssueTypeIds();
    setClonedSourceToTargetIssueTypeIds(clonedSourceToTargetIssueTypeIds);
    props.onIssueTypeMappingChange();
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
    return option;
  }

  const renderTargetProjectIssueTypeSelect = (sourceProjectId: string, sourceIssueTypeId: string) => {
    const options: Option[] = [];
    const filteredIssueTypes = props.filterIssueTypes(targetProjectIssueTypes, props.targetProject);
    for (const issueType of filteredIssueTypes.map(issueType => issueType)) {
      const option: Option = {
        label: `${formatIssueType(issueType)}`,
        value: issueType.id,
      };
      options.push(option);
    }
    const defaultValue = determineInitiallySelectedOption(sourceProjectId, sourceIssueTypeId, options);
    // console.log(`renderTargetProjectIssueTypeSelect: defaultValue for source project ${sourceProjectId}, source issue type ${sourceIssueTypeId} is "${defaultValue ? defaultValue.label : 'none'}" (${defaultValue ? defaultValue.value : 'none'})`);
    return (
      <div>
        <Select
          inputId="target-issue-type-select"
          isMulti={false}
          isRequired={true}
          options={options}
          value={defaultValue}
          placeholder="Select issue type"
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
      const projectInvocationResult = await jiraDataModel.getProjectById(props.targetProject.id);
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
 
  useEffect(() => {
    setClonedSourceToTargetIssueTypeIds(bulkIssueTypeMappingModel.cloneSourceToTargetIssueTypeIds());
    // bulkIssueTypeMapping.registerListener(onBulkIssueTypeMappingChange);
    return () => {
      // bulkIssueTypeMapping.unregisterListener(onBulkIssueTypeMappingChange);
    };
  }, []);


  useEffect(() => {
    loadTargetProjectIssueTypes();
  }, [props.targetProject]);

  const renderMappings = () => {
    return (
      <div>
        <table>
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

  const renderPanel = () => {
    if (props.targetProject && props.selectedIssues.length > 0) {
      return renderMappings();
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
