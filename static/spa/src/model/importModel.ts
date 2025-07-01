import { ImportColumnValueType } from "src/types/ImportColumnValueType";
import { ImportStepName } from "./BulkOperationsWorkflow";
import { BulkOpsModel } from "./BulkOpsModel";
import { Project } from "src/types/Project";
import jiraDataModel from "./jiraDataModel";
import { ProjectCreateIssueMetadata } from "src/types/CreateIssueMetadata";
import { IssueType } from "src/types/IssueType";
import { FieldMetadata } from "src/types/FieldMetadata";
import { ObjectMapping } from "src/types/ObjectMapping";

export const MAX_ISSUES_TO_IMPORT = 1000;
const MAX_FILE_LINES_TO_READ = 1 + 1.1 * MAX_ISSUES_TO_IMPORT; // Account for the header line and allow some blank lines

export const importStepSequence: ImportStepName[] = ['file-upload', 'project-and-issue-type-selection', 'column-mapping', 'import-issues'];

export type ImportColumnMatchInfo = {
  columnName: string;
  fieldMetadata: FieldMetadata;
  userSelected: boolean;
}

export type CsvLine = {
  cells: string[];
}

export type CsvParseResult = {
  success: boolean;
  fileName: string;
  headerLine: CsvLine;
  bodyLines: CsvLine[];
  errorMessage?: string;
}

const nilCsvParseResult: CsvParseResult = {
  success: false,
  fileName: '',
  headerLine: { cells: [] },
  bodyLines: [],
  errorMessage: 'No file selected.'
};

class ImportModel extends BulkOpsModel<ImportStepName> {

  private issueCount: number = 0;
  private csvParseResult: CsvParseResult = nilCsvParseResult;
  private columnIndexesToColumnNames: ObjectMapping<string> = {};
  private columnNamesToIndexes: ObjectMapping<number> = {};
  private fieldKeysToMatchInfos: ObjectMapping<ImportColumnMatchInfo> = {};
  private selectedProject: undefined | Project = undefined;
  private selectedProjectCreateIssueMetadata: undefined | ProjectCreateIssueMetadata = undefined;
  private selectedIssueType: undefined | IssueType = undefined;
  private allMandatoryFieldsHaveColumnMappings: boolean = false;

  constructor() {
    super('ImportModel', importStepSequence);
  }

  public onFileSelection = async (file: undefined | File): Promise<CsvParseResult> => {
    this.setStepCompletionState('file-upload', 'incomplete');
    // console.log('ImportModel.onFileSelection: onFileSelected called');
    // console.log(`ImportModel.onFileSelection... selected file: ${file ? file.name : 'none'}`); 
    // console.log(`ImportModel.onFileSelection: file: `, file);
    const prevCsvParseResultAsString = JSON.stringify(this.csvParseResult);
    if (file) {
      const fileContent = await this.readFileContent(file);
      const fileLines = fileContent.split('\n');
      // console.log(`ImportModel.onFileSelection: fileLines length: ${fileLines.length}`);
      this.csvParseResult = await this.parseFileLines(file.name, fileLines);
    } else {
      this.csvParseResult = nilCsvParseResult;
    }
    // const fileUploadStepComplete = this.csvParseResult.success && this.csvParseResult.bodyLines.length > 0;
    const fileUploadStepComplete = this.csvParseResult.success && this.issueCount > 0;
    // console.log(`ImportModel.onFileSelection: fileUploadStepComplete: ${fileUploadStepComplete}`);
    this.setStepCompletionState('file-upload', fileUploadStepComplete ? 'complete' : 'incomplete');
    const newCsvParseResultAsString = JSON.stringify(this.csvParseResult);
    if (prevCsvParseResultAsString === newCsvParseResultAsString) {
      // console.log('ImportModel.onFileSelection: No change in csvParseResult, skipping update.');
    } else {
      this.updateModelTimestamp();
    }
    return this.csvParseResult;
  }

  getIssueCount = (): number => {
    return this.issueCount;
  }

  setAllMandatoryFieldsHaveColumnMappings = (newAllMandatoryFieldsHaveColumnMappings: boolean): void => {
    const notify = this.allMandatoryFieldsHaveColumnMappings !== newAllMandatoryFieldsHaveColumnMappings;
    if (this.allMandatoryFieldsHaveColumnMappings === newAllMandatoryFieldsHaveColumnMappings) {
      // console.log('ImportModel.setAllMandatoryFieldsHaveColumnMappings: No change in allMandatoryFieldsHaveColumnMappings, skipping update.');
      return; // No change, skip update
    } else {
      this.allMandatoryFieldsHaveColumnMappings = newAllMandatoryFieldsHaveColumnMappings;
      this.setStepCompletionState('column-mapping', newAllMandatoryFieldsHaveColumnMappings ? 'complete' : 'incomplete');
      this.updateModelTimestamp();
      if (notify) {
        this.notifyStepCompletionStateChangeListeners('column-mapping', this.allMandatoryFieldsHaveColumnMappings ? 'complete' : 'incomplete');
      }
    }
  }

