/**
 * Setup wizard for LittleCMS
 * Interactive CLI setup that guides users through configuration
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface SetupAnswers {
  cloudflareAccountId?: string;
  githubUsername?: string;
  appUrl?: string;
  oauthAppName?: string;
  oauthCallbackUrl?: string;
  githubClientId?: string;
  githubClientSecret?: string;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupWizard() {
  console.log('\n🚀 LittleCMS Setup Wizard');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const answers: SetupAnswers = {};

  // Cloudflare Account ID
  console.log('Step 1: Cloudflare Configuration');
  answers.cloudflareAccountId = await question('Enter your Cloudflare Account ID: ');
  
  if (!answers.cloudflareAccountId) {
    console.log('⚠️  You can find your Account ID in Cloudflare Dashboard → Any domain → Right sidebar');
    answers.cloudflareAccountId = await question('Enter your Cloudflare Account ID: ');
  }

  // App URL
  answers.appUrl = await question('Enter your app URL (e.g., https://cms.little.cloud) [optional]: ');
  if (!answers.appUrl) {
    answers.appUrl = 'https://your-worker.your-subdomain.workers.dev';
    console.log(`Using default: ${answers.appUrl}`);
  }

  // GitHub OAuth Setup
  console.log('\nStep 2: GitHub OAuth Setup');
  const createOAuth = await question('Would you like help setting up GitHub OAuth? (y/n): ');
  
  if (createOAuth.toLowerCase() === 'y' || createOAuth.toLowerCase() === 'yes') {
    answers.githubUsername = await question('Enter your GitHub username: ');
    
    console.log('\n📝 GitHub OAuth App Creation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('GitHub doesn\'t allow creating OAuth apps via API.');
    console.log('Please follow these steps:\n');
    console.log(`1. Go to: https://github.com/settings/developers`);
    console.log(`2. Click "New OAuth App"`);
    console.log(`3. Fill in:`);
    answers.oauthAppName = await question('   Application name [LittleCMS]: ') || 'LittleCMS';
    answers.oauthCallbackUrl = `${answers.appUrl}/admin/auth/callback`;
    console.log(`   Homepage URL: ${answers.appUrl.replace('/admin/auth/callback', '')}`);
    console.log(`   Authorization callback URL: ${answers.oauthCallbackUrl}`);
    console.log(`4. Click "Register application"`);
    console.log(`5. Copy the Client ID and generate a Client Secret\n`);
    
    answers.githubClientId = await question('Enter your GitHub OAuth Client ID: ');
    answers.githubClientSecret = await question('Enter your GitHub OAuth Client Secret: ');
  } else {
    answers.githubClientId = await question('Enter your GitHub OAuth Client ID: ');
    answers.githubClientSecret = await question('Enter your GitHub OAuth Client Secret: ');
  }

  // KV Namespace
  console.log('\nStep 3: KV Namespace Setup');
  console.log('Creating KV namespace...');
  console.log('Run these commands after setup:');
  console.log('  wrangler kv:namespace create "SESSIONS"');
  console.log('  wrangler kv:namespace create "SESSIONS" --preview');
  console.log('Then add the IDs to wrangler.toml\n');

  // Generate config files
  await generateConfigFiles(answers);

  console.log('\n✅ Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Set up GitHub Secrets (see docs/GITHUB_SECRETS.md)');
  console.log('2. Create KV namespace and update wrangler.toml');
  console.log('3. Push to main branch to deploy!\n');

  rl.close();
}

async function generateConfigFiles(answers: SetupAnswers) {
  const rootDir = process.cwd();

  // Generate little-cms.config.js
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
      owner: 'your-username',
      repo: 'your-blog-repo',
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

  // Generate .env.example
  const envTemplate = `# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=${answers.cloudflareAccountId || 'your-account-id'}

# GitHub OAuth
GITHUB_CLIENT_ID=${answers.githubClientId || 'your-client-id'}
GITHUB_CLIENT_SECRET=${answers.githubClientSecret || 'your-client-secret'}

# Application URL
APP_URL=${answers.appUrl || 'https://your-worker.workers.dev'}
`;
  
  writeFileSync(join(rootDir, '.env.example'), envTemplate);
  console.log('✓ Created .env.example');

  // Update wrangler.toml if it exists
  if (existsSync(join(rootDir, 'wrangler.toml'))) {
    const wranglerContent = readFileSync(join(rootDir, 'wrangler.toml'), 'utf-8');
    const updatedWrangler = wranglerContent.replace(
      /# account_id = ".*"/,
      `account_id = "${answers.cloudflareAccountId || 'your-account-id'}"`
    );
    writeFileSync(join(rootDir, 'wrangler.toml'), updatedWrangler);
    console.log('✓ Updated wrangler.toml');
  }
}

export async function setup() {
  try {
    await setupWizard();
  } catch (error) {
    console.error('Setup failed:', error);
    rl.close();
    process.exit(1);
  }
}

