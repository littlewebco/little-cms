/**
 * Repositories API handler
 * Lists repositories accessible through GitHub App installations
 */
import { getAuthenticatedUser } from './auth.js';
import { getInstallationRepos, getUserInstallations, getInstallationInfo } from '../utils/github-app.js';

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  SESSIONS?: KVNamespace;
  APP_URL?: string;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  private: boolean;
  description: string | null;
  default_branch: string;
}

export async function handleReposAPI(request: Request, env?: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Path format: /api/repos/:action
  if (pathParts.length < 3 || pathParts[0] !== 'api' || pathParts[1] !== 'repos') {
    return new Response('Invalid API path', { status: 400 });
  }

  // Authenticate user
  const auth = await getAuthenticatedUser(request, env);
  if (!auth) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const action = pathParts[2];
  const envVars = env as Env || {};
  const sessions = envVars.SESSIONS;
  const appId = envVars.GITHUB_APP_ID;
  const privateKey = envVars.GITHUB_APP_PRIVATE_KEY;

  if (!sessions || !appId || !privateKey) {
    return new Response(
      JSON.stringify({ error: 'GitHub App not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  switch (action) {
    case 'list': {
      // List all repositories accessible through user's installations
      try {
        // Use user login for installations lookup
        const userInstallations = await getUserInstallations(sessions, auth.user.login);
        
        if (userInstallations.length === 0) {
          return new Response(
            JSON.stringify({ repos: [] }),
            {
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Get repos from all installations
        const allRepos: Map<string, GitHubRepository> = new Map();
        
        for (const installationId of userInstallations) {
          try {
            const repos = await getInstallationRepos(appId, privateKey, installationId);
            const installationInfo = await getInstallationInfo(sessions, installationId);
            
            // Mark repos as selected if they're in the installation's selected repos
            const selectedRepos = installationInfo?.repos || [];
            
            for (const repo of repos) {
              if (!allRepos.has(repo.full_name)) {
                allRepos.set(repo.full_name, {
                  id: repo.id,
                  name: repo.name,
                  full_name: repo.full_name,
                  owner: repo.full_name.split('/')[0],
                  private: repo.private,
                  description: null, // Installation API doesn't return description
                  default_branch: repo.default_branch,
                });
              }
            }
          } catch (error) {
            console.error(`Error fetching repos for installation ${installationId}:`, error);
            // Continue with other installations
          }
        }

        // Convert map to array and mark selected repos
        const reposList = await Promise.all(
          Array.from(allRepos.values()).map(async (repo) => {
            // Check if repo is selected in any installation
            let selected = false;
            for (const installationId of userInstallations) {
              const installationInfo = await getInstallationInfo(sessions, installationId);
              if (installationInfo && installationInfo.repos.includes(repo.full_name)) {
                selected = true;
                break;
              }
            }
            
            return {
              ...repo,
              selected,
            };
          })
        );

        return new Response(
          JSON.stringify({ repos: reposList }),
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

    case 'select': {
      // Update selected repositories for an installation
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const body = await request.json();
        const { repos, installationId } = body; // Array of repo full_names and installation ID

        if (!Array.isArray(repos) || !installationId) {
          return new Response(
            JSON.stringify({ error: 'Invalid request body. Expected { repos: string[], installationId: string }' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Update installation info with selected repos
        const installationInfo = await getInstallationInfo(sessions, installationId);
        if (installationInfo) {
          const githubApp = await import('../utils/github-app.js');
          await githubApp.storeInstallation(sessions, installationId, auth.user.login, repos);
        }

        return new Response(
          JSON.stringify({ success: true, repos }),
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

    case 'selected': {
      // Get currently selected repositories across all installations
      try {
        const userInstallations = await getUserInstallations(sessions, auth.user.login);
        const allSelectedRepos: string[] = [];
        
        for (const installationId of userInstallations) {
          const installationInfo = await getInstallationInfo(sessions, installationId);
          if (installationInfo && installationInfo.repos) {
            allSelectedRepos.push(...installationInfo.repos);
          }
        }

        // Remove duplicates
        const uniqueRepos = Array.from(new Set(allSelectedRepos));

        return new Response(
          JSON.stringify({ repos: uniqueRepos }),
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

    default:
      return new Response('Invalid action', { status: 400 });
  }
}
