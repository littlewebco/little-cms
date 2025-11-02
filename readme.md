# LittleCMS - Git-powered CMS for Static Sites

LittleCMS is a self-hostable, Git-powered content management system that allows you to manage content directly in your GitHub repositories. Edit content, sync across multiple sites, and deploy with confidence.

## Features

- **Git-powered**: All content stored in GitHub repositories
- **Self-hostable**: Deploy to your own Cloudflare Workers account
- **GitHub App Authentication**: Secure, installation-based access with granular permissions
- **Automated CI/CD**: GitHub Actions for builds and deployments
- **Embed Support**: Embed GitHub files directly in your HTML pages
- **Admin UI**: Modern React-based admin interface for content editing
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
- `GITHUB_APP_ID` - GitHub App ID (e.g., 2222851)
- `GITHUB_APP_PRIVATE_KEY` - GitHub App private key (PEM format)
- `APP_URL` - Your deployed URL (optional, defaults to request origin)

The setup wizard will help you configure the GitHub App and guide you through all steps!

See [docs/GITHUB_APP_SETUP.md](./docs/GITHUB_APP_SETUP.md) for detailed setup instructions.

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

**Note**: Configuration is now handled via GitHub App installations. Users install the app on their repositories, and the CMS automatically detects and manages access to those repositories.

```javascript
module.exports = {
  github: {
    appId: process.env.GITHUB_APP_ID,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
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

## How It Works

### Authentication Flow

LittleCMS uses **GitHub App** authentication for secure, installation-based access:

1. **Install GitHub App**: Users install the LittleCMS GitHub App on their repositories
2. **Automatic Detection**: The CMS automatically detects installed repositories
3. **Installation Tokens**: Each installation gets its own secure token (valid for 1 hour)
4. **Content Management**: Users can browse and edit content in their installed repositories through the admin UI

### Key Benefits

- **Granular Permissions**: Only access repositories where the app is installed
- **Per-Installation Access**: Each installation has its own token scope
- **More Secure**: Installation tokens are shorter-lived and more limited than OAuth tokens
- **Better for Organizations**: Installations can be scoped to specific repositories

See [docs/GITHUB_APP_SETUP.md](./docs/GITHUB_APP_SETUP.md) for detailed setup instructions.

## Embed Usage

Embed GitHub files directly in your HTML:

```html
<script src="https://cms.little.cloud?githubUrl=https://raw.githubusercontent.com/user/repo/main/post.md"></script>
```

The content will appear where the script tag is placed.

## Documentation

- [GitHub App Setup](./docs/GITHUB_APP_SETUP.md) - GitHub App configuration and setup
- [GitHub Secrets Setup](./docs/GITHUB_SECRETS.md) - Configure secrets for CI/CD
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
