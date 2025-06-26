import React, { useEffect, useState, useRef } from 'react';
import Button, { IconButton } from '@atlaskit/button/new';
import Tooltip from '@atlaskit/tooltip';
import { FormSection, Label } from '@atlaskit/form';
import TextArea from '@atlaskit/textarea';
import { ParsedJqlQuery } from 'src/types/ParsedJqlQuery';
import jiraDataModel from 'src/model/jiraDataModel';
import { PanelMessage } from './PanelMessage';
import { applyDebouncingDelay } from 'src/model/util';
import CheckMarkIcon from '@atlaskit/icon/core/check-mark';
import ErrorIcon from '@atlaskit/icon/core/error';
import { token } from '@atlaskit/tokens';
import LabelWithTooltipInfo from './LabelWithTooltipInfo';
import { BulkOperationMode } from 'src/types/BulkOperationMode';
import { FilterMode } from 'src/types/FilterMode';

export type JQLInputPanelProps = {
  placeholder?: string;
  initialJql: string;
  bulkOperationMode: BulkOperationMode;
  buildJqlAugmentationLogicText: (filterMode: FilterMode, bulkOperationMode: BulkOperationMode) => string;
  augmentJqlWithBusinessRules?: (jql: string, bulkOperationMode: BulkOperationMode) => Promise<string>;
  onExecuteUnaugmentedJql: (unaugmentedJql: string) => Promise<void>;
}

const JQLInputPanel = (props: JQLInputPanelProps) => {

  const unaugmentedJqlRef = useRef<string>(props.initialJql || '');
  const [errorMessage, setErrorMessage] = useState<string | null>('');
  const [parsedJqlQuery, setParsedJqlQuery] = useState<ParsedJqlQuery | undefined>(null);
  const [augmentedJql, setAugmentedJql] = useState<string | undefined>('');
  const lastInvocationNumberRef = useRef<number>(0);

  const onMount = async () => {
    const augmentedJql = props.augmentJqlWithBusinessRules ? await props.augmentJqlWithBusinessRules(props.initialJql, props.bulkOperationMode) : props.initialJql;
    setAugmentedJql(augmentedJql);
    // console.log(`JQLInputPanel.useEffect: initialJql = ${props.initialJql}`);
    unaugmentedJqlRef.current = props.initialJql;
    setParsedJqlQuery(undefined);
    setErrorMessage(null);
    onValidateJqlDebounced(props.initialJql);
  }

  useEffect(() => {
    onMount();
  }, [props.initialJql]);

  const isJqlOk = (): boolean => {
    if (parsedJqlQuery) {
      if (parsedJqlQuery.errors && parsedJqlQuery.errors.length > 0) {
        return false;
      }
    }
    return true;
  }

  const onValidateJql = async (jql: string): Promise<ParsedJqlQuery | undefined> => {
    lastInvocationNumberRef.current = lastInvocationNumberRef.current + 1;
    const myInvocationNumber = lastInvocationNumberRef.current;
    const augmentedJql = props.augmentJqlWithBusinessRules ? await props.augmentJqlWithBusinessRules(jql, props.bulkOperationMode) : jql;
    if (myInvocationNumber === lastInvocationNumberRef.current) {
      const parsedJqlQueryInvocationResult = await jiraDataModel.parseJql(augmentedJql);
      if (myInvocationNumber === lastInvocationNumberRef.current) {
        if (parsedJqlQueryInvocationResult.ok) {
          const parsedJqlQuery = parsedJqlQueryInvocationResult.data;
          setParsedJqlQuery(parsedJqlQuery);
          return parsedJqlQuery;
        } else {
          setErrorMessage(parsedJqlQueryInvocationResult.errorMessage);
        }
      }
    }
    return undefined;
  }

  const onValidateJqlDebounced = applyDebouncingDelay(onValidateJql, 500);

  const onChange = async (event: any): Promise<void> => {
    // console.log(`JQLInputPanel.onChange: `, selectedOption);
    const newJql = event.target.value;
    unaugmentedJqlRef.current = newJql;
    await onValidateJqlDebounced(newJql);
    const augmentedJql = props.augmentJqlWithBusinessRules ? await props.augmentJqlWithBusinessRules(newJql, props.bulkOperationMode) : newJql;
    setAugmentedJql(augmentedJql);
  }

  const onExecuteJql = async (): Promise<void> => {
    await props.onExecuteUnaugmentedJql(unaugmentedJqlRef.current);
  }

  const buttonEnabled = unaugmentedJqlRef.current.trim().length > 0 && isJqlOk();

  const renderAugmentedJql = () => {
    if (augmentedJql && augmentedJql.trim().length > 0) {
      return (
        <FormSection>
          {renderJQLLabelAndTooltip()}
          <Tooltip content={props.buildJqlAugmentationLogicText('advanced', props.bulkOperationMode)} position="auto">
            <div style={{cursor: 'help'}}>
              <PanelMessage
                className="info-banner banner-full-width banner-left-aligned-text"
                message={augmentedJql} 
              />
            </div>
          </Tooltip>
        </FormSection>
      );
    } else {
      return null;
    }
  }

  const renderJQLLabelAndTooltip = () => {
    return (
      <LabelWithTooltipInfo
        display={unaugmentedJqlRef.current.trim().length > 0}
        labelText="Final JQL"
        fieldId="jql-textfield"
        color={isJqlOk() ? token('color.text.information') : token('color.text.danger')}
        backgroundColor={isJqlOk() ? token('color.background.success') : token('color.background.danger')}
        tooltipText={isJqlOk() ? undefined : parsedJqlQuery.errors.join(', ')}
        Icon={isJqlOk() ? <CheckMarkIcon label="JQL parse success" /> : <ErrorIcon label="JQL parse error" />}
        textAfterIcon={isJqlOk() ? '' : 'Error in JQL'}
      />
    );
  }

  return (
    <>
      <FormSection>
        <Label htmlFor="jql-textfield">JQL</Label>
        <TextArea
          id="jql-textfield"
          name="jql"
          resize="vertical"
          isInvalid={!isJqlOk()}
          defaultValue={props.initialJql}
          autoFocus={true}
          isRequired={true}
          minimumRows={3}
          placeholder={props.placeholder ?? "JQL query"}
          onChange={onChange}
        />
      </FormSection>
      {props.augmentJqlWithBusinessRules ? renderAugmentedJql() : null}
      <FormSection>
        <Button
          appearance={buttonEnabled ? 'primary' : 'default'}
          isDisabled={!buttonEnabled}
          onClick={onExecuteJql}
        >
          Execute
        </Button>
      </FormSection>
    </>
  );
}

export default JQLInputPanel;
