// src/worker/utils/html.ts
function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// src/worker/utils/markdown.ts
function renderMarkdown(md, repo, filePath) {
  let html = md.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/^###### (.*$)/gim, "<h6>$1</h6>").replace(/^##### (.*$)/gim, "<h5>$1</h5>").replace(/^#### (.*$)/gim, "<h4>$1</h4>").replace(/^### (.*$)/gim, "<h3>$1</h3>").replace(/^## (.*$)/gim, "<h2>$1</h2>").replace(/^# (.*$)/gim, "<h1>$1</h1>").replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>").replace(/__(.*?)__/gim, "<strong>$1</strong>").replace(/\*(.*?)\*/gim, "<em>$1</em>").replace(/_(.*?)_/gim, "<em>$1</em>").replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>').replace(/!\[(.*?)\]\((.*?)\)/gim, (match, alt, url) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return `<img src="${url}" alt="${alt}" />`;
    }
    if (repo) {
      const [owner, repoName] = repo.split("/");
      const branch = "main";
      let imagePath = url;
      if (filePath && !url.startsWith("/")) {
        const fileDir = filePath.substring(0, filePath.lastIndexOf("/"));
        if (fileDir) {
          imagePath = `${fileDir}/${url}`;
        } else {
          imagePath = url;
        }
      }
      const githubRawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${imagePath}`;
      return `<img src="${githubRawUrl}" alt="${alt}" />`;
    }
    return `<img src="${url}" alt="${alt}" />`;
  }).replace(/```(\w+)?\n([\s\S]*?)?\n```/gim, (match, lang, code) => {
    const languageClass = lang ? ` class="language-${lang}"` : "";
    const escapedCode = code || "";
    return `<pre><code${languageClass}>${escapedCode.trim()}</code></pre>`;
  }).replace(/`([^`]+)`/gim, "<code>$1</code>").replace(/^\s*([\*\-\+])\s+(.*)/gim, "<ul>\n<li>$2</li>\n</ul>").replace(/^\s*(\d+)\.\s+(.*)/gim, "<ol>\n<li>$2</li>\n</ol>").replace(/<\/ul>\n<ul>/gim, "").replace(/<\/ol>\n<ol>/gim, "");
  html = html.split("\n").map((line) => {
    line = line.trim();
    if (line.length === 0 || line.match(/^<\/?(h[1-6]|ul|ol|li|pre|code|a|strong|em|img)/)) {
      return line;
    }
    if (html.substring(html.indexOf(line) - 10, html.indexOf(line)).includes("<pre>")) {
      return line;
    }
    return `<p>${line}</p>`;
  }).join("\n").replace(/\n{2,}/g, "\n");
  return html;
}

// src/worker/utils/file.ts
function isCodeFile(extension, contentType) {
  const codeExtensions = [
    "js",
    "ts",
    "py",
    "java",
    "c",
    "cpp",
    "go",
    "rb",
    "php",
    "cs",
    "swift",
    "kt",
    "rs",
    "sh",
    "css",
    "html",
    "xml",
    "json",
    "yaml",
    "sql"
  ];
  return codeExtensions.includes(extension) || contentType?.startsWith("text/") === true || contentType?.includes("application/json") === true || contentType?.includes("application/xml") === true;
}

// src/worker/handlers/embed.ts
async function handleEmbed(request) {
  const url = new URL(request.url);
  const githubUrl = url.searchParams.get("githubUrl");
  if (!githubUrl) {
    return new Response(
      "Error: Missing required 'githubUrl' query parameter.",
      { status: 400 }
    );
  }
  let parsedGithubUrl;
  try {
    parsedGithubUrl = new URL(githubUrl);
    const allowedDomains = ["github.com", "raw.githubusercontent.com"];
    if (!allowedDomains.includes(parsedGithubUrl.hostname)) {
      return new Response(
        `Error: Invalid GitHub domain. Only github.com and raw.githubusercontent.com are allowed.`,
        { status: 400 }
      );
    }
  } catch (e) {
    const error = e;
    return new Response(
      `Error: Invalid 'githubUrl' format: ${error.message}`,
      { status: 400 }
    );
  }
  try {
    let fetchUrl = githubUrl;
    if (parsedGithubUrl.hostname === "github.com") {
      fetchUrl = githubUrl.replace("github.com", "raw.githubusercontent.com").replace("/blob/", "/");
    }
    const githubResponse = await fetch(fetchUrl);
    if (!githubResponse.ok) {
      const errorText = await githubResponse.text();
      return new Response(
        `Error fetching from GitHub (${githubResponse.status}): ${githubResponse.statusText}. URL: ${fetchUrl}. Details: ${errorText}`,
        { status: githubResponse.status }
      );
    }
    const contentType = githubResponse.headers.get("content-type");
    const pathSegments = parsedGithubUrl.pathname.split("/");
    const fileName = pathSegments[pathSegments.length - 1];
    const fileExtension = fileName.includes(".") ? fileName.split(".").pop()?.toLowerCase() || "" : "";
    const fileContent = await githubResponse.text();
    let renderedContent = "";
    if (fileExtension === "md" || contentType?.includes("text/markdown")) {
      renderedContent = renderMarkdown(fileContent);
    } else if (isCodeFile(fileExtension, contentType)) {
      renderedContent = `<pre><code class="language-${fileExtension}">${escapeHtml(fileContent)}</code></pre>`;
    } else {
      renderedContent = `<pre>${escapeHtml(fileContent)}</pre>`;
    }
    return new Response(`
      (function() {
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = \`${renderedContent.replace(/`/g, "\\`")}\`;

        const scriptTag = document.currentScript;

        if (scriptTag) {
          scriptTag.parentNode.insertBefore(contentDiv, scriptTag);
          scriptTag.remove();
        } else {
          console.warn('LittleCMS: Could not find the initiating script tag. Appending content to body.');
          document.body.appendChild(contentDiv);
        }
      })();
    `, {
      headers: { "Content-Type": "text/javascript" }
    });
  } catch (error) {
    const err = error;
    console.error("LittleCMS Worker Error:", err);
    const errorMessage = `Error processing request: ${err.message}`;
    return new Response(`
      (function() {
        const errorDiv = document.createElement('div');
        errorDiv.style.color = 'red';
        errorDiv.style.border = '1px solid red';
        errorDiv.style.padding = '10px';
        errorDiv.textContent = 'LittleCMS Error: ${escapeHtml(errorMessage)}';
        const scriptTag = document.currentScript;
        if (scriptTag) {
          scriptTag.parentNode.insertBefore(errorDiv, scriptTag);
          scriptTag.remove();
        } else {
          console.error('LittleCMS Error:', '${escapeHtml(errorMessage)}');
          document.body.appendChild(errorDiv);
        }
      })();
    `, {
      headers: {
        "Content-Type": "text/javascript",
        "X-LittleCMS-Error": "true"
      },
      status: 500
    });
  }
}

