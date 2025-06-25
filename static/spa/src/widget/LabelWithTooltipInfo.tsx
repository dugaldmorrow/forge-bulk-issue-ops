import React from 'react';
import { Label } from '@atlaskit/form';
import Tooltip from '@atlaskit/tooltip';

export type LabelWithTooltipInfoProps = {
  display: boolean,
  labelText: string;
  fieldId: string;
  color: string;
  backgroundColor: string;
  tooltipText: string;
  Icon: React.ReactNode;
  textAfterIcon: string;
}

const LabelWithTooltipInfo = (props: LabelWithTooltipInfoProps) => {

  const renderIcon = (message: string, icon: React.ReactNode, opacity: number = 1) => {
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      height: '22px',
      color: props.color, 
      backgroundColor: props.backgroundColor,
      borderRadius: '6px',
      padding: '2px',
      cursor: props.tooltipText ? 'help' : undefined,
      opacity: opacity,
    }
    return (
      <div style={containerStyle}>
        {icon}{message ? <div style={{ marginLeft: '4px' }}>{message}</div> : null}
      </div>
    );
  }

  const renderInfoWidget = () => {
    if (!props.display) {
      // Use the same render routine, except make it transparent - this is to stop the icon's presence from shifting the layout
      return renderIcon(props.textAfterIcon, props.Icon, 0);
    } else if (!props.tooltipText) {
      return renderIcon(props.textAfterIcon, props.Icon);
    } else {
      return (
        <Tooltip content={props.tooltipText} position="top">
          {renderIcon(props.textAfterIcon, props.Icon)}
        </Tooltip>
      );
    }
  }

  return (
    <div style={{display: 'flex', flexDirection: 'row', alignItems: 'end', justifyContent: 'space-between'}}>
      <Label htmlFor={props.fieldId}>{props.labelText}</Label>
      {renderInfoWidget()}
    </div>
  )
}

export default LabelWithTooltipInfo;
