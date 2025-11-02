/**
 * Homepage handler for LittleCMS
 * Showcases the embed functionality with live examples

* HTML is embedded directly to ensure it's served even if Cloudflare assets intercept the route
 */
export async function handleHomepage(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const baseUrl = url.origin;

    // Generate homepage HTML dynamically
    const html = generateHomepageHTML(baseUrl);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const err = error as Error;
    console.error('Homepage handler error:', err);
    return new Response(`Error generating homepage: ${err.message}\n\nStack: ${err.stack}`, {
      status: 500,
      headers: { 
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-cache',
      },
    });
  }
}

/**
 * Generate homepage HTML content
 */
function generateHomepageHTML(baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LittleCMS - Git-powered CMS</title>
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    header {
      text-align: center;
      color: white;
      margin-bottom: 3rem;
      padding: 2rem 0;
    }
    
    header h1 {
      font-size: 3rem;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }
    
    header p {
      font-size: 1.25rem;
      opacity: 0.9;
    }
    
    .content {
      background: white;
      border-radius: 12px;
      padding: 2rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }
    
    .section {
      margin-bottom: 3rem;
    }
    
    .section h2 {
      font-size: 2rem;
      margin-bottom: 1rem;
      color: #667eea;
    }
    
    .section h3 {
      font-size: 1.5rem;
      margin-bottom: 0.75rem;
      margin-top: 1.5rem;
      color: #764ba2;
    }
    
    code {
      background: #f4f4f4;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1rem 0;
    }
    
    pre code {
      background: transparent;
      color: inherit;
      padding: 0;
    }
    
    .example {
      background: #f9f9f9;
      border-left: 4px solid #667eea;
      padding: 1rem;
      margin: 1rem 0;
      border-radius: 4px;
    }
    
    .demo-section {
      background: #f0f4ff;
      border: 2px solid #667eea;
      border-radius: 8px;
      padding: 1.5rem;
      margin: 2rem 0;
    }
    
    .demo-section h3 {
      margin-top: 0;
      color: #667eea;
    }
    
    .cta {
      text-align: center;
      margin-top: 3rem;
    }
    
    .btn {
      display: inline-block;
      padding: 0.75rem 2rem;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 0.5rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }
    
    .btn-secondary {
      background: #764ba2;
    }
    
    .features {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }
    
    .feature {
      background: #f9f9f9;
      padding: 1.5rem;
      border-radius: 8px;
      border-top: 3px solid #667eea;
    }
    
    .feature h4 {
      color: #667eea;
      margin-bottom: 0.5rem;
    }
    
    footer {
      text-align: center;
      color: white;
      padding: 2rem 0;
      opacity: 0.9;
    }
    
    footer a {
      color: white;
      text-decoration: underline;
    }
    
    ul {
      list-style-position: inside;
      margin: 1rem 0;
    }
    
    ul li {
      margin: 0.5rem 0;
    }
    
    @media (prefers-color-scheme: dark) {
      body {
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      }
      
      .content {
        background: #1e1e1e;
        color: #e0e0e0;
      }
      
      .section h2 {
        color: #8b9aff;
      }
      
      .section h3 {
        color: #a78bfa;
      }
      
      code {
        background: #2d2d2d;
        color: #d4d4d4;
      }
      
      .example {
        background: #2d2d2d;
      }
      
      .demo-section {
        background: #1a1a2e;
        border-color: #8b9aff;
      }
      
      .feature {
        background: #2d2d2d;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 LittleCMS</h1>
      <p>Git-powered CMS for Static Sites</p>
    </header>
    
    <div class="content">
      <div class="section">
        <h2>What is LittleCMS?</h2>
        <p>
          LittleCMS is a self-hostable, Git-powered content management system that allows you to manage content 
          directly in your GitHub repositories. Edit content, sync across multiple sites, and deploy with confidence.
        </p>
        
        <div class="features">
          <div class="feature">
            <h4>📝 Git-powered</h4>
            <p>All content stored in GitHub repositories</p>
          </div>
          <div class="feature">
            <h4>🔒 Secure</h4>
            <p>GitHub App authentication with granular permissions</p>
          </div>
          <div class="feature">
            <h4>⚡ Fast</h4>
            <p>Built on Cloudflare Workers for global edge deployment</p>
          </div>
          <div class="feature">
            <h4>🎨 Flexible</h4>
            <p>Embed GitHub files directly in your HTML pages</p>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h2>Live Embed Examples</h2>
        <p>See LittleCMS in action! These examples are rendered live from GitHub:</p>
        
        <div class="demo-section">
          <h3>Example 1: Markdown File</h3>
          <p>This markdown file is embedded directly from GitHub:</p>
          <pre><code>&lt;script src="${baseUrl}/?githubUrl=https://raw.githubusercontent.com/linq84/gitshow/main/readme.md"&gt;&lt;/script&gt;</code></pre>
          
          <div class="example">
            <script src="${baseUrl}/?githubUrl=https://raw.githubusercontent.com/linq84/gitshow/main/readme.md"></script>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h2>How to Use</h2>
        
        <h3>Embedding Content</h3>
        <p>Add this script tag anywhere in your HTML to embed GitHub content:</p>
        <pre><code>&lt;script src="${baseUrl}/?githubUrl=https://raw.githubusercontent.com/user/repo/main/file.md"&gt;&lt;/script&gt;</code></pre>
        
        <h3>Supported Formats</h3>
        <ul>
          <li><strong>Markdown (.md)</strong> - Rendered as HTML</li>
          <li><strong>Code files</strong> - Syntax highlighted (JS, TS, Python, etc.)</li>
          <li><strong>Plain text</strong> - Displayed as formatted text</li>
        </ul>
        
        <h3>URL Formats</h3>
        <p>You can use either format:</p>
        <pre><code>${baseUrl}/?githubUrl=https://raw.githubusercontent.com/user/repo/main/file.md
${baseUrl}/?githubUrl=https://github.com/user/repo/blob/main/file.md</code></pre>
      </div>
      
      <div class="section">
        <h2>Features</h2>
        <ul>
          <li>✅ <strong>Git-powered</strong>: All content stored in GitHub repositories</li>
          <li>✅ <strong>Self-hostable</strong>: Deploy to your own Cloudflare Workers account</li>
          <li>✅ <strong>GitHub App Authentication</strong>: Secure, installation-based access</li>
          <li>✅ <strong>Automated CI/CD</strong>: GitHub Actions for builds and deployments</li>
          <li>✅ <strong>Admin UI</strong>: Modern React-based admin interface</li>
          <li>✅ <strong>Multi-repo Support</strong>: Manage content across multiple repositories</li>
        </ul>
      </div>
      
      <div class="cta">
        <a href="/admin" class="btn">🚀 Try Admin UI</a>
        <a href="https://github.com/littlewebco/little-cms" class="btn btn-secondary" target="_blank">📚 View on GitHub</a>
      </div>
    </div>
    
    <footer>
      <p>Built with ❤️ by <a href="https://little.cloud">Little Cloud</a></p>
    </footer>
  </div>
</body>
</html>`;
}
