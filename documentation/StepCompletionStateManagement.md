# Step Completion State Management

## Overview

The Forge Bulk Issue Operations app uses a step completion state management system to track user progress through multi-step workflows. This system ensures that users complete prerequisite steps before proceeding to dependent steps, maintains data consistency, and provides clear visual feedback about workflow progress.

## Core Architecture

### Completion States

The system uses a simple but effective two-state model defined in `CompletionState.ts`:

```typescript
export type CompletionState = 'incomplete' | 'complete';
```

### Workflow Definitions

Each operation mode has a predefined sequence of steps:

**Move Workflow:**
```typescript
['filter', 'issue-selection', 'target-project-selection', 'issue-type-mapping', 'field-mapping', 'move-or-edit']
```

**Edit Workflow:**
```typescript
['filter', 'issue-selection', 'edit-fields', 'move-or-edit']
```

**Import Workflow:**
```typescript
['file-upload', 'project-and-issue-type-selection', 'column-mapping', 'import-issues']
```

## BulkOpsModel: The State Management Engine

### Core Data Structure

The `BulkOpsModel` class maintains completion states using a record mapping step names to their completion states:

```typescript
private stepNamesToCompletionStates: Record<StepNameSubtype, CompletionState>;
```

### Initialization

When a model is constructed, all steps are initialized to `'incomplete'`:

```typescript
stepSequence.forEach((stepName) => {
  this.stepNamesToCompletionStates[stepName] = 'incomplete';
});
```

### State Updates and Cascade Logic

The most critical aspect of the system is the cascade logic implemented in `setStepCompletionState()`:

```typescript
public setStepCompletionState = (stepName: StepNameSubtype, completionState: CompletionState): void => {
  const previousCompletionState = this.stepNamesToCompletionStates[stepName];
  if (previousCompletionState !== completionState) {
    let changedStepNames: StepNameSubtype[] = [];
    changedStepNames.push(stepName);
    this.stepNamesToCompletionStates[stepName] = completionState;
    
    // CASCADE LOGIC: If a step becomes incomplete, all downstream steps become incomplete
    if (completionState !== 'complete') {
      const downstreamSteps = this.stepSequence.slice(this.stepSequence.indexOf(stepName) + 1);
      for (const downstreamStep of downstreamSteps) {
        if (this.stepNamesToCompletionStates[downstreamStep] !== 'complete') {
          this.stepNamesToCompletionStates[downstreamStep] = 'incomplete';
          changedStepNames.push(downstreamStep);
        }
      }
    }
    
    // Notify listeners in reverse order for logical consistency
    for (let i = changedStepNames.length - 1; i >= 0; i--) {
      const changedStepName = changedStepNames[i];
      const stepCompletionState = this.stepNamesToCompletionStates[changedStepName];
      this.notifyStepCompletionStateChangeListeners(changedStepName, stepCompletionState);
    }
  }
}
```

**Key Cascade Behavior:**
- When a step becomes `'incomplete'`, ALL downstream steps automatically become `'incomplete'`
- When a step becomes `'complete'`, downstream steps are NOT automatically updated
- This ensures data consistency and prevents users from proceeding with stale data

## Observer Pattern Implementation

### Listener Groups

The system uses a custom observer pattern implementation through `ListenerGroup`:

```typescript
private stepCompletionStateChangeListenerGroup: ListenerGroup;
private modelUpdateChangeListenerGroup: ListenerGroup;
```

### Registration and Notification

Components register listeners to receive state change notifications:

```typescript
// Registration
props.bulkOpsModel.registerStepCompletionStateChangeListener(onStepCompletionStateChange);

// Notification payload
type CompletionStateChangeInfo = {
  stepName: StepName;
  completionState: CompletionState;
  modelUpdateTimestamp: number;
}
```

### Debounced Updates

To prevent excessive re-renders, model updates are debounced:

```typescript
const modelUpdateNotifierDebouncePeriodMilliseconds = 100;
this.debouncedNotifyModelUpdateChangeListeners = debounce(
  this.notifyModelUpdateChangeListeners,
  modelUpdateNotifierDebouncePeriodMilliseconds,
  immediatelyNotifyModelUpdateListeners
);
```

## UI Integration in BulkOperationPanel

### State Synchronization

The main `BulkOperationPanel` maintains a local copy of completion states for rendering:

```typescript
const [stepNamesToCompletionStates, setStepNamesToCompletionStates] = useState<ObjectMapping<CompletionState>>(
  props.bulkOpsModel.getStepNamesToCompletionStates()
);
```

