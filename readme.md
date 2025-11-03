# LittleCMS - Git-powered CMS for Static Sites

LittleCMS is a self-hostable, Git-powered content management system that allows you to manage content directly in your GitHub repositories. Built with security and privacy in mind, LittleCMS provides a modern admin interface for editing markdown files while maintaining full version control through Git.

## 🎯 Overview

LittleCMS bridges the gap between static site generators and content management. Instead of editing files locally or through GitHub's web interface, content creators can use a beautiful, modern admin UI that automatically commits changes to Git. This provides:

- **Version Control**: Every change is tracked in Git with commit messages
- **Collaboration**: Multiple users can edit content simultaneously
- **Content Sync**: Single source of truth that can feed multiple sites
- **Self-Hosted**: Full control over your data and infrastructure
- **Secure**: Hybrid authentication with GitHub OAuth and GitHub Apps

## ✨ Features

### Core Features

- **Git-powered Content**: All content stored as markdown files in GitHub repositories
- **Modern Admin UI**: React-based interface with dark mode support
- **Real-time Editing**: Live markdown preview with syntax highlighting
- **Multi-repository Support**: Manage content across multiple repositories
- **Content Restrictions**: Automatically restricts editing to `/posts` directory
- **Automatic Filenames**: Posts saved as `YYYY-MM-DD-slug.md`
- **Rich Front Matter**: Support for title, date, category, tags, excerpt, feature images, and more
- **File Browser**: Navigate and organize files within the `/posts` directory
- **CRUD Operations**: Create, read, update, and delete posts with full Git history

### Security Features

- **Hybrid Authentication**: GitHub OAuth for user identity + GitHub App for repository access
- **Installation-based Access**: Granular permissions per repository installation
- **Session Management**: Secure cookie-based sessions stored in Cloudflare KV
- **CSRF Protection**: State parameter validation in OAuth flows
- **Path Traversal Protection**: Strict validation of file paths
- **Content Isolation**: All content operations restricted to `/posts` directory
- **Secure Token Storage**: Installation tokens never exposed to client

### Technical Features

- **Cloudflare Workers**: Edge computing for global low-latency access
- **TypeScript**: Fully typed codebase for reliability
- **Automated CI/CD**: GitHub Actions for builds and deployments
- **Embed Support**: Embed GitHub files directly in HTML pages
- **Markdown Rendering**: Server-side markdown to HTML conversion
- **Image Support**: Relative image path resolution in markdown
- **Dark Mode**: Automatic theme detection with manual toggle

## 🔐 Security Architecture

### Authentication Flow

LittleCMS uses a **hybrid authentication model** combining GitHub OAuth and GitHub Apps:

1. **User Authentication (GitHub OAuth)**
   - Users authenticate with GitHub OAuth
   - Scope: `read:user`, `user:email`, `public_repo`
   - Creates user session stored in Cloudflare KV
   - Session expires after 7 days of inactivity

2. **Repository Access (GitHub App)**
   - Users install the GitHub App on repositories they want to manage
   - Each installation generates short-lived tokens (1 hour)
   - Tokens are scoped only to installed repositories
   - Installation tokens are never exposed to the client

### Security Best Practices

#### 🔒 Secrets Management

**Never commit secrets to Git!**

All sensitive values must be stored as Cloudflare Worker secrets:

```bash
# Set secrets via wrangler CLI
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_APP_PRIVATE_KEY
wrangler secret put APP_URL
```

**For GitHub Actions**: Use GitHub Secrets in repository settings:
- Settings → Secrets and variables → Actions
- Add secrets there for CI/CD pipeline

#### 🔑 Private Key Security

GitHub App private keys are sensitive:
- **Store only in Cloudflare Secrets** or GitHub Secrets
- **Never commit** to repository
- **Rotate regularly** if compromised
- **Support both PKCS#1 and PKCS#8** formats (auto-converted)

#### 🛡️ Session Security

- Sessions stored in Cloudflare KV with expiration
- Cookie-based authentication with `HttpOnly` and `Secure` flags
- CSRF protection via state parameter validation
- Session validation on every authenticated request

#### 📁 Path Security

- All file operations validated to ensure paths are within `/posts`
- Path traversal attacks prevented (`../` blocked)
- File extensions validated (only `.md` and `.markdown` allowed)
- Directory creation restricted to `/posts` subdirectories

#### 🌐 Content Security

- Content API restricted to `/posts` directory
- GitHub domain whitelist for embed functionality
- Input sanitization for user-provided content
- Secure headers on all responses

## 🚀 Installation

### Prerequisites

- Node.js 18+ and npm/pnpm/yarn
- Cloudflare account with Workers access
- GitHub account
- Git installed locally

