# Managing Bulk Permissions: Dynamic Group Enrollment Strategy

## Overview

This document outlines a security strategy for managing bulk operations permissions in Jira using dynamic group enrollment. The approach temporarily grants users the necessary permissions to perform bulk operations by enrolling them in a pre-configured group, executing the operation, and then removing them from the group.

## Architecture

The permission management system consists of three main phases:

1. **Pre-Operation**: Enroll user in bulk operations group
2. **Execution**: Perform the bulk operation with elevated permissions
3. **Post-Operation**: Remove user from the group (cleanup)

## Security Model

### Permission Groups Setup

Before implementing this strategy, administrators must set up a dedicated group named bulk-ops-app or similar. This group must be added to the "Make bulk changes" global permission and groups that regular users are in must be removed from the "Make bulk changes" global permission.

The id allocated to the bulk-ops-app group must be determined since its value set in an environment variable as explain in [the configuration instructions](./configuration-instructions.md).

### Authentication Strategy

The system uses **Basic Authentication** with service account credentials to make administrative API calls for group management. This requires:

1. **Service Account**: A dedicated Jira user with group management permissions
2. **API Token**: Generated for the service account
3. **Secure Storage**: Credentials stored in an encrypted Forge environment variable
