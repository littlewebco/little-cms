/**
 * Worker handler for serving admin UI
 */
interface Env {
  SESSIONS?: KVNamespace;
}

export async function handleAdmin(request: Request, env?: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace('/admin', '') || '/';
  
  // Handle auth callback redirect
  if (path === '/auth/callback') {
    // Redirect to API auth callback
    return Response.redirect(`${url.origin}/api/auth/callback${url.search}`, 302);
  }
  
  // For now, return a placeholder
  // In production, this will serve the built admin UI from dist/admin
  if (path === '/' || path === '/index.html') {
    return new Response(
      `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LittleCMS Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/admin/assets/index.js"></script>
  </body>
</html>`,
      {
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  }
  
  // Serve static assets
  // TODO: Implement proper static file serving from dist/admin
  return new Response('Admin UI assets coming soon', { status: 501 });
}

