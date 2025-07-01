import React, { useEffect } from 'react';
import { WaitingMessageBuilder } from 'src/controller/WaitingMessageBuilder';
import importModel, { ImportColumnMatchInfo } from 'src/model/importModel';
import { CompletionState } from 'src/types/CompletionState';
import { IssueTypeMetadata, ProjectCreateIssueMetadata } from 'src/types/CreateIssueMetadata';
import { FieldMetadata } from 'src/types/FieldMetadata';
import { ImportColumnValueType } from 'src/types/ImportColumnValueType';
import { ObjectMapping } from 'src/types/ObjectMapping';
import { Option } from '../types/Option';
import Select from '@atlaskit/select';
import { IssueType } from 'src/types/IssueType';
import { renderPanelMessage } from 'src/widget/PanelMessage';

const showDebug = false;

const mandatoryIndicatorWidth = '10px';

// This type identifies the CVS column match options for an issue field.
type ColumnOptionsMatch = {
  options: Option[],
  selectedOption: undefined | Option,
  matchStrength: number
}

export type ImportColumnMappingPanelProps = {
  importProjectCompletionState: CompletionState,
  columnMappingCompletionState: CompletionState,
  selectedIssueType: undefined | IssueType,
  createIssueMetadata: undefined | ProjectCreateIssueMetadata
  modelUpdateTimestamp: number;
}

