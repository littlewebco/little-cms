/**
 * Content API handler for LittleCMS
 * Uses GitHub App installation tokens for repository access
 */
import { GitHubAPI } from '../utils/github.js';
import { getAuthenticatedUser } from './auth.js';
import { getInstallationToken, getInstallationInfo, getUserInstallations } from '../utils/github-app.js';

interface Env {
  SESSIONS?: KVNamespace;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  APP_URL?: string;
}

/**
 * Get installation token for a repository
 * Finds which installation has access to the repo
 */
async function getTokenForRepo(
  repoFullName: string,
  userInstallations: string[],
  env: Env
): Promise<{ token: string; installationId: string } | null> {
  const appId = env.GITHUB_APP_ID;
  const privateKey = env.GITHUB_APP_PRIVATE_KEY;
  const sessions = env.SESSIONS;

  if (!appId || !privateKey || !sessions) {
    return null;
  }

  // Check each installation to see if it has access to this repo
  for (const installationId of userInstallations) {
    try {
      const installationInfo = await getInstallationInfo(sessions, installationId);
      if (installationInfo && installationInfo.repos.includes(repoFullName)) {
        // This installation has access to the repo
        const token = await getInstallationToken(appId, privateKey, installationId);
        return { token, installationId };
      }
    } catch (error) {
      // Continue to next installation
      console.error(`Error checking installation ${installationId}:`, error);
    }
  }

  return null;
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
  
  // Validate file path (prevent path traversal and ensure within /posts)
  if (filePath) {
    // Prevent path traversal
    if (filePath.includes('..') || filePath.includes('~') || filePath.startsWith('/')) {
      return new Response(
        JSON.stringify({ error: 'Invalid path' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Ensure all paths are within /posts directory
    const normalizedPath = filePath.startsWith('./') ? filePath.slice(2) : filePath;
    if (normalizedPath !== 'posts' && !normalizedPath.startsWith('posts/')) {
      return new Response(
        JSON.stringify({ error: 'Path must be within /posts directory' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }
  
  const envVars = env as Env || {};
  const sessions = envVars.SESSIONS;
  
  if (!sessions) {
    return new Response(
      JSON.stringify({ error: 'Sessions not configured' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Get user's installations (using login as identifier)
  const userInstallations = await getUserInstallations(sessions, auth.user.login);
  
  // If user has installations, check if repo is accessible via any installation
  if (userInstallations.length === 0) {
    // No installations - user needs to install the app
    return new Response(
      JSON.stringify({ 
        error: 'No installations found',
        message: 'Please install the GitHub App on your repositories first.'
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const tokenInfo = await getTokenForRepo(repoFullName, userInstallations, envVars);
  
  if (!tokenInfo) {
    return new Response(
      JSON.stringify({ 
        error: 'Repository not accessible',
        message: 'This repository is not accessible through any of your GitHub App installations.'
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Use installation token for API calls
  const github = new GitHubAPI(tokenInfo.token);

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
          // Default to 'posts' directory if no path specified
          const pathParam = url.searchParams.get('path');
          const directoryPath = pathParam || 'posts';
          
          // Ensure directory path is within /posts
          if (directoryPath !== 'posts' && !directoryPath.startsWith('posts/')) {
            return new Response(
              JSON.stringify({ error: 'Directory must be within /posts' }),
              {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
          
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

        // Ensure file path is within /posts
        if (filePath !== 'posts' && !filePath.startsWith('posts/')) {
          return new Response(
            JSON.stringify({ error: 'Files must be created within /posts directory' }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          );
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
        // Ensure file path is within /posts
        if (filePath !== 'posts' && !filePath.startsWith('posts/')) {
          return new Response(
            JSON.stringify({ error: 'Files must be deleted from within /posts directory' }),
            {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

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
    console.error('Content API error:', {
      method: request.method,
      url: request.url,
      path: filePath,
      error: err.message,
      stack: err.stack,
    });
    
    // Try to extract more details from the error
    let errorMessage = err.message || 'Unknown error';
    let statusCode = 500;
    
    // Check if it's a GitHub API error with status code
    if (errorMessage.includes('GitHub API error:')) {
      const statusMatch = errorMessage.match(/GitHub API error: (\d+)/);
      if (statusMatch) {
        statusCode = parseInt(statusMatch[1], 10);
        // Don't return 500 for client errors (4xx)
        if (statusCode >= 400 && statusCode < 500) {
          statusCode = statusCode;
        }
      }
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
      }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