  signalImportComplete = (): void => {
    // console.log(`ImportModel.signalImportComplete: Import complete, setting step "import-issues" to "complete" (full step completion state = ${JSON.stringify(this.getStepNamesToCompletionStates(), null, 2)}).`);
    this.setStepCompletionState('import-issues', 'complete');
    this.notifyStepCompletionStateChangeListeners('import-issues', 'complete');
  }

  getSelectedProjectCreateIssueMetadata() {
    return this.selectedProjectCreateIssueMetadata;
  }

  public getSelectedProject = (): undefined |Project => {
    return this.selectedProject;
  }

  public setSelectedProject = async (project: undefined | Project): Promise<void> => {
    if ((this.selectedProject === undefined && project === undefined) || (this.selectedProject !== undefined && this.selectedProject.id === project?.id)) {
      // console.log('ImportModel.setSelectedProject: No change in selected project, skipping update.');
      return; // No change, skip update
    } else {
      this.selectedProject = project;
      if (this.selectedProject) {
        this.selectedProjectCreateIssueMetadata = await jiraDataModel.getCreateIssueMetadataForProject(this.selectedProject.id);
      } else {
        this.selectedProjectCreateIssueMetadata = undefined;
      }
      const stepComplete = this.isProjectAndIssueTypeSelectionStepComplete();
      this.updateModelTimestamp();
      this.notifyStepCompletionStateChangeListeners('project-and-issue-type-selection', stepComplete ? 'complete' : 'incomplete');
    }
  }

  getSelectedIssueType = (): undefined | IssueType => {
    return this.selectedIssueType;
  }

  getColumnNamesToIndexes = (): ObjectMapping<number> => {
    return this.columnNamesToIndexes;
  }

  setFieldKeysToMatchInfos = (fieldKeysToMatchInfos: ObjectMapping<ImportColumnMatchInfo>): void => {
    const oldFieldKeysToMatchInfosAsString = JSON.stringify(this.fieldKeysToMatchInfos);
    const newFieldKeysToMatchInfosAsString = JSON.stringify(fieldKeysToMatchInfos);
    if (oldFieldKeysToMatchInfosAsString === newFieldKeysToMatchInfosAsString) {
      // console.log('ImportModel.setFieldKeysToMatchInfos: No change in fieldKeysToMatchInfos, skipping update.');
      return; // No change, skip update
    } else {
      this.fieldKeysToMatchInfos = fieldKeysToMatchInfos;
      this.updateModelTimestamp();
    }
  }

  getFieldKeysToMatchInfos = (): ObjectMapping<ImportColumnMatchInfo> => {
    return this.fieldKeysToMatchInfos;
  }

  getCsvParseResult = (): undefined | CsvParseResult => {
    return this.csvParseResult;
  }

  getImportColumnMatchInfoByColumnName = (columnName: string): ImportColumnMatchInfo | undefined => {
    const fieldKeys = Object.keys(this.fieldKeysToMatchInfos);
    for (const fieldKey of fieldKeys) {
      const matchInfo = this.fieldKeysToMatchInfos[fieldKey];
      if (matchInfo.columnName === columnName) {
        return matchInfo;
      }
    }
    return undefined;
  }

  setSelectedIssueType = async (issueType: undefined | IssueType): Promise<void> => {
    this.selectedIssueType = issueType;
    const stepComplete = this.isProjectAndIssueTypeSelectionStepComplete();
    this.setStepCompletionState('project-and-issue-type-selection', stepComplete ? 'complete' : 'incomplete');
    // this.notifyStepCompletionStateChangeListeners('project-and-issue-type-selection', stepComplete ? 'complete' : 'incomplete');
    // this.updateModelTimestamp();
  }

  private isProjectAndIssueTypeSelectionStepComplete = (): boolean => {
    // console.log(`ImportModel.isProjectAndIssueTypeSelectionStepComplete: selectedProject: ${this.selectedProject ? this.selectedProject.name : '[none]'}, selectedIssueType: ${this.selectedIssueType ? this.selectedIssueType.name : '[none]'}`);
    return this.selectedProject !== undefined && this.selectedIssueType !== undefined;
  }

