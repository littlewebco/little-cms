/**
 * Preview API handler for markdown rendering
 */
import { renderMarkdown } from '../utils/markdown.js';

interface Env {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SESSIONS?: KVNamespace;
  APP_URL?: string;
}

export async function handlePreviewAPI(request: Request, env?: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json();
    const { markdown, repo, filePath } = body;

    if (!markdown || typeof markdown !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid markdown content' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Render markdown using worker's markdown renderer
    // Pass filePath to help resolve relative image paths
    const html = renderMarkdown(markdown, repo, filePath);

    return new Response(
      JSON.stringify({ html }),
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