### Listener Implementation

The panel registers listeners to stay synchronized with model changes:

```typescript
const onStepCompletionStateChange = (completionStateChangeInfo: CompletionStateChangeInfo) => {
  const stepName = completionStateChangeInfo.stepName;
  const completionState = completionStateChangeInfo.completionState;
  updateStepCompletionState(stepName, completionState, false); // false = don't update model
  if (completionState === 'incomplete') {
    clearStepStateAfter(stepName); // Clear UI state for downstream steps
  }
}
```

### Step Validation Logic

The panel implements prerequisite checking:

```typescript
const arePrerequisiteStepsComplete = (priorToStepName: StepName, rendering: boolean): boolean => {
  let complete = true;
  const stepSequence = props.bulkOpsModel.getStepSequence();
  for (const stepName of stepSequence) {
    if (stepName === priorToStepName) {
      break; // Stop checking once we reach the step we're interested in
    }
    const completionState = getStepCompletionState(stepName, rendering);
    if (isStepApplicableToBulkOperationMode(stepName)) {
      if (completionState !== 'complete') {
        complete = false;
        break;
      }
    }
  }
  return complete;
}
```

## Step-Specific Completion Logic

### Filter Step
- **Complete when:** JQL query returns > 0 issues
- **Triggers:** `onIssueSearchCompleted()` sets completion state based on issue count

### Issue Selection Step
- **Complete when:** Valid issues are selected (passes business rule validation)
- **Validation includes:** 
  - No cross-project selections (if restricted)
  - No multiple issue types (for certain operations)
  - No subtasks (if restricted by rules)

### Target Project Selection Step (Move only)
- **Complete when:** A target project is selected
- **Triggers:** `onToProjectSelect()` immediately updates completion state

### Issue Type Mapping Step (Move only)
- **Complete when:** All selected issue types have valid mappings to target project issue types
- **Validation:** Uses `bulkIssueTypeMappingModel.areAllIssueTypesMapped()`

### Field Mapping Step (Move only)
- **Complete when:** All mandatory fields have default values provided
- **Complex logic:** Combines data retrieval status with field value validation

### Edit Fields Step (Edit only)
- **Complete when:** All field edits pass validation
- **Triggers:** `onEditsValidityChange()` callback from field validation

### Final Execution Step
- **Complete when:** Bulk operation successfully completes
- **Managed by:** `MoveOrEditPanel` component

## State Clearing and Cascade Effects

### Automatic State Clearing

When a step becomes incomplete, the system automatically clears downstream state:

```typescript
const clearStepStateAfter = (stepName: StepName) => {
  const nextDownstreamStep = props.bulkOpsModel.getNextDownstreamStep(stepName);
  if (nextDownstreamStep) {
    clearStepState(nextDownstreamStep);
  }
}
```

### Step-Specific Clearing Logic

Each step has specific clearing behavior:

```typescript
const clearStepState = (stepName: StepName) => {
  if (stepName === 'issue-selection') {
    const newIssueSelectionState: IssueSelectionState = {
      uuid: newIssueSelectionUuid(),
      selectedIssues: [],
      selectionValidity: 'invalid-no-issues-selected'
    };
    setIssueSelectionState(newIssueSelectionState);
  } else if (stepName === 'target-project-selection') {
    setSelectedToProject(undefined);
  } else if (stepName === 'issue-type-mapping') {
    bulkIssueTypeMappingModel.clearMappings();
  } else if (stepName === 'field-mapping') {
    targetProjectFieldsModel.clearDefaultFieldValues();
  }
  // ... additional step clearing logic
}
```

## Visual Feedback System

### PanelHeader Component

Each step displays its completion state visually:

```typescript
const PanelHeader = (props: PanelHeaderProps) => {
  return (
    <div className='panel-header'>
      <div><h3>Step {props.stepNumber}</h3></div>
      <div>
        {props.completionState === 'complete' ? 
          <SuccessSymbol label="Step complete" /> : 
          <TodoSymbol label="Step incomplete" />
        }
      </div>
    </div>
  );
}
```

### Waiting Messages

Steps display waiting messages when prerequisites aren't met:

```typescript
const waitingMessage = new WaitingMessageBuilder()
  .addCheck(arePrerequisiteStepsComplete('target-project-selection', true), 'Waiting for previous steps to be completed.')
  .addCheck(issueSelectionState.selectionValidity === 'valid', 'A valid set of work items has not yet been selected.')
  .build();
```

## Import Workflow Specifics

The import workflow has some unique characteristics:

