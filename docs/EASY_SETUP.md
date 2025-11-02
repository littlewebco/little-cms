# Easy Setup Guide

LittleCMS now includes an interactive setup wizard to make configuration easier!

## Quick Setup Options

### Option 1: Interactive CLI Setup (Recommended)

```bash
# After cloning/forking the repo
npm install
npx little-cms setup
```

The wizard will guide you through:
- Cloudflare account configuration
- GitHub OAuth app setup (with instructions)
- KV namespace creation
- Configuration file generation

### Option 2: Web-Based Setup Wizard

1. Deploy the worker first (basic setup)
2. Navigate to `/admin/setup`
3. Complete the setup wizard in your browser
4. Configuration is saved automatically

### Option 3: Manual Setup

Follow the traditional setup:
1. Configure GitHub Secrets
2. Set up KV namespace
3. Edit config files manually

## What the Setup Wizard Does

### 1. Cloudflare Configuration
- Guides you to find your Account ID
- Helps create API token
- Validates credentials

### 2. GitHub OAuth Setup
- Provides step-by-step instructions
- Generates correct callback URLs
- Validates OAuth app configuration

### 3. KV Namespace Setup
- Shows exact commands to run
- Guides you through namespace creation
- Helps update wrangler.toml

### 4. GitHub Secrets Setup
- Opens GitHub secrets page directly
- Lists all required secrets
- Provides copy-paste ready values

## Setup Flow

```
User runs: npx little-cms setup
    ↓
Wizard asks for Cloudflare Account ID
    ↓
Wizard helps create GitHub OAuth app
    ↓
Wizard guides KV namespace creation
    ↓
Wizard generates config files
    ↓
User adds secrets to GitHub
    ↓
Push to main → Auto-deploy!
```

## Benefits

✅ **No manual config editing** - Wizard generates files
✅ **Step-by-step guidance** - Never get lost
✅ **Validates inputs** - Catches errors early
✅ **Opens relevant pages** - Quick access to setup pages
✅ **Copy-paste ready** - Values ready to use

## After Setup

Once setup is complete:
1. Push to main branch
2. GitHub Actions will deploy automatically
3. Visit `/admin` to start using LittleCMS

## Troubleshooting

If setup wizard fails:
- Check you have Node.js 18+ installed
- Ensure you have network access
- Try manual setup (see docs/GITHUB_SECRETS.md)

