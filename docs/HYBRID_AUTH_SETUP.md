# Hybrid GitHub OAuth + GitHub App Authentication Setup

## Overview

LittleCMS uses a **hybrid authentication approach** that combines:
- **GitHub OAuth** for user authentication (minimal scope: `read:user user:email`)
- **GitHub App** for repository access (granular permissions)

This approach provides:
- ✅ Secure user identity verification ("Login with GitHub")
- ✅ Minimal OAuth scope (no repository access via OAuth)
- ✅ Granular repository permissions via GitHub App
- ✅ Better security separation between authentication and authorization

## Authentication Flow

1. **User clicks "Login with GitHub"** → Redirects to GitHub OAuth with `read:user user:email` scope
2. **GitHub redirects back** → OAuth callback exchanges code for token → Gets user info → Creates session
3. **User installs GitHub App** → Links installation to authenticated session → Repository access enabled
4. **Repository operations** → Use GitHub App installation tokens (not OAuth token)

## Setup Instructions

### 1. Create GitHub OAuth App

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: LittleCMS
   - **Homepage URL**: `https://cms.little.cloud` (or your domain)
   - **Authorization callback URL**: `https://cms.little.cloud/api/auth/callback`
4. Click "Register application"
5. Copy the **Client ID** and generate a **Client Secret**

### 2. Configure GitHub App (Already Done)

Your GitHub App is already configured at: https://github.com/apps/littlecms

**App ID**: 2222851

**Setup URL**: `https://cms.little.cloud/api/auth/callback`

**Important**: The Setup URL must be configured in your GitHub App settings:
1. Go to https://github.com/settings/apps/littlecms
2. Scroll to "Post installation" section
3. Set **Setup URL** to: `https://cms.little.cloud/api/auth/callback`
4. Save changes

### 3. Set Up Cloudflare KV Namespace

```bash
# Create production namespace (if not already created)
wrangler kv:namespace create "SESSIONS"

# Create preview namespace
wrangler kv:namespace create "SESSIONS" --preview
```

Add the namespace IDs to your `wrangler.toml` (already configured).

### 4. Set Environment Variables

#### Local Development

Update `env.local`:

```bash
# GitHub OAuth (required for authentication)
GITHUB_CLIENT_ID=<your-oauth-client-id>
GITHUB_CLIENT_SECRET=<your-oauth-client-secret>

# GitHub App (required for repository access)
GITHUB_APP_ID=2222851
GITHUB_APP_PRIVATE_KEY=<your-private-key-pem-content>

# Application URL
APP_URL=https://cms.little.cloud
```

#### Cloudflare Workers (Production)

Set secrets via `wrangler`:

```bash
# GitHub OAuth credentials
echo "<your-client-id>" | wrangler secret put GITHUB_CLIENT_ID --name little-cms
echo "<your-client-secret>" | wrangler secret put GITHUB_CLIENT_SECRET --name little-cms

# GitHub App credentials
echo "2222851" | wrangler secret put GITHUB_APP_ID --name little-cms
wrangler secret put GITHUB_APP_PRIVATE_KEY --name little-cms
# (paste the entire PEM content when prompted)

# Application URL (optional)
echo "https://cms.little.cloud" | wrangler secret put APP_URL --name little-cms
```

#### GitHub Actions Secrets

Add these secrets to your GitHub repository:

1. `GITHUB_CLIENT_ID` - Your GitHub OAuth App Client ID
2. `GITHUB_CLIENT_SECRET` - Your GitHub OAuth App Client Secret
3. `GITHUB_APP_ID` - Your GitHub App ID (2222851)
4. `GITHUB_APP_PRIVATE_KEY` - Your GitHub App private key (PEM content)
5. `APP_URL` - Your application URL (optional)

The GitHub Actions workflow will automatically set these secrets when deploying.

### 5. Deploy

```bash
npm run build
npm run deploy
```

## OAuth Scope Details

The OAuth flow requests only **minimal scopes**:
- `read:user` - Read user profile information (login, id, name, avatar)
- `user:email` - Read user email address

**No repository access** is requested via OAuth. Repository access is handled exclusively through GitHub App installations, which provide granular permissions.

## Security Features

1. **User Authentication Required**: All routes require OAuth authentication before access
2. **Installation Verification**: GitHub App installations are verified to belong to the authenticated user
3. **Session Isolation**: Each user has their own session with secure cookies
4. **Minimal OAuth Scope**: Only user identity requested, no repository access
5. **Granular Permissions**: Repository access controlled via GitHub App installations

## Troubleshooting

### "GitHub OAuth not configured" Error

Make sure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` are set as Cloudflare Worker secrets.

### "Installation does not belong to your account" Error

This means the GitHub App installation belongs to a different GitHub account than the one you authenticated with. Make sure you're logged in with the correct GitHub account.

### Redirect Loop

If you're experiencing a redirect loop:
1. Clear your browser cookies
2. Make sure the OAuth callback URL matches exactly: `https://cms.little.cloud/api/auth/callback`
3. Verify the GitHub App Setup URL is configured correctly

## How It Works

### User Authentication (OAuth)

```typescript
// 1. User clicks "Login with GitHub"
GET /api/auth/login
→ Redirects to: https://github.com/login/oauth/authorize?scope=read:user%20user:email

// 2. GitHub redirects back with code
GET /api/auth/callback?code=xxx&state=yyy
→ Exchanges code for token
→ Gets user info from GitHub API
→ Creates session with user identity
→ Redirects to /admin
```

### Repository Access (GitHub App)

```typescript
// 1. User installs GitHub App (after OAuth authentication)
GET /api/auth/callback?installation_id=xxx
→ Verifies user is authenticated
→ Verifies installation belongs to user
→ Links installation to user session
→ Redirects to /admin

// 2. Repository operations use App tokens
GET /api/content/:owner/:repo/:path
→ Uses GitHub App installation token (not OAuth token)
→ Provides granular repository access
```

## Benefits of This Approach

1. **Security**: User identity verified separately from repository access
2. **Granular Permissions**: GitHub App allows per-repository permissions
3. **Minimal Scope**: OAuth only requests user identity, not repository access
4. **User Experience**: Standard "Login with GitHub" flow users expect
5. **Flexibility**: Users can install GitHub App on specific repositories only

