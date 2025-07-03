# Forge Bulk Issue Operations - Architecture Documentation

## Overview

The Forge Bulk Issue Operations app is a comprehensive Atlassian Forge application that provides enhanced bulk operations for Jira issues. It offers three main functionalities: bulk move, bulk edit, and bulk import of work items, with configurable business rules and policy enforcement.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Atlassian Forge Platform                 │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (React SPA)          │  Backend (Node.js Functions)   │
│  ┌─────────────────────────┐   │  ┌─────────────────────────┐   │
│  │     Main Application    │   │  │      Resolver           │   │
│  │  - BulkOperationPanel   │◄──┼──┤  - initiateBulkMove     │   │
│  │  - Workflow Models      │   │  │  - initiateBulkEdit     │   │
│  │  - UI Components        │   │  │  - logMessage           │   │
│  └─────────────────────────┘   │  └─────────────────────────┘   │
│  ┌─────────────────────────┐   │                                │
│  │   Business Rules        │   │                                │
│  │  - Static Rules         │   │                                │
│  │  - Rule Enforcer        │   │                                │
│  └─────────────────────────┘   │                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Jira REST APIs                           │
│  - Bulk Move API (/rest/api/3/bulk/issues/move)                 │
│  - Bulk Edit API (/rest/api/3/bulk/issues/fields)               │
│  - Issue Search, Projects, Field Metadata APIs                  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Architecture (React SPA)

#### Main Application Structure
- **Entry Point**: `static/spa/src/index.tsx` - Initializes the React app with Forge bridge
- **Main Router**: `static/spa/src/Main.tsx` - Handles routing between different operation modes
- **Core Panel**: `static/spa/src/panel/BulkOperationPanel.tsx` - Main orchestrator for all bulk operations

#### Workflow System
The application uses a step-based workflow system defined in `BulkOperationsWorkflow.ts`:

**Move Workflow Steps:**
1. `filter` - Define JQL filters to select issues
2. `issue-selection` - Review and confirm selected issues
3. `target-project-selection` - Choose destination project
4. `issue-type-mapping` - Map source to target issue types
5. `field-mapping` - Configure field value mappings
6. `move-or-edit` - Execute the operation

**Edit Workflow Steps:**
1. `filter` - Define JQL filters to select issues
2. `issue-selection` - Review and confirm selected issues
3. `edit-fields` - Configure field edits
4. `move-or-edit` - Execute the operation

**Import Workflow Steps:**
2. `project-and-issue-type-selection` - Choose target project and issue type
3. `column-mapping` - Map CSV columns to Jira fields
4. `import-issues` - Execute the import

#### Model System
- **BulkOpsModel**: Base class for workflow state management
- **moveModel**: Handles move operation state
- **editModel**: Handles edit operation state  
- **importModel**: Handles import operation state with CSV parsing

Each model tracks completion states for workflow steps and notifies UI components of changes.

#### UI Components Structure
```
panels/
├── BulkOperationPanel.tsx      # Main orchestrator
├── FilterPanel.tsx             # JQL filtering
├── FieldMappingPanel.tsx       # Field value mapping
├── FieldEditsPanel.tsx         # Field editing
├── IssueTypeMappingPanel.tsx   # Issue type mapping
├── FileUploadPanel.tsx         # CSV file upload
└── ImportColumnMappingPanel.tsx # CSV column mapping

widgets/
├── IssueSelectionPanel.tsx     # Issue selection and review
├── ProjectsSelect.tsx          # Project selection
├── FieldEditor.tsx             # Individual field editors
└── FileUploadWidget.tsx        # File upload component
```

### 2. Backend Architecture (Node.js Functions)

#### Resolver Functions (`src/resolver.ts`)
- **initiateBulkMove**: Processes bulk move requests
- **initiateBulkEdit**: Processes bulk edit requests  
- **logMessage**: Handles client-side logging

#### Bulk Operations Handler (`src/initiateBulkOperations.ts`)
Key responsibilities:
- **User Group Management**: Temporarily adds users to bulk operations group for permissions
- **API Orchestration**: Calls Jira bulk APIs with retry logic
- **Error Handling**: Implements exponential backoff for failed operations
- **Tracing**: Provides request tracing for debugging

