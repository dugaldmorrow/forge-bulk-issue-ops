import React from 'react';
import FullscreenEnterIcon from '@atlaskit/icon/core/fullscreen-enter';
import FullscreenExitIcon from '@atlaskit/icon/core/fullscreen-exit';

export type ExpandIconProps = {
  isExpanded: boolean;
  onClick: () => void;
  label?: string;
}

const ExpandIcon = (props: ExpandIconProps) => {
  const title = props.label || (props.isExpanded ? 'Collapse panel' : 'Expand panel');

  const renderIcon = () => {
    if (props.isExpanded) {
      return (
        <FullscreenExitIcon
          label="Collapse panel"
        />
      );
    } else {
      return (
        <FullscreenEnterIcon
          label="Expand panel"
        />
      );
    }
  }
  
  return (
    <button
      className="expand-icon-button"
      onClick={props.onClick}
      title={title}
      aria-label={title}
    >
      {renderIcon()}
    </button>
  );

};

export default ExpandIcon;