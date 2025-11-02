/**
 * Repositories API handler
 * Allows users to list and select which repositories they want to use
 */
import { getAuthenticatedUser } from './auth.js';
import { GitHubAPI } from '../utils/github.js';

interface Env {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SESSIONS?: KVNamespace;
  APP_URL?: string;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
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
  const github = new GitHubAPI(auth.token);

  switch (action) {
    case 'list': {
      // List all repositories the user has access to
      try {
        // Get user's repositories (including private if scope allows)
        const repos = await github.apiRequest<GitHubRepository[]>('/user/repos?per_page=100&sort=updated');
        
        // Get selected repositories for this user
        const selectedRepos = await getSelectedRepos(sessions, auth.user.id);
        
        // Mark which repos are selected
        const reposWithSelection = repos.map(repo => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          owner: repo.owner.login,
          private: repo.private,
          description: repo.description,
          default_branch: repo.default_branch,
          selected: selectedRepos.includes(repo.full_name),
        }));

        return new Response(
          JSON.stringify({ repos: reposWithSelection }),
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
      // Update selected repositories
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        const body = await request.json();
        const { repos } = body; // Array of repo full_names like ["owner/repo"]

        if (!Array.isArray(repos)) {
          return new Response(
            JSON.stringify({ error: 'Invalid request body' }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Store selected repos in KV
        if (sessions) {
          await sessions.put(
            `selected_repos_${auth.user.id}`,
            JSON.stringify(repos),
            { expirationTtl: 3600 * 24 * 365 } // 1 year
          );
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
      // Get currently selected repositories
      try {
        const selectedRepos = await getSelectedRepos(sessions, auth.user.id);
        return new Response(
          JSON.stringify({ repos: selectedRepos }),
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

/**
 * Get selected repositories for a user
 */
async function getSelectedRepos(sessions: KVNamespace | undefined, userId: number): Promise<string[]> {
  if (!sessions) return [];
  
  const data = await sessions.get(`selected_repos_${userId}`);
  if (!data) return [];
  
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Check if a repository is selected by the user
 */
export async function isRepoSelected(
  sessions: KVNamespace | undefined,
  userId: number,
  repoFullName: string
): Promise<boolean> {
  const selectedRepos = await getSelectedRepos(sessions, userId);
  return selectedRepos.includes(repoFullName);
}