// src/worker/handlers/homepage.ts
async function handleHomepage(request) {
  try {
    const url = new URL(request.url);
    const baseUrl = url.origin;
    const html = `<!DOCTYPE html>
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
      <h1>\u{1F680} LittleCMS</h1>
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
            <h4>\u{1F4DD} Git-powered</h4>
            <p>All content stored in GitHub repositories</p>
          </div>
          <div class="feature">
            <h4>\u{1F512} Secure</h4>
            <p>GitHub App authentication with granular permissions</p>
          </div>
          <div class="feature">
            <h4>\u26A1 Fast</h4>
            <p>Built on Cloudflare Workers for global edge deployment</p>
          </div>
          <div class="feature">
            <h4>\u{1F3A8} Flexible</h4>
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
          <li>\u2705 <strong>Git-powered</strong>: All content stored in GitHub repositories</li>
          <li>\u2705 <strong>Self-hostable</strong>: Deploy to your own Cloudflare Workers account</li>
          <li>\u2705 <strong>GitHub App Authentication</strong>: Secure, installation-based access</li>
          <li>\u2705 <strong>Automated CI/CD</strong>: GitHub Actions for builds and deployments</li>
          <li>\u2705 <strong>Admin UI</strong>: Modern React-based admin interface</li>
          <li>\u2705 <strong>Multi-repo Support</strong>: Manage content across multiple repositories</li>
        </ul>
      </div>
      
      <div class="cta">
        <a href="/admin" class="btn">\u{1F680} Try Admin UI</a>
        <a href="https://github.com/littlewebco/little-cms" class="btn btn-secondary" target="_blank">\u{1F4DA} View on GitHub</a>
      </div>
    </div>
    
    <footer>
      <p>Built with \u2764\uFE0F by <a href="https://little.cloud">Little Cloud</a></p>
    </footer>
  </div>
</body>
</html>`;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8"
      }
    });
  } catch (error) {
    const err = error;
    return new Response(`Error generating homepage: ${err.message}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" }
    });
  }
}

// src/worker/handlers/admin.ts
var INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LittleCMS Admin</title>
    <link rel="icon" type="image/svg+xml" href="/logo.svg" />
    <script type="module" crossorigin src="/assets/index-B4CC0YaQ.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-KAWaKXx9.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>

`;
async function handleAdmin(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace("/admin", "") || "/";
  if (path === "/auth/callback") {
    return Response.redirect(`${url.origin}/api/auth/callback${url.search}`, 302);
  }
  if (path === "/" || path === "/index.html") {
    return new Response(INDEX_HTML, {
      headers: {
        "Content-Type": "text/html"
      }
    });
  }
  return new Response("Not Found", { status: 404 });
}

// src/worker/utils/github-app.ts
function encodeDERLength(length) {
  if (length < 128) {
    return new Uint8Array([length]);
  }
  const lengthBytes = [];
  let len = length;
  while (len > 0) {
    lengthBytes.unshift(len & 255);
    len >>= 8;
  }
  return new Uint8Array([128 | lengthBytes.length, ...lengthBytes]);
}
function convertPKCS1ToPKCS8(pkcs1Bytes) {
  const rsaAlgorithmId = new Uint8Array([
    48,
    13,
    // SEQUENCE, length 13
    6,
    9,
    // OID, length 9
    42,
    134,
    72,
    134,
    247,
    13,
    1,
    1,
    1,
    // 1.2.840.113549.1.1.1
    5,
    0
    // NULL
  ]);
  const version = new Uint8Array([2, 1, 0]);
  const pkcs1Length = pkcs1Bytes.length;
  const octetStringLengthBytes = encodeDERLength(pkcs1Length);
  const octetString = new Uint8Array(1 + octetStringLengthBytes.length + pkcs1Length);
  let offset = 0;
  octetString[offset++] = 4;
  octetString.set(octetStringLengthBytes, offset);
  offset += octetStringLengthBytes.length;
  octetString.set(pkcs1Bytes, offset);
  const versionLength = version.length;
  const algorithmIdLength = rsaAlgorithmId.length;
  const octetStringLength = octetString.length;
  const innerSequenceLength = versionLength + algorithmIdLength + octetStringLength;
  const innerSequenceLengthBytes = encodeDERLength(innerSequenceLength);
  const pkcs8 = new Uint8Array(
    1 + // SEQUENCE tag
    innerSequenceLengthBytes.length + // length encoding
    innerSequenceLength
    // actual content
  );
  offset = 0;
  pkcs8[offset++] = 48;
  pkcs8.set(innerSequenceLengthBytes, offset);
  offset += innerSequenceLengthBytes.length;
  pkcs8.set(version, offset);
  offset += version.length;
  pkcs8.set(rsaAlgorithmId, offset);
  offset += rsaAlgorithmId.length;
  pkcs8.set(octetString, offset);
  return pkcs8;
}
async function generateAppJWT(appId, privateKey) {
  let keyData = privateKey.replace(/-----BEGIN RSA PRIVATE KEY-----/g, "").replace(/-----END RSA PRIVATE KEY-----/g, "").replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const isPKCS8 = privateKey.includes("BEGIN PRIVATE KEY") && !privateKey.includes("BEGIN RSA PRIVATE KEY");
  const isPKCS1 = privateKey.includes("BEGIN RSA PRIVATE KEY");
  let cryptoKey;
  try {
    if (isPKCS8) {
      cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        keyBytes,
        {
          name: "RSASSA-PKCS1-v1_5",
          hash: "SHA-256"
        },
        false,
        ["sign"]
      );
    } else if (isPKCS1) {
      const pkcs8Bytes = convertPKCS1ToPKCS8(keyBytes);
      cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        pkcs8Bytes,
        {
          name: "RSASSA-PKCS1-v1_5",
          hash: "SHA-256"
        },
        false,
        ["sign"]
      );
    } else {
      throw new Error("Unknown key format. Expected BEGIN PRIVATE KEY (PKCS#8) or BEGIN RSA PRIVATE KEY (PKCS#1)");
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    if (errorMsg.includes("PKCS#1") || errorMsg.includes("PKCS#8")) {
      throw error;
    }
    throw new Error(`Failed to import private key: ${errorMsg}. Please ensure the key is a valid RSA private key in PKCS#1 or PKCS#8 format.`);
  }
  const header = {
    alg: "RS256",
    typ: "JWT"
  };
  const now = Math.floor(Date.now() / 1e3);
  const payload = {
    iss: appId,
    // Issuer (GitHub App ID)
    iat: now,
    // Issued at
    exp: now + 600
    // Expires in 10 minutes
  };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signatureBytes = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes))).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${signatureInput}.${signature}`;
}
async function getInstallationToken(appId, privateKey, installationId) {
  const jwt = await generateAppJWT(appId, privateKey);
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "LittleCMS"
    }
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get installation token: ${response.status} ${error}`);
  }
  const data = await response.json();
  return data.token;
}
async function getInstallation2(appId, privateKey, installationId) {
  const jwt = await generateAppJWT(appId, privateKey);
  const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "LittleCMS"
    }
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get installation: ${response.status} ${error}`);
  }
  return response.json();
}
async function getInstallationRepos(appId, privateKey, installationId) {
  const installationToken = await getInstallationToken(appId, privateKey, installationId);
  const response = await fetch(`https://api.github.com/installation/repositories`, {
    headers: {
      "Authorization": `Bearer ${installationToken}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "LittleCMS"
    }
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get installation repositories: ${response.status} ${error}`);
  }
  const data = await response.json();
  return data.repositories || [];
}
async function storeInstallation2(sessions, installationId, userIdOrLogin, repos, ttl = 3600 * 24 * 365) {
  await sessions.put(`installation_${installationId}`, JSON.stringify({ userIdOrLogin, repos }), {
    expirationTtl: ttl
  });
  const userKey = typeof userIdOrLogin === "string" ? userIdOrLogin : `user_${userIdOrLogin}`;
  const userInstallationsKey = `user_installations_${userKey}`;
  const existingData = await sessions.get(userInstallationsKey);
  let installations = [];
  if (existingData) {
    try {
      installations = JSON.parse(existingData);
    } catch {
      installations = [];
    }
  }
  if (!installations.includes(installationId)) {
    installations.push(installationId);
    await sessions.put(userInstallationsKey, JSON.stringify(installations), {
      expirationTtl: ttl
    });
  }
}
async function getInstallationInfo(sessions, installationId) {
  const data = await sessions.get(`installation_${installationId}`);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
async function getUserInstallations(sessions, userKey) {
  const key = typeof userKey === "string" ? userKey : `user_${userKey}`;
  const data = await sessions.get(`user_installations_${key}`);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// src/worker/handlers/auth.ts
function generateSessionId() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function storeSession(sessions, sessionId, session, ttl = 3600 * 24 * 7) {
  await sessions.put(sessionId, JSON.stringify(session), {
    expirationTtl: ttl
  });
}
async function getSession(sessions, sessionId) {
  const data = await sessions.get(sessionId);
  if (!data) return null;
  const session = JSON.parse(data);
  if (session.expiresAt < Date.now()) {
    await sessions.delete(sessionId);
    return null;
  }
  return session;
}
async function exchangeCodeForToken(code, clientId, clientSecret, redirectUri) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "LittleCMS"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code: ${response.status} ${error}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`OAuth error: ${data.error_description || data.error}`);
  }
  if (!data.access_token) {
    throw new Error("No access token received from GitHub");
  }
  return data.access_token;
}
async function getGitHubUserFromOAuth(token) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "LittleCMS"
    }
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user: ${response.status} ${error}`);
  }
  const userData = await response.json();
  let email = "";
  try {
    const emailResponse = await fetch("https://api.github.com/user/emails", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "LittleCMS"
      }
    });
    if (emailResponse.ok) {
      const emails = await emailResponse.json();
      const primaryEmail = emails.find((e) => e.primary);
      email = primaryEmail?.email || emails[0]?.email || "";
    }
  } catch {
  }
  return {
    login: userData.login,
    id: userData.id,
    avatar_url: userData.avatar_url || "",
    name: userData.name || userData.login,
    email
  };
}
function getSessionFromCookie(request) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith("littlecms_session="));
  if (!sessionCookie) return null;
  return sessionCookie.split("=")[1];
}
function createSessionCookie(sessionId, maxAge = 3600 * 24 * 7) {
  return `littlecms_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function clearSessionCookie() {
  return "littlecms_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
async function handleAuth(request, env) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts.length < 3 || pathParts[0] !== "api" || pathParts[1] !== "auth") {
    return new Response("Invalid auth path", { status: 400 });
  }
  const action = pathParts[2];
  const envVars = env || {};
  const clientId = envVars.GITHUB_CLIENT_ID || "";
  const clientSecret = envVars.GITHUB_CLIENT_SECRET || "";
  const appId = envVars.GITHUB_APP_ID || "";
  const privateKey = envVars.GITHUB_APP_PRIVATE_KEY || "";
  const sessions = envVars.SESSIONS;
  const appUrl = envVars.APP_URL || url.origin;
  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: "GitHub OAuth not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  switch (action) {
    case "login": {
      const state = generateSessionId();
      const returnUrl = url.searchParams.get("return_url") || "/admin";
      const redirectUri = `${url.origin}/api/auth/callback`;
      if (sessions) {
        await sessions.put(`oauth_state_${state}`, returnUrl, { expirationTtl: 600 });
      }
      const oauthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user%20user:email%20public_repo&state=${encodeURIComponent(state)}`;
      return Response.redirect(oauthUrl, 302);
    }
    case "link": {
      if (!sessions) {
        return new Response(
          JSON.stringify({ error: "Sessions not configured" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      const existingSessionId = getSessionFromCookie(request);
      if (!existingSessionId) {
        return new Response(
          JSON.stringify({ error: "Unauthorized. Please install the GitHub App first." }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      const existingSession = await getSession(sessions, existingSessionId);
      if (!existingSession) {
        return new Response(
          JSON.stringify({ error: "Session expired. Please install the GitHub App again." }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      let installationId = null;
      if (request.method === "POST") {
        try {
          const body = await request.json();
          installationId = body.installation_id || null;
        } catch {
        }
      }
      installationId = installationId || url.searchParams.get("installation_id");
      if (!installationId) {
        return new Response(
          JSON.stringify({ error: "Missing installation_id parameter" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      try {
        const installation = await getInstallation2(appId, privateKey, installationId);
        const repos = await getInstallationRepos(appId, privateKey, installationId);
        const repoFullNames = repos.map((r) => r.full_name);
        if (installation.account.login !== existingSession.user.login) {
          return new Response(
            JSON.stringify({ error: "Installation does not belong to your account" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
        const updatedInstallations = [...existingSession.installations];
        if (!updatedInstallations.includes(installationId)) {
          updatedInstallations.push(installationId);
        }
        const updatedSession = {
          ...existingSession,
          installations: updatedInstallations
        };
        if (sessions) {
          await storeInstallation2(sessions, installationId, existingSession.user.login, repoFullNames);
          await storeSession(sessions, existingSessionId, updatedSession);
        }
        if (request.method === "GET") {
          const redirectUrl = `${url.origin}/admin`;
          return new Response(null, {
            status: 302,
            headers: {
              "Location": redirectUrl
            }
          });
        }
        return new Response(
          JSON.stringify({
            success: true,
            user: existingSession.user,
            installation: {
              id: installation.id,
              account: installation.account,
              repos: repoFullNames.length
            }
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          }
        );
      } catch (error) {
        const err = error;
        return new Response(
          JSON.stringify({ error: err.message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
    case "installations": {
      if (!sessions) {
        return new Response(
          JSON.stringify({ error: "Sessions not configured" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: "Unauthorized", installations: [] }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      const session = await getSession(sessions, sessionId);
      if (!session) {
        return new Response(
          JSON.stringify({ error: "Session expired", installations: [] }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      const userInstallations = await getUserInstallations(sessions, session.user.login);
      if (userInstallations.length === 0) {
        return new Response(
          JSON.stringify({ installations: [] }),
          {
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      try {
        const installationsList = await Promise.all(
          userInstallations.map(async (installationId) => {
            try {
              const installation = await getInstallation2(appId, privateKey, installationId);
              return {
                id: installation.id,
                account: installation.account,
                repository_selection: installation.repository_selection
              };
            } catch {
              return null;
            }
          })
        );
        return new Response(
          JSON.stringify({
            installations: installationsList.filter((inst) => inst !== null)
          }),
          {
            headers: { "Content-Type": "application/json" }
          }
        );
      } catch (error) {
        const err = error;
        return new Response(
          JSON.stringify({ error: err.message, installations: [] }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
    case "callback": {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const installationId = url.searchParams.get("installation_id");
      const setupAction = url.searchParams.get("setup_action");
      if (installationId) {
        if (!sessions) {
          return new Response("Sessions not configured", { status: 500 });
        }
        const sessionId = getSessionFromCookie(request);
        if (!sessionId) {
          const returnUrl = encodeURIComponent(url.pathname + url.search);
          return Response.redirect(`${url.origin}/api/auth/login?return_url=${returnUrl}`, 302);
        }
        const session = await getSession(sessions, sessionId);
        if (!session) {
          const returnUrl = encodeURIComponent(url.pathname + url.search);
          return Response.redirect(`${url.origin}/api/auth/login?return_url=${returnUrl}`, 302);
        }
        if (!appId || !privateKey) {
          return new Response(
            JSON.stringify({ error: "GitHub App not configured" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
        try {
          const installation = await getInstallation2(appId, privateKey, installationId);
          if (installation.account.type === "User" && installation.account.login !== session.user.login) {
            return new Response(
              JSON.stringify({ error: "Installation does not belong to your account" }),
              {
                status: 403,
                headers: { "Content-Type": "application/json" }
              }
            );
          }
          const repos = await getInstallationRepos(appId, privateKey, installationId);
          const repoFullNames = repos.map((r) => r.full_name);
          const updatedInstallations = [...session.installations];
          if (!updatedInstallations.includes(installationId)) {
            updatedInstallations.push(installationId);
          }
          const updatedSession = {
            ...session,
            installations: updatedInstallations
          };
          await storeInstallation2(sessions, installationId, session.user.login, repoFullNames);
          await storeSession(sessions, sessionId, updatedSession);
          let redirectPath = "/admin";
          if (state) {
            try {
              const decodedState = decodeURIComponent(state);
              if (decodedState.startsWith("/")) {
                redirectPath = decodedState;
              }
            } catch {
            }
          }
          return new Response(null, {
            status: 302,
            headers: {
              "Location": `${url.origin}${redirectPath}`
            }
          });
        } catch (error) {
          const err = error;
          return new Response(
            JSON.stringify({ error: `GitHub App installation failed: ${err.message}` }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      }
      if (code && state) {
        if (!sessions) {
          return new Response("Sessions not configured", { status: 500 });
        }
        const storedReturnUrl = await sessions.get(`oauth_state_${state}`);
        if (!storedReturnUrl) {
          return new Response("Invalid or expired state parameter", { status: 400 });
        }
        try {
          const redirectUri = `${url.origin}/api/auth/callback`;
          const oauthToken = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);
          const user = await getGitHubUserFromOAuth(oauthToken);
          const sessionId = generateSessionId();
          const session = {
            user,
            expiresAt: Date.now() + 3600 * 24 * 7 * 1e3,
            // 7 days
            installations: []
            // Will be populated when GitHub App is installed
          };
          await storeSession(sessions, sessionId, session);
          await sessions.delete(`oauth_state_${state}`);
          const returnUrl = storedReturnUrl || "/admin";
          return new Response(null, {
            status: 302,
            headers: {
              "Location": `${url.origin}${returnUrl}`,
              "Set-Cookie": createSessionCookie(sessionId)
            }
          });
        } catch (error) {
          const err = error;
          return new Response(
            JSON.stringify({ error: `OAuth authentication failed: ${err.message}` }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      }
      return new Response("Missing required parameters (code or installation_id)", { status: 400 });
    }
    case "user": {
      return new Response("This endpoint is not used for GitHub App authentication", { status: 404 });
    }
    case "user-callback": {
      return new Response("This endpoint is not used for GitHub App authentication", { status: 404 });
    }
    case "logout": {
      const sessionId = getSessionFromCookie(request);
      if (sessionId && sessions) {
        await sessions.delete(sessionId);
      }
      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": clearSessionCookie()
          }
        }
      );
    }
    case "me": {
      if (!sessions) {
        return new Response(
          JSON.stringify({ error: "Sessions not configured" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return new Response(
          JSON.stringify({ error: "Not authenticated" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      const session = await getSession(sessions, sessionId);
      if (!session) {
        return new Response(
          JSON.stringify({ error: "Session expired" }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      return new Response(
        JSON.stringify({ user: session.user }),
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    case "session": {
      if (!sessions) {
        return new Response(
          JSON.stringify({ authenticated: false }),
          {
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      const sessionId = getSessionFromCookie(request);
      if (!sessionId) {
        return new Response(
          JSON.stringify({ authenticated: false }),
          {
            headers: { "Content-Type": "application/json" }
          }
        );
      }
      const session = await getSession(sessions, sessionId);
      return new Response(
        JSON.stringify({ authenticated: !!session, user: session?.user || null }),
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    default:
      return new Response("Invalid auth action", { status: 400 });
  }
}
async function getAuthenticatedUser(request, env) {
  const envVars = env || {};
  const sessions = envVars.SESSIONS;
  if (!sessions) return null;
  const sessionId = getSessionFromCookie(request);
  if (!sessionId) return null;
  const session = await getSession(sessions, sessionId);
  if (!session) return null;
  return { user: session.user, installations: session.installations };
}

// src/worker/utils/github.ts
var GitHubAPI = class {
  token;
  baseUrl = "https://api.github.com";
  constructor(token) {
    this.token = token;
  }
  async request(endpoint, options) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": `token ${this.token}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "LittleCMS",
        ...options?.headers
      }
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${error}`);
    }
    return response.json();
  }
  /**
   * Make a public GitHub API request (exposed for use in handlers)
   */
  async apiRequest(endpoint, options) {
    return this.request(endpoint, options);
  }
  /**
   * Get file contents
   */
  async getFile(owner, repo, path, ref = "main") {
    return this.request(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref}`
    );
  }
  /**
   * Get directory contents
   */
  async getDirectory(owner, repo, path, ref = "main") {
    return this.request(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref}`
    );
  }
  /**
   * Create or update file
   */
  async putFile(owner, repo, path, content, message, sha, branch = "main") {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const base64Content = btoa(String.fromCharCode(...data));
    const body = {
      message,
      content: base64Content,
      branch
    };
    if (sha) {
      body.sha = sha;
    }
    return this.request(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        method: "PUT",
        body: JSON.stringify(body)
      }
    );
  }
  /**
   * Delete file
   */
  async deleteFile(owner, repo, path, message, sha, branch = "main") {
    await this.request(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        method: "DELETE",
        body: JSON.stringify({
          message,
          sha,
          branch
        })
      }
    );
  }
};

// src/worker/handlers/content.ts
async function getTokenForRepo(repoFullName, userInstallations, env) {
  const appId = env.GITHUB_APP_ID;
  const privateKey = env.GITHUB_APP_PRIVATE_KEY;
  const sessions = env.SESSIONS;
  if (!appId || !privateKey || !sessions) {
    return null;
  }
  for (const installationId of userInstallations) {
    try {
      const installationInfo = await getInstallationInfo(sessions, installationId);
      if (installationInfo && installationInfo.repos.includes(repoFullName)) {
        const token = await getInstallationToken(appId, privateKey, installationId);
        return { token, installationId };
      }
    } catch (error) {
      console.error(`Error checking installation ${installationId}:`, error);
    }
  }
  return null;
}
async function handleContentAPI(request, env) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts.length < 4 || pathParts[0] !== "api" || pathParts[1] !== "content") {
    return new Response("Invalid API path", { status: 400 });
  }
  const auth = await getAuthenticatedUser(request, env);
  if (!auth) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  const owner = pathParts[2];
  const repo = pathParts[3];
  const filePath = decodeURIComponent(pathParts.slice(4).join("/")) || "";
  if (!owner || !repo) {
    return new Response("Invalid repository name", { status: 400 });
  }
  const repoFullName = `${owner}/${repo}`;
  if (filePath) {
    if (filePath.includes("..") || filePath.includes("~") || filePath.startsWith("/")) {
      return new Response(
        JSON.stringify({ error: "Invalid path" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    const normalizedPath = filePath.startsWith("./") ? filePath.slice(2) : filePath;
    if (normalizedPath !== "posts" && !normalizedPath.startsWith("posts/")) {
      return new Response(
        JSON.stringify({ error: "Path must be within /posts directory" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }
  const envVars = env || {};
  const sessions = envVars.SESSIONS;
  if (!sessions) {
    return new Response(
      JSON.stringify({ error: "Sessions not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  const userInstallations = await getUserInstallations(sessions, auth.user.login);
  if (userInstallations.length === 0) {
    return new Response(
      JSON.stringify({
        error: "No installations found",
        message: "Please install the GitHub App on your repositories first."
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  const tokenInfo = await getTokenForRepo(repoFullName, userInstallations, envVars);
  if (!tokenInfo) {
    return new Response(
      JSON.stringify({
        error: "Repository not accessible",
        message: "This repository is not accessible through any of your GitHub App installations."
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  const github = new GitHubAPI(tokenInfo.token);
  try {
    switch (request.method) {
      case "GET":
        if (filePath) {
          const file = await github.getFile(owner, repo, filePath);
          return new Response(JSON.stringify(file), {
            headers: { "Content-Type": "application/json" }
          });
        } else {
          const pathParam = url.searchParams.get("path");
          const directoryPath = pathParam || "posts";
          if (directoryPath !== "posts" && !directoryPath.startsWith("posts/")) {
            return new Response(
              JSON.stringify({ error: "Directory must be within /posts" }),
              {
                status: 403,
                headers: { "Content-Type": "application/json" }
              }
            );
          }
          const files = await github.getDirectory(owner, repo, directoryPath);
          return new Response(JSON.stringify(files), {
            headers: { "Content-Type": "application/json" }
          });
        }
      case "POST":
      case "PUT": {
        const body = await request.json();
        const { content, message } = body;
        if (!content || !message) {
          return new Response("Missing content or message", { status: 400 });
        }
        if (filePath !== "posts" && !filePath.startsWith("posts/")) {
          return new Response(
            JSON.stringify({ error: "Files must be created within /posts directory" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
        let sha;
        if (request.method === "PUT") {
          try {
            const existing = await github.getFile(owner, repo, filePath);
            sha = existing.sha;
          } catch {
          }
        }
        const result = await github.putFile(owner, repo, filePath, content, message, sha);
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" }
        });
      }
      case "DELETE": {
        if (filePath !== "posts" && !filePath.startsWith("posts/")) {
          return new Response(
            JSON.stringify({ error: "Files must be deleted from within /posts directory" }),
            {
              status: 403,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
        const file = await github.getFile(owner, repo, filePath);
        const body = await request.json();
        const { message } = body;
        if (!message) {
          return new Response("Missing message", { status: 400 });
        }
        await github.deleteFile(owner, repo, filePath, message, file.sha);
        return new Response("File deleted", { status: 200 });
      }
      default:
        return new Response("Method not allowed", { status: 405 });
    }
  } catch (error) {
    const err = error;
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

// src/worker/handlers/setup.ts
async function handleSetupAPI(request, env) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts.length < 3 || pathParts[0] !== "api" || pathParts[1] !== "setup") {
    return new Response("Invalid setup path", { status: 400 });
  }
  const action = pathParts[2];
  switch (action) {
    case "validate-cloudflare": {
      const body = await request.json();
      const { accountId, apiToken } = body;
      try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}`, {
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json"
          }
        });
        if (!response.ok) {
          return new Response(
            JSON.stringify({ valid: false, error: "Invalid credentials" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
        const data = await response.json();
        return new Response(
          JSON.stringify({ valid: true, account: data.result }),
          {
            headers: { "Content-Type": "application/json" }
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ valid: false, error: "Connection failed" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
    case "validate-github": {
      const body = await request.json();
      const { clientId, clientSecret } = body;
      try {
        if (!clientId || !clientSecret) {
          return new Response(
            JSON.stringify({ valid: false, error: "Missing credentials" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
        if (clientId.length < 10 || clientSecret.length < 10) {
          return new Response(
            JSON.stringify({ valid: false, error: "Invalid format" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
        return new Response(
          JSON.stringify({ valid: true, message: "Credentials format valid" }),
          {
            headers: { "Content-Type": "application/json" }
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ valid: false, error: "Validation failed" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
    case "oauth-instructions": {
      const appUrl = url.searchParams.get("appUrl") || "https://your-worker.workers.dev";
      const callbackUrl = `${appUrl}/admin/auth/callback`;
      const instructions = {
        steps: [
          {
            title: "Go to GitHub OAuth Apps",
            url: "https://github.com/settings/developers",
            description: "Navigate to Developer settings"
          },
          {
            title: "Create New OAuth App",
            action: 'Click "New OAuth App"',
            fields: {
              name: "LittleCMS",
              homepageUrl: appUrl.replace("/admin/auth/callback", ""),
              callbackUrl
            }
          },
          {
            title: "Copy Credentials",
            items: [
              "Copy the Client ID",
              "Generate and copy the Client Secret"
            ]
          }
        ],
        callbackUrl
      };
      return new Response(JSON.stringify(instructions), {
        headers: { "Content-Type": "application/json" }
      });
    }
    default:
      return new Response("Invalid setup action", { status: 400 });
  }
}

// src/worker/handlers/repos.ts
async function handleReposAPI(request, env) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts.length < 3 || pathParts[0] !== "api" || pathParts[1] !== "repos") {
    return new Response("Invalid API path", { status: 400 });
  }
  const auth = await getAuthenticatedUser(request, env);
  if (!auth) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  const action = pathParts[2];
  const envVars = env || {};
  const sessions = envVars.SESSIONS;
  const appId = envVars.GITHUB_APP_ID;
  const privateKey = envVars.GITHUB_APP_PRIVATE_KEY;
  if (!sessions || !appId || !privateKey) {
    return new Response(
      JSON.stringify({ error: "GitHub App not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
  switch (action) {
    case "list": {
      try {
        const userInstallations = await getUserInstallations(sessions, auth.user.login);
        if (userInstallations.length === 0) {
          return new Response(
            JSON.stringify({ repos: [] }),
            {
              headers: { "Content-Type": "application/json" }
            }
          );
        }
        const allRepos = /* @__PURE__ */ new Map();
        for (const installationId of userInstallations) {
          try {
            const repos = await getInstallationRepos(appId, privateKey, installationId);
            const installationInfo = await getInstallationInfo(sessions, installationId);
            const selectedRepos = installationInfo?.repos || [];
            for (const repo of repos) {
              if (!allRepos.has(repo.full_name)) {
                allRepos.set(repo.full_name, {
                  id: repo.id,
                  name: repo.name,
                  full_name: repo.full_name,
                  owner: repo.full_name.split("/")[0],
                  private: repo.private,
                  description: null,
                  // Installation API doesn't return description
                  default_branch: repo.default_branch
                });
              }
            }
          } catch (error) {
            console.error(`Error fetching repos for installation ${installationId}:`, error);
          }
        }
        const reposList = await Promise.all(
          Array.from(allRepos.values()).map(async (repo) => {
            let selected = false;
            for (const installationId of userInstallations) {
              const installationInfo = await getInstallationInfo(sessions, installationId);
              if (installationInfo && installationInfo.repos.includes(repo.full_name)) {
                selected = true;
                break;
              }
            }
            return {
              ...repo,
              selected
            };
          })
        );
        return new Response(
          JSON.stringify({ repos: reposList }),
          {
            headers: { "Content-Type": "application/json" }
          }
        );
      } catch (error) {
        const err = error;
        return new Response(
          JSON.stringify({ error: err.message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
    case "select": {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      try {
        const body = await request.json();
        const { repos, installationId } = body;
        if (!Array.isArray(repos)) {
          return new Response(
            JSON.stringify({ error: "Invalid request body. Expected { repos: string[], installationId?: string }" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
        const userInstallations = await getUserInstallations(sessions, auth.user.login);
        if (userInstallations.length === 0) {
          return new Response(
            JSON.stringify({ error: "No installations found. Please install the GitHub App first." }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
        const installationsToUpdate = installationId ? [installationId] : userInstallations;
        for (const instId of installationsToUpdate) {
          const installationInfo = await getInstallationInfo(sessions, instId);
          if (installationInfo) {
            await storeInstallation(sessions, instId, auth.user.login, repos);
          }
        }
        return new Response(
          JSON.stringify({ success: true, repos }),
          {
            headers: { "Content-Type": "application/json" }
          }
        );
      } catch (error) {
        const err = error;
        return new Response(
          JSON.stringify({ error: err.message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
    case "selected": {
      try {
        const userInstallations = await getUserInstallations(sessions, auth.user.login);
        const allSelectedRepos = [];
        for (const installationId of userInstallations) {
          const installationInfo = await getInstallationInfo(sessions, installationId);
          if (installationInfo && installationInfo.repos) {
            allSelectedRepos.push(...installationInfo.repos);
          }
        }
        const uniqueRepos = Array.from(new Set(allSelectedRepos));
        return new Response(
          JSON.stringify({ repos: uniqueRepos }),
          {
            headers: { "Content-Type": "application/json" }
          }
        );
      } catch (error) {
        const err = error;
        return new Response(
          JSON.stringify({ error: err.message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
    case "installations": {
      try {
        const userInstallations = await getUserInstallations(sessions, auth.user.login);
        const installationsList = [];
        for (const installationId of userInstallations) {
          try {
            const installation = await getInstallation(appId, privateKey, installationId);
            const installationInfo = await getInstallationInfo(sessions, installationId);
            const repos = await getInstallationRepos(appId, privateKey, installationId);
            installationsList.push({
              id: installation.id,
              account: installation.account,
              repository_selection: installation.repository_selection,
              repos_count: repos.length,
              selected_repos_count: installationInfo?.repos?.length || 0
            });
          } catch (error) {
            console.error(`Error fetching installation ${installationId}:`, error);
          }
        }
        return new Response(
          JSON.stringify({ installations: installationsList }),
          {
            headers: { "Content-Type": "application/json" }
          }
        );
      } catch (error) {
        const err = error;
        return new Response(
          JSON.stringify({ error: err.message }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }
    case "install-url": {
      const returnUrl = url.searchParams.get("return_url") || "/admin/settings";
      const installUrl = `https://github.com/apps/littlecms/installations/new?state=${encodeURIComponent(returnUrl)}`;
      return new Response(
        JSON.stringify({ url: installUrl }),
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    default:
      return new Response("Invalid action", { status: 400 });
  }
}

// src/worker/handlers/preview.ts
async function handlePreviewAPI(request, env) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const body = await request.json();
    const { markdown, repo, filePath } = body;
    if (!markdown || typeof markdown !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid markdown content" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    const html = renderMarkdown(markdown, repo, filePath);
    return new Response(
      JSON.stringify({ html }),
      {
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    const err = error;
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
}

// src/worker/index.ts
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/assets/")) {
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }
    }
    if (url.pathname === "/favicon.ico" || url.pathname === "/logo.svg") {
      if (env.ASSETS) {
        const logoPath = url.pathname === "/favicon.ico" ? "/logo.svg" : url.pathname;
        const assetRequest = new Request(new URL(logoPath, request.url), request);
        const assetResponse = await env.ASSETS.fetch(assetRequest);
        if (assetResponse.status !== 404) {
          if (url.pathname === "/favicon.ico") {
            return new Response(assetResponse.body, {
              headers: {
                "Content-Type": "image/svg+xml",
                ...assetResponse.headers
              }
            });
          }
          return assetResponse;
        }
      }
      return new Response("Not Found", { status: 404 });
    }
    if (url.pathname === "/" && url.searchParams.has("githubUrl")) {
      return handleEmbed(request);
    }
    if (url.pathname === "/") {
      return handleHomepage(request);
    }
    if (url.pathname.startsWith("/admin")) {
      return handleAdmin(request, env);
    }
    if (url.pathname.startsWith("/api/setup")) {
      return handleSetupAPI(request, env);
    }
    if (url.pathname.startsWith("/api/auth")) {
      return handleAuth(request, env);
    }
    if (url.pathname.startsWith("/api/repos")) {
      return handleReposAPI(request, env);
    }
    if (url.pathname.startsWith("/api/preview")) {
      return handlePreviewAPI(request, env);
    }
    if (url.pathname.startsWith("/api/content")) {
      return handleContentAPI(request, env);
    }
    return new Response("Not Found", { status: 404 });
  }
};
export {
  worker_default as default
};
