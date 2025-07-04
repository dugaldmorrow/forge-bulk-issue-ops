# Admin Enhancement Exercise: Jira Admin Page for Bulk Operations Settings

## Note

This exercise in AI generated and had little review. Consequentally, the exercise may containe mistakes, but let's treat that as a *feature* of the exercise.

## Overview

This exercise outlines the steps to add a Jira admin page that allows administrators to configure the static settings defined in `bulkOperationStaticRules.ts`. The solution described uses Forge UI Kit for the admin interface, Forge Key-Value Store for persistence, and a new resolver function to provide settings access to the CustomUI frontend.

## Architecture

The enhancement consists of four main components:

1. **Admin Page Module**: A new Jira admin page using `jira:adminPage` module
2. **Settings Storage**: Forge Key-Value Store for persisting configuration values
3. **Resolver Function**: Backend function to retrieve settings for the frontend
4. **TypeScript Types**: Shared type definitions for type safety

## Current Settings Analysis

Based on `static/spa/src/extension/bulkOperationStaticRules.ts`, the following settings need to be configurable:

### Numeric Settings
- `maximumNumberOfIssuesToBulkActOn` (number, default: 100)

### Boolean Settings
- `allowTheTargetProjectToMatchAnyIssueSourceProject` (boolean, default: false)
- `allowBulkMovesAcrossProjectCategories` (boolean, default: true)
- `allowBulkMovesFromMultipleProjects` (boolean, default: false)
- `allowBulkEditsFromMultipleProjects` (boolean, default: false)
- `allowBulkEditsAcrossMultipleProjects` (boolean, default: true)
- `enableTheAbilityToBulkChangeResolvedIssues` (boolean, default: false)
- `restrictIssueTypeMoveMappingsToSameHierarchyLevel` (boolean, default: true)
- `showLabelsSelect` (boolean, default: false)
- `showLabelsEditField` (boolean, default: true)
- `advancedFilterModeEnabled` (boolean, default: true)
- `defaultRetainValueSetting` (boolean, default: true)
- `enablePanelExpansion` (boolean, default: true)

### String/Enum Settings
- `bulkMoveIssueTypeMappingStrategy` (enum, default: 'exact-matches-and-allow-listed-mappings')
- `filterModeDefault` (enum: 'advanced' | 'basic', default: 'basic')
- `subtaskMoveStrategy` (enum, default: 'move-subtasks-explicitly-with-parents')

### Array Settings
- `excludedIssueStatuses` (string[], default: [])
- `optionalFieldNamesToIncludeInMoves` (string[], default: [])

### Object Settings
- `allowedBulkMoveIssueTypeMappings` (object, default: { 'Bug': 'THE Bug' })

## Implementation Steps

### Step 1: Install Required Dependencies

Add the Forge Key-Value Store and UI Kit libraries to your project:

```bash
npm install @forge/kvs @forge/ui
```

Update `package.json` dependencies:
```json
{
  "dependencies": {
    "@forge/api": "^5.1.0",
    "@forge/bridge": "4.5.3",
    "@forge/react": "^11.2.2",
    "@forge/resolver": "1.6.10",
    "@forge/kvs": "^1.0.0",
    "@forge/ui": "^1.0.0",
    "react": "^18.2.0"
  }
}
```

### Step 2: Define TypeScript Types

Create the shared type definition that will be used in both backend and frontend:

