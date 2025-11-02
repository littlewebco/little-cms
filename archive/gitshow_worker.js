addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
  });
  
  async function handleRequest(request) {
    const url = new URL(request.url);
    const githubUrl = url.searchParams.get('githubUrl');
  
    if (!githubUrl) {
      return new Response("Error: Missing required 'githubUrl' query parameter.", { status: 400 });
    }
  
    // Validate the GitHub URL structure (basic check)
    let parsedGithubUrl;
    try {
      parsedGithubUrl = new URL(githubUrl);
      if (parsedGithubUrl.hostname !== 'github.com' && parsedGithubUrl.hostname !== 'raw.githubusercontent.com') {
         // Allow raw content URLs too
         // A more robust check might be needed depending on supported formats
         // throw new Error('Invalid GitHub URL hostname.');
      }
    } catch (e) {
      return new Response(`Error: Invalid 'githubUrl' format: ${e.message}`, { status: 400 });
    }
  
    try {
      // Use the raw content URL for fetching if available, otherwise construct it
      // Note: This assumes standard github.com URLs and might need adjustment for Enterprise etc.
      let fetchUrl = githubUrl;
      if (parsedGithubUrl.hostname === 'github.com') {
          // Convert 'github.com/.../blob/...' to 'raw.githubusercontent.com/...'
          fetchUrl = githubUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      }
  
      const githubResponse = await fetch(fetchUrl);
  
      if (!githubResponse.ok) {
        // Provide more specific error feedback
        const errorText = await githubResponse.text();
        return new Response(`Error fetching from GitHub (${githubResponse.status}): ${githubResponse.statusText}. URL: ${fetchUrl}. Details: ${errorText}`, { status: githubResponse.status });
      }
  
      const contentType = githubResponse.headers.get('content-type');
      // Extract file extension more reliably
      const pathSegments = parsedGithubUrl.pathname.split('/');
      const fileName = pathSegments[pathSegments.length - 1];
      const fileExtension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  
      const fileContent = await githubResponse.text();
      let renderedContent = '';
  
      // --- Content Rendering Logic ---
  
      if (fileExtension === 'md' || contentType?.includes('text/markdown')) {
        renderedContent = renderMarkdown(fileContent);
      } else if (isCodeFile(fileExtension, contentType)) {
        // FR5: Code Block Rendering
        renderedContent = `<pre><code class="language-${fileExtension}">${escapeHtml(fileContent)}</code></pre>`;
        // Note: Actual syntax highlighting would require a client-side library like Prism.js or highlight.js
      } else {
        // FR6: Plain Text Display
        renderedContent = `<pre>${escapeHtml(fileContent)}</pre>`;
      }
  
      // --- Dynamic Insertion Script ---
      // FR7: Inject content and self-remove script tag
      // Using text/javascript for the response part that runs client-side
      return new Response(`
        (function() {
          const contentDiv = document.createElement('div');
          contentDiv.innerHTML = \`${renderedContent.replace(/`/g, '\\`')}\`; // Embed rendered HTML, escape backticks
  
          // Find the script tag that loaded this content
          // document.currentScript might be null in some contexts (e.g., modules)
          // A more robust approach might involve IDs or data attributes if needed.
          const scriptTag = document.currentScript;
  
          if (scriptTag) {
            // Insert the fetched content before the script tag
            scriptTag.parentNode.insertBefore(contentDiv, scriptTag);
            // Remove the original script tag
            scriptTag.remove();
          } else {
            // Fallback: append to body or a specific container if scriptTag is null
            console.warn('GitShow: Could not find the initiating script tag. Appending content to body.');
            document.body.appendChild(contentDiv);
          }
        })();
      `, {
        // Important: Set Content-Type to text/javascript for the client-side script
        headers: { 'Content-Type': 'text/javascript' },
      });
  
    } catch (error) {
      console.error('GitShow Worker Error:', error);
      // FR8: Improved Error Handling
      // Send a script that displays the error message in place
      const errorMessage = `Error processing request: ${error.message}`;
      return new Response(`
        (function() {
          const errorDiv = document.createElement('div');
          errorDiv.style.color = 'red';
          errorDiv.style.border = '1px solid red';
          errorDiv.style.padding = '10px';
          errorDiv.textContent = 'GitShow Error: ${escapeHtml(errorMessage)}';
          const scriptTag = document.currentScript;
          if (scriptTag) {
            scriptTag.parentNode.insertBefore(errorDiv, scriptTag);
            scriptTag.remove();
          } else {
            console.error('GitShow Error:', '${escapeHtml(errorMessage)}');
            // Optionally append error to body as fallback
             document.body.appendChild(errorDiv);
          }
        })();
      `, {
          headers: { 'Content-Type': 'text/javascript', 'X-GitShow-Error': 'true' }, // Add custom header for debugging
          status: 500 // Keep internal server error status
      });
    }
  }
  
  // --- Helper Functions ---
  
  function isCodeFile(extension, contentType) {
    const codeExtensions = ['js', 'ts', 'py', 'java', 'c', 'cpp', 'go', 'rb', 'php', 'cs', 'swift', 'kt', 'rs', 'sh', 'css', 'html', 'xml', 'json', 'yaml', 'sql'];
    // FR5: Check common code extensions or text-based content types
    return codeExtensions.includes(extension) || contentType?.startsWith('text/') || contentType?.includes('application/json') || contentType?.includes('application/xml');
  }
  
  // FR4: Basic Markdown Rendering (Improved)
  function renderMarkdown(md) {
    let html = md
      // Escape HTML first to prevent injection via Markdown
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Headers (h1-h6)
      .replace(/^###### (.*$)/gim, '<h6>$1</h6>')
      .replace(/^##### (.*$)/gim, '<h5>$1</h5>')
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold (**text** or __text__)
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/__(.*?)__/gim, '<strong>$1</strong>')
       // Italic (*text* or _text_)
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/_(.*?)_/gim, '<em>$1</em>')
      // Links [text](url)
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank">$1</a>') // Added target="_blank"
      // Code blocks (```lang\ncode\n```) - Basic handling
      // This simple regex won't handle nested blocks or complex cases well.
      .replace(/```(\w+)?\n([\s\S]*?)?\n```/gim, (match, lang, code) => {
          const languageClass = lang ? ` class="language-${lang}"` : '';
          // Re-escape HTML within code blocks if necessary (already escaped above)
          const escapedCode = code || ''; // Handle empty code blocks
          return `<pre><code${languageClass}>${escapedCode.trim()}</code></pre>`;
       })
       // Inline code (`code`) - needs to be after block code
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      // Lists (unordered *, -, +; ordered 1.) - Very basic, handles simple cases
      .replace(/^\s*([\*\-\+])\s+(.*)/gim, '<ul>\n<li>$2</li>\n</ul>') // Unordered
      .replace(/^\s*(\d+)\.\s+(.*)/gim, '<ol>\n<li>$2</li>\n</ol>')    // Ordered
       // Combine adjacent list items (basic attempt)
      .replace(/<\/ul>\n<ul>/gim, '')
      .replace(/<\/ol>\n<ol>/gim, '');
  
    // Wrap paragraphs (any line not starting with a tag or list marker)
    // This is a simplification; real Markdown needs state machines.
    html = html.split('\n').map(line => {
      line = line.trim();
      if (line.length === 0 || line.match(/^<\/?(h[1-6]|ul|ol|li|pre|code|a|strong|em)/)) {
        return line; // Keep lines that are already HTML tags or empty
      }
      // Check if it's inside a pre block (very rough check)
       if (html.substring(html.indexOf(line)-10, html.indexOf(line)).includes('<pre>')) return line; // Avoid wrapping lines in pre
      return `<p>${line}</p>`;
    }).join('\n')
     // Clean up extra newlines possibly introduced by paragraph wrapping
    .replace(/\n{2,}/g, '\n');
  
    return html;
  }
  
  // NFR 4.4: Security - Ensure HTML is escaped for non-Markdown/Code display
  function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }