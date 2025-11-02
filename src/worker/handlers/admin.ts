/**
 * Worker handler for serving admin UI
 */
interface Env {
  SESSIONS?: KVNamespace;
  __STATIC_CONTENT?: any; // For asset serving
  __STATIC_CONTENT_MANIFEST?: any; // Asset manifest
}

export async function handleAdmin(request: Request, env?: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/admin', '') || '/';
  
  // Handle auth callback redirect
  if (path === '/auth/callback') {
    // Redirect to API auth callback
    return Response.redirect(`${url.origin}/api/auth/callback${url.search}`, 302);
  }
  
  // Serve index.html for root path
  if (path === '/' || path === '/index.html') {
    // Serve the actual built index.html
    // Note: Assets are served from /assets/ (not /admin/assets/) because
    // [site] bucket serves from the bucket root, so /assets/file.js maps to dist/admin/assets/file.js
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LittleCMS Admin</title>
    <script type="module" crossorigin src="/assets/index-ClJ6TX0_.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-H3luEsyq.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
      {
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  }
  
  // Assets are served automatically by Cloudflare's [site] bucket configuration
  // Requests to /assets/* are handled before reaching the worker
  // No need to handle them here
  
  return new Response('Not Found', { status: 404 });
}

