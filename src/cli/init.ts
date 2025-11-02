/**
 * Init command for LittleCMS CLI
 */
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function init() {
  console.log('Initializing LittleCMS...');
  
  const rootDir = process.cwd();
  
  // Check if config already exists
  if (existsSync(join(rootDir, 'little-cms.config.js'))) {
    console.log('little-cms.config.js already exists. Skipping...');
    return;
  }
  
  // Copy config template
  const configTemplate = `module.exports = {
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
      owner: 'username',
      repo: 'repo-name',
      branch: 'main',
      collections: [
        {
          name: 'posts',
          label: 'Blog Posts',
          folder: 'posts',
          create: true,
          fields: [
            { name: 'title', label: 'Title', widget: 'string' },
            { name: 'date', label: 'Date', widget: 'datetime' },
            { name: 'body', label: 'Body', widget: 'markdown' }
          ]
        }
      ]
    }
  ],
  features: {
    embeds: true,
    api: true,
    preview: true,
  }
};
`;
  
  writeFileSync(join(rootDir, 'little-cms.config.js'), configTemplate);
  console.log('✓ Created little-cms.config.js');
  
  // Copy wrangler.toml template if it doesn't exist
  if (!existsSync(join(rootDir, 'wrangler.toml'))) {
    const wranglerTemplate = `# wrangler.toml - Configuration for the Cloudflare Worker

# Top-level configuration
name = "little-cms" # Worker name - customize as needed
main = "dist/worker.js" # The entry point for your worker script
compatibility_date = "2024-11-01" # Use a recent compatibility date

# Set the account ID for deployment (replace with your account ID)
# account_id = "your-cloudflare-account-id"

# Optional: Add environment variables if needed
# [vars]
# GITHUB_CLIENT_ID = "your-github-client-id"
# GITHUB_CLIENT_SECRET = "your-github-client-secret"

# Optional: KV namespace bindings (for sessions, etc.)
# [[kv_namespaces]]
# binding = "SESSIONS"
# id = "your-kv-namespace-id"

# Optional: Specify build steps
# [build]
# command = "npm run build"
# upload.format = "modules"
`;
    writeFileSync(join(rootDir, 'wrangler.toml'), wranglerTemplate);
    console.log('✓ Created wrangler.toml');
  }
  
  console.log('');
  console.log('Next steps:');
  console.log('1. Edit little-cms.config.js with your repository details');
  console.log('2. Set up environment variables (GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, etc.)');
  console.log('3. Run: npm run build');
  console.log('4. Run: npm run deploy');
}

