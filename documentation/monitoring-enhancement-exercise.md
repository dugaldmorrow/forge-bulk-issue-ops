# Monitoring Enhancement Exercise: Bulk Operations Group Monitoring

## Note

This exercise in AI generated and had little review. Consequentally, the exercise may containe mistakes, but let's treat that as a *feature* of the exercise.

## Overview

This document outlines how to enhance the Forge Bulk Issue Operations app with monitoring functionality to detect users who may have been accidentally left in the bulk-ops-app group. The solution described uses Forge scheduled triggers to periodically check group membership and automatically creates Jira issues to notify administrators when orphaned users are detected.

## Problem Statement

As documented in **KNOWN-11**, there is currently no monitoring of users accidentally left in the bulk-ops group. This can occur due to:

- Application errors during cleanup operations
- Network timeouts during user removal
- Unexpected application termination
- Manual testing that doesn't complete cleanup
- Race conditions in concurrent operations

Users left in the bulk-ops-app group retain elevated permissions for bulk operations, which poses a security risk and violates the principle of least privilege.

## Architecture

The monitoring solution consists of four main components:

1. **Scheduled Trigger**: Forge cron job that runs periodic checks
2. **Group Monitoring Service**: Service to check group membership and detect orphaned users
3. **Issue Creation Service**: Service to create notification issues in Jira
4. **Configuration Management**: Settings for monitoring behavior and notification targets

## Implementation Details

### Step 1: Update Manifest Configuration

Add the scheduled trigger to `manifest.yml`:

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
  
  # NEW: Scheduled trigger for monitoring
  trigger:
    - key: bulk-ops-group-monitor
      function: group-monitor-function
      events:
        - avi:forge:scheduled:bulk-ops-group-check

  function:
    - key: global-resolver-fn
      handler: resolver.handler
    # NEW: Group monitoring function
    - key: group-monitor-function
      handler: groupMonitor.handler

permissions:
  scopes:
    - read:jira-work
    - write:jira-work
    - manage:jira-configuration
    - read:jira-user
    - storage:app
```

### Step 2: Define Monitoring Configuration Types

Create `src/types/MonitoringConfig.ts`:

```typescript
export interface MonitoringConfig {
  enabled: boolean;
  checkIntervalHours: number;
  notificationProjectKey: string;
  assigneeAccountId: string;
  issueTypeId: string;
  priorityId?: string;
  labelPrefix: string;
  maxUsersPerIssue: number;
  gracePeriodMinutes: number;
}

export interface OrphanedUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  addedToGroupTime?: string;
  lastSeenTime?: string;
}

export interface MonitoringResult {
  checkTime: string;
  orphanedUsers: OrphanedUser[];
  totalGroupMembers: number;
  issuesCreated: number;
  errors: string[];
}

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enabled: true,
  checkIntervalHours: 4,
  notificationProjectKey: 'ADMIN',
  assigneeAccountId: '',
  issueTypeId: '10001', // Task
  priorityId: '3', // Medium
  labelPrefix: 'bulk-ops-monitoring',
  maxUsersPerIssue: 10,
  gracePeriodMinutes: 30
};
```

### Step 3: Create Group Monitoring Service

Create `src/groupMonitoringService.ts`:

```typescript
import { storage } from '@forge/kvs';
import api, { route } from '@forge/api';
import { createGroupManagementService } from './groupManagement';
import { MonitoringConfig, OrphanedUser, MonitoringResult, DEFAULT_MONITORING_CONFIG } from './types/MonitoringConfig';

const MONITORING_CONFIG_KEY = 'group-monitoring-config';
const USER_TRACKING_KEY = 'group-user-tracking';
const LAST_CHECK_KEY = 'last-monitoring-check';

interface UserTrackingData {
  [accountId: string]: {
    firstSeen: string;
    lastSeen: string;
    addedByApp: boolean;
  };
}

