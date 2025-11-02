/**
 * Auth handler for LittleCMS
 * Handles GitHub OAuth flow with session management
 */

interface Env {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SESSIONS?: KVNamespace;
  APP_URL?: string;
  GITHUB_SCOPE?: string; // Optional: GitHub OAuth scope (default: 'public_repo')
}

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
  email: string;
}

interface Session {
  token: string;
  user: GitHubUser;
  expiresAt: number;
}

/**
 * Generate a secure session ID
 */
function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store session in KV
 */
async function storeSession(
  sessions: KVNamespace,
  sessionId: string,
  session: Session,
  ttl = 3600 * 24 * 7 // 7 days
): Promise<void> {
  await sessions.put(sessionId, JSON.stringify(session), {
    expirationTtl: ttl,
  });
}

/**
 * Get session from KV
 */
async function getSession(sessions: KVNamespace, sessionId: string): Promise<Session | null> {
  const data = await sessions.get(sessionId);
  if (!data) return null;
  
  const session: Session = JSON.parse(data);
  if (session.expiresAt < Date.now()) {
    await sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

/**
 * Exchange OAuth code for access token
 */
async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${error}`);
  }

  const data: GitHubTokenResponse = await response.json();
  return data.access_token;
}

/**
 * Get GitHub user info
 */
async function getGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'LittleCMS',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Get session from cookie
 */
function getSessionFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').map(c => c.trim());
  const sessionCookie = cookies.find(c => c.startsWith('littlecms_session='));
  
  if (!sessionCookie) return null;
  
  return sessionCookie.split('=')[1];
}

/**
 * Set session cookie
 */
function createSessionCookie(sessionId: string, maxAge = 3600 * 24 * 7): string {
  return `littlecms_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * Clear session cookie
 */
function clearSessionCookie(): string {
  return 'littlecms_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

export async function handleAuth(request: Request, env?: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Path format: /api/auth/:action
  if (pathParts.length < 3 || pathParts[0] !== 'api' || pathParts[1] !== 'auth') {
    return new Response('Invalid auth path', { status: 400 });
  }

  const action = pathParts[2];
  const envVars = env as Env || {};
  const clientId = envVars.GITHUB_CLIENT_ID || '';
  const clientSecret = envVars.GITHUB_CLIENT_SECRET || '';
  const sessions = envVars.SESSIONS;
  const appUrl = envVars.APP_URL || url.origin;

  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: 'GitHub OAuth not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  switch (action) {
    case 'login': {
      // Initiate GitHub OAuth flow
      const redirectUri = `${appUrl}/admin/auth/callback`;
      const state = generateSessionId(); // Use as CSRF token
      
      // GitHub OAuth scope options:
      // - 'public_repo': Access public repositories only
      // - 'repo': Full access to private repositories (all repos)
      // - 'repo:status': Access commit status only
      // Note: Users can still select which repos to use via the admin UI
      // Default to 'repo' to allow access to both public and private repos
      // Users will be able to choose which repos to use in the admin interface
      const scope = envVars.GITHUB_SCOPE || 'repo';
      
      // Store state temporarily (1 hour)
      if (sessions) {
        await sessions.put(`oauth_state_${state}`, '1', { expirationTtl: 3600 });
      }
      
      const githubAuthUrl = 
        `https://github.com/login/oauth/authorize?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${encodeURIComponent(state)}`;
      
      return Response.redirect(githubAuthUrl, 302);
    }

    case 'callback': {
      // Handle OAuth callback
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      
      if (!code) {
        return new Response('Missing code parameter', { status: 400 });
      }
      
      if (!state) {
        return new Response('Missing state parameter', { status: 400 });
      }
      
      // Verify state (CSRF protection)
      if (sessions) {
        const stateValid = await sessions.get(`oauth_state_${state}`);
        if (!stateValid) {
          return new Response('Invalid state parameter', { status: 400 });
        }
        await sessions.delete(`oauth_state_${state}`);
      }
      
      try {
        const redirectUri = `${appUrl}/admin/auth/callback`;
        const token = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);
        const user = await getGitHubUser(token);
        
        // Create session
        const sessionId = generateSessionId();
        const session: Session = {
          token,
          user,
          expiresAt: Date.now() + (3600 * 24 * 7 * 1000), // 7 days
        };
        
        if (sessions) {
          await storeSession(sessions, sessionId, session);
        }
        
        // Redirect to admin with session cookie
        return new Response(null, {
          status: 302,
          headers: {
            'Location': '/admin',
            'Set-Cookie': createSessionCookie(sessionId),
          },
        });
      } catch (error) {
        const err = error as Error;
        return new Response(
          JSON.stringify({ error: err.message }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    case 'logout': {
      // Clear session
      const sessionId = getSessionFromCookie(request);
      if (sessionId && sessions) {
        await sessions.delete(sessionId);
      }
      
      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': clearSessionCookie(),
          },
        }
      );
    }

    case 'me': {
      // Get current user info
      if (!sessions) {
        return new Response(
          JSON.stringify({ error: 'Sessions not configured' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'Not authenticated' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      const session = await getSession(sessions, sessionId);
      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Session expired' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      return new Response(
        JSON.stringify({ user: session.user }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    case 'session': {
      // Check session validity
      if (!sessions) {
        return new Response(
          JSON.stringify({ authenticated: false }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return new Response(
          JSON.stringify({ authenticated: false }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
      
      const session = await getSession(sessions, sessionId);
      return new Response(
        JSON.stringify({ authenticated: !!session, user: session?.user || null }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    default:
      return new Response('Invalid auth action', { status: 400 });
  }
}

/**
 * Get authenticated user from request
 */
export async function getAuthenticatedUser(request: Request, env?: Env): Promise<{ user: GitHubUser; token: string } | null> {
  const envVars = env as Env || {};
  const sessions = envVars.SESSIONS;
  
  if (!sessions) return null;
  
  const sessionId = getSessionFromCookie(request);
  if (!sessionId) return null;
  
  const session = await getSession(sessions, sessionId);
  if (!session) return null;
  
  return { user: session.user, token: session.token };
}
