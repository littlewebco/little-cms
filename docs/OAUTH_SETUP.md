# GitHub OAuth Setup Guide

## 1. Create a GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: LittleCMS
   - **Homepage URL**: `https://cms.little.cloud` (or your domain)
   - **Authorization callback URL**: `https://cms.little.cloud/admin/auth/callback`
4. Click "Register application"
5. Copy the **Client ID** and generate a **Client Secret**

## 2. Set Up Cloudflare KV Namespace

```bash
# Create production namespace
wrangler kv:namespace create "SESSIONS"

# Create preview namespace
wrangler kv:namespace create "SESSIONS" --preview
```

Add the namespace IDs to your `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-production-namespace-id"
preview_id = "your-preview-namespace-id"
```

## 3. Set Environment Variables

```bash
# Set GitHub OAuth credentials
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET

# Set app URL (optional, defaults to request origin)
wrangler secret put APP_URL

# Set GitHub OAuth scope (optional, defaults to 'public_repo')
# Options:
#   - 'public_repo': Access public repositories only (recommended, safer)
#   - 'repo': Full access to private repositories (all repos)
#   - 'repo:status': Access commit status only
#   - 'public_repo repo:status': Combine multiple scopes
wrangler secret put GITHUB_SCOPE
```

Or add to `wrangler.toml` vars section (not recommended for secrets):

```toml
[vars]
GITHUB_CLIENT_ID = "your-client-id"
GITHUB_CLIENT_SECRET = "your-client-secret"
APP_URL = "https://cms.little.cloud"
GITHUB_SCOPE = "public_repo"  # or "repo" for full access
```

## 4. Update Configuration

In your `little-cms.config.js`:

```javascript
module.exports = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
  // ... rest of config
};
```

## 5. Deploy

```bash
npm run build
npm run deploy
```

## How It Works

1. User clicks "Login with GitHub" → redirects to `/api/auth/login`
2. User authorizes on GitHub → callback to `/admin/auth/callback`
3. Worker exchanges code for token → stores session in KV
4. Session cookie set → user authenticated
5. Subsequent requests use session cookie → verify via KV

## OAuth Scope Options

By default, LittleCMS uses `repo` scope, which grants access to all repositories (public and private). However, **users can choose which repositories to use** via the admin interface, providing an additional layer of security.

### How Repository Selection Works:

1. **OAuth Authorization**: User grants `repo` scope (access to all repos)
2. **Repository Selection**: User logs into the admin UI and selects which repos they want to use
3. **Access Control**: The CMS only allows operations on selected repositories
4. **Storage**: Selected repos are stored per-user in Cloudflare KV

This means:
- ✅ Users only see/access repositories they've explicitly selected
- ✅ Even if OAuth grants access to all repos, the CMS restricts access
- ✅ Users can change their selection anytime in the admin UI
- ✅ More secure than granting access to everything

### Available Scopes:

- **`repo`** (default): Full access to all repositories (public and private)
  - Required for repository selection feature to work
  - Users can still choose which repos to use in the admin UI
  - Recommended for most use cases

- **`public_repo`**: Access public repositories only
  - More restrictive, but limits functionality
  - Users won't be able to select private repositories

- **Combined scopes**: You can combine multiple scopes: `public_repo repo:status`

### Changing the Scope:

To change from the default `repo` to `public_repo`:

```bash
echo "public_repo" | wrangler secret put GITHUB_SCOPE --name little-cms
```

Or set it as an environment variable in `wrangler.toml`:

```toml
[vars]
GITHUB_SCOPE = "public_repo"
```

**Note**: Users will need to re-authorize the application if you change the scope.