#### `src/types/BulkOpsStaticSettings.ts`
```typescript
export interface BulkOpsStaticSettings {
  maximumNumberOfIssuesToBulkActOn: number;
  allowTheTargetProjectToMatchAnyIssueSourceProject: boolean;
  allowBulkMovesAcrossProjectCategories: boolean;
  allowBulkMovesFromMultipleProjects: boolean;
  allowBulkEditsFromMultipleProjects: boolean;
  allowBulkEditsAcrossMultipleProjects: boolean;
  bulkMoveIssueTypeMappingStrategy: BulkMoveIssueTypeMappingStrategy;
  allowedBulkMoveIssueTypeMappings: Record<string, string>;
  enableTheAbilityToBulkChangeResolvedIssues: boolean;
  excludedIssueStatuses: string[];
  subtaskMoveStrategy: SubtaskMoveStrategy;
  restrictIssueTypeMoveMappingsToSameHierarchyLevel: boolean;
  showLabelsSelect: boolean;
  showLabelsEditField: boolean;
  advancedFilterModeEnabled: boolean;
  filterModeDefault: 'advanced' | 'basic';
  defaultRetainValueSetting: boolean;
  optionalFieldNamesToIncludeInMoves: string[];
  enablePanelExpansion: boolean;
}

export type BulkMoveIssueTypeMappingStrategy =
  'all-mappings-at-same-level-allowed' |
  'exact-matches-and-allow-listed-mappings' |
  'only-allow-listed-mappings';

export type SubtaskMoveStrategy =
  'issues-with-subtasks-can-not-be-moved' |
  'move-subtasks-explicitly-with-parents';

export const DEFAULT_BULK_OPS_SETTINGS: BulkOpsStaticSettings = {
  maximumNumberOfIssuesToBulkActOn: 100,
  allowTheTargetProjectToMatchAnyIssueSourceProject: false,
  allowBulkMovesAcrossProjectCategories: true,
  allowBulkMovesFromMultipleProjects: false,
  allowBulkEditsFromMultipleProjects: false,
  allowBulkEditsAcrossMultipleProjects: true,
  bulkMoveIssueTypeMappingStrategy: 'exact-matches-and-allow-listed-mappings',
  allowedBulkMoveIssueTypeMappings: { 'Bug': 'THE Bug' },
  enableTheAbilityToBulkChangeResolvedIssues: false,
  excludedIssueStatuses: [],
  subtaskMoveStrategy: 'move-subtasks-explicitly-with-parents',
  restrictIssueTypeMoveMappingsToSameHierarchyLevel: true,
  showLabelsSelect: false,
  showLabelsEditField: true,
  advancedFilterModeEnabled: true,
  filterModeDefault: 'basic',
  defaultRetainValueSetting: true,
  optionalFieldNamesToIncludeInMoves: [],
  enablePanelExpansion: true
};
```

#### `static/spa/src/types/BulkOpsStaticSettings.ts`
```typescript
// Duplicate the exact same content as above for frontend usage
```

### Step 3: Update Manifest Configuration

Add the admin page module to `manifest.yml`:

```yaml
modules:
  jira:globalPage:
    - key: forge-custom-bulk-move-issues-page
      resource: main
      layout: blank
      resolver:
        function: global-resolver-fn
      title: Bulk Work Item Operations
      pages:
        - title: About Bulk Work Items Operations
          route: /
        - title: Bulk Move Work Items
          route: move
        - title: Bulk Edit Work Items
          route: edit
        - title: Bulk Import Work Items
          route: import
  
  # NEW: Admin page module using UI Kit
  jira:adminPage:
    - key: bulk-ops-admin-page
      function: admin-function
      title: Bulk Operations Settings
      render: native
      resolver:
        function: global-resolver-fn
      
  function:
    - key: global-resolver-fn
      handler: resolver.handler
    # NEW: Admin function using UI Kit
    - key: admin-function
      handler: adminPage.handler

resources:
  - key: main
    path: static/spa/build
    tunnel:
      port: 3000

permissions:
  scopes:
    - read:jira-work
    - write:jira-work
    - manage:jira-configuration
    - read:jira-user
    # NEW: Storage permission for KVS
    - storage:app
```

### Step 4: Create Admin Page with UI Kit

Create `src/adminPage.ts`:

