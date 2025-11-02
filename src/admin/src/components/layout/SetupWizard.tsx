import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SetupStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export default function SetupWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: 'cloudflare',
      title: 'Cloudflare Account',
      description: 'Connect your Cloudflare account',
      completed: false,
    },
    {
      id: 'github-oauth',
      title: 'GitHub OAuth',
      description: 'Set up GitHub OAuth app',
      completed: false,
    },
    {
      id: 'kv-namespace',
      title: 'KV Namespace',
      description: 'Create session storage',
      completed: false,
    },
    {
      id: 'github-secrets',
      title: 'GitHub Secrets',
      description: 'Configure repository secrets',
      completed: false,
    },
  ]);

  const handleCloudflareConnect = () => {
    // TODO: Implement Cloudflare OAuth flow
    window.open('https://dash.cloudflare.com/profile/api-tokens', '_blank');
  };

  const handleGitHubOAuthSetup = () => {
    // Open GitHub OAuth app creation page
    window.open('https://github.com/settings/developers', '_blank');
  };

  const handleKVSetup = () => {
    // Open documentation
    window.open('/docs/GITHUB_SECRETS.md#kv-namespace', '_blank');
  };

  const handleGitHubSecretsSetup = () => {
    // Open GitHub secrets page
    window.open('https://github.com/littlewebco/little-cms/settings/secrets/actions', '_blank');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Welcome to LittleCMS</h1>
        <p className="text-muted-foreground">
          Let's get you set up in just a few steps
        </p>
      </div>

      <div className="space-y-4">
        {/* Cloudflare Setup */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Step 1: Cloudflare Account</CardTitle>
                <CardDescription>
                  Connect your Cloudflare account to deploy the worker
                </CardDescription>
              </div>
              {steps[0].completed && (
                <span className="text-green-600">✓</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Cloudflare Account ID
                </label>
                <input
                  type="text"
                  placeholder="your-account-id"
                  className="w-full px-3 py-2 border rounded-md"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Find it in Cloudflare Dashboard → Any domain → Right sidebar
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Cloudflare API Token
                </label>
                <Button onClick={handleCloudflareConnect} variant="outline">
                  Create API Token
                </Button>
                <input
                  type="password"
                  placeholder="your-api-token"
                  className="w-full px-3 py-2 border rounded-md mt-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GitHub OAuth Setup */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Step 2: GitHub OAuth App</CardTitle>
                <CardDescription>
                  Create a GitHub OAuth app for authentication
                </CardDescription>
              </div>
              {steps[1].completed && (
                <span className="text-green-600">✓</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={handleGitHubOAuthSetup} variant="outline">
                Create GitHub OAuth App
              </Button>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Client ID
                  </label>
                  <input
                    type="text"
                    placeholder="your-client-id"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Client Secret
                  </label>
                  <input
                    type="password"
                    placeholder="your-client-secret"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Callback URL: <code className="bg-muted px-1 py-0.5 rounded">{window.location.origin}/admin/auth/callback</code>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KV Namespace Setup */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Step 3: KV Namespace</CardTitle>
                <CardDescription>
                  Create a KV namespace for session storage
                </CardDescription>
              </div>
              {steps[2].completed && (
                <span className="text-green-600">✓</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={handleKVSetup} variant="outline">
                View Setup Instructions
              </Button>
              <div className="bg-muted p-4 rounded-md">
                <code className="text-sm">
                  wrangler kv:namespace create "SESSIONS"<br />
                  wrangler kv:namespace create "SESSIONS" --preview
                </code>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Production Namespace ID
                  </label>
                  <input
                    type="text"
                    placeholder="namespace-id"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Preview Namespace ID
                  </label>
                  <input
                    type="text"
                    placeholder="preview-namespace-id"
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GitHub Secrets Setup */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Step 4: GitHub Secrets</CardTitle>
                <CardDescription>
                  Add secrets to your repository for CI/CD
                </CardDescription>
              </div>
              {steps[3].completed && (
                <span className="text-green-600">✓</span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={handleGitHubSecretsSetup} variant="outline">
                Open GitHub Secrets Page
              </Button>
              <div className="bg-muted p-4 rounded-md space-y-2">
                <p className="text-sm font-medium">Required secrets:</p>
                <ul className="text-sm list-disc list-inside space-y-1">
                  <li><code>CLOUDFLARE_ACCOUNT_ID</code></li>
                  <li><code>CLOUDFLARE_API_TOKEN</code></li>
                  <li><code>GITHUB_CLIENT_ID</code></li>
                  <li><code>GITHUB_CLIENT_SECRET</code></li>
                  <li><code>APP_URL</code> (optional)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={() => {}} className="flex-1">
            Save Configuration
          </Button>
          <Button onClick={() => {}} variant="outline">
            Test Connection
          </Button>
        </div>
      </div>
    </div>
  );
}

