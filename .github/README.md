# GitHub Actions Setup

This repository uses GitHub Actions for automated builds and deployments.

## Setup Instructions

### 1. Configure Secrets

Add these secrets in your repository settings:
- **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Required secrets:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `APP_URL` (optional)

See [docs/GITHUB_SECRETS.md](../docs/GITHUB_SECRETS.md) for detailed instructions.

### 2. Set Up KV Namespace

```bash
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "SESSIONS" --preview
```

Add the IDs to `wrangler.toml` and commit.

### 3. Push to Main

Once secrets are configured, pushing to `main` or `master` will automatically:
1. Build the worker
2. Build the admin UI (when ready)
3. Deploy to Cloudflare Workers
4. Set worker secrets

## Workflows

- **build-and-deploy.yml** - Builds and deploys on push to main
- **build.yml** - Builds only (for PRs and other branches)