  private readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const fileContent = e.target.result;
        // console.log('File content:', fileContent);
        resolve(fileContent as string);
      };
      reader.onerror = (e) => {
        console.error('Error reading file:', e);
        reject(e);
      };
      reader.readAsText(file);
    });
  }

  private parseFileLines = async (fileName: string, fileLines: string[]): Promise<CsvParseResult> => {
    const csvParseResult =  await this.startFileMapping(fileName, fileLines);
    // console.log(`ImportModel.setFileLines: csvParseResult: ${JSON.stringify(csvParseResult)}`);
    // console.log(`ImportModel.setFileLines: this.issueCount: ${this.issueCount}`);
    return csvParseResult;
  }

  public getColumnIndexesToColumnNames = (): any => {
    return this.columnIndexesToColumnNames;
  }

  // public getColumnNamesToValueTypes = (): Record<string, ImportColumnValueType> => {
  //   return this.columnNamesToValueTypes;
  // }

  private startFileMapping = async (fileName: string, fileLines: string[]): Promise<CsvParseResult> => {
    const headerLine: CsvLine = {
      cells: []
    };
    const bodyLines: CsvLine[] = [];
    const csvParseResult: CsvParseResult = {
      success: true,
      fileName: fileName,
      headerLine: headerLine,
      bodyLines: bodyLines
    };
    let columnCount = 0;
    const columnIndexesToColumnNames: ObjectMapping<string> = {};
    const columnNamesToIndexes: ObjectMapping<number> = {};
    // const columnNamesToValueTypes: ObjectMapping<ImportColumnValueType> = {};
    let issueCount = 0;
    for (let lineIndex = 0; lineIndex < fileLines.length; lineIndex++) {
      const line = fileLines[lineIndex].trim();
      if (!line) {
        continue; // Skip empty lines
      }
      const columnNames = line.split(',');
      if (lineIndex === 0) {
        // This is the header line.
        columnCount = columnNames.length;
        columnNames.forEach((columnName, index) => {
          const trimmedColumnName = columnName.trim();
          if (trimmedColumnName) {
            columnIndexesToColumnNames[index] = trimmedColumnName;
            columnNamesToIndexes[trimmedColumnName] = index;
            headerLine.cells.push(trimmedColumnName);
          }
        });
      } else {
        if (columnNames.length !== columnCount) {
          // KNOWN-14: Import functionality does not surface file format warnings to the user.
          console.warn(`Line ${lineIndex} has ${columnNames.length} columns, expected ${columnCount}. Skipping this line.`);
          continue;
        }
        issueCount++;
        const bodyLine: CsvLine = {
          cells: []
        };
        bodyLines.push(bodyLine);
        for (let columnIndex = 0; columnIndex < columnNames.length; columnIndex++) {
          const columnName = columnIndexesToColumnNames[columnIndex];
          if (columnName) {
            const columnValue = columnNames[columnIndex].trim();
            bodyLine.cells.push(columnValue);
            const valueType = this.interpretColumnType(columnValue);
            // console.log(`Determining the type of column ${columnIndex} with name "${columnName}" in line ${lineIndex} based on the value "${columnValue}"`);
            // const previouslyDeterminedType = columnNamesToValueTypes[columnName];
            // if (valueType === previouslyDeterminedType || previouslyDeterminedType === undefined) {
            //   // All good
            //   columnNamesToValueTypes[columnName] = valueType;
            // } else if (previouslyDeterminedType === 'unknown') {
            //   columnNamesToValueTypes[columnName] = valueType;
            // } else {
            //   console.warn(`Column "${columnName}" has inconsistent types: ${previouslyDeterminedType} vs ${valueType}`);
            //   columnNamesToValueTypes[columnName] = 'string';
            // }
            // console.log(`Column ${columnIndex} with name "${columnName}" in line ${lineIndex} has type: ${valueType}`);
          } else {
            console.warn(`No column name found for index ${columnIndex} in line ${lineIndex}`);
          }
        }
      }
      if (lineIndex >= MAX_FILE_LINES_TO_READ) {
        console.warn('Too many lines, stopping processing to avoid performance issues');
        break;
      }
      if (issueCount >= MAX_ISSUES_TO_IMPORT) {
        console.warn('Too many issues, stopping processing to avoid performance issues');
        break;
      }
    }
    this.issueCount = issueCount;
    this.columnIndexesToColumnNames = columnIndexesToColumnNames;
    this.columnNamesToIndexes = columnNamesToIndexes;
    // this.columnNamesToValueTypes = columnNamesToValueTypes;
    return csvParseResult;
  }

  private interpretColumnType = (columnValue: string): ImportColumnValueType => {
    // if (!isNaN(Date.parse(columnValue))) {
    //   return 'date';
    // }
    if (!isNaN(Number(columnValue))) {
      return 'number';
    }
    if (columnValue.toLowerCase() === 'true' || columnValue.toLowerCase() === 'false') {
      return 'boolean';
    }
    try {
      const parsedValue = JSON.parse(columnValue) as any;
      if (Array.isArray(parsedValue)) {
        console.warn(` * Column value "${columnValue}" is an array, which is not supported. Treating as unknown.`);
        return 'unknown';
      } else if (typeof parsedValue === 'object') {
        const isAdf =
          parsedValue.type === 'doc' && 
          typeof parsedValue.version === 'number' && 
          parsedValue.content && 
          Array.isArray(parsedValue.content);
        if (isAdf) {
          return 'rich text';
        } else {
          console.warn(` * Column value "${columnValue}" is an object, but not ADF, which is not supported. Treating as unknown.`);
          return 'unknown';
        }
      } else {
        // console.log(` * Column value "${columnValue}" is a string.`);
        return 'string';
      }
    } catch (error) {
      console.warn(` * Column value "${columnValue}" could not be parsed as JSON. Treating as string.`);
      return 'string'; 
    }
  }

}

export default new ImportModel();
