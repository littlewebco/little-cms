/**
 * Embed handler for LittleCMS
 * Handles the original GitShow embed functionality
 */
import { escapeHtml } from '../utils/html.js';
import { renderMarkdown } from '../utils/markdown.js';
import { isCodeFile } from '../utils/file.js';

export async function handleEmbed(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const githubUrl = url.searchParams.get('githubUrl');

  if (!githubUrl) {
    return new Response(
      "Error: Missing required 'githubUrl' query parameter.",
      { status: 400 }
    );
  }

  // Validate the GitHub URL structure
  let parsedGithubUrl: URL;
  try {
    parsedGithubUrl = new URL(githubUrl);
    const allowedDomains = ['github.com', 'raw.githubusercontent.com'];
    if (!allowedDomains.includes(parsedGithubUrl.hostname)) {
      return new Response(
        `Error: Invalid GitHub domain. Only github.com and raw.githubusercontent.com are allowed.`,
        { status: 400 }
      );
    }
  } catch (e) {
    const error = e as Error;
    return new Response(
      `Error: Invalid 'githubUrl' format: ${error.message}`,
      { status: 400 }
    );
  }

  try {
    // Convert github.com URLs to raw.githubusercontent.com
    let fetchUrl = githubUrl;
    if (parsedGithubUrl.hostname === 'github.com') {
      fetchUrl = githubUrl
        .replace('github.com', 'raw.githubusercontent.com')
        .replace('/blob/', '/');
    }

    const githubResponse = await fetch(fetchUrl);

    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      return new Response(
        `Error fetching from GitHub (${githubResponse.status}): ${githubResponse.statusText}. URL: ${fetchUrl}. Details: ${errorText}`,
        { status: githubResponse.status }
      );
    }

    const contentType = githubResponse.headers.get('content-type');
    const pathSegments = parsedGithubUrl.pathname.split('/');
    const fileName = pathSegments[pathSegments.length - 1];
    const fileExtension = fileName.includes('.') 
      ? fileName.split('.').pop()?.toLowerCase() || ''
      : '';

    const fileContent = await githubResponse.text();
    let renderedContent = '';

    // Content Rendering Logic
    if (fileExtension === 'md' || contentType?.includes('text/markdown')) {
      renderedContent = renderMarkdown(fileContent);
    } else if (isCodeFile(fileExtension, contentType)) {
      renderedContent = `<pre><code class="language-${fileExtension}">${escapeHtml(fileContent)}</code></pre>`;
    } else {
      renderedContent = `<pre>${escapeHtml(fileContent)}</pre>`;
    }

    // Dynamic Insertion Script
    // Use JSON.stringify to properly escape the HTML content
    const escapedContent = JSON.stringify(renderedContent);
    
    return new Response(
      `(function() {
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = ${escapedContent};

        const scriptTag = document.currentScript;

        if (scriptTag) {
          scriptTag.parentNode.insertBefore(contentDiv, scriptTag);
          scriptTag.remove();
        } else {
          console.warn('LittleCMS: Could not find the initiating script tag. Appending content to body.');
          document.body.appendChild(contentDiv);
        }
      })();`,
      {
        headers: { 
          'Content-Type': 'text/javascript; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        },
      }
    );

  } catch (error) {
    const err = error as Error;
    console.error('LittleCMS Worker Error:', err);
    
    const errorMessage = `Error processing request: ${err.message}`;
    const escapedErrorMessage = JSON.stringify(`LittleCMS Error: ${errorMessage}`);
    
    return new Response(
      `(function() {
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.border = '1px solid red';
        errorDiv.style.padding = '10px';
        errorDiv.textContent = ${escapedErrorMessage};
        const scriptTag = document.currentScript;
        if (scriptTag) {
          scriptTag.parentNode.insertBefore(errorDiv, scriptTag);
          scriptTag.remove();
        } else {
          console.error('LittleCMS Error:', ${escapedErrorMessage});
          document.body.appendChild(errorDiv);
        }
      })();`,
      {
        headers: { 
          'Content-Type': 'text/javascript; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'X-LittleCMS-Error': 'true' 
        },
        status: 500
      }
    );
  }
}

