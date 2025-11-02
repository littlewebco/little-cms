#!/usr/bin/env node
/**
 * Build script to embed index.html content into admin handler
 * This ensures the admin handler always has the correct asset references
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const adminHtmlPath = join(process.cwd(), 'dist/admin/index.html');
const adminHandlerPath = join(process.cwd(), 'src/worker/handlers/admin.ts');

try {
  // Read the built index.html
  const indexHtml = readFileSync(adminHtmlPath, 'utf-8');
  
  // Escape backticks and template literals for embedding in TypeScript
  const escapedHtml = indexHtml
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');
  
  // Generate the admin handler TypeScript file
  const adminHandlerContent = `/**
 * Worker handler for serving admin UI
 * The index.html content is embedded at build time to ensure correct asset references
 */
interface Env {
  SESSIONS?: KVNamespace;
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
}

// Embedded index.html content (generated at build time)
const INDEX_HTML = \`${escapedHtml}\`;

export async function handleAdmin(request: Request, env?: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/admin', '') || '/';
  
  // Handle auth callback redirect
  if (path === '/auth/callback') {
    // Redirect to API auth callback
    return Response.redirect(\`\${url.origin}/api/auth/callback\${url.search}\`, 302);
  }
  
  // Serve index.html for root path
  if (path === '/' || path === '/index.html') {
    // Serve the embedded index.html content
    return new Response(INDEX_HTML, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  }
  
  // Assets are handled by the main worker's ASSETS binding
  // No need to handle them here
  
  return new Response('Not Found', { status: 404 });
}
`;

  writeFileSync(adminHandlerPath, adminHandlerContent, 'utf-8');
  console.log('✓ Generated admin handler with embedded index.html');
} catch (error) {
  console.error('Error generating admin handler:', error);
  process.exit(1);
}