```typescript
import { useState, useEffect } from 'react';
import { storage } from '@forge/kvs';
import { 
  Fragment, 
  Text, 
  Form, 
  FormSection, 
  FormField, 
  TextField, 
  Checkbox, 
  Select, 
  Option, 
  Button, 
  ButtonSet, 
  SectionMessage,
  Heading,
  Strong,
  Textfield
} from '@forge/ui';
import { BulkOpsStaticSettings, DEFAULT_BULK_OPS_SETTINGS } from './types/BulkOpsStaticSettings';

const SETTINGS_KEY = 'bulk-ops-static-settings';

const AdminPage = () => {
  const [settings, setSettings] = useState<BulkOpsStaticSettings>(DEFAULT_BULK_OPS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(async () => {
    try {
      const storedSettings = await storage.get(SETTINGS_KEY);
      if (storedSettings) {
        setSettings({ ...DEFAULT_BULK_OPS_SETTINGS, ...storedSettings });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings. Using defaults.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = async (formData: any) => {
    setSaving(true);
    setMessage(null);
    
    try {
      const newSettings: BulkOpsStaticSettings = {
        maximumNumberOfIssuesToBulkActOn: parseInt(formData.maximumNumberOfIssuesToBulkActOn) || 100,
        allowTheTargetProjectToMatchAnyIssueSourceProject: formData.allowTheTargetProjectToMatchAnyIssueSourceProject === 'true',
        allowBulkMovesAcrossProjectCategories: formData.allowBulkMovesAcrossProjectCategories === 'true',
        allowBulkMovesFromMultipleProjects: formData.allowBulkMovesFromMultipleProjects === 'true',
        allowBulkEditsFromMultipleProjects: formData.allowBulkEditsFromMultipleProjects === 'true',
        allowBulkEditsAcrossMultipleProjects: formData.allowBulkEditsAcrossMultipleProjects === 'true',
        bulkMoveIssueTypeMappingStrategy: formData.bulkMoveIssueTypeMappingStrategy,
        allowedBulkMoveIssueTypeMappings: JSON.parse(formData.allowedBulkMoveIssueTypeMappings || '{}'),
        enableTheAbilityToBulkChangeResolvedIssues: formData.enableTheAbilityToBulkChangeResolvedIssues === 'true',
        excludedIssueStatuses: formData.excludedIssueStatuses ? formData.excludedIssueStatuses.split(',').map(s => s.trim()).filter(s => s) : [],
        subtaskMoveStrategy: formData.subtaskMoveStrategy,
        restrictIssueTypeMoveMappingsToSameHierarchyLevel: formData.restrictIssueTypeMoveMappingsToSameHierarchyLevel === 'true',
        showLabelsSelect: formData.showLabelsSelect === 'true',
        showLabelsEditField: formData.showLabelsEditField === 'true',
        advancedFilterModeEnabled: formData.advancedFilterModeEnabled === 'true',
        filterModeDefault: formData.filterModeDefault,
        defaultRetainValueSetting: formData.defaultRetainValueSetting === 'true',
        optionalFieldNamesToIncludeInMoves: formData.optionalFieldNamesToIncludeInMoves ? formData.optionalFieldNamesToIncludeInMoves.split(',').map(s => s.trim()).filter(s => s) : [],
        enablePanelExpansion: formData.enablePanelExpansion === 'true'
      };

      await storage.set(SETTINGS_KEY, newSettings);
      setSettings(newSettings);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      await storage.delete(SETTINGS_KEY);
      setSettings(DEFAULT_BULK_OPS_SETTINGS);
      setMessage({ type: 'info', text: 'Settings reset to defaults.' });
    } catch (error) {
      console.error('Error resetting settings:', error);
      setMessage({ type: 'error', text: 'Failed to reset settings. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Fragment>
        <Heading size="large">Bulk Operations Settings</Heading>
        <Text>Loading settings...</Text>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <Heading size="large">Bulk Operations Settings</Heading>
      <Text>Configure the behavior of bulk operations for work items.</Text>
      
      {message && (
        <SectionMessage title={message.type === 'success' ? 'Success' : message.type === 'error' ? 'Error' : 'Info'} appearance={message.type}>
          <Text>{message.text}</Text>
        </SectionMessage>
      )}

      <Form onSubmit={handleSave}>
        <FormSection>
          <Heading size="medium">General Settings</Heading>
          
          <FormField label="Maximum Issues for Bulk Operations" isRequired>
            <Textfield 
              name="maximumNumberOfIssuesToBulkActOn" 
              defaultValue={settings.maximumNumberOfIssuesToBulkActOn.toString()}
              placeholder="100"
            />
            <Text>Maximum number of issues that can be selected for bulk operations (recommended: 100)</Text>
          </FormField>

          <FormField label="Enable Panel Expansion">
            <Checkbox 
              name="enablePanelExpansion" 
              defaultChecked={settings.enablePanelExpansion}
            />
            <Text>Allow panels to be expanded to full-screen overlays</Text>
          </FormField>
        </FormSection>

        <FormSection>
          <Heading size="medium">Bulk Move Settings</Heading>
          
          <FormField label="Allow Target Project to Match Source Projects">
            <Checkbox 
              name="allowTheTargetProjectToMatchAnyIssueSourceProject" 
              defaultChecked={settings.allowTheTargetProjectToMatchAnyIssueSourceProject}
            />
            <Text>Allow selecting a target project that matches one of the source projects</Text>
          </FormField>

          <FormField label="Allow Moves Across Project Categories">
            <Checkbox 
              name="allowBulkMovesAcrossProjectCategories" 
              defaultChecked={settings.allowBulkMovesAcrossProjectCategories}
            />
          </FormField>

          <FormField label="Allow Moves From Multiple Projects">
            <Checkbox 
              name="allowBulkMovesFromMultipleProjects" 
              defaultChecked={settings.allowBulkMovesFromMultipleProjects}
            />
          </FormField>

          <FormField label="Issue Type Mapping Strategy">
            <Select name="bulkMoveIssueTypeMappingStrategy" defaultValue={settings.bulkMoveIssueTypeMappingStrategy}>
              <Option label="All mappings at same level allowed" value="all-mappings-at-same-level-allowed" />
              <Option label="Exact matches and allow-listed mappings" value="exact-matches-and-allow-listed-mappings" />
              <Option label="Only allow-listed mappings" value="only-allow-listed-mappings" />
            </Select>
          </FormField>

          <FormField label="Allowed Issue Type Mappings (JSON)">
            <Textfield 
              name="allowedBulkMoveIssueTypeMappings" 
              defaultValue={JSON.stringify(settings.allowedBulkMoveIssueTypeMappings, null, 2)}
              placeholder='{"Bug": "THE Bug"}'
            />
            <Text>JSON object mapping source issue types to target issue types</Text>
          </FormField>

          <FormField label="Subtask Move Strategy">
            <Select name="subtaskMoveStrategy" defaultValue={settings.subtaskMoveStrategy}>
              <Option label="Issues with subtasks cannot be moved" value="issues-with-subtasks-can-not-be-moved" />
              <Option label="Move subtasks explicitly with parents" value="move-subtasks-explicitly-with-parents" />
            </Select>
          </FormField>

          <FormField label="Restrict Issue Type Mappings to Same Hierarchy Level">
            <Checkbox 
              name="restrictIssueTypeMoveMappingsToSameHierarchyLevel" 
              defaultChecked={settings.restrictIssueTypeMoveMappingsToSameHierarchyLevel}
            />
          </FormField>

          <FormField label="Default Retain Value Setting">
            <Checkbox 
              name="defaultRetainValueSetting" 
              defaultChecked={settings.defaultRetainValueSetting}
            />
            <Text>Default value for the 'retain' field parameter in bulk move operations</Text>
          </FormField>

          <FormField label="Optional Field Names to Include in Moves">
            <Textfield 
              name="optionalFieldNamesToIncludeInMoves" 
              defaultValue={settings.optionalFieldNamesToIncludeInMoves.join(', ')}
              placeholder="Components, Affects versions, Fix versions"
            />
            <Text>Comma-separated list of field names to include in move operations</Text>
          </FormField>
        </FormSection>

        <FormSection>
          <Heading size="medium">Bulk Edit Settings</Heading>
          
          <FormField label="Allow Edits From Multiple Projects">
            <Checkbox 
              name="allowBulkEditsFromMultipleProjects" 
              defaultChecked={settings.allowBulkEditsFromMultipleProjects}
            />
          </FormField>

          <FormField label="Allow Edits Across Multiple Projects">
            <Checkbox 
              name="allowBulkEditsAcrossMultipleProjects" 
              defaultChecked={settings.allowBulkEditsAcrossMultipleProjects}
            />
          </FormField>

          <FormField label="Enable Bulk Changes for Resolved Issues">
            <Checkbox 
              name="enableTheAbilityToBulkChangeResolvedIssues" 
              defaultChecked={settings.enableTheAbilityToBulkChangeResolvedIssues}
            />
            <Text>Allow bulk operations on issues that are already resolved</Text>
          </FormField>

          <FormField label="Excluded Issue Statuses">
            <Textfield 
              name="excludedIssueStatuses" 
              defaultValue={settings.excludedIssueStatuses.join(', ')}
              placeholder="On-Hold, Cancelled"
            />
            <Text>Comma-separated list of issue statuses to exclude from bulk operations</Text>
          </FormField>
        </FormSection>

        <FormSection>
          <Heading size="medium">UI Settings</Heading>
          
          <FormField label="Show Labels Select">
            <Checkbox 
              name="showLabelsSelect" 
              defaultChecked={settings.showLabelsSelect}
            />
          </FormField>

          <FormField label="Show Labels Edit Field">
            <Checkbox 
              name="showLabelsEditField" 
              defaultChecked={settings.showLabelsEditField}
            />
          </FormField>

          <FormField label="Advanced Filter Mode Enabled">
            <Checkbox 
              name="advancedFilterModeEnabled" 
              defaultChecked={settings.advancedFilterModeEnabled}
            />
          </FormField>

          <FormField label="Default Filter Mode">
            <Select name="filterModeDefault" defaultValue={settings.filterModeDefault}>
              <Option label="Basic" value="basic" />
              <Option label="Advanced" value="advanced" />
            </Select>
          </FormField>
        </FormSection>

        <ButtonSet>
          <Button text={saving ? "Saving..." : "Save Settings"} type="submit" disabled={saving} appearance="primary" />
          <Button text="Reset to Defaults" onClick={handleReset} disabled={saving} appearance="subtle" />
        </ButtonSet>
      </Form>
    </Fragment>
  );
};

export const handler = AdminPage;
```

