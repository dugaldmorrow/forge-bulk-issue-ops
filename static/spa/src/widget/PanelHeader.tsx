import React from 'react';
import { CompletionState } from 'src/types/CompletionState';
import SuccessSymbol from './SuccessSymbol';
import TodoSymbol from './TodoSymbol';
import ExpandIcon from './ExpandIcon';

export type PanelHeaderProps = {
  stepNumber: number;
  label: string;
  completionState: CompletionState;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

const PanelHeader = (props: PanelHeaderProps) => {
  return (
    <div>
      <div className='panel-header'>
        <div><h3>Step {props.stepNumber}</h3></div>
        <div className='panel-header-icons'>
          {props.onExpandToggle && (
            <ExpandIcon
              isExpanded={props.isExpanded || false}
              onClick={props.onExpandToggle}
            />
          )}
          {
          props.completionState === 'complete' ? 
            <SuccessSymbol label="Step complete" /> : 
            <TodoSymbol label="Step incomplete" />
          }
        </div>
      </div>
      <div><h4>{props.label}</h4></div>
    </div>
  );
}

export default PanelHeader;