export class GroupMonitoringService {
  private config: MonitoringConfig;

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  /**
   * Main monitoring function called by scheduled trigger
   */
  async performMonitoringCheck(): Promise<MonitoringResult> {
    const checkTime = new Date().toISOString();
    const result: MonitoringResult = {
      checkTime,
      orphanedUsers: [],
      totalGroupMembers: 0,
      issuesCreated: 0,
      errors: []
    };

    try {
      if (!this.config.enabled) {
        console.log('Group monitoring is disabled');
        return result;
      }

      console.log(`Starting group monitoring check at ${checkTime}`);

      // Get current group members
      const groupService = await createGroupManagementService();
      const currentMembers = await groupService.getGroupMembers();
      result.totalGroupMembers = currentMembers.length;

      if (currentMembers.length === 0) {
        console.log('No users found in bulk-ops-app group');
        await this.updateLastCheckTime(checkTime);
        return result;
      }

      // Get user tracking data
      const userTracking = await this.getUserTrackingData();
      
      // Update tracking data with current members
      await this.updateUserTracking(currentMembers, userTracking);

      // Identify orphaned users
      const orphanedUsers = await this.identifyOrphanedUsers(currentMembers, userTracking);
      result.orphanedUsers = orphanedUsers;

      if (orphanedUsers.length > 0) {
        console.log(`Found ${orphanedUsers.length} orphaned users in bulk-ops-app group`);
        
        // Create notification issues
        const issuesCreated = await this.createNotificationIssues(orphanedUsers);
        result.issuesCreated = issuesCreated;
      } else {
        console.log('No orphaned users detected');
      }

      await this.updateLastCheckTime(checkTime);
      await this.logMonitoringResult(result);

    } catch (error) {
      console.error('Error during group monitoring check:', error);
      result.errors.push(error.message);
    }

    return result;
  }

  /**
   * Identifies users who have been in the group longer than the grace period
   */
  private async identifyOrphanedUsers(
    currentMembers: any[], 
    userTracking: UserTrackingData
  ): Promise<OrphanedUser[]> {
    const orphanedUsers: OrphanedUser[] = [];
    const gracePeriodMs = this.config.gracePeriodMinutes * 60 * 1000;
    const now = new Date();

    for (const member of currentMembers) {
      const trackingData = userTracking[member.accountId];
      
      if (!trackingData) {
        // New user, add to tracking but don't flag as orphaned yet
        continue;
      }

      const firstSeenTime = new Date(trackingData.firstSeen);
      const timeSinceFirstSeen = now.getTime() - firstSeenTime.getTime();

      if (timeSinceFirstSeen > gracePeriodMs) {
        orphanedUsers.push({
          accountId: member.accountId,
          displayName: member.displayName,
          emailAddress: member.emailAddress,
          addedToGroupTime: trackingData.firstSeen,
          lastSeenTime: trackingData.lastSeen
        });
      }
    }

    return orphanedUsers;
  }

  /**
   * Creates Jira issues to notify administrators about orphaned users
   */
  private async createNotificationIssues(orphanedUsers: OrphanedUser[]): Promise<number> {
    let issuesCreated = 0;
    const chunks = this.chunkArray(orphanedUsers, this.config.maxUsersPerIssue);

    for (const chunk of chunks) {
      try {
        await this.createSingleNotificationIssue(chunk);
        issuesCreated++;
      } catch (error) {
        console.error('Failed to create notification issue:', error);
      }
    }

    return issuesCreated;
  }