### Step 5: Update Main Resolver

Add a new resolver function to `src/resolver.ts` for frontend access:

```typescript
import Resolver from '@forge/resolver';
import { webTrigger } from "@forge/api";
import { storage } from '@forge/kvs';
import { initiateBulkEdit, initiateBulkMove } from './initiateBulkOperations';
import { BulkOpsStaticSettings, DEFAULT_BULK_OPS_SETTINGS } from './types/BulkOpsStaticSettings';

const resolver = new Resolver();

const SETTINGS_KEY = 'bulk-ops-static-settings';

// Existing resolvers...
resolver.define('initiateBulkMove', async (request: any) => {
  // ... existing code
});

resolver.define('initiateBulkEdit', async (request: any) => {
  // ... existing code
});

resolver.define('logMessage', async (request: any): Promise<void> => {
  // ... existing code
});

// NEW: Settings resolver for frontend
resolver.define('getBulkOpsSettings', async (): Promise<BulkOpsStaticSettings> => {
  try {
    const settings = await storage.get(SETTINGS_KEY);
    return settings ? { ...DEFAULT_BULK_OPS_SETTINGS, ...settings } : DEFAULT_BULK_OPS_SETTINGS;
  } catch (error) {
    console.error('Error retrieving bulk ops settings:', error);
    return DEFAULT_BULK_OPS_SETTINGS;
  }
});

export const handler = resolver.getDefinitions();
```