const ImportColumnMappingPanel = (props: ImportColumnMappingPanelProps) => {

  const [waitingMessage, setWaitingMessage] = React.useState<string>('');
  const [columnIndexesToColumnNames, setColumnIndexesToColumnNames] = React.useState<any>({});
  const [columnNamesToValueTypes, setColumnNamesToValueTypes] = React.useState<ObjectMapping<ImportColumnValueType>>({});
  const [fieldKeysToMatchInfos, setFieldKeysToMatchInfos] = React.useState<ObjectMapping<ImportColumnMatchInfo>>({});
  const [sortedFilteredFields, setSortedFilteredFields] = React.useState<FieldMetadata[]>([]);
  const [fieldKeysToOptionMatches, setFieldKeysToOptionMatches] = React.useState<ObjectMapping<ColumnOptionsMatch>>({});

  const updateSelectionState = async (fieldKeysToMatchInfos: ObjectMapping<ImportColumnMatchInfo>): Promise<void> => {
    let newAllMandatoryFieldsHaveColumnMappings = false;
    if (props.createIssueMetadata && props.selectedIssueType) {
      const issueTypeCreateMetadata = props.createIssueMetadata.issuetypes.find(issueType => {
        return issueType.id === props.selectedIssueType.id;
      });
      newAllMandatoryFieldsHaveColumnMappings = doAllMandatoryFieldsHaveColumnMappings(
        issueTypeCreateMetadata,
        fieldKeysToMatchInfos);
    } else {
      newAllMandatoryFieldsHaveColumnMappings = false;
    }
    importModel.setAllMandatoryFieldsHaveColumnMappings(newAllMandatoryFieldsHaveColumnMappings);
  }

  const updateState = async (): Promise<void> => {
    // console.log('ImportColumnMappingPanel.updateState called');
    // console.log(' * importProjectCompletionState:', props.importProjectCompletionState);
    // console.log(' * columnMappingCompletionState:', props.columnMappingCompletionState);
    const waitingMessage = new WaitingMessageBuilder()
      .addCheck(props.importProjectCompletionState === 'complete', 'Waiting for target project and issue type selection.')
      .build();
    setWaitingMessage(waitingMessage);
    setColumnIndexesToColumnNames(importModel.getColumnIndexesToColumnNames());
    // setColumnNamesToValueTypes(importModel.getColumnNamesToValueTypes());

    const fieldKeysToMappedColumnNames: ObjectMapping<string> = {};
    const fieldKeysToMatchInfos: ObjectMapping<ImportColumnMatchInfo> = {};
    if (props.createIssueMetadata && props.selectedIssueType) {
      const issueTypeCreateMetadata = props.createIssueMetadata.issuetypes.find(issueType => {
        return issueType.id === props.selectedIssueType.id;
      });
      const fieldKeysToOptionMatches: ObjectMapping<ColumnOptionsMatch> = {};
      const fields = issueTypeCreateMetadata.fields;
      const filteredFields = filterFields(Object.values(fields));
      const sortedFilteredFields = sortFields(filteredFields);
      setSortedFilteredFields(sortedFilteredFields);
      for (const fieldMetadata of sortedFilteredFields) {
        const fieldType = fieldMetadata.schema?.type;
        if (fieldType) {
          if (fieldKeysToOptionMatches[fieldMetadata.key] === undefined) {
            const optionsMatch = matchColumns(fieldMetadata, fieldKeysToMappedColumnNames, fieldKeysToMatchInfos);
            fieldKeysToOptionMatches[fieldMetadata.key] = optionsMatch;
          }
        }
      }
      setFieldKeysToOptionMatches(fieldKeysToOptionMatches);
    } else {
      setSortedFilteredFields([]);
      setFieldKeysToOptionMatches({});
    }
    importModel.setFieldKeysToMatchInfos(fieldKeysToMatchInfos);
    setFieldKeysToMatchInfos(fieldKeysToMatchInfos);
    await updateSelectionState(fieldKeysToMatchInfos);
  }

  useEffect(() => {
    // console.log('ImportColumnMappingPanel mounted');
  }, []);

  // useEffect(() => {
  //   updateState();
  // }, [props.importProjectCompletionState, props.columnMappingCompletionState, props.selectedIssueType, props.createIssueMetadata]);

  useEffect(() => {
    updateState();
  }, [props.modelUpdateTimestamp]);

  const isFieldMandatory = (fieldMetadata: FieldMetadata): boolean => {
    return fieldMetadata.required && !fieldMetadata.hasDefaultValue;
  }

  const filterFields = (fields: FieldMetadata[]): FieldMetadata[] => {
    // KNOWN-13: No import field filtering.
    return fields.filter(field => {
      if (field.schema?.type === 'issuetype') {
        return false;
      } else if (field.schema?.type === 'project') {
        return false;
      } else if (field.schema?.type === 'issuelink') {
        return false;
      }
      return true;
    });
  }

  const sortFields = (fields: FieldMetadata[]): FieldMetadata[] => {
    return fields.sort((a, b) => {
      const aMandatory = isFieldMandatory(a);
      const bMandatory = isFieldMandatory(b);
      if (aMandatory && !bMandatory) return -1;
      if (!aMandatory && bMandatory) return 1;
      return 0;
    });
  }

  const doAllMandatoryFieldsHaveColumnMappings = (
    issueTypeCreateMetadata: IssueTypeMetadata,
    columnIndexesToMatchInfos: ObjectMapping<ImportColumnMatchInfo>
  ): boolean => {
    // console.log('doAllMandatoryFieldsHaveColumnMappings called');
    if (!issueTypeCreateMetadata) {
      return false;
    }
    let fieldCount = 0;
    const fields = issueTypeCreateMetadata.fields;
    const filteredFields  = filterFields(Object.values(fields));
    for (const fieldMetadata of filteredFields) {
      fieldCount++;
      if (isFieldMandatory(fieldMetadata)) {
        const matchInfo = columnIndexesToMatchInfos[fieldMetadata.key];
        if (!matchInfo) {
          console.warn(`Mandatory field "${fieldMetadata.name}" does not have a column mapping.`);
          return false;
        }
      }
    }
    return fieldCount > 0;
  }

  const matchColumns = (
    fieldMetadata: FieldMetadata,
    fieldKeysToMappedColumnNames: ObjectMapping<string>,
    fieldKeysToMatchInfos: ObjectMapping<ImportColumnMatchInfo>
  ): ColumnOptionsMatch => {
    // const ieldKeysToMappedColumnNames: ObjectMapping<string> = {};
    const columnOptions: Option[] = [];
    let selectedOption: undefined | Option = undefined;
    let matchStrength = 0;
    // const columnNamesToValueTypes = importModel.getColumnNamesToValueTypes();
    // const columnNames = Object.keys(columnNamesToValueTypes);
    let matchedColumnName: undefined | string = undefined;

    const columnIndexesToColumnNames = importModel.getColumnIndexesToColumnNames();
    const columnIndexes = Object.keys(columnIndexesToColumnNames).map(index => parseInt(index, 10));
    for (const columnIndex of columnIndexes) {
      const columnName = columnIndexesToColumnNames[columnIndex];
      const columnValueType = columnNamesToValueTypes[columnName];
      let matchTypeFactor = 0;
      if (columnValueType === fieldMetadata.schema?.type) {
        matchTypeFactor = 1; // Exact type match
      } else if (columnValueType === 'string' && fieldMetadata.schema?.type === 'option') {
        matchTypeFactor = 0.8; // Text is a string, but not vice versa
      } else {
        matchTypeFactor = 0.2; // No type match
      }

      let thisMatchStrength = 0;
      const option: Option = {
        label: columnName,
        value: columnName,
      }
      columnOptions.push(option);
      if (columnName.toLowerCase() === fieldMetadata.name.toLowerCase()) {
        selectedOption = option; // Prefer exact match
        thisMatchStrength = 1; // Exact match
      } else if (columnName.toLowerCase().includes(fieldMetadata.name.toLowerCase())) {
        thisMatchStrength = 0.5; // Partial match
      } else if (fieldMetadata.name.toLowerCase().includes(columnName.toLowerCase())) {
        thisMatchStrength = 0.5; // Partial match
      }
      thisMatchStrength *= matchTypeFactor; // Apply type match factor
      if (thisMatchStrength > matchStrength) {
        matchStrength = thisMatchStrength;
        selectedOption = option; // Prefer exact match
        fieldKeysToMappedColumnNames[fieldMetadata.key] = columnName; // Store the mapping
        const matchInfo: ImportColumnMatchInfo = {
          columnName: columnName,
          fieldMetadata: fieldMetadata,
          userSelected: false // This is a system-generated match
        }
        fieldKeysToMatchInfos[fieldMetadata.key] = matchInfo;
        matchedColumnName = columnName; // Store the matched column name
        // console.log(`* Matching column "${columnName}" with field "${fieldMetadata.name}". Match strength: ${thisMatchStrength}.`);
        // console.log(`* fieldKeysToMappedColumnNames = ${JSON.stringify(fieldKeysToMappedColumnNames, null, 2)}`);
      }
    }

    return {
      options: columnOptions,
      selectedOption: selectedOption,
      matchStrength: matchStrength
    };
  }

  const onColumnSelect = async (fieldMetadata: FieldMetadata, selectedOption: undefined | Option): Promise<void> => {
    // console.log(`ImportColumnMappingPanel.onColumnSelect: selectedOption = `, selectedOption);
    const newFieldKeysToOptionMatches: ObjectMapping<ColumnOptionsMatch> = { ...fieldKeysToOptionMatches };
    const existingColumnOptionsMatch: ColumnOptionsMatch | undefined = newFieldKeysToOptionMatches[fieldMetadata.key];
    if (existingColumnOptionsMatch) {
      const newColumnOptionsMatch: ColumnOptionsMatch = { ...existingColumnOptionsMatch };
      newColumnOptionsMatch.selectedOption = selectedOption;
      newFieldKeysToOptionMatches[fieldMetadata.key] = newColumnOptionsMatch;
    } else {
      console.warn(`No existing column options match found for field "${fieldMetadata.name}". Creating a new one.`);
    }

    const newFieldKeysToMatchInfos = { ...fieldKeysToMatchInfos };
    if (selectedOption) {
      const columnName = selectedOption ? selectedOption.value : '';
      const newImportColumnMatchInfo: ImportColumnMatchInfo = {
        columnName: columnName,
        fieldMetadata: fieldMetadata,
        userSelected: true
      };
      newFieldKeysToMatchInfos[fieldMetadata.key] = newImportColumnMatchInfo;
    } else {
      delete newFieldKeysToMatchInfos[fieldMetadata.key];
    }
    setFieldKeysToOptionMatches(newFieldKeysToOptionMatches);
    importModel.setFieldKeysToMatchInfos(newFieldKeysToMatchInfos);
    setFieldKeysToMatchInfos(newFieldKeysToMatchInfos);
    await updateSelectionState(newFieldKeysToMatchInfos);
  }

  const renderMandatoryIndicator = (fieldMetadata: FieldMetadata) => {
    const text = isFieldMandatory(fieldMetadata) ? '*' : '';
    return <div style={{ display: 'inline-block', width: mandatoryIndicatorWidth, color: '#BF2600' }}>{text}</div>;
  }

  const renderColumnSelection = (fieldMetadata: FieldMetadata) => {
    const fieldType = fieldMetadata.schema?.type;
    if (fieldType) {
      const optionsMatch = fieldKeysToOptionMatches[fieldMetadata.key];
      const columnOptions = optionsMatch.options;
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {renderMandatoryIndicator(fieldMetadata)}
          <Select<Option>
            options={columnOptions}
            value={optionsMatch.selectedOption}
            isRequired={fieldMetadata.required}
            isClearable={!isFieldMandatory(fieldMetadata)}
            placeholder="Select a column"
            menuPortalTarget={document.body}
            onChange={selectedOption => onColumnSelect(fieldMetadata, selectedOption)}
          />
        </div>
      );
    } else {
      return (
        <div>
          <p>Unspecified field type</p>
        </div>
      );
    }
  }

  const renderColumnMappingTable = (createIssueMetadata: ProjectCreateIssueMetadata, issueTypeCreateMetadata: IssueTypeMetadata) => {
    const renderedRows: any[] = [];
    for (const fieldMetadata of sortedFilteredFields) {
      const fieldType = fieldMetadata.schema?.type || 'unknown';
      renderedRows.push(
        <tr key={`issue-type-field-${fieldMetadata.key}`}>
          <td>{fieldMetadata.name}</td>
          <td>{fieldType}</td>
          <td>{renderColumnSelection(fieldMetadata)}</td>
        </tr>
      );
    }
    return (
      <div className="data-table-container" style={{margin: '20px 0px'}}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Field Name</th>
              <th>Data type</th>
              <th>File column</th>
            </tr>
          </thead>
          <tbody>
            {renderedRows}
          </tbody>
        </table>
      </div>
    );
  }

  const renderColumnMapping = () => {
    const createIssueMetadata = importModel.getSelectedProjectCreateIssueMetadata();
    const selectedIssueType = importModel.getSelectedIssueType();
    if (!createIssueMetadata || !selectedIssueType) {
      return null;
    }
    const issueTypeCreateMetadata = createIssueMetadata.issuetypes.find(issueType => issueType.id === selectedIssueType.id);
    if (!issueTypeCreateMetadata) {
      return (
        <div style={{margin: '20px 0px'}}>  
          <p>Selected issue type not found in project create issue metadata.</p>
        </div>
      );
    }
    return renderColumnMappingTable(createIssueMetadata, issueTypeCreateMetadata);
  }

  const renderDebug = () => {
    // console.log('ImportColumnMappingPanel.renderDebug: fieldKeysToMatchInfos = ', fieldKeysToMatchInfos);
    return (
      <div style={{margin: '20px 0px'}}>
        <h3>Debug Information</h3>
        <div>
          <strong>fieldKeysToMatchInfos:</strong>
          <pre>{JSON.stringify(fieldKeysToMatchInfos, null, 2)}</pre>
        </div>
        <div>
          <strong>Create issue metadata:</strong>
          <pre>{JSON.stringify(importModel.getSelectedProjectCreateIssueMetadata(), null, 2)}</pre>
        </div>
      </div>
    );
  }

  return (
    <div>
      {renderPanelMessage(waitingMessage)}
      {waitingMessage ? null : renderColumnMapping()}
      {showDebug ? renderDebug() : null}
    </div>
  )

}

export default ImportColumnMappingPanel;
