/**
 * Content API handler for LittleCMS
 */
import { GitHubAPI } from '../utils/github.js';
import { getAuthenticatedUser } from './auth.js';

interface Env {
  SESSIONS?: KVNamespace;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  APP_URL?: string;
}

/**
 * Get selected repositories for a user (helper function)
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

export async function handleContentAPI(request: Request, env?: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Path format: /api/content/:owner/:repo/:path or /api/content/:owner/:repo?path=...
  if (pathParts.length < 4 || pathParts[0] !== 'api' || pathParts[1] !== 'content') {
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

  const owner = pathParts[2];
  const repo = pathParts[3];
  // Decode the file path (it may be URL encoded)
  const filePath = decodeURIComponent(pathParts.slice(4).join('/')) || '';
  
  if (!owner || !repo) {
    return new Response('Invalid repository name', { status: 400 });
  }

  const repoFullName = `${owner}/${repo}`;
  
  // Validate file path (prevent path traversal)
  if (filePath && (filePath.includes('..') || filePath.includes('~') || filePath.startsWith('/'))) {
    return new Response(
      JSON.stringify({ error: 'Invalid path' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  const envVars = env as Env || {};
  const sessions = envVars.SESSIONS;
  
  // Check if repository is selected (if user has selected repos)
  const selectedRepos = await getSelectedRepos(sessions, auth.user.id);
  if (selectedRepos.length > 0 && !selectedRepos.includes(repoFullName)) {
    return new Response(
      JSON.stringify({ 
        error: 'Repository not selected',
        message: 'Please select this repository in your settings to access it.'
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  
  const github = new GitHubAPI(auth.token);

  try {
    switch (request.method) {
      case 'GET':
        if (filePath) {
          // Get single file
          const file = await github.getFile(owner, repo, filePath);
          return new Response(JSON.stringify(file), {
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          // List directory - check for path query parameter
          const pathParam = url.searchParams.get('path');
          const directoryPath = pathParam || '.';
          const files = await github.getDirectory(owner, repo, directoryPath);
          return new Response(JSON.stringify(files), {
            headers: { 'Content-Type': 'application/json' },
          });
        }

      case 'POST':
      case 'PUT': {
        // Create or update file
        const body = await request.json();
        const { content, message } = body;
        
        if (!content || !message) {
          return new Response('Missing content or message', { status: 400 });
        }

        let sha: string | undefined;
        if (request.method === 'PUT') {
          try {
            const existing = await github.getFile(owner, repo, filePath);
            sha = existing.sha;
          } catch {
            // File doesn't exist, will create new
          }
        }

        const result = await github.putFile(owner, repo, filePath, content, message, sha);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'DELETE': {
        // Delete file
        const file = await github.getFile(owner, repo, filePath);
        const body = await request.json();
        const { message } = body;
        
        if (!message) {
          return new Response('Missing message', { status: 400 });
        }

        await github.deleteFile(owner, repo, filePath, message, file.sha);
        return new Response('File deleted', { status: 200 });
      }

      default:
        return new Response('Method not allowed', { status: 405 });
    }
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

