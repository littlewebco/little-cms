/**
 * Main worker entry point for LittleCMS
 * Supports both Service Worker and Modules format
 */
import { handleEmbed } from './handlers/embed.js';
import { handleAdmin } from './handlers/admin.js';
import { handleAuth } from './handlers/auth.js';
import { handleContentAPI } from './handlers/content.js';
import { handleSetupAPI } from './handlers/setup.js';

// Service Worker format (for backward compatibility)
addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleRequest(event.request, (event as any).env));
});

async function handleRequest(request: Request, env?: unknown): Promise<Response> {
  const url = new URL(request.url);
  
  // Handle static assets first (CSS, JS, images, etc.)
  // With [assets] configuration, we use the ASSETS binding
  if (url.pathname.startsWith('/assets/')) {
    const envTyped = env as { ASSETS?: { fetch: (req: Request) => Promise<Response> } };
    if (envTyped?.ASSETS) {
      return envTyped.ASSETS.fetch(request);
    }
  }
  
  // Handle embed requests (original GitShow functionality)
  if (url.pathname === '/' && url.searchParams.has('githubUrl')) {
    return handleEmbed(request);
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
  
  // Content API routes
  if (url.pathname.startsWith('/api/content')) {
    return handleContentAPI(request, env);
  }
  
  // Default 404
  return new Response('Not Found', { status: 404 });
}

// Export for Modules format (if needed)
export default {
  fetch: handleRequest
};