### File Upload Step
- Uses `importModel.setCsvParseResult()` to update completion state
- Validates CSV format and content

### Column Mapping Step
- Tracks field mappings between CSV columns and Jira fields
- Uses `importModel.setColumnMappingInfo()` for state updates

### Project Selection Step
- Simpler than move workflow - just project and issue type selection
- Updates via `importModel.setSelectedProject()` and `importModel.setSelectedIssueType()`

## Performance Optimizations

### Debounced Notifications
- Model updates are debounced to prevent excessive re-renders
- 100ms debounce period balances responsiveness with performance

### Selective Re-rendering
- Components only re-render when their specific completion states change
- Uses React's dependency arrays effectively

### Listener Management
- Proper cleanup of listeners in component unmount
- Prevents memory leaks in long-running sessions

## Areas for Improvement

### 1. **State Management Complexity**

**Current Issues:**
- The completion state logic is scattered across multiple components
- Complex interdependencies between UI state and model state
- Dual state management (model state + UI state) creates synchronization challenges

**Improvements:**
- **Centralized State Management:** Implement a Redux-like pattern or use React Context to centralize all state management
- **Single Source of Truth:** Eliminate the dual state system by making the model the single source of truth
- **State Machines:** Consider using XState or similar to model the complex workflow transitions more explicitly

### 2. **Observer Pattern Implementation**

**Current Issues:**
- Custom observer implementation lacks type safety
- Manual listener registration/cleanup is error-prone
- No built-in debugging or monitoring capabilities

**Improvements:**
- **Typed Events:** Implement strongly-typed event system with TypeScript
- **Automatic Cleanup:** Use React hooks that automatically handle listener cleanup
- **Event Debugging:** Add development-time event logging and visualization
- **Event Replay:** Implement event sourcing for better debugging and testing

### 3. **Validation Logic Distribution**

**Current Issues:**
- Validation logic is spread across multiple components
- Business rules are embedded in UI components
- Difficult to test validation logic in isolation

**Improvements:**
- **Validation Layer:** Create a dedicated validation layer separate from UI
- **Rule Engine:** Implement a more sophisticated rule engine for business logic
- **Validation Schemas:** Use libraries like Yup or Zod for declarative validation
- **Async Validation:** Better handling of async validation with proper loading states

### 4. **Error Handling and Recovery**

**Current Issues:**
- Limited error recovery mechanisms
- No way to retry failed state transitions
- Errors can leave the system in inconsistent states

**Improvements:**
- **Error Boundaries:** Implement React error boundaries for graceful error handling
- **Retry Logic:** Add retry mechanisms for failed state transitions
- **State Snapshots:** Implement state snapshots for rollback capabilities
- **Error Reporting:** Better error reporting and user feedback

### 5. **Testing and Debugging**

**Current Issues:**
- Complex state interactions are difficult to test
- No built-in debugging tools for state transitions
- Manual testing required for workflow validation

**Improvements:**
- **State Testing:** Implement comprehensive state machine testing
- **Visual Debugging:** Create development tools for visualizing state transitions
- **Automated Workflow Testing:** End-to-end testing of complete workflows
- **State Invariant Checking:** Runtime validation of state consistency

### 6. **Performance and Scalability**

**Current Issues:**
- Debouncing is hardcoded and not configurable
- No optimization for large datasets
- Potential memory leaks with listener management

**Improvements:**
- **Configurable Debouncing:** Make debounce periods configurable based on context
- **Virtual Scrolling:** For large issue lists, implement virtual scrolling
- **Memory Management:** Better cleanup and garbage collection strategies
- **Progressive Loading:** Load workflow steps progressively as needed

### 7. **Type Safety and Developer Experience**

**Current Issues:**
- Some type assertions and `any` types reduce type safety
- Complex generic types make the code harder to understand
- Limited IntelliSense support for step names and states

**Improvements:**
- **Stronger Typing:** Eliminate `any` types and improve type inference
- **Code Generation:** Generate types from workflow definitions
- **Better Developer Tools:** Improve IDE support and developer experience
- **Documentation:** Auto-generate documentation from type definitions

### 8. **Workflow Flexibility**

**Current Issues:**
- Workflows are hardcoded and not easily configurable
- No support for conditional steps or branching
- Difficult to add new workflow types

**Improvements:**
- **Dynamic Workflows:** Support for runtime workflow configuration
- **Conditional Steps:** Allow steps to be conditionally included
- **Workflow Composition:** Enable composition of smaller workflows into larger ones
- **Plugin Architecture:** Allow third-party extensions to add new workflow steps