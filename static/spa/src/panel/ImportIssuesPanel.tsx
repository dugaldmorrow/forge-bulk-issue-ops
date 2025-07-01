import React, { useEffect } from 'react';
import Button from '@atlaskit/button/new';
import { LinearProgress } from '@mui/material';
import { WaitingMessageBuilder } from 'src/controller/WaitingMessageBuilder';
import importModel from 'src/model/importModel';
import { CompletionState } from 'src/types/CompletionState';
import { ImportColumnValueType } from 'src/types/ImportColumnValueType';
import { ObjectMapping } from 'src/types/ObjectMapping';
import { renderPanelMessage } from 'src/widget/PanelMessage';
import { ImportInstructions, importIssues } from 'src/controller/issueImporter';
import { ProgressInfo } from 'src/types/ProgressInfo';
import { FormSection, Label } from '@atlaskit/form';
import WarningSymbol from 'src/widget/WarningSymbol';
import SuccessSymbol from 'src/widget/SuccessSymbol';

const showDebug = true;

export type ImportIssuesPanelProps = {
  columnMappingCompletionState: CompletionState;
  importIssuesCompletionState: CompletionState;
  modelUpdateTimestamp: number;
}

type ColumnMappingSummaryInfo = {
  mappedColumnNames: string[];
  unmappedColumnNames: string[];
}

