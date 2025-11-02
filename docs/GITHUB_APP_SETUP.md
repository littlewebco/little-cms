# GitHub App Setup Guide

## Overview

LittleCMS uses GitHub App authentication instead of OAuth Apps. This provides more granular permissions and better security through installation-based access tokens.

## 1. GitHub App Configuration

Your GitHub App is already configured at: https://github.com/apps/littlecms

**App ID**: 2222851

**Required Permissions**:
- Repository contents: Read & Write
- Repository metadata: Read
- Pull requests: Read (optional, for future features)

**Setup URL**: `https://cms.little.cloud/api/auth/callback`

**Important**: You must configure the Setup URL in your GitHub App settings:
1. Go to https://github.com/settings/apps/littlecms
2. Scroll to "Post installation" section
3. Set **Setup URL** to: `https://cms.little.cloud/api/auth/callback`
4. Save changes

This ensures users are redirected back to your CMS after installing the app.

## 2. Get Your Private Key

1. Go to your GitHub App settings: https://github.com/settings/apps/littlecms
2. Scroll down to "Private keys"
3. Generate a new private key or download the existing one
4. **Key Format**: Both PKCS#1 (`BEGIN RSA PRIVATE KEY`) and PKCS#8 (`BEGIN PRIVATE KEY`) formats are automatically supported. The CMS will convert PKCS#1 keys to PKCS#8 format at runtime if needed.

## 3. Set Up Cloudflare KV Namespace

```bash
# Create production namespace (if not already created)
wrangler kv:namespace create "SESSIONS"

# Create preview namespace
wrangler kv:namespace create "SESSIONS" --preview
```

Add the namespace IDs to your `wrangler.toml` (already configured).

## 4. Set Environment Variables

### Local Development

Update `env.local`:

```bash
GITHUB_APP_ID=2222851
GITHUB_APP_PRIVATE_KEY=<your-private-key-pem-content>
APP_URL=https://cms.little.cloud
```

### Cloudflare Workers (Production)

Set secrets via `wrangler`:

```bash
# Set GitHub App ID
echo "2222851" | wrangler secret put GITHUB_APP_ID --name little-cms

# Set private key (paste the entire PEM content)
wrangler secret put GITHUB_APP_PRIVATE_KEY --name little-cms
# Paste your private key when prompted

# Set app URL
echo "https://cms.little.cloud" | wrangler secret put APP_URL --name little-cms
```

### GitHub Actions Secrets

Set these secrets in your GitHub repository:

1. Go to: Repository → Settings → Secrets and variables → Actions
2. Add:
   - `GITHUB_APP_ID`: `2222851`
   - `GITHUB_APP_PRIVATE_KEY`: (paste your entire PEM private key)
   - `APP_URL`: `https://cms.little.cloud`

## 5. How It Works

### Installation Flow

1. User installs GitHub App on their repository → GitHub redirects to `/api/auth/callback?installation_id=...&setup_action=install`
2. Worker stores installation info → redirects to `/admin`
3. User can now access repositories from that installation

### Authentication Flow

1. User accesses `/admin` → checks for session
2. If no session, creates a temporary session linked to installations
3. When accessing repos, finds which installation has access
4. Generates installation token for that installation
5. Uses installation token for GitHub API calls

### Storage Schema (KV)

- `installation_{installationId}` → `{ userId, repos: string[] }`
- `user_installations_{userId}` → `[installationId1, installationId2]`
- Sessions: `{ user, installations: string[], expiresAt }`

## 6. Key Differences from OAuth

| Feature | OAuth App | GitHub App |
|---------|-----------|------------|
| Token Scope | Broad (all repos user has access to) | Narrow (only repos in installation) |
| Token Lifetime | Long-lived (until revoked) | Short-lived (1 hour, auto-refreshed) |
| Permissions | All-or-nothing | Granular per-installation |
| Security | Less secure (broad access) | More secure (per-installation) |

## 7. Troubleshooting

### "Missing state parameter" Error

This occurs when GitHub redirects after installation. The callback handler now expects `installation_id` instead of `state`. Ensure your GitHub App callback URL is set to:
```
https://cms.little.cloud/api/auth/callback
```

### Private Key Format Error

If you see "Failed to import private key":
- Ensure your private key is in valid PEM format (either PKCS#1 or PKCS#8)
- Check that the key includes the header and footer lines (`-----BEGIN...-----` and `-----END...-----`)
- Verify the key hasn't been corrupted during copy/paste
- Try regenerating the key from GitHub App settings

### Installation Not Found

- Ensure the installation_id matches an active installation
- Check that the GitHub App has access to the repository
- Verify the installation wasn't removed

## 8. Migration Notes

- Existing OAuth sessions will need to be cleared
- Users will need to re-authenticate via GitHub App installation
- Installation tokens are more secure (per-installation, shorter-lived)
- Multiple installations per user are supported

