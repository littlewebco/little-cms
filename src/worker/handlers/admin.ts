/**
 * Worker handler for serving admin UI
 * The index.html content is embedded at build time to ensure correct asset references
 */
interface Env {
  SESSIONS?: KVNamespace;
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
}

// Embedded index.html content (generated at build time)
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LittleCMS Admin</title>
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <script type="module" crossorigin src="/assets/index-INTRDVA5.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-Cvl6CaS6.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>

`;

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
