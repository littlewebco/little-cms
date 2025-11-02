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

        if (!Array.isArray(repos)) {
          return new Response(
            JSON.stringify({ error: 'Invalid request body. Expected { repos: string[], installationId?: string }' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Get user's installations
        const userInstallations = await getUserInstallations(sessions, auth.user.login);

        if (userInstallations.length === 0) {
          return new Response(
            JSON.stringify({ error: 'No installations found. Please install the GitHub App first.' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // If installationId is provided, update only that installation
        // Otherwise, update all installations with the selected repos
        const installationsToUpdate = installationId 
          ? [installationId]
          : userInstallations;

        for (const instId of installationsToUpdate) {
          const installationInfo = await getInstallationInfo(sessions, instId);
          if (installationInfo) {
            await storeInstallation(sessions, instId, auth.user.login, repos);
          }
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

    case 'installations': {
      // Get installation status for authenticated user
      try {
        const userInstallations = await getUserInstallations(sessions, auth.user.login);
        const installationsList = [];

        for (const installationId of userInstallations) {
          try {
            const installation = await getInstallation(appId, privateKey, installationId);
            const installationInfo = await getInstallationInfo(sessions, installationId);
            const repos = await getInstallationRepos(appId, privateKey, installationId);

            installationsList.push({
              id: installation.id,
              account: installation.account,
              repository_selection: installation.repository_selection,
              repos_count: repos.length,
              selected_repos_count: installationInfo?.repos?.length || 0,
            });
          } catch (error) {
            console.error(`Error fetching installation ${installationId}:`, error);
            // Continue with other installations
          }
        }

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

    case 'install-url': {
      // Get GitHub App installation URL for the authenticated user
      // This allows users to install/update the app
      const returnUrl = url.searchParams.get('return_url') || '/admin/settings';
      const installUrl = `https://github.com/apps/littlecms/installations/new?state=${encodeURIComponent(returnUrl)}`;
      
      return new Response(
        JSON.stringify({ url: installUrl }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    default:
      return new Response('Invalid action', { status: 400 });
  }
}
