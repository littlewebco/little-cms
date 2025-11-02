# LittleCMS - Git-powered CMS for Static Sites

LittleCMS is a self-hostable, Git-powered content management system that allows you to manage content directly in your GitHub repositories. Edit content, sync across multiple sites, and deploy with confidence.

## Features

- **Git-powered**: All content stored in GitHub repositories
- **Self-hostable**: Deploy to your own Cloudflare Workers account
- **Automated CI/CD**: GitHub Actions for builds and deployments
- **Embed Support**: Embed GitHub files directly in your HTML pages
- **Admin UI**: Modern React-based admin interface (coming soon)
- **Multi-repo Support**: Manage content across multiple repositories
- **TypeScript**: Fully typed for better developer experience

## Installation

```bash
npm install @little/little-cms
```

## Quick Start

### Option 1: Interactive Setup (Easiest)

```bash
# After cloning/forking
npm install
npx little-cms setup
```

The interactive wizard will guide you through all configuration steps!

### Option 2: Manual Setup

#### 1. Fork and Clone

Fork the repository at https://github.com/littlewebco/little-cms, then clone your fork:

```bash
git clone https://github.com/YOUR-USERNAME/little-cms.git
cd little-cms
npm install
```

Or clone directly from the main repository:

```bash
git clone https://github.com/littlewebco/little-cms.git
cd little-cms
npm install
```

#### 2. Run Setup Wizard

```bash
npx little-cms setup
```

Or initialize manually:

```bash
npx little-cms init
```

#### 3. Configure GitHub Secrets

Go to your repository → **Settings** → **Secrets and variables** → **Actions** and add:

- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers permissions
- `GITHUB_CLIENT_ID` - GitHub OAuth app client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth app client secret
- `APP_URL` - Your deployed URL (optional, defaults to request origin)

The setup wizard will help you create the GitHub OAuth app and guide you through all steps!

See [docs/GITHUB_SECRETS.md](./docs/GITHUB_SECRETS.md) for detailed setup instructions.

### 3. Set Up KV Namespace

```bash
# Install wrangler if needed
npm install -g wrangler

# Create KV namespace
wrangler kv:namespace create "SESSIONS"
wrangler kv:namespace create "SESSIONS" --preview
```

Add the namespace IDs to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-production-namespace-id"
preview_id = "your-preview-namespace-id"
```

### 4. Configure Repository

Edit `little-cms.config.js` with your repository details (or use `npx little-cms init`):

```javascript
module.exports = {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
  cloudflare: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    workerName: 'little-cms',
  },
  repos: [
    {
      name: 'blog',
      owner: 'your-username',
      repo: 'your-blog-repo',
      branch: 'main',
      collections: [...]
    }
  ]
};
```

### 5. Push to Deploy

```bash
git add .
git commit -m "Configure LittleCMS"
git push origin main
```

GitHub Actions will automatically build and deploy to Cloudflare Workers!

## Manual Deployment

If you prefer manual deployment:

```bash
# Build
npm run build

# Deploy (requires wrangler configured)
npm run deploy
```

## Embed Usage

Embed GitHub files directly in your HTML:

```html
<script src="https://cms.little.cloud?githubUrl=https://raw.githubusercontent.com/user/repo/main/post.md"></script>
```

The content will appear where the script tag is placed.

## Documentation

- [GitHub Secrets Setup](./docs/GITHUB_SECRETS.md) - Configure secrets for CI/CD
- [OAuth Setup](./docs/OAUTH_SETUP.md) - GitHub OAuth configuration
- [Configuration Guide](./docs/configuration.md) - Detailed config options
- [API Reference](./docs/api.md) - API endpoints
- [Migration Guide](./MIGRATION.md) - Migrating from GitShow

## Development

```bash
# Install dependencies
npm install

# Build worker
npm run build:worker

# Build admin UI (when implemented)
npm run build:admin

# Develop locally
npm run dev:worker
```

## CI/CD

This repository includes GitHub Actions workflows:

- **Automatic deployment** on push to main/master
- **Build verification** on pull requests
- **Secrets management** via GitHub Secrets

See [.github/workflows](./.github/workflows) for workflow files.

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

For more information about Little Cloud and other tools, visit [https://little.cloud](https://little.cloud).