### Quick Start

#### Option 1: Interactive Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/littlewebco/little-cms.git
cd little-cms

# Install dependencies
npm install

# Run interactive setup wizard
npx little-cms setup
```

The wizard will guide you through:
- Cloudflare account configuration
- GitHub App setup
- GitHub OAuth App creation
- KV namespace creation
- Secrets configuration

#### Option 2: Manual Setup

See detailed setup instructions below.

## 📖 Detailed Setup Guide

### Step 1: Fork and Clone

Fork the repository at https://github.com/littlewebco/little-cms, then clone:

```bash
git clone https://github.com/YOUR-USERNAME/little-cms.git
cd little-cms
npm install
```

### Step 2: Create GitHub OAuth App

For user authentication, create a GitHub OAuth App:

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: LittleCMS (or your custom name)
   - **Homepage URL**: `https://your-domain.com`
   - **Authorization callback URL**: `https://your-domain.com/api/auth/callback`
4. Click "Register application"
5. Copy the **Client ID** and generate a **Client Secret**

**Required Scopes**:
- `read:user` - Read user profile information
- `user:email` - Read user email addresses
- `public_repo` - Access public repositories

See [docs/OAUTH_SETUP.md](./docs/OAUTH_SETUP.md) for detailed instructions.

### Step 3: Create GitHub App

For repository access, create a GitHub App:

1. Go to https://github.com/settings/apps/new
2. Fill in:
   - **GitHub App name**: LittleCMS (or your custom name)
   - **Homepage URL**: `https://your-domain.com`
   - **Setup URL**: `https://your-domain.com/api/auth/callback`
   - **Webhook URL**: (optional, for future features)
3. Configure permissions:
   - **Repository permissions**:
     - Contents: Read & Write
     - Metadata: Read-only
     - Pull requests: Read-only (optional)
4. Select "Only on this account" or "Any account"
5. Click "Create GitHub App"
6. Copy the **App ID** and download the **Private Key**

See [docs/GITHUB_APP_SETUP.md](./docs/GITHUB_APP_SETUP.md) for detailed instructions.

### Step 4: Create Cloudflare KV Namespace

Sessions are stored in Cloudflare KV:

```bash
# Install wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create production namespace
wrangler kv:namespace create "SESSIONS"

# Create preview namespace
wrangler kv:namespace create "SESSIONS" --preview
```

Copy the namespace IDs and add to `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SESSIONS"
id = "your-production-namespace-id"
preview_id = "your-preview-namespace-id"
```

### Step 5: Configure Cloudflare Worker Secrets

Set all secrets in Cloudflare:

```bash
# OAuth credentials
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET

# GitHub App credentials
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_APP_PRIVATE_KEY

# Application URL
wrangler secret put APP_URL
```

