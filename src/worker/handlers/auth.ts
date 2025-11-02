/**
 * Auth handler for LittleCMS
 * Handles GitHub App installation flow with session management
 */

import { 
  getInstallation, 
  getInstallationRepos, 
  storeInstallation, 
  getUserInstallations,
  listInstallations
} from '../utils/github-app.js';

interface Env {
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
 * Get GitHub user info using installation token
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
  const appId = envVars.GITHUB_APP_ID || '';
  const privateKey = envVars.GITHUB_APP_PRIVATE_KEY || '';
  const sessions = envVars.SESSIONS;
  const appUrl = envVars.APP_URL || url.origin;

  if (!appId || !privateKey) {
    return new Response(
      JSON.stringify({ error: 'GitHub App not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  switch (action) {
    case 'login': {
      // Redirect to GitHub App installation page with state parameter
      // The state will be used to redirect back after installation
      const state = generateSessionId();
      const returnUrl = url.searchParams.get('return_url') || '/admin';
      
      // Store return URL temporarily (1 hour)
      if (sessions) {
        await sessions.put(`install_return_${state}`, returnUrl, { expirationTtl: 3600 });
      }
      
      // Redirect to GitHub App installation with state
      const installUrl = `https://github.com/apps/littlecms/installations/new?state=${encodeURIComponent(state)}`;
      return Response.redirect(installUrl, 302);
    }

    case 'link': {
      // Link an existing installation (for users who already installed the app)
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

        // Create user from installation account
        const user: GitHubUser = {
          login: installation.account.login,
          id: 0,
          avatar_url: '',
          name: installation.account.login,
          email: '',
        };

        // Create session
        const sessionId = generateSessionId();
        const session: Session = {
          user,
          expiresAt: Date.now() + (3600 * 24 * 7 * 1000),
          installations: [installationId],
        };

        if (sessions) {
          await storeInstallation(sessions, installationId, user.login, repoFullNames);
          await storeSession(sessions, sessionId, session);
        }

        // If this is a GET request, redirect to admin
        if (request.method === 'GET') {
          return new Response(null, {
            status: 302,
            headers: {
              'Location': `${appUrl}/admin`,
              'Set-Cookie': createSessionCookie(sessionId),
            },
          });
        }

        // If POST, return JSON response
        return new Response(
          JSON.stringify({ 
            success: true, 
            user,
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
              'Set-Cookie': createSessionCookie(sessionId),
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
      // List all installations for the app (for users to find their installation ID)
      try {
        const installations = await listInstallations(appId, privateKey);
        
        // Return installations with basic info
        const installationsList = installations.map(inst => ({
          id: inst.id,
          account: inst.account,
          repository_selection: inst.repository_selection,
        }));

        return new Response(
          JSON.stringify({ installations: installationsList }),
          {
            headers: { 'Content-Type': 'application/json' },
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

    case 'callback': {
      // Handle GitHub App installation callback
      const code = url.searchParams.get('code');
      const installationId = url.searchParams.get('installation_id');
      const setupAction = url.searchParams.get('setup_action');

      if (!installationId) {
        return new Response('Missing installation_id parameter', { status: 400 });
      }

      try {
        // Get installation info to verify it exists
        const installation = await getInstallation(appId, privateKey, installationId);
        
        // Get repositories accessible to this installation
        const repos = await getInstallationRepos(appId, privateKey, installationId);
        const repoFullNames = repos.map(r => r.full_name);

        // If setup_action is 'install', store the installation and create a session
        if (setupAction === 'install') {
          // Check if there's a return URL from state parameter
          const state = url.searchParams.get('state');
          let returnUrl = '/admin';
          if (state && sessions) {
            const storedReturnUrl = await sessions.get(`install_return_${state}`);
            if (storedReturnUrl) {
              // Normalize return URL - ensure it's a path, not a full URL
              const parsedReturnUrl = new URL(storedReturnUrl, 'http://dummy');
              returnUrl = parsedReturnUrl.pathname || '/admin';
              await sessions.delete(`install_return_${state}`);
            }
          }
          
          // Ensure returnUrl starts with /
          if (!returnUrl.startsWith('/')) {
            returnUrl = '/' + returnUrl;
          }
          
          // Create a session for the user who installed the app
          // Use installation account info to identify the user
          const sessionId = generateSessionId();
          
          // Create a user object from installation account
          // Note: For organization installations, account.type will be 'Organization'
          const user: GitHubUser = {
            login: installation.account.login,
            id: 0, // We don't have user ID from installation, using 0 as placeholder
            avatar_url: '', // Not available from installation
            name: installation.account.login,
            email: '',
          };

          // Create session with this installation
          const session: Session = {
            user,
            expiresAt: Date.now() + (3600 * 24 * 7 * 1000), // 7 days
            installations: [installationId],
          };

          if (sessions) {
            // Store installation info using account login as identifier
            await storeInstallation(sessions, installationId, user.login, repoFullNames);
            
            // Store session
            await storeSession(sessions, sessionId, session);
          }

          // Redirect to admin with session cookie
          return new Response(null, {
            status: 302,
            headers: {
              'Location': `${appUrl}${returnUrl}`,
              'Set-Cookie': createSessionCookie(sessionId),
            },
          });
        }

        // If code is provided but setup_action is not 'install', handle as update
        // This happens when installation is updated (e.g., repositories added/removed)
        if (!setupAction) {
          // Get installation info
          const installation = await getInstallation(appId, privateKey, installationId);
          const repos = await getInstallationRepos(appId, privateKey, installationId);
          const repoFullNames = repos.map(r => r.full_name);

          // Create user from installation account
          const user: GitHubUser = {
            login: installation.account.login,
            id: 0,
            avatar_url: '',
            name: installation.account.login,
            email: '',
          };

          // Find existing session or create new one
          const sessionId = generateSessionId();
          const session: Session = {
            user,
            expiresAt: Date.now() + (3600 * 24 * 7 * 1000),
            installations: [installationId],
          };

          if (sessions) {
            await storeInstallation(sessions, installationId, user.login, repoFullNames);
            await storeSession(sessions, sessionId, session);
          }

          return new Response(null, {
            status: 302,
            headers: {
              'Location': `${appUrl}/admin`,
              'Set-Cookie': createSessionCookie(sessionId),
            },
          });
        }

        return new Response('Invalid callback parameters', { status: 400 });
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