const ImportIssuesPanel = (props: ImportIssuesPanelProps) => {

  const buildColumnMappingSummary = (): ColumnMappingSummaryInfo => {
    const csvParseResult = importModel.getCsvParseResult();
    const mappedColumnNumes: string[] = [];
    const unmappedColumnNumes: string[] = [];
    const columnNames = csvParseResult.headerLine.cells;
    for (const columnName of columnNames) {
      const matchInfo = importModel.getImportColumnMatchInfoByColumnName(columnName);
      if (matchInfo) {
        mappedColumnNumes.push(columnName);
      } else {
        unmappedColumnNumes.push(columnName);
      }
    }
    const columnMappingSummaryInfo: ColumnMappingSummaryInfo = {
      mappedColumnNames: mappedColumnNumes,
      unmappedColumnNames: unmappedColumnNumes
    };
    // console.log(`ImportIssuesPanel.buildColumnMappingSummary: built columnMappingSummaryInfo: ${JSON.stringify(columnMappingSummaryInfo, null, 2)}`);
    return columnMappingSummaryInfo;
  }

  const [waitingMessage, setWaitingMessage] = React.useState<string>('');
  const [columnIndexesToColumnNames, setColumnIndexesToColumnNames] = React.useState<any>({});
  const [columnNamesToValueTypes, setColumnNamesToValueTypes] = React.useState<ObjectMapping<ImportColumnValueType>>({});
  const [progressInfo, setProgressInfo] = React.useState<ProgressInfo>({
    state: 'waiting',
    percentComplete: 0
  });
  const [columnMappingSummary, setColumnMappingSummary] = React.useState<ColumnMappingSummaryInfo | null>(buildColumnMappingSummary());

  const updateState = async (): Promise<void> => {
    // console.log('ImportIssuesPanel.updateState called');
    // console.log(' * columnMappingCompletionState:', props.columnMappingCompletionState);
    // console.log(' * importIssuesCompletionState:', props.importIssuesCompletionState);
    const waitingMessage = new WaitingMessageBuilder()
      .addCheck(props.columnMappingCompletionState === 'complete', 'Waiting for column mapping.')
      .build();
    setWaitingMessage(waitingMessage);
    setColumnIndexesToColumnNames(importModel.getColumnIndexesToColumnNames());
    setColumnMappingSummary(buildColumnMappingSummary());
    if (props.importIssuesCompletionState !== 'complete') {
      setProgressInfo({
        state: 'waiting',
        percentComplete: 0
      });
    }
  }

  useEffect(() => {
    updateState();
  }, [props.columnMappingCompletionState, props.importIssuesCompletionState, props.modelUpdateTimestamp]);

  const canImportBeStarted = (): boolean => {
    return props.columnMappingCompletionState === 'complete' && progressInfo.state === 'waiting';
  }

  const onImportProgressUpdate = async (importCount: number, lineSkipCount: number, failCount: number, totalCount: number): Promise<void> => {
    // console.log(`ImportIssuesPanel.onImportProgressUpdate called with importCount = ${importCount}, lineSkipCount = ${lineSkipCount}, failCount = ${failCount}, totalCount = ${totalCount}`);
    const percentComplete = totalCount > 0 ? Math.round((importCount + lineSkipCount + failCount) / totalCount * 100) : 0;
    const progressInfo: ProgressInfo = {
      state: percentComplete === 100 ? 'complete' : 'in_progress',
      percentComplete: percentComplete,
      message: `Imported ${importCount} of ${totalCount} (${lineSkipCount} skipped, ${failCount} failed)`
    };
    setProgressInfo(progressInfo);
    if (progressInfo.percentComplete === 100) {
      importModel.signalImportComplete();
    }
  }

  const onImportIssuesButtonClick = async () => {
    // console.log('ImportIssuesPanel.onImportIssuesButtonClick called');
    const importInstructions: ImportInstructions = {
      targetProject: importModel.getSelectedProject(),
      targetIssueType: importModel.getSelectedIssueType(),
      columnNamesToIndexes: importModel.getColumnNamesToIndexes(),
      fieldKeysToMatchInfos: importModel.getFieldKeysToMatchInfos(),
      csvParseResult: importModel.getCsvParseResult(),
    }
    importIssues(importInstructions, onImportProgressUpdate);
  }

  const renderImportSummary = () => {
    if (props.columnMappingCompletionState !== 'complete' && props.importIssuesCompletionState !== 'complete') {
      return null;
    }
    const csvParseResult = importModel.getCsvParseResult();
    const mappedColumnNumes = columnMappingSummary.mappedColumnNames;
    const unmappedColumnNumes = columnMappingSummary.unmappedColumnNames;
    let renderedColumnMappingSummary = null;
    if (unmappedColumnNumes.length === 0) {
      renderedColumnMappingSummary = <p><SuccessSymbol /> All columns have been mapped to fields.</p>;
    } else if (unmappedColumnNumes.length === 1) {
      renderedColumnMappingSummary = <p><WarningSymbol/> Column "{unmappedColumnNumes[0]}" is not mapped to any field so its data will be ignored.</p>;
    } else {
      renderedColumnMappingSummary = <p><WarningSymbol/> Columns {unmappedColumnNumes.join(', ')} are not mapped to any fields so their data will be ignored.</p>;
    }
    return (
      <div style={{margin: '20px'}}>
        <h5>Import Summary</h5>
        <ul style={{listStyleType: 'none', paddingLeft: '0px'}}>
          <li><p><SuccessSymbol /> File: {csvParseResult.fileName}</p></li>
          <li><p><SuccessSymbol /> Number of data lines: {csvParseResult.bodyLines.length}</p></li>
          <li><p><SuccessSymbol /> Mapped columns: {mappedColumnNumes.join(', ')}</p></li>
          <li>{renderedColumnMappingSummary}</li>
        </ul>
      </div>
    );
  }

  const renderImportButton = () => {
    const issueCount = importModel.getIssueCount();
    const buttonLabel = issueCount === 0 ? 'Import work items' : `Import ${issueCount} ${issueCount === 1 ? 'work item' : 'work items'}`;
    return (
      <Button
        appearance="primary"
        isDisabled={!canImportBeStarted()}
        onClick={onImportIssuesButtonClick}
      >
        {buttonLabel}
      </Button>
    );
  };

  const renderProgressIndicator = () => {
    if (progressInfo.state === 'waiting') {
      return null;
    } else {
      return (
        <div>
          <Label htmlFor={''}>{progressInfo.message ?? ''}</Label>
          <LinearProgress variant="determinate" value={progressInfo.percentComplete} color="secondary" />
        </div>
      );
    }
  }

  return (
    <div className="step-panel-content-container">
      {renderPanelMessage(waitingMessage)}
      {renderImportSummary()}
      {renderImportButton()}
      <FormSection>
        {renderProgressIndicator()}
      </FormSection>
    </div>
  )

}

export default ImportIssuesPanel;
