/**
 * Setup API endpoints for LittleCMS setup wizard
 */
export async function handleSetupAPI(request: Request, env?: unknown): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Path format: /api/setup/:action
  if (pathParts.length < 3 || pathParts[0] !== 'api' || pathParts[1] !== 'setup') {
    return new Response('Invalid setup path', { status: 400 });
  }

  const action = pathParts[2];

  switch (action) {
    case 'validate-cloudflare': {
      // Validate Cloudflare credentials
      const body = await request.json();
      const { accountId, apiToken } = body;

      try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}`, {
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Invalid credentials' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ valid: true, account: data.result }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Connection failed' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    case 'validate-github': {
      // Validate GitHub OAuth credentials
      const body = await request.json();
      const { clientId, clientSecret } = body;

      try {
        // Test OAuth credentials by attempting token exchange
        // Note: This requires a valid authorization code, so we'll just validate format
        if (!clientId || !clientSecret) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Missing credentials' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Basic validation - check format
        if (clientId.length < 10 || clientSecret.length < 10) {
          return new Response(
            JSON.stringify({ valid: false, error: 'Invalid format' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ valid: true, message: 'Credentials format valid' }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Validation failed' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    case 'oauth-instructions': {
      // Generate OAuth app creation instructions
      const appUrl = url.searchParams.get('appUrl') || 'https://your-worker.workers.dev';
      const callbackUrl = `${appUrl}/admin/auth/callback`;

      const instructions = {
        steps: [
          {
            title: 'Go to GitHub OAuth Apps',
            url: 'https://github.com/settings/developers',
            description: 'Navigate to Developer settings',
          },
          {
            title: 'Create New OAuth App',
            action: 'Click "New OAuth App"',
            fields: {
              name: 'LittleCMS',
              homepageUrl: appUrl.replace('/admin/auth/callback', ''),
              callbackUrl: callbackUrl,
            },
          },
          {
            title: 'Copy Credentials',
            items: [
              'Copy the Client ID',
              'Generate and copy the Client Secret',
            ],
          },
        ],
        callbackUrl,
      };

      return new Response(JSON.stringify(instructions), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    default:
      return new Response('Invalid setup action', { status: 400 });
  }
}

