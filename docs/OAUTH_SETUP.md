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
```

Or add to `wrangler.toml` vars section (not recommended for secrets):

```toml
[vars]
GITHUB_CLIENT_ID = "your-client-id"
GITHUB_CLIENT_SECRET = "your-client-secret"
APP_URL = "https://cms.little.cloud"
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

## Security Notes

- Sessions expire after 7 days
- Sessions stored in KV with expiration
- CSRF protection via state parameter
- HttpOnly, Secure cookies
- SameSite=Lax cookie policy

