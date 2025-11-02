/**
 * Main worker entry point for LittleCMS
 * Uses Modules format (recommended for Cloudflare Workers)
 */
import { handleEmbed } from './handlers/embed.js';
import { handleHomepage } from './handlers/homepage.js';
import { handleAdmin } from './handlers/admin.js';
import { handleAuth } from './handlers/auth.js';
import { handleContentAPI } from './handlers/content.js';
import { handleSetupAPI } from './handlers/setup.js';
import { handleReposAPI } from './handlers/repos.js';
import { handlePreviewAPI } from './handlers/preview.js';

interface Env {
  // GitHub OAuth (for user authentication)
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  // GitHub App (for repository access)
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  SESSIONS?: KVNamespace;
  APP_URL?: string;
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle static assets first (CSS, JS, images, etc.)
    // With [assets] configuration, we use the ASSETS binding
    if (url.pathname.startsWith('/assets/')) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
    }
    
    // Handle favicon and logo requests
    if (url.pathname === '/favicon.ico' || url.pathname === '/logo.svg') {
      if (env.ASSETS) {
        // Try to serve from assets first (logo.svg)
        const logoPath = url.pathname === '/favicon.ico' ? '/logo.svg' : url.pathname;
        const assetRequest = new Request(new URL(logoPath, request.url), request);
        const assetResponse = await env.ASSETS.fetch(assetRequest);
        if (assetResponse.status !== 404) {
          // For favicon.ico requests, serve logo.svg with appropriate content type
          if (url.pathname === '/favicon.ico') {
            return new Response(assetResponse.body, {
              headers: {
                'Content-Type': 'image/svg+xml',
                ...assetResponse.headers,
              },
            });
          }
          return assetResponse;
        }
      }
      // If not found in assets, return 404
      return new Response('Not Found', { status: 404 });
    }
    
    // Handle embed requests (original GitShow functionality)
    // Must check this BEFORE the homepage route
    if (url.pathname === '/' && url.searchParams.has('githubUrl')) {
      return handleEmbed(request);
    }
    
    // Handle homepage (root path without githubUrl)
    if (url.pathname === '/') {
      return handleHomepage(request);
    }
    
    // Admin UI routes
    if (url.pathname.startsWith('/admin')) {
      return handleAdmin(request, env);
    }
    
    // Setup API routes
    if (url.pathname.startsWith('/api/setup')) {
      return handleSetupAPI(request, env);
    }
    
    // Auth API routes
    if (url.pathname.startsWith('/api/auth')) {
      return handleAuth(request, env);
    }
    
    // Repositories API routes (for selecting which repos to use)
    if (url.pathname.startsWith('/api/repos')) {
      return handleReposAPI(request, env);
    }
    
    // Preview API routes (for markdown rendering)
    if (url.pathname.startsWith('/api/preview')) {
      return handlePreviewAPI(request, env);
    }
    
    // Content API routes
    if (url.pathname.startsWith('/api/content')) {
      return handleContentAPI(request, env);
    }
    
    // Default 404
    return new Response('Not Found', { status: 404 });
  }
};

