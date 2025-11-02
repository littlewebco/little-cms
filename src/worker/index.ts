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
    const pathname = url.pathname;
    
    // CRITICAL: Handle root path FIRST before any asset handling
    // Cloudflare's assets binding may intercept /index.html automatically for navigation requests
    // We must handle the root path explicitly before assets can interfere
    
    // Handle embed requests (original GitShow functionality)
    if (pathname === '/' && url.searchParams.has('githubUrl')) {
      return handleEmbed(request);
    }
    
    // Handle homepage (root path without githubUrl)
    // Check for navigation requests explicitly to prevent asset interception
    if (pathname === '/' && !url.searchParams.has('githubUrl')) {
      // Always serve homepage for root path, regardless of headers
      return handleHomepage(request);
    }
    
    // Handle static assets (CSS, JS, images, etc.)
    // With [assets] configuration, we use the ASSETS binding
    // Only handle /assets/ paths, not root paths
    if (pathname.startsWith('/assets/')) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
    }
    
    // Handle favicon and logo requests
    if (pathname === '/favicon.ico' || pathname === '/logo.svg') {
      if (env.ASSETS) {
        // Try to serve from assets first (logo.svg)
        const logoPath = pathname === '/favicon.ico' ? '/logo.svg' : pathname;
        const assetRequest = new Request(new URL(logoPath, request.url), request);
        const assetResponse = await env.ASSETS.fetch(assetRequest);
        if (assetResponse.status !== 404) {
          // For favicon.ico requests, serve logo.svg with appropriate content type
          if (pathname === '/favicon.ico') {
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
    
    // Admin UI routes
    if (pathname.startsWith('/admin')) {
      return handleAdmin(request, env);
    }
    
    // Setup API routes
    if (pathname.startsWith('/api/setup')) {
      return handleSetupAPI(request, env);
    }
    
    // Auth API routes
    if (pathname.startsWith('/api/auth')) {
      return handleAuth(request, env);
    }
    
    // Repositories API routes (for selecting which repos to use)
    if (pathname.startsWith('/api/repos')) {
      return handleReposAPI(request, env);
    }
    
    // Preview API routes (for markdown rendering)
    if (pathname.startsWith('/api/preview')) {
      return handlePreviewAPI(request, env);
    }
    
    // Content API routes
    if (pathname.startsWith('/api/content')) {
      return handleContentAPI(request, env);
    }
    
    // Default 404
    return new Response('Not Found', { status: 404 });
  }
};

