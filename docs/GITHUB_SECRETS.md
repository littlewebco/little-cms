# GitHub Secrets Setup Guide

This guide explains how to configure GitHub secrets for automated builds and deployments of LittleCMS.

## Required Secrets

Set these secrets in your GitHub repository settings:

1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each secret below

### Cloudflare Secrets

#### `CLOUDFLARE_ACCOUNT_ID`
- **Description**: Your Cloudflare account ID
- **How to get**: 
  1. Log in to Cloudflare dashboard
  2. Select any domain
  3. Copy the Account ID from the right sidebar
  4. Or use: `wrangler whoami` to see your account info

#### `CLOUDFLARE_API_TOKEN`
- **Description**: Cloudflare API token with Workers permissions
- **How to create**:
  1. Go to Cloudflare Dashboard → **My Profile** → **API Tokens**
  2. Click **Create Token**
  3. Use "Edit Cloudflare Workers" template
  4. Or create custom token with:
     - **Permissions**: Account → Cloudflare Workers → Edit
     - **Account Resources**: Include → All accounts
     - **Zone Resources**: Include → All zones
  5. Copy the token (you won't see it again!)

### GitHub OAuth Secrets

#### `GITHUB_CLIENT_ID`
- **Description**: GitHub OAuth App Client ID
- **How to get**:
  1. Go to GitHub → **Settings** → **Developer settings** → **OAuth Apps**
  2. Create new OAuth App or use existing
  3. Copy the **Client ID**

#### `GITHUB_CLIENT_SECRET`
- **Description**: GitHub OAuth App Client Secret
- **How to get**:
  1. Same as above, in your OAuth App settings
  2. Generate a new client secret if needed
  3. Copy the secret (you won't see it again!)

### Application Secrets

#### `APP_URL` (Optional)
- **Description**: Your deployed LittleCMS URL
- **Example**: `https://cms.little.cloud`
- **Default**: If not set, uses request origin

## Secret Setup Steps

### 1. Create GitHub Secrets

```bash
# Via GitHub Web UI (recommended)
# Go to: https://github.com/littlewebco/little-cms/settings/secrets/actions
# Add each secret one by one
```

### 2. Create KV Namespace

```bash
# In your local terminal with wrangler configured
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "SESSIONS" --preview

# Copy the IDs and add to wrangler.toml
```

### 3. Update wrangler.toml

Add KV namespace bindings:

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-production-namespace-id"
preview_id = "your-preview-namespace-id"
```

Commit this file (KV namespace IDs are not sensitive).

### 4. Set Up GitHub OAuth App

1. Create OAuth App at: https://github.com/settings/developers
2. Set **Authorization callback URL**: `https://your-domain.com/admin/auth/callback`
3. Copy Client ID and Client Secret
4. Add as GitHub secrets

## GitHub Actions Workflow

The repository includes two workflows:

### `build-and-deploy.yml`
- **Triggers**: Push to main/master branch
- **Actions**: 
  - Builds worker and admin UI
  - Deploys to Cloudflare Workers
  - Creates GitHub deployment

### `build.yml`
- **Triggers**: Pull requests, other branches
- **Actions**: 
  - Builds worker and admin UI
  - Verifies build succeeds
  - No deployment

## Environment Variables in Worker

Secrets are automatically available as environment variables in your Worker:

```typescript
// In your worker code
const env = {
  GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET,
  APP_URL: env.APP_URL,
  SESSIONS: env.SESSIONS, // KV namespace
};
```

## Local Development

For local development, use `.env` file (not committed):

```bash
# .env (not committed to git)
CLOUDFLARE_ACCOUNT_ID=your-account-id
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret
APP_URL=http://localhost:8787
```

Or use `wrangler secret put`:

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put APP_URL
```

## Security Best Practices

1. **Never commit secrets** to git
2. **Use GitHub secrets** for CI/CD
3. **Use wrangler secrets** for local development
4. **Rotate secrets** periodically
5. **Use least privilege** for API tokens
6. **Review deployments** before merging

## Troubleshooting

### Build fails with "Missing secret"
- Check all required secrets are set in GitHub
- Verify secret names match exactly (case-sensitive)

### Deployment fails with "Unauthorized"
- Verify `CLOUDFLARE_API_TOKEN` has correct permissions
- Check `CLOUDFLARE_ACCOUNT_ID` is correct

### OAuth not working
- Verify `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are correct
- Check callback URL matches your OAuth app settings
- Ensure `APP_URL` is set correctly

### KV namespace errors
- Verify KV namespace IDs in `wrangler.toml` are correct
- Check namespace exists in your Cloudflare account
- Ensure namespace binding name matches (`SESSIONS`)

