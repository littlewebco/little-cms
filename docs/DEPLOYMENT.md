# Worker Deployment Guide

## When Does the Worker Get Created?

The worker named **`little-cms`** will be created in your Cloudflare account when:

1. **Automated Deployment (GitHub Actions)**:
   - You push to `main` or `master` branch
   - All GitHub Secrets are configured
   - GitHub Actions workflow runs successfully

2. **Manual Deployment**:
   - Run `npm run deploy` locally
   - Requires wrangler to be authenticated

## Check Current Status

### Check if Worker Exists
```bash
wrangler deployments list --name little-cms
```

### Check Worker Status
```bash
wrangler tail --name little-cms
```

### Manual Deployment
```bash
# Build first
npm run build:worker

# Then deploy
npm run deploy
```

## Worker Configuration

The worker is configured in `wrangler.toml`:
- **Name**: `little-cms`
- **Entry Point**: `dist/worker.js`
- **KV Namespace**: `SESSIONS` (must be configured)

## After Deployment

Once deployed, your worker will be available at:
- `https://little-cms.YOUR_SUBDOMAIN.workers.dev`
- Or your custom domain if configured

## Troubleshooting

### Worker Not Created Yet?
- Check if you've pushed to main/master
- Check GitHub Actions workflow status
- Verify all secrets are configured

### KV Namespace Issues?
- Ensure KV namespace IDs are in `wrangler.toml`
- Both production and preview IDs should be set

### Deployment Fails?
- Check `CLOUDFLARE_API_TOKEN` has Workers permissions
- Verify `CLOUDFLARE_ACCOUNT_ID` is correct
- Check worker name matches in `wrangler.toml`

