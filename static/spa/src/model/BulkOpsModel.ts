import { ImportStepName, StepName } from "./BulkOperationsWorkflow";
import { CompletionState } from "src/types/CompletionState";
import ListenerGroup from "./ListenerGroup";
import { debounce } from "./util";

export const importStepSequence: ImportStepName[] = ['file-upload'];

export type CompletionStateChangeInfo = {
  stepName: StepName;
  completionState: CompletionState;
  modelUpdateTimestamp: number;
}

// These two constants will result in a delay before the model update listeners are notified, but with
// the benefit that it avoids unnecessary updates when multiple changes occur in quick succession.
const modelUpdateNotifierDebouncePeriodMilliseconds = 100;
const immediatelyNotifyModelUpdateListeners = false;

export class BulkOpsModel<StepNameSubtype extends StepName> {

  private modelName: string;
  private stepSequence: StepNameSubtype[];
  private stepNamesToCompletionStates: Record<StepNameSubtype, CompletionState>;
  private lastUpdateTimestamp: number = 0;
  private stepCompletionStateChangeListenerGroup: ListenerGroup;
  private modelUpdateChangeListenerGroup: ListenerGroup;
  private debouncedNotifyModelUpdateChangeListeners: () => void;

  constructor(modelName: string, stepSequence: StepNameSubtype[]) {
    // console.log(`BulkOpsModel(${this.modelName}): constructing...`);
    this.modelName = modelName;
    this.stepSequence = stepSequence;
    this.stepCompletionStateChangeListenerGroup = new ListenerGroup(`${modelName}-step-completion`);
    this.modelUpdateChangeListenerGroup = new ListenerGroup(`${modelName}-model-update`);
    this.stepNamesToCompletionStates = {} as Record<StepNameSubtype, CompletionState>;
    stepSequence.forEach((stepName) => {
      // console.log(`BulkOpsModel(${this.modelName}): Initializing step "${stepName}" to "incomplete".`);
      this.stepNamesToCompletionStates[stepName] = 'incomplete';
    });
    this.debouncedNotifyModelUpdateChangeListeners = debounce(
      this.notifyModelUpdateChangeListeners,
      modelUpdateNotifierDebouncePeriodMilliseconds,
      immediatelyNotifyModelUpdateListeners
    );
  }

  public getStepSequence = (): StepNameSubtype[] => {
    return this.stepSequence;
  }

  public getDownstreamSteps = (stepName: StepNameSubtype): StepNameSubtype[] => {
    const stepIndex = this.stepSequence.indexOf(stepName);
    if (stepIndex === -1) {
      throw new Error(`Step "${stepName}" not found in step sequence.`);
    }
    return this.stepSequence.slice(stepIndex + 1);
  }

  public getNextDownstreamStep = (stepName: StepNameSubtype): StepNameSubtype | undefined => {
    const stepIndex = this.stepSequence.indexOf(stepName);
    if (stepIndex === -1) {
      throw new Error(`Step "${stepName}" not found in step sequence.`);
    }
    const nextStepIndex = stepIndex + 1;
    if (nextStepIndex < this.stepSequence.length) {
      return this.stepSequence[nextStepIndex];
    }
    return undefined; // No next step
  }

  public updateModelTimestamp = (): void => {
    const now = Date.now();
    const updated = now !== this.lastUpdateTimestamp;
    this.lastUpdateTimestamp = now;
    if (updated) {
      // console.log(`Detected model update - enqueuing model update notification...`);
      this.debouncedNotifyModelUpdateChangeListeners();
    }
  }

  public getUpdateTimestamp = (): number => {
    return this.lastUpdateTimestamp;
  }

  public setStepCompletionState = (stepName: StepNameSubtype, completionState: CompletionState): void => {
    let changedStepNames: StepNameSubtype[] = [];
    if (this.stepNamesToCompletionStates[stepName] !== completionState) {
      changedStepNames.push(stepName);
      this.stepNamesToCompletionStates[stepName] = completionState;
      if (completionState !== 'complete') {
        const downstreamSteps = this.stepSequence.slice(this.stepSequence.indexOf(stepName) + 1);
        console.log(`BulkOpsModel(${this.modelName}): * downstreamSteps = ${downstreamSteps.join(', ')}`);
        for (const downstreamStep of downstreamSteps) {
          if (this.stepNamesToCompletionStates[downstreamStep] !== 'complete') {
            console.log(`BulkOpsModel(${this.modelName}): Resetting downstream step "${downstreamStep}" to "incomplete" due to upstream step "${stepName}" being set to "incomplete".`);
            // If a downstream step is complete, we need to reset it to incomplete
            this.stepNamesToCompletionStates[downstreamStep] = 'incomplete';
            changedStepNames.push(downstreamStep);
          } else {
            console.log(`BulkOpsModel(${this.modelName}): Downstream step "${downstreamStep}" is already "${this.stepNamesToCompletionStates[downstreamStep]}", no action needed.`);
          }
        }
      }
    }
    if (changedStepNames.length > 0) {
      // Notify in the reverse order since this makes logical sense in terms of keeping the overall state sane.
      for (let i = changedStepNames.length - 1; i >= 0; i--) {
        const changedStepName = changedStepNames[i];
        const stepCompletionState = this.stepNamesToCompletionStates[changedStepName];
        console.log(`BulkOpsModel(${this.modelName}): Sending step "${changedStepName}" completion state notification: "${stepCompletionState}"`);
        this.notifyStepCompletionStateChangeListeners(changedStepName, stepCompletionState);
      }
      this.updateModelTimestamp();
    }
  }

  public registerStepCompletionStateChangeListener = (listener: any) => {
    this.stepCompletionStateChangeListenerGroup.registerListener(listener);
  };

  public unregisterStepCompletionStateChangeListener = (listener: any) => {
    this.stepCompletionStateChangeListenerGroup.unregisterListener(listener);
  };

  protected notifyStepCompletionStateChangeListeners = (stepName: StepName, completionState: CompletionState) => {
    const completionStateChangeInfo: CompletionStateChangeInfo = {
      stepName: stepName,
      completionState: completionState,
      modelUpdateTimestamp: this.lastUpdateTimestamp,
    }
    this.stepCompletionStateChangeListenerGroup.notifyListeners(completionStateChangeInfo);
  };

  public registerModelUpdateChangeListener = (listener: any) => {
    this.modelUpdateChangeListenerGroup.registerListener(listener);
  };

  public unregisterModelUpdateChangeListener = (listener: any) => {
    this.modelUpdateChangeListenerGroup.unregisterListener(listener);
  };

  private notifyModelUpdateChangeListeners = () => {
    // console.log(`Detected model update - firing model update notifications...`);
    this.modelUpdateChangeListenerGroup.notifyListeners(this.lastUpdateTimestamp);
  }

}
