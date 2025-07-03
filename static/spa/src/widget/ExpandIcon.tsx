import React from 'react';

export type ExpandIconProps = {
  isExpanded: boolean;
  onClick: () => void;
  label?: string;
}

const ExpandIcon = (props: ExpandIconProps) => {
  const title = props.label || (props.isExpanded ? 'Collapse panel' : 'Expand panel');
  
  return (
    <button
      className="expand-icon-button"
      onClick={props.onClick}
      title={title}
      aria-label={title}
    >
      {props.isExpanded ? (
        // Collapse icon (minimize/compress)
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 13H5v-2h14v2z"/>
          <path d="M19 17H5v-2h14v2z"/>
          <path d="M5 9h14V7H5v2z"/>
        </svg>
      ) : (
        // Expand icon (maximize/fullscreen)
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
        </svg>
      )}
    </button>
  );
};

export default ExpandIcon;