### Step 6: Update Frontend to Use Dynamic Settings

Modify `static/spa/src/extension/bulkOperationStaticRules.ts` to load settings dynamically:

```typescript
import { invoke } from '@forge/bridge';
import { BulkOpsStaticSettings, DEFAULT_BULK_OPS_SETTINGS } from '../types/BulkOpsStaticSettings';

let cachedSettings: BulkOpsStaticSettings | null = null;

export const getSettings = async (): Promise<BulkOpsStaticSettings> => {
  if (cachedSettings) {
    return cachedSettings;
  }
  
  try {
    cachedSettings = await invoke('getBulkOpsSettings');
    return cachedSettings;
  } catch (error) {
    console.error('Failed to load settings, using defaults:', error);
    return DEFAULT_BULK_OPS_SETTINGS;
  }
};

// Export individual settings as async functions
export const getMaximumNumberOfIssuesToBulkActOn = async (): Promise<number> => {
  const settings = await getSettings();
  return settings.maximumNumberOfIssuesToBulkActOn;
};

export const getAllowTheTargetProjectToMatchAnyIssueSourceProject = async (): Promise<boolean> => {
  const settings = await getSettings();
  return settings.allowTheTargetProjectToMatchAnyIssueSourceProject;
};

// ... continue for all other settings

// For backward compatibility, keep the original exports but mark as deprecated
/** @deprecated Use getMaximumNumberOfIssuesToBulkActOn() instead */
export const maximumNumberOfIssuesToBulkActOn = 100;

/** @deprecated Use getAllowTheTargetProjectToMatchAnyIssueSourceProject() instead */
export const allowTheTargetProjectToMatchAnyIssueSourceProject = false;

// ... continue for all other settings
```