  /**
   * Creates a single Jira issue for a group of orphaned users
   */
  private async createSingleNotificationIssue(orphanedUsers: OrphanedUser[]): Promise<void> {
    const summary = `Bulk Operations: ${orphanedUsers.length} user(s) left in bulk-ops-app group`;
    
    const description = this.buildIssueDescription(orphanedUsers);
    
    const labels = [
      `${this.config.labelPrefix}-alert`,
      `${this.config.labelPrefix}-${new Date().toISOString().split('T')[0]}`
    ];

    const issueData = {
      fields: {
        project: {
          key: this.config.notificationProjectKey
        },
        summary: summary,
        description: description,
        issuetype: {
          id: this.config.issueTypeId
        },
        assignee: {
          accountId: this.config.assigneeAccountId
        },
        priority: this.config.priorityId ? {
          id: this.config.priorityId
        } : undefined,
        labels: labels
      }
    };

    // Remove undefined fields
    if (!issueData.fields.priority) {
      delete issueData.fields.priority;
    }

    const response = await api.asApp().requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issueData)
    });

    if (response.ok) {
      const createdIssue = await response.json();
      console.log(`Created notification issue: ${createdIssue.key}`);
    } else {
      const errorText = await response.text();
      throw new Error(`Failed to create issue: ${response.status} - ${errorText}`);
    }
  }

  /**
   * Builds the issue description with user details and remediation steps
   */
  private buildIssueDescription(orphanedUsers: OrphanedUser[]): string {
    const userTable = orphanedUsers.map(user => 
      `| ${user.displayName} | ${user.accountId} | ${user.emailAddress} | ${user.addedToGroupTime} |`
    ).join('\n');

    return `
## Alert: Users Left in Bulk Operations Group

The following users have been detected in the bulk-ops-app group for longer than the configured grace period (${this.config.gracePeriodMinutes} minutes):

| Display Name | Account ID | Email | First Detected |
|--------------|------------|-------|----------------|
${userTable}

### Impact
These users currently have elevated permissions for bulk operations in Jira, which may violate security policies.

### Recommended Actions
1. **Immediate**: Review if these users should have bulk operation permissions
2. **If unauthorized**: Remove users from the bulk-ops-app group manually
3. **Investigation**: Check application logs for errors during cleanup operations
4. **Prevention**: Review bulk operation workflows for proper cleanup

### Remediation Commands
To remove users from the group manually, use the Jira REST API:

\`\`\`bash
# Remove user from group
curl -X DELETE \\
  "https://your-domain.atlassian.net/rest/api/3/group/user?groupname=bulk-ops-app&accountId=USER_ACCOUNT_ID" \\
  -u "admin@domain.com:api-token"
\`\`\`

### Monitoring Configuration
- Check Interval: ${this.config.checkIntervalHours} hours
- Grace Period: ${this.config.gracePeriodMinutes} minutes
- Generated: ${new Date().toISOString()}

*This issue was automatically created by the Bulk Operations Monitoring system.*
`;
  }

  /**
   * Updates user tracking data with current group members
   */
  private async updateUserTracking(
    currentMembers: any[], 
    existingTracking: UserTrackingData
  ): Promise<void> {
    const now = new Date().toISOString();
    const updatedTracking: UserTrackingData = { ...existingTracking };

    // Update existing users and add new ones
    for (const member of currentMembers) {
      if (updatedTracking[member.accountId]) {
        updatedTracking[member.accountId].lastSeen = now;
      } else {
        updatedTracking[member.accountId] = {
          firstSeen: now,
          lastSeen: now,
          addedByApp: false // We don't know if it was added by the app
        };
      }
    }

    // Remove tracking for users no longer in the group
    const currentAccountIds = new Set(currentMembers.map(m => m.accountId));
    for (const accountId in updatedTracking) {
      if (!currentAccountIds.has(accountId)) {
        delete updatedTracking[accountId];
      }
    }

    await storage.set(USER_TRACKING_KEY, updatedTracking);
  }

  /**
   * Retrieves user tracking data from storage
   */
  private async getUserTrackingData(): Promise<UserTrackingData> {
    const data = await storage.get(USER_TRACKING_KEY);
    return data || {};
  }

  /**
   * Updates the last check timestamp
   */
  private async updateLastCheckTime(timestamp: string): Promise<void> {
    await storage.set(LAST_CHECK_KEY, timestamp);
  }

  /**
   * Logs monitoring results for audit purposes
   */
  private async logMonitoringResult(result: MonitoringResult): Promise<void> {
    const logKey = `monitoring-log-${result.checkTime.split('T')[0]}`;
    const existingLogs = await storage.get(logKey) || [];
    existingLogs.push(result);
    
    // Keep only the last 100 entries per day
    if (existingLogs.length > 100) {
      existingLogs.splice(0, existingLogs.length - 100);
    }
    
    await storage.set(logKey, existingLogs);
  }

  /**
   * Utility function to chunk arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

/**
 * Factory function to create GroupMonitoringService with stored configuration
 */
export async function createGroupMonitoringService(): Promise<GroupMonitoringService> {
  const config = await storage.get(MONITORING_CONFIG_KEY) as MonitoringConfig;
  const finalConfig = config ? { ...DEFAULT_MONITORING_CONFIG, ...config } : DEFAULT_MONITORING_CONFIG;
  return new GroupMonitoringService(finalConfig);
}

/**
 * Stores the monitoring configuration
 */
export async function configureGroupMonitoring(config: Partial<MonitoringConfig>): Promise<void> {
  const existingConfig = await storage.get(MONITORING_CONFIG_KEY) as MonitoringConfig || {};
  const updatedConfig = { ...DEFAULT_MONITORING_CONFIG, ...existingConfig, ...config };
  await storage.set(MONITORING_CONFIG_KEY, updatedConfig);
}
```

### Step 4: Create Scheduled Trigger Handler

Create `src/groupMonitor.ts`:

```typescript
import { createGroupMonitoringService } from './groupMonitoringService';