### 3. Business Rules System

#### Static Rules (`static/spa/src/extension/bulkOperationStaticRules.ts`)
Configurable business rules including:
- Cross-project category move restrictions
- Issue type mapping constraints
- Field editing permissions
- Subtask handling strategies
- Maximum issue limits

#### Rule Enforcer (`static/spa/src/extension/bulkOperationRuleEnforcer.ts`)
- **JQL Augmentation**: Automatically adds business rule constraints to JQL queries
- **Validation**: Enforces rules during operation execution
- **Policy Compliance**: Ensures organizational practices are followed

### 4. Data Flow

#### Move Operation Flow:
1. User defines JQL filter → Rule enforcer augments with business rules
2. Issues loaded and displayed for selection
3. User selects target project → System validates against rules
4. Issue type mappings configured → Validated against hierarchy rules
5. Field mappings configured → Default values and transformations applied
6. Backend adds user to permissions group temporarily
7. Bulk move API called with retry logic
8. User removed from permissions group

#### Edit Operation Flow:
1. User defines JQL filter → Rule enforcer augments with business rules
2. Issues loaded and displayed for selection
3. User configures field edits → Validated against field permissions
4. Backend processes with temporary permission elevation
5. Bulk edit API called with retry logic

#### Import Operation Flow:
1. User uploads CSV file → Parsed and validated
2. User selects target project and issue type
3. CSV columns mapped to Jira fields → Validated against field schemas
4. Issues created via standard Jira APIs

### 5. Key Design Patterns

#### Observer Pattern
- Models notify UI components of state changes via listener groups
- Enables reactive UI updates without tight coupling

#### Strategy Pattern
- Different bulk operation modes (Move/Edit/Import) use same base infrastructure
- Workflow steps are configurable per operation type

#### Template Method Pattern
- BulkOpsModel provides common workflow management
- Specific models extend with operation-specific logic

#### Facade Pattern
- BulkOperationPanel orchestrates complex interactions between components
- Simplifies the interface for bulk operations

### 6. Security & Permissions

#### Temporary Permission Elevation
- Users temporarily added to bulk operations group during API calls
- Ensures proper permissions for bulk operations
- Automatic cleanup removes users from group after operations

#### Rule-Based Access Control
- Business rules enforce organizational policies
- Configurable restrictions on cross-project moves
- Field-level edit permissions

### 7. Configuration & Extensibility

#### Static Configuration (`static/spa/src/model/config.ts`)
- Feature toggles for different operation modes
- API behavior configuration
- Development/testing switches

#### Extension Points
- Business rules are externalized and configurable
- Field mapping strategies can be customized
- Issue type mapping rules are pluggable

### 8. Error Handling & Resilience

#### Retry Logic
- Exponential backoff for failed API calls
- Configurable retry attempts and delays
- Comprehensive error logging

#### Validation
- Multi-level validation (client-side, business rules, API-level)
- User-friendly error messages
- Graceful degradation for partial failures

### 9. Performance Considerations

#### Debounced Updates
- Model updates are debounced to prevent excessive re-renders
- Optimized for bulk operations on large issue sets

#### Lazy Loading
- Issue data loaded on-demand
- Progressive disclosure of workflow steps

#### Caching
- Project and field metadata cached to reduce API calls
- Smart cache invalidation strategies

## Technology Stack

- **Frontend**: React 18, TypeScript, Atlaskit Design System
- **Backend**: Node.js 22.x, Forge APIs
- **Platform**: Atlassian Forge
- **Build**: TypeScript compiler, standard Forge tooling

## Deployment & Manifest

The application is configured via `manifest.yml`:
- Global page module with multiple routes
- Required Jira permissions (read/write work, manage configuration)
- Function definitions for resolvers and file upload
- External fetch permissions for Atlassian APIs

This architecture provides a robust, extensible platform for bulk Jira operations while maintaining security, performance, and organizational policy compliance.