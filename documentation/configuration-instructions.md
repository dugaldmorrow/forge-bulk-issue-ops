# Configuration Instructions

This document provides detailed configuration instructions for the Forge Bulk Issue Operations app.

## Prerequisites

Before configuring the app, ensure you have:
- Administrative access to your Jira instance
- Forge CLI installed and configured
- Node.js and npm installed

## Installation Steps

### Step 1: Install Dependencies

Install the required dependencies for both the main app and the frontend:

```bash
# Install main app dependencies
npm install

# Install frontend dependencies
cd static/spa
npm install
cd ../..
```

### Step 2: Setup a Service Account

#### Creating a Service Account

1. Create a dedicated user account in your Jira instance for the app
2. Assign appropriate permissions to this account:
   - User and Group Picker
   - Group Management (or Jira Administrators)
3. Generate an API token for this account:
   - Log in as the service account
   - Go to Account Settings → Security → API tokens
   - Create a new token with description "Bulk Operations App"
   - Store the token securely

#### Finding the Group ID

To find the ID of the "bulk-ops-app" group:

1. Use the Jira REST API to list groups:
   ```bash
   curl -u your-email@domain.com:your-api-token \
     "https://your-domain.atlassian.net/rest/api/3/groups/picker?query=bulk-ops-app"
   ```

2. Look for the group in the response and note the `groupId` field.


### Step 3: Enable the App to Perform Bulk Operations

Jira provides a global permission, called "Make bulk changes", to enable/disable the ability for users to make bulk changes. The standard configuration includes various roles, but administrators may change which roles are able to make bulk changes. To ensure the app continues to work, it is recommended that a role specific to the app be created and added to the "Make bulk changes" permission so that its purpose and association with the app is obvious.

#### Create the Bulk Operations Group

1. Create a group called "bulk-ops-app" as follows:
   * Click "User management" from the settings (cog) menu.
   * Click "Directory" and "Groups".
   * Click the "Create group" button.
   * Enter "bulk-ops-app" as the group name.
   * Click "Create" to create the group.

#### Add Group to Global Permissions

2. Add the "bulk-ops-app" group to the "Make bulk changes" global permission as follows:
   * Visit Jira admin settings (https://your-tenant.atlassian.net/jira/settings/system/general-configuration).
   * Visit "Global permissions" within the "Security" section.
   * In the "Grant Permission" section, select "Grant: Make bulk changes" and "Group: bulk-ops-app". 

Once this is done, you should see the "bulk-ops-app" appear alongside the "Make bulk changes" global permission. When testing the app, it is recommended for this to be the only permission, but in a production environment, you will likely also want to allow administrators to have bulk change permissions.

### Step 4: Configure Environment Variables

In order for the app to be able to make bulk changes as the user requesting the changes, the app needs to add the requesting user into the "bulk-ops-app" group before the request is submitted and then remove the user from the group afterwards. Details about these environment variables are provided in [src/userManagementConfig.ts](../src/userManagementConfig.ts).

#### Environment Variable Setup

1. Copy `scripts/setup-forge-environment-template.sh` to `setup-forge-[env]-environment-private.sh` where `[env]` refers to one of your environments. An example would be `setup-forge-development-environment-private.sh`. 

   **Note:** The `-private` part of the file name is necessary to prevent the file being checked into GIT and consequently disclosing private information.

2. Replace the values within `setup-forge-[env]-environment-private.sh` within square brackets with values for your configuration.

3. Run `./scripts/setup-forge-[env]-environment-private.sh`.

#### Required Environment Variables

The following environment variables must be configured:

- **MANAGE_USERS_USER_NAME**: Email address of the service account (e.g., "some-bot@yourdomain.com")
- **MANAGE_USERS_API_TOKEN**: API token for the service account (encrypted)
- **BULK_OPS_APP_GROUP_ID**: The ID of the bulk-ops-app group (encrypted)

#### Setting Environment Variables

Use the following commands to set environment variables:

```bash
# Set username (non-encrypted)
forge variables set MANAGE_USERS_USER_NAME your-service-account@yourdomain.com
forge variables set --environment production MANAGE_USERS_USER_NAME your-service-account@yourdomain.com

# Set API token (encrypted)
forge variables set --encrypt MANAGE_USERS_API_TOKEN your-api-token-here
forge variables set --environment production --encrypt MANAGE_USERS_API_TOKEN your-api-token-here

# Set group ID (encrypted)
forge variables set --encrypt BULK_OPS_APP_GROUP_ID your-group-id-here
forge variables set --environment production --encrypt BULK_OPS_APP_GROUP_ID your-group-id-here
```

For local development, you can also export these as environment variables:
```bash
export FORGE_USER_VAR_MANAGE_USERS_USER_NAME=your-service-account@yourdomain.com
export FORGE_USER_VAR_MANAGE_USERS_API_TOKEN=your-api-token-here
export FORGE_USER_VAR_BULK_OPS_APP_GROUP_ID=your-group-id-here
```

### Step 5: Deploy the Application

Deploy the app to your Forge environment:

```bash
forge deploy
```

For production deployment:
```bash
forge deploy --environment production
```

### Step 6: Install the Application

Install the app on your Jira site:

```bash
forge install
```

Select your Jira site when prompted.

## Optional Configuration Steps

### Step 7: Prevent Regular Users from Using Jira's Built-in Bulk Operations (Optional)

This optional step involves reviewing and tuning the access to Jira's built-in bulk operations. Visit the Jira administration global permissions section, and review the permissions corresponding to "Make bulk changes".

Consider removing other groups or roles from the "Make bulk changes" permission if you want to force all users to use this app instead of Jira's built-in bulk operations.

### Step 8: Reduce External Permissions (Optional)

To support any customer, the app declares the backend external permission `*.atlassian.net` in order for it to make basic auth requests to the Jira REST API. This can be secured further to only allow requests to the domains your instance of the app will be running on.

#### Update manifest.yml

Edit the `manifest.yml` file to restrict external permissions:

```yaml
permissions:
  external:
    fetch:
      backend:
        - "your-tenant-stage.atlassian.net"
        - "your-tenant.atlassian.net"
```

Replace `your-tenant` with your actual Atlassian domain.

## Development Configuration

### Development Loop

- Run all forge commands from the `[app-root-directory]`.
- After making changes to the frontend, run `npm run start` from the `[app-root-directory]/static/spa` directory.
- Use the `forge deploy` command when you want to persist code changes or after you make changes to the app manifest.
- Use the `forge install` command when you want to install the app on a new site.
- Once the app is installed on a site, the site picks up the new app changes you deploy without needing to rerun the install command.

### Build and Deploy Script

You can use the `./scripts/build-and-deploy.sh` to build and deploy the app:

```bash
# Deploy to development environment
./scripts/build-and-deploy.sh

# Deploy to production environment
./scripts/build-and-deploy.sh production
```

### Step 9: Application Configuration

#### Static Configuration Rules

Static configuration rules are defined as constants in `static/spa/src/extension/bulkOperationStaticRules.ts`. These control various aspects of bulk operations behavior.

#### Additional Configuration Options

Configuration options can be defined in [static/spa/src/model/config.ts](../static/spa/src/model/config.ts), but be careful modifying these options as they affect core application behavior.