/**
 * Scheduled trigger handler for group monitoring
 */
export const handler = async (event: any) => {
  console.log('Group monitoring trigger fired:', event);
  
  try {
    const monitoringService = await createGroupMonitoringService();
    const result = await monitoringService.performMonitoringCheck();
    
    console.log('Group monitoring check completed:', {
      checkTime: result.checkTime,
      orphanedUsers: result.orphanedUsers.length,
      totalGroupMembers: result.totalGroupMembers,
      issuesCreated: result.issuesCreated,
      errors: result.errors.length
    });
    
    return {
      success: true,
      result: result
    };
  } catch (error) {
    console.error('Group monitoring check failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
```

### Step 5: Update Resolver with Configuration Functions

Add to `src/resolver.ts`:

```typescript
import { configureGroupMonitoring, createGroupMonitoringService } from './groupMonitoringService';

// Add to existing resolver definitions
resolver.define('configureGroupMonitoring', async (request: any) => {
  try {
    const config = request.payload;
    await configureGroupMonitoring(config);
    return { success: true };
  } catch (error) {
    console.error('Error configuring group monitoring:', error);
    return { success: false, error: error.message };
  }
});

resolver.define('getGroupMonitoringConfig', async () => {
  try {
    const monitoringService = await createGroupMonitoringService();
    return { success: true, config: monitoringService.config };
  } catch (error) {
    console.error('Error getting monitoring config:', error);
    return { success: false, error: error.message };
  }
});

resolver.define('testGroupMonitoring', async () => {
  try {
    const monitoringService = await createGroupMonitoringService();
    const result = await monitoringService.performMonitoringCheck();
    return { success: true, result };
  } catch (error) {
    console.error('Error testing group monitoring:', error);
    return { success: false, error: error.message };
  }
});

resolver.define('getMonitoringHistory', async (request: any) => {
  try {
    const { days = 7 } = request.payload || {};
    const history = [];
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const logKey = `monitoring-log-${date.toISOString().split('T')[0]}`;
      const dayLogs = await storage.get(logKey);
      if (dayLogs) {
        history.push(...dayLogs);
      }
    }
    
    return { success: true, history };
  } catch (error) {
    console.error('Error getting monitoring history:', error);
    return { success: false, error: error.message };
  }
});
```

### Step 6: Schedule Configuration

Create the scheduled trigger using Forge CLI:

```bash
# Create a scheduled trigger that runs every 4 hours
forge schedule create bulk-ops-group-check --cron "0 */4 * * *"
```

Or configure it programmatically in your deployment script:

```bash
#!/bin/bash
# Add to your deployment script

echo "Configuring scheduled trigger for group monitoring..."
forge schedule create bulk-ops-group-check --cron "0 */4 * * *" --description "Monitor bulk-ops-app group for orphaned users"
```

### Step 7: Enhanced Group Management Integration

Update `src/groupManagement.ts` to track user additions and removals:

```typescript
// Add to GroupManagementService class

/**
 * Enhanced enrollUser with tracking
 */
async enrollUserWithTracking(accountId: string): Promise<{ success: boolean; error?: string }> {
  const result = await this.enrollUser(accountId);
  
  if (result.success) {
    // Mark user as added by the app
    await this.markUserAsAppManaged(accountId, true);
  }
  
  return result;
}

/**
 * Enhanced unenrollUser with tracking
 */
async unenrollUserWithTracking(accountId: string): Promise<{ success: boolean; error?: string }> {
  const result = await this.unenrollUser(accountId);
  
  if (result.success) {
    // Remove user from tracking
    await this.markUserAsAppManaged(accountId, false);
  }
  
  return result;
}

/**
 * Marks a user as managed by the app
 */
private async markUserAsAppManaged(accountId: string, isManaged: boolean): Promise<void> {
  const trackingKey = 'group-user-tracking';
  const tracking = await storage.get(trackingKey) || {};
  
  if (isManaged) {
    tracking[accountId] = {
      ...tracking[accountId],
      addedByApp: true,
      lastManagedTime: new Date().toISOString()
    };
  } else {
    delete tracking[accountId];
  }
  
  await storage.set(trackingKey, tracking);
}
```

## Configuration Management

### Environment Variables

Add the following environment variables for monitoring configuration:

```bash
# Monitoring configuration
forge variables set MONITORING_PROJECT_KEY ADMIN
forge variables set MONITORING_ASSIGNEE_ACCOUNT_ID your-admin-account-id
forge variables set --encrypt MONITORING_ISSUE_TYPE_ID 10001
forge variables set MONITORING_CHECK_INTERVAL_HOURS 4
forge variables set MONITORING_GRACE_PERIOD_MINUTES 30
```

### Configuration UI Integration

Add monitoring configuration to the admin page (from admin-enhancement-exercise.md):

```typescript
// Add to adminPage.ts FormSection
<FormSection>
  <Heading size="medium">Monitoring Settings</Heading>
  
  <FormField label="Enable Group Monitoring">
    <Checkbox 
      name="monitoringEnabled" 
      defaultChecked={monitoringConfig.enabled}
    />
    <Text>Monitor for users left in the bulk-ops-app group</Text>
  </FormField>

  <FormField label="Check Interval (Hours)">
    <Textfield 
      name="checkIntervalHours" 
      defaultValue={monitoringConfig.checkIntervalHours.toString()}
      placeholder="4"
    />
    <Text>How often to check for orphaned users</Text>
  </FormField>

  <FormField label="Grace Period (Minutes)">
    <Textfield 
      name="gracePeriodMinutes" 
      defaultValue={monitoringConfig.gracePeriodMinutes.toString()}
      placeholder="30"
    />
    <Text>How long to wait before flagging a user as orphaned</Text>
  </FormField>

  <FormField label="Notification Project Key">
    <Textfield 
      name="notificationProjectKey" 
      defaultValue={monitoringConfig.notificationProjectKey}
      placeholder="ADMIN"
    />
    <Text>Project where notification issues will be created</Text>
  </FormField>

  <FormField label="Assignee Account ID">
    <Textfield 
      name="assigneeAccountId" 
      defaultValue={monitoringConfig.assigneeAccountId}
      placeholder="admin-account-id"
    />
    <Text>User who will be assigned notification issues</Text>
  </FormField>
</FormSection>
```

## Monitoring and Alerting

### Health Checks

```typescript
// Add to resolver.ts
resolver.define('groupMonitoringHealthCheck', async () => {
  try {
    const monitoringService = await createGroupMonitoringService();
    const lastCheck = await storage.get('last-monitoring-check');
    const config = monitoringService.config;
    
    const health = {
      enabled: config.enabled,
      lastCheck: lastCheck,
      checkInterval: config.checkIntervalHours,
      gracePeriod: config.gracePeriodMinutes,
      notificationProject: config.notificationProjectKey,
      assignee: config.assigneeAccountId,
      status: 'healthy'
    };
    
    // Check if monitoring is overdue
    if (lastCheck) {
      const lastCheckTime = new Date(lastCheck);
      const now = new Date();
      const hoursSinceLastCheck = (now.getTime() - lastCheckTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastCheck > config.checkIntervalHours * 2) {
        health.status = 'overdue';
      }
    }
    
    return { success: true, health };
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      health: { status: 'error' }
    };
  }
});
```

### Monitoring Dashboard Data

```typescript
// Add to resolver.ts
resolver.define('getMonitoringDashboard', async () => {
  try {
    const monitoringService = await createGroupMonitoringService();
    const groupService = await createGroupManagementService();
    
    // Get current group state
    const currentMembers = await groupService.getGroupMembers();
    const userTracking = await storage.get('group-user-tracking') || {};
    
    // Get recent monitoring history
    const history = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const logKey = `monitoring-log-${date.toISOString().split('T')[0]}`;
      const dayLogs = await storage.get(logKey);
      if (dayLogs) {
        history.push(...dayLogs);
      }
    }
    
    const dashboard = {
      currentGroupSize: currentMembers.length,
      trackedUsers: Object.keys(userTracking).length,
      recentChecks: history.length,
      lastCheck: await storage.get('last-monitoring-check'),
      recentAlerts: history.filter(h => h.orphanedUsers.length > 0).length,
      config: monitoringService.config
    };
    
    return { success: true, dashboard };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

## Testing and Validation

### Manual Testing

```typescript
// Add to resolver.ts for testing
resolver.define('simulateOrphanedUsers', async (request: any) => {
  try {
    const { accountIds } = request.payload;
    const trackingKey = 'group-user-tracking';
    const tracking = await storage.get(trackingKey) || {};
    
    // Simulate users being in the group for longer than grace period
    const oldTime = new Date();
    oldTime.setHours(oldTime.getHours() - 2); // 2 hours ago
    
    for (const accountId of accountIds) {
      tracking[accountId] = {
        firstSeen: oldTime.toISOString(),
        lastSeen: new Date().toISOString(),
        addedByApp: false
      };
    }
    
    await storage.set(trackingKey, tracking);
    
    return { success: true, message: `Simulated ${accountIds.length} orphaned users` };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### Automated Testing

```bash
#!/bin/bash
# Test script for monitoring functionality

echo "Testing group monitoring functionality..."

# Test configuration
echo "1. Testing configuration..."
curl -X POST "https://your-app.forge.atlassian.net/resolver" \
  -H "Content-Type: application/json" \
  -d '{
    "resolver": "configureGroupMonitoring",
    "payload": {
      "enabled": true,
      "checkIntervalHours": 1,
      "gracePeriodMinutes": 5,
      "notificationProjectKey": "TEST",
      "assigneeAccountId": "test-account-id"
    }
  }'

# Test monitoring check
echo "2. Testing monitoring check..."
curl -X POST "https://your-app.forge.atlassian.net/resolver" \
  -H "Content-Type: application/json" \
  -d '{"resolver": "testGroupMonitoring"}'

# Test health check
echo "3. Testing health check..."
curl -X POST "https://your-app.forge.atlassian.net/resolver" \
  -H "Content-Type: application/json" \
  -d '{"resolver": "groupMonitoringHealthCheck"}'

echo "Testing complete!"
```

## Security Considerations

### Access Control
- Monitoring functions should only be accessible to administrators
- Notification issues should be created in a secure project
- User tracking data should be encrypted in storage

### Data Privacy
- Store minimal user information for tracking
- Implement data retention policies for monitoring logs
- Ensure compliance with privacy regulations

### Error Handling
- Graceful degradation when monitoring fails
- Prevent monitoring failures from affecting core app functionality
- Comprehensive logging for audit purposes

## Deployment Checklist

### Pre-Deployment
- [ ] Configure notification project and assignee
- [ ] Set up scheduled trigger with appropriate interval
- [ ] Test monitoring functionality in development
- [ ] Verify issue creation permissions
- [ ] Configure monitoring settings

### Post-Deployment
- [ ] Verify scheduled trigger is active
- [ ] Test end-to-end monitoring flow
- [ ] Confirm notification issues are created correctly
- [ ] Set up monitoring dashboard access
- [ ] Document monitoring procedures for administrators

### Ongoing Maintenance
- [ ] Monitor the monitoring system health
- [ ] Review and tune grace period settings
- [ ] Audit notification issue creation
- [ ] Update assignee and project settings as needed
- [ ] Regular testing of monitoring functionality

## Troubleshooting

### Common Issues

1. **Scheduled Trigger Not Running**
   - Check trigger status: `forge schedule list`
   - Verify cron expression syntax
   - Check function handler is correctly defined

2. **Issues Not Being Created**
   - Verify project key exists and is accessible
   - Check assignee account ID is valid
   - Ensure issue type ID is correct for the project
   - Verify app has permission to create issues

3. **False Positives**
   - Adjust grace period settings
   - Review user tracking logic
   - Check for clock synchronization issues

### Debugging Tools

```typescript
// Add debug resolver
resolver.define('debugGroupMonitoring', async () => {
  try {
    const config = await storage.get('group-monitoring-config');
    const tracking = await storage.get('group-user-tracking');
    const lastCheck = await storage.get('last-monitoring-check');
    
    return {
      success: true,
      debug: {
        config,
        tracking,
        lastCheck,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

## Conclusion

This monitoring enhancement provides a comprehensive solution to address KNOWN-11 by:

1. **Proactive Detection**: Automatically identifies users left in the bulk-ops-app group
2. **Automated Notification**: Creates Jira issues to alert administrators
3. **Configurable Monitoring**: Flexible settings for different organizational needs
4. **Audit Trail**: Comprehensive logging for compliance and troubleshooting
5. **Health Monitoring**: Self-monitoring capabilities to ensure the system is working

The implementation follows Forge best practices and integrates seamlessly with the existing bulk operations functionality while providing robust monitoring and alerting capabilities.