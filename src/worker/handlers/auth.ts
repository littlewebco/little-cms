/**
 * Auth handler for LittleCMS
 * Handles GitHub App installation flow with session management
 */

import { 
  getInstallation, 
  getInstallationRepos, 
  storeInstallation, 
  getUserInstallations
} from '../utils/github-app.js';

interface Env {
  // GitHub OAuth (for user authentication)
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  // GitHub App (for repository access)
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  SESSIONS?: KVNamespace;
  APP_URL?: string;
}

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
  email: string;
}

interface Session {
  user: GitHubUser;
  expiresAt: number;
  installations: string[]; // Installation IDs this user has access to
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
      'User-Agent': 'LittleCMS',
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
    throw new Error(`Failed to exchange code: ${response.status} ${error}`);
  }

  const data = await response.json() as { access_token?: string; error?: string; error_description?: string };
  if (data.error) {
    throw new Error(`OAuth error: ${data.error_description || data.error}`);
  }

  if (!data.access_token) {
    throw new Error('No access token received from GitHub');
  }

  return data.access_token;
}

/**
 * Get GitHub user info using OAuth token
 */
async function getGitHubUserFromOAuth(token: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'LittleCMS',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user: ${response.status} ${error}`);
  }

  const userData = await response.json() as {
    login: string;
    id: number;
    avatar_url?: string;
    name?: string;
  };
  
  // Get user email (requires user:email scope)
  let email = '';
  try {
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'LittleCMS',
      },
    });
    if (emailResponse.ok) {
      const emails = await emailResponse.json() as Array<{ email: string; primary: boolean }>;
      const primaryEmail = emails.find((e) => e.primary);
      email = primaryEmail?.email || emails[0]?.email || '';
    }
  } catch {
    // Email fetch failed, continue without it
  }

  return {
    login: userData.login,
    id: userData.id,
    avatar_url: userData.avatar_url || '',
    name: userData.name || userData.login,
    email,
  };
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
  const appId = envVars.GITHUB_APP_ID || '';
  const privateKey = envVars.GITHUB_APP_PRIVATE_KEY || '';
  const sessions = envVars.SESSIONS;
  const appUrl = envVars.APP_URL || url.origin;

  // OAuth is required for authentication
  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: 'GitHub OAuth not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  switch (action) {
    case 'login': {
      // Redirect to GitHub OAuth with minimal scope (read:user for identity only)
      const state = generateSessionId();
      const returnUrl = url.searchParams.get('return_url') || '/admin';
      const redirectUri = `${url.origin}/api/auth/callback`;
      
      // Store return URL temporarily (10 minutes)
      if (sessions) {
        await sessions.put(`oauth_state_${state}`, returnUrl, { expirationTtl: 600 });
      }
      
      // OAuth URL with public_repo scope for public repos, GitHub App handles private repos
      const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user%20user:email%20public_repo&state=${encodeURIComponent(state)}`;
      return Response.redirect(oauthUrl, 302);
    }

    case 'link': {
      // SECURITY FIX: Link an installation only if user already has a session
      // This prevents unauthorized linking of installations
      if (!sessions) {
        return new Response(
          JSON.stringify({ error: 'Sessions not configured' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Check if user already has a session
      const existingSessionId = getSessionFromCookie(request);
      if (!existingSessionId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized. Please install the GitHub App first.' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const existingSession = await getSession(sessions, existingSessionId);
      if (!existingSession) {
        return new Response(
          JSON.stringify({ error: 'Session expired. Please install the GitHub App again.' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Accepts installation_id as query parameter or in body
      let installationId: string | null = null;
      
      if (request.method === 'POST') {
        try {
          const body = await request.json() as { installation_id?: string };
          installationId = body.installation_id || null;
        } catch {
          // Body parsing failed, try query param
        }
      }
      
      installationId = installationId || url.searchParams.get('installation_id');
      
      if (!installationId) {
        return new Response(
          JSON.stringify({ error: 'Missing installation_id parameter' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      try {
        // Get installation info
        const installation = await getInstallation(appId, privateKey, installationId);
        const repos = await getInstallationRepos(appId, privateKey, installationId);
        const repoFullNames = repos.map(r => r.full_name);

        // Verify installation belongs to the same user as the session
        if (installation.account.login !== existingSession.user.login) {
          return new Response(
            JSON.stringify({ error: 'Installation does not belong to your account' }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Update session to include this installation
        const updatedInstallations = [...existingSession.installations];
        if (!updatedInstallations.includes(installationId)) {
          updatedInstallations.push(installationId);
        }

        const updatedSession: Session = {
          ...existingSession,
          installations: updatedInstallations,
        };

        if (sessions) {
          await storeInstallation(sessions, installationId, existingSession.user.login, repoFullNames);
          await storeSession(sessions, existingSessionId, updatedSession);
        }

        // If this is a GET request, redirect to admin
        if (request.method === 'GET') {
          const redirectUrl = `${url.origin}/admin`;
          return new Response(null, {
            status: 302,
            headers: {
              'Location': redirectUrl,
            },
          });
        }

        // If POST, return JSON response
        return new Response(
          JSON.stringify({ 
            success: true, 
            user: existingSession.user,
            installation: {
              id: installation.id,
              account: installation.account,
              repos: repoFullNames.length
            }
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
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

    case 'installations': {
      // SECURITY FIX: Require authentication and only return user's installations
      // This prevents unauthorized access to installation information
      if (!sessions) {
        return new Response(
          JSON.stringify({ error: 'Sessions not configured' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Check if user is authenticated
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized', installations: [] }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const session = await getSession(sessions, sessionId);
      if (!session) {
        return new Response(
          JSON.stringify({ error: 'Session expired', installations: [] }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Only return installations linked to this user's session
      const userInstallations = await getUserInstallations(sessions, session.user.login);
      
      if (userInstallations.length === 0) {
        return new Response(
          JSON.stringify({ installations: [] }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Get installation details for user's installations only
      try {
        const installationsList = await Promise.all(
          userInstallations.map(async (installationId) => {
            try {
              const installation = await getInstallation(appId, privateKey, installationId);
              return {
                id: installation.id,
                account: installation.account,
                repository_selection: installation.repository_selection,
              };
            } catch {
              // Skip invalid installations
              return null;
            }
          })
        );

        return new Response(
          JSON.stringify({ 
            installations: installationsList.filter(inst => inst !== null) 
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        const err = error as Error;
        return new Response(
          JSON.stringify({ error: err.message, installations: [] }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    case 'callback': {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const installationId = url.searchParams.get('installation_id');
      const setupAction = url.searchParams.get('setup_action');

      // Handle GitHub App installation callback FIRST (it may include OAuth code + state)
      // Priority: installation_id takes precedence over OAuth callback
      if (installationId) {
        if (!sessions) {
          return new Response('Sessions not configured', { status: 500 });
        }

        // Verify user is authenticated
        const sessionId = getSessionFromCookie(request);
        if (!sessionId) {
          // Redirect to OAuth login, preserving the installation callback URL
          const returnUrl = encodeURIComponent(url.pathname + url.search);
          return Response.redirect(`${url.origin}/api/auth/login?return_url=${returnUrl}`, 302);
        }

        const session = await getSession(sessions, sessionId);
        if (!session) {
          // Session expired, redirect to login
          const returnUrl = encodeURIComponent(url.pathname + url.search);
          return Response.redirect(`${url.origin}/api/auth/login?return_url=${returnUrl}`, 302);
        }

        // Verify GitHub App is configured
        if (!appId || !privateKey) {
          return new Response(
            JSON.stringify({ error: 'GitHub App not configured' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        try {
          // Get installation info
          const installation = await getInstallation(appId, privateKey, installationId);
          
          // Verify installation belongs to the authenticated user
          // For personal accounts: check if login matches
          // For organizations: GitHub already ensures only authorized users can install,
          // so we trust the installation callback (user must have permission)
          if (installation.account.type === 'User' && installation.account.login !== session.user.login) {
            return new Response(
              JSON.stringify({ error: 'Installation does not belong to your account' }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
          
          // For organizations, we trust GitHub's authorization - if the user received
          // this callback, they have permission to install on that organization
          
          // Get repositories accessible to this installation
          const repos = await getInstallationRepos(appId, privateKey, installationId);
          const repoFullNames = repos.map(r => r.full_name);

          // Update session to include this installation
          const updatedInstallations = [...session.installations];
          if (!updatedInstallations.includes(installationId)) {
            updatedInstallations.push(installationId);
          }

          const updatedSession: Session = {
            ...session,
            installations: updatedInstallations,
          };

          // Store installation info with the user's login (for lookup)
          // Also store the account (org/user) that owns the installation
          await storeInstallation(sessions, installationId, session.user.login, repoFullNames);
          await storeSession(sessions, sessionId, updatedSession);

          // Check if there's a return URL in the state parameter (from install-url)
          // GitHub App installations may include state in query params
          let redirectPath = '/admin';
          
          if (state) {
            // Decode and use the return URL from state
            try {
              const decodedState = decodeURIComponent(state);
              // If state looks like a path (starts with /), use it
              if (decodedState.startsWith('/')) {
                redirectPath = decodedState;
              }
            } catch {
              // If decoding fails, use default
            }
          }

          // Redirect to admin (or return URL from state)
          return new Response(null, {
            status: 302,
            headers: {
              'Location': `${url.origin}${redirectPath}`,
            },
          });
        } catch (error) {
          const err = error as Error;
          return new Response(
            JSON.stringify({ error: `GitHub App installation failed: ${err.message}` }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // Handle OAuth callback (user authentication)
      // Only process if there's no installation_id (to avoid conflicts)
      if (code && state) {
        if (!sessions) {
          return new Response('Sessions not configured', { status: 500 });
        }

        // Verify state - check if it's a valid OAuth state (stored in KV)
        const storedReturnUrl = await sessions.get(`oauth_state_${state}`);
        if (!storedReturnUrl) {
          // State not found in KV - this might be from GitHub App installation
          // If we have installation_id, we already handled it above
          // Otherwise, it's an invalid/expired state
          return new Response('Invalid or expired state parameter', { status: 400 });
        }

        try {
          const redirectUri = `${url.origin}/api/auth/callback`;
          
          // Exchange code for token
          const oauthToken = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);
          
          // Get user info from OAuth token
          const user = await getGitHubUserFromOAuth(oauthToken);

          // Create session with authenticated user
          const sessionId = generateSessionId();
          const session: Session = {
            user,
            expiresAt: Date.now() + (3600 * 24 * 7 * 1000), // 7 days
            installations: [], // Will be populated when GitHub App is installed
          };

          await storeSession(sessions, sessionId, session);
          await sessions.delete(`oauth_state_${state}`);

          // Redirect to admin (or return URL)
          const returnUrl = storedReturnUrl || '/admin';
          return new Response(null, {
            status: 302,
            headers: {
              'Location': `${url.origin}${returnUrl}`,
              'Set-Cookie': createSessionCookie(sessionId),
            },
          });
        } catch (error) {
          const err = error as Error;
          return new Response(
            JSON.stringify({ error: `OAuth authentication failed: ${err.message}` }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // Neither OAuth code nor installation_id provided
      return new Response('Missing required parameters (code or installation_id)', { status: 400 });
    }

    case 'user': {
      // This endpoint is no longer needed for GitHub App flow
      // Users are identified through installations
      return new Response('This endpoint is not used for GitHub App authentication', { status: 404 });
    }

    case 'user-callback': {
      // This endpoint is no longer needed for GitHub App flow
      return new Response('This endpoint is not used for GitHub App authentication', { status: 404 });
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
 * Returns user info and installation IDs they have access to
 */
export async function getAuthenticatedUser(request: Request, env?: Env): Promise<{ user: GitHubUser; installations: string[] } | null> {
  const envVars = env as Env || {};
  const sessions = envVars.SESSIONS;
  
  if (!sessions) return null;
  
  const sessionId = getSessionFromCookie(request);
  if (!sessionId) return null;
  
  const session = await getSession(sessions, sessionId);
  if (!session) return null;
  
  return { user: session.user, installations: session.installations };
}