**Important**: For local development, create `env.local` (don't commit it):

```bash
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your-account-id

# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your-oauth-client-id
GITHUB_CLIENT_SECRET=your-oauth-client-secret

# GitHub App Configuration
GITHUB_APP_ID=your-app-id
GITHUB_APP_PRIVATE_KEY=your-private-key-content

# Application URL
APP_URL=https://your-domain.com
```

### Step 6: Configure GitHub Secrets (for CI/CD)

Go to your repository → **Settings** → **Secrets and variables** → **Actions** and add:

- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Workers permissions
- `GITHUB_CLIENT_ID` - GitHub OAuth Client ID
- `GITHUB_CLIENT_SECRET` - GitHub OAuth Client Secret
- `GITHUB_APP_ID` - GitHub App ID
- `GITHUB_APP_PRIVATE_KEY` - GitHub App private key (full PEM content)
- `APP_URL` - Your deployed URL (e.g., `https://cms.little.cloud`)

### Step 7: Build and Deploy

```bash
# Build everything
npm run build

# Deploy manually (or push to main for auto-deploy)
npm run deploy
```

Or simply push to main:

```bash
git add .
git commit -m "Initial LittleCMS setup"
git push origin main
```

GitHub Actions will automatically build and deploy!

## 🎨 Admin UI Features

### Dashboard

The dashboard provides:
- **Statistics Overview**: Total posts, repositories, categories, recent activity
- **Search & Filter**: Real-time search across post titles and content
- **Category Filtering**: Filter posts by category
- **Recent Posts**: Quick access to recently edited posts
- **Post Cards**: Visual cards with feature images, excerpts, and metadata
- **Quick Actions**: Create new posts with one click

### Content Management

#### Creating Posts

1. Click "New Post" button (Dashboard or Content page)
2. Fill in the post creation form:
   - **Title** (required): Post title
   - **Slug** (required): URL-friendly version (auto-generated from title)
   - **Date** (required): Publication date (defaults to today)
   - **Category** (optional): Organize posts by category
   - **Tags** (optional): Comma-separated tags (e.g., `welcome, getting-started`)
   - **Excerpt** (optional): Brief description
   - **Feature Image** (optional): URL to featured image
3. File is automatically saved as `YYYY-MM-DD-slug.md`
4. Front matter is generated with all provided fields

#### Editing Posts

- Click any post card or file in the browser
- Edit markdown content in the split-pane editor
- Edit front matter fields directly
- Real-time preview of rendered markdown
- Auto-save draft changes
- Commit with custom commit message

#### File Organization

- Files are restricted to `/posts` directory
- Create subdirectories for organization
- Browse files in a hierarchical file browser
- Search and filter files
- View file metadata (size, last modified)

### Post Front Matter

Posts support rich front matter:

```yaml
---
title: My First Blog Post
date: 2025-01-15
author: John Doe
tags:
  - welcome
  - getting-started
category: Tutorial
excerpt: This is my first blog post about getting started.
draft: false
feature_image: https://example.com/image.jpg
---

# Post Content Here
```

All fields are optional except `title` and `date` (automatically added).

## 🔌 Embed Functionality

LittleCMS includes the original GitShow embed functionality:

### Basic Usage

```html
<script src="https://your-domain.com/embed?githubUrl=https://raw.githubusercontent.com/user/repo/main/post.md"></script>
```

### Supported Formats

- **Markdown** (`.md`, `.markdown`): Rendered as HTML
- **Code files** (`.js`, `.ts`, `.py`, etc.): Syntax highlighted
- **Plain text** (`.txt`): Displayed as formatted text

### URL Formats

Both formats are supported:

```
https://your-domain.com/embed?githubUrl=https://raw.githubusercontent.com/user/repo/main/file.md
https://your-domain.com/embed?githubUrl=https://github.com/user/repo/blob/main/file.md
```

> **Note:** The embed endpoint is `/embed` (not `/`) to avoid conflicts with the homepage route. Using `/embed` ensures embeds work reliably without being intercepted by Cloudflare's assets binding.

### Security

- Only GitHub domains are whitelisted
- Content is fetched server-side
- No client-side GitHub API calls
- XSS protection via HTML escaping

## 🏗️ Architecture

### Project Structure

```
little-cms/
├── src/
│   ├── admin/              # React admin UI
│   │   ├── src/
│   │   │   ├── components/ # React components
│   │   │   ├── hooks/      # React hooks
│   │   │   ├── lib/        # Utilities and API client
│   │   │   └── styles/     # CSS and theme
│   │   └── public/         # Static assets
│   ├── worker/             # Cloudflare Worker
│   │   ├── handlers/       # Request handlers
│   │   │   ├── admin.ts    # Admin UI serving
│   │   │   ├── auth.ts     # Authentication
│   │   │   ├── content.ts  # Content CRUD API
│   │   │   ├── embed.ts    # Embed handler
│   │   │   ├── homepage.ts # Homepage
│   │   │   ├── preview.ts  # Markdown preview
│   │   │   └── repos.ts    # Repository management
│   │   └── utils/          # Utilities
│   │       ├── github-app.ts    # GitHub App auth
│   │       └── markdown.ts      # Markdown rendering
│   └── cli/                # CLI tools
│       ├── init.ts         # Project initialization
│       └── setup.ts        # Setup wizard
├── dist/                   # Build output
├── docs/                    # Documentation
├── .github/workflows/       # CI/CD workflows
└── wrangler.toml            # Cloudflare Worker config
```

### Technology Stack

- **Runtime**: Cloudflare Workers (Edge computing)
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: TanStack Query (React Query)
- **Build Tool**: esbuild (Worker) + Vite (Admin UI)
- **Authentication**: GitHub OAuth + GitHub Apps
- **Storage**: Cloudflare KV (sessions)
- **Package Manager**: npm/pnpm/yarn

### API Endpoints

#### Authentication

- `GET /api/auth/login` - Initiate OAuth login
- `GET /api/auth/callback` - OAuth callback handler
- `GET /api/auth/session` - Get current session
- `GET /api/auth/me` - Get authenticated user

#### Repositories

- `GET /api/repos/list` - List accessible repositories
- `GET /api/repos/selected` - Get selected repositories
- `POST /api/repos/select` - Select repositories
- `GET /api/repos/installations` - List GitHub App installations
- `GET /api/repos/install-url` - Get installation URL

#### Content

- `GET /api/content/:repo/:path?` - List files or get file content
- `POST /api/content/:repo/:path` - Create file
- `PUT /api/content/:repo/:path` - Update file
- `DELETE /api/content/:repo/:path` - Delete file

#### Preview

- `POST /api/preview` - Render markdown preview

All endpoints require authentication except `/api/auth/login` and embed endpoints.

## 🔄 Authentication Flow

### Initial Login

1. User visits `/admin` or clicks "Login with GitHub"
2. Redirected to GitHub OAuth (`/api/auth/login`)
3. User authorizes on GitHub
4. GitHub redirects to `/api/auth/callback` with code
5. Server exchanges code for access token
6. Server fetches user profile
7. Server creates session in Cloudflare KV
8. User redirected to `/admin` with session cookie

### GitHub App Installation

1. User clicks "Install GitHub App" in settings
2. Redirected to GitHub App installation page
3. User selects repositories to grant access
4. GitHub redirects to `/api/auth/callback` with `installation_id`
5. Server verifies installation belongs to authenticated user
6. Server fetches installation repositories
7. Server links installation to user session
8. User redirected back to `/admin`

### Request Flow

```
Request → Authentication Check → GitHub App Token → GitHub API → Response
```

1. Client makes authenticated request with session cookie
2. Server validates session from Cloudflare KV
3. Server gets installation token for requested repository
4. Server uses installation token to access GitHub API
5. Server returns response to client

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Build worker
npm run build:worker

# Build admin UI
npm run build:admin

# Build everything
npm run build

# Run local development server (requires wrangler)
npm run dev:worker
```

### Environment Variables

Create `env.local` for local development:

```bash
CLOUDFLARE_ACCOUNT_ID=your-account-id
GITHUB_CLIENT_ID=your-oauth-client-id
GITHUB_CLIENT_SECRET=your-oauth-client-secret
GITHUB_APP_ID=your-app-id
GITHUB_APP_PRIVATE_KEY=your-private-key-content
APP_URL=http://localhost:8787
```

### Testing

```bash
# Run tests (when implemented)
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

## 📦 Deployment

### Automatic Deployment (GitHub Actions)

1. Push to `main` branch
2. GitHub Actions automatically:
   - Builds admin UI
   - Builds worker
   - Sets Cloudflare secrets
   - Deploys to Cloudflare Workers

### Manual Deployment

```bash
# Build
npm run build

# Deploy
npm run deploy
```

Or use wrangler directly:

```bash
wrangler deploy
```

### Environment Configuration

The `wrangler.toml` file configures:
- Worker name
- KV namespace bindings
- Static assets (admin UI)
- Compatibility date

## 🔍 Troubleshooting

### Common Issues

#### "Admin UI assets not found"

**Solution**: Rebuild admin UI:
```bash
npm run build:admin
npm run build:worker
npm run deploy
```

#### "Invalid or expired state parameter"

**Solution**: This usually means OAuth state expired. Clear cookies and try logging in again.

#### "Installation does not belong to your account"

**Solution**: Make sure you're installing the GitHub App on an account/organization you own. For organization installations, you must have admin permissions.

#### "Failed to import private key"

**Solution**: Ensure the private key is in PKCS#8 format (`BEGIN PRIVATE KEY`) or PKCS#1 format (`BEGIN RSA PRIVATE KEY`). The CMS auto-converts PKCS#1 to PKCS#8.

#### "No repositories found"

**Solution**: 
1. Make sure you've installed the GitHub App on repositories
2. Check that repositories are selected in Settings
3. Verify installation permissions include repository access

#### Session issues

**Solution**: Clear browser cookies and log in again. Sessions are stored in Cloudflare KV and expire after 7 days.

### Debug Mode

Enable debug logging by checking Cloudflare Worker logs:
1. Go to Cloudflare Dashboard → Workers
2. Select your worker
3. View logs in real-time

## 📚 Documentation

- [GitHub App Setup](./docs/GITHUB_APP_SETUP.md) - Detailed GitHub App configuration
- [OAuth Setup](./docs/OAUTH_SETUP.md) - GitHub OAuth App setup guide
- [Hybrid Authentication](./docs/HYBRID_AUTH_SETUP.md) - Understanding the auth model
- [Security Review](./SECURITY_REVIEW.md) - Security considerations
- [Migration Guide](./MIGRATION.md) - Migrating from GitShow

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation
- Follow existing code style
- Ensure security best practices

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the [docs](./docs/) directory
- **Issues**: Report bugs on [GitHub Issues](https://github.com/littlewebco/little-cms/issues)
- **Website**: [https://little.cloud](https://little.cloud)

## 🙏 Acknowledgments

LittleCMS is built on top of:
- Cloudflare Workers for edge computing
- GitHub API for repository management
- React for the admin interface
- The open-source community

---

**Built with ❤️ by [Little Cloud](https://little.cloud)**
