import React, { useEffect } from 'react';
import importModel from '../model/importModel';
import { CompletionState } from 'src/types/CompletionState';
import FileUploadWidget from 'src/widget/FileUploadWidget';

const showDebug = false;

export type FileUploadPanelProps = {
  completionState: CompletionState
  disabled?: boolean;
}

const FileUploadPanel = (props: FileUploadPanelProps) => {

  const [file, setFile] = React.useState<any>(null);
  const [fileLines, setFileLines] = React.useState<string[]>([]);
  const [columnIndexesToColumnNames, setColumnIndexesToColumnNames] = React.useState<any>({});

  useEffect(() => {
    // console.log('FileUploadPanel mounted');
  }, []);

  const onFileSelected = async (file: undefined | File) => {
    // console.log('onFileSelected called');
    const fileParseResult = await importModel.onFileSelection(file);

    if (!fileParseResult.success) {
      // TODO: Handle failure
    }

    setColumnIndexesToColumnNames(importModel.getColumnIndexesToColumnNames());
  }

  const renderFileUploadDropTarget = () => {
    return (
      <div style={{margin: '20px auto', width: 'fit-content'}}>
        <FileUploadWidget
          message="Drag and drop your file to import here"
          allowedFileTypes={['.csv']}
          width={'400px'}
          height={'100px'}
          allowMultiple={false}
          disabled={props.disabled}
          onFilesSelected={(files: File[]): void => {
            if (files.length === 0) {
              onFileSelected(undefined);
            } else {
              onFileSelected(files[0]);
            }
          }} 
        />
      </div>
    )
  }

  const renderFileLines = () => {
    if (fileLines.length === 0) {
      if (file) {
        return <div>No file lines to display</div>;
      } else {
        return null;
      }
    } else {
      const renderedLines = fileLines.map((line, index) => (
        <div key={index}>
          {line}
        </div>
      ));
      return (
        <div>
          <h5>File Lines:</h5>
          {renderedLines}
        </div>
      );
    }
  }

  const renderDebug = () => {
    if (!showDebug) {
      return null;
    }
    return (
      <div style={{margin: '20px 0px'}}>
        <h3>Debug Information:</h3>
        <div style={{margin: '20px 0px'}}>
          {renderFileLines()}
        </div>
        <div style={{margin: '10px 0px'}}>
          <h5>columnIndexesToColumnNames:</h5>
          <pre>
            {JSON.stringify(columnIndexesToColumnNames, null, 2)}
          </pre>
        </div>
        <div style={{margin: '10px 0px'}}>
          <h5>File:</h5>
          <pre>
            {JSON.stringify({ file, fileLines }, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* {renderFileUploadWidget()} */}
      {renderFileUploadDropTarget()}
      {renderDebug()}
    </div>
  )

}

export default FileUploadPanel;