## Key Design Decisions

### UI Kit vs Custom UI
This implementation uses **Forge UI Kit** instead of Custom UI for the admin page, which provides several advantages:

1. **Simplicity**: No need for separate React build process or additional resources
2. **Native Integration**: UI Kit components are optimized for Forge and Atlassian products
3. **Reduced Complexity**: Single TypeScript file handles the entire admin interface
4. **Automatic Styling**: Consistent with Atlassian design system out of the box
5. **Better Performance**: No additional bundle size or loading overhead

### Single JSON Object Storage
All settings are stored as a single JSON object in the Forge Key-Value Store using the key `'bulk-ops-static-settings'`. This approach provides several benefits:

1. **Efficiency**: Only one read operation is required to retrieve all settings
2. **Atomicity**: All settings are updated together, preventing inconsistent states
3. **Simplicity**: Easier to manage and backup/restore configurations
4. **Performance**: Reduces the number of storage API calls

### Type Safety
The `BulkOpsStaticSettings` interface ensures type safety across both backend and frontend code. The type definition is duplicated in both `src/types/` and `static/spa/src/types/` to maintain separation between backend and frontend dependencies while ensuring consistency.

### Caching Strategy
The frontend implementation includes a simple caching mechanism to avoid repeated resolver calls within the same session, improving performance.

### Backward Compatibility
The original static exports are maintained but marked as deprecated, allowing for gradual migration of existing code.

## Testing Considerations

1. **Admin Page**: Test all form fields, validation, save/reset functionality
2. **Storage**: Verify settings persist correctly and handle storage errors gracefully
3. **Frontend Integration**: Ensure settings are properly loaded and applied
4. **Performance**: Test with various settings combinations to ensure no performance degradation
5. **Permissions**: Verify only Jira administrators can access the admin page

## Security Considerations

1. **Access Control**: The `jira:adminPage` module automatically restricts access to Jira administrators
2. **Input Validation**: Validate all settings on both frontend and backend
3. **Storage Security**: Forge Key-Value Store provides secure, app-scoped storage
4. **Error Handling**: Avoid exposing sensitive information in error messages

## Deployment Steps

1. Install dependencies: `npm install @forge/kvs`
2. Create type definitions in both backend and frontend
3. Update manifest.yml with admin page module
4. Implement admin resolver and update main resolver
5. Build admin UI components
6. Update frontend to use dynamic settings
7. Test thoroughly in development environment
8. Deploy using `forge deploy`
9. Install/upgrade the app in target Jira instance

## Future Enhancements

1. **Settings Validation**: Add comprehensive validation rules for each setting
2. **Import/Export**: Allow administrators to export/import settings configurations
3. **Audit Trail**: Track changes to settings with timestamps and user information
4. **Environment-Specific Settings**: Support different settings for different environments
5. **Settings Documentation**: Add help text and tooltips for each setting in the admin UI