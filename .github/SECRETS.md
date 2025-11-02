# GitHub Secrets Configuration

This template shows what secrets need to be configured in GitHub for automated deployments.

## Required Secrets

Configure these in: Repository Settings → Secrets and variables → Actions

| Secret Name | Description | Required |
|------------|-------------|----------|
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | Yes |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers permissions | Yes |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID | Yes |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret | Yes |
| `APP_URL` | Your deployed LittleCMS URL (e.g., https://cms.little.cloud) | No |

## Setup Instructions

See [docs/GITHUB_SECRETS.md](../docs/GITHUB_SECRETS.md) for detailed setup instructions.

## Workflow Files

- `.github/workflows/build-and-deploy.yml` - Builds and deploys on push to main
- `.github/workflows/build.yml` - Builds only (for PRs and other branches)

## How It Works

1. User pushes to main/master branch
2. GitHub Actions workflow triggers
3. Builds worker and admin UI
4. Deploys to Cloudflare Workers using wrangler-action
5. Sets worker secrets (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, APP_URL)
6. Worker is live with all secrets configured

All secrets are securely stored in GitHub Secrets and never exposed in logs.

