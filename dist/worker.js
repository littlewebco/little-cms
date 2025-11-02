"use strict";
(() => {
  // src/worker/utils/html.ts
  function escapeHtml(unsafe) {
    if (typeof unsafe !== "string") return "";
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  // src/worker/utils/markdown.ts
  function renderMarkdown(md) {
    let html = md.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/^###### (.*$)/gim, "<h6>$1</h6>").replace(/^##### (.*$)/gim, "<h5>$1</h5>").replace(/^#### (.*$)/gim, "<h4>$1</h4>").replace(/^### (.*$)/gim, "<h3>$1</h3>").replace(/^## (.*$)/gim, "<h2>$1</h2>").replace(/^# (.*$)/gim, "<h1>$1</h1>").replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>").replace(/__(.*?)__/gim, "<strong>$1</strong>").replace(/\*(.*?)\*/gim, "<em>$1</em>").replace(/_(.*?)_/gim, "<em>$1</em>").replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>').replace(/```(\w+)?\n([\s\S]*?)?\n```/gim, (match, lang, code) => {
      const languageClass = lang ? ` class="language-${lang}"` : "";
      const escapedCode = code || "";
      return `<pre><code${languageClass}>${escapedCode.trim()}</code></pre>`;
    }).replace(/`([^`]+)`/gim, "<code>$1</code>").replace(/^\s*([\*\-\+])\s+(.*)/gim, "<ul>\n<li>$2</li>\n</ul>").replace(/^\s*(\d+)\.\s+(.*)/gim, "<ol>\n<li>$2</li>\n</ol>").replace(/<\/ul>\n<ul>/gim, "").replace(/<\/ol>\n<ol>/gim, "");
    html = html.split("\n").map((line) => {
      line = line.trim();
      if (line.length === 0 || line.match(/^<\/?(h[1-6]|ul|ol|li|pre|code|a|strong|em)/)) {
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

  // src/worker/handlers/admin.ts
  async function handleAdmin(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace("/admin", "") || "/";
    if (path === "/auth/callback") {
      return Response.redirect(`${url.origin}/api/auth/callback${url.search}`, 302);
    }
    if (path === "/" || path === "/index.html") {
      return new Response(
        `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LittleCMS Admin</title>
    <script type="module" crossorigin src="/assets/index-ClJ6TX0_.js"><\/script>
    <link rel="stylesheet" crossorigin href="/assets/index-H3luEsyq.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
        {
          headers: {
            "Content-Type": "text/html"
          }
        }
      );
    }
    return new Response("Not Found", { status: 404 });
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
        "Accept": "application/json"
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
      throw new Error(`Token exchange failed: ${response.status} ${error}`);
    }
    const data = await response.json();
    return data.access_token;
  }
  async function getGitHubUser(token) {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `token ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "LittleCMS"
      }
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get user: ${response.status} ${error}`);
    }
    return response.json();
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
    const sessions = envVars.SESSIONS;
    const appUrl = envVars.APP_URL || url.origin;
    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "GitHub OAuth not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    switch (action) {
      case "login": {
        const redirectUri = `${appUrl}/admin/auth/callback`;
        const state = generateSessionId();
        const scope = "repo";
        if (sessions) {
          await sessions.put(`oauth_state_${state}`, "1", { expirationTtl: 3600 });
        }
        const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
        return Response.redirect(githubAuthUrl, 302);
      }
      case "callback": {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code) {
          return new Response("Missing code parameter", { status: 400 });
        }
        if (!state) {
          return new Response("Missing state parameter", { status: 400 });
        }
        if (sessions) {
          const stateValid = await sessions.get(`oauth_state_${state}`);
          if (!stateValid) {
            return new Response("Invalid state parameter", { status: 400 });
          }
          await sessions.delete(`oauth_state_${state}`);
        }
        try {
          const redirectUri = `${appUrl}/admin/auth/callback`;
          const token = await exchangeCodeForToken(code, clientId, clientSecret, redirectUri);
          const user = await getGitHubUser(token);
          const sessionId = generateSessionId();
          const session = {
            token,
            user,
            expiresAt: Date.now() + 3600 * 24 * 7 * 1e3
            // 7 days
          };
          if (sessions) {
            await storeSession(sessions, sessionId, session);
          }
          return new Response(null, {
            status: 302,
            headers: {
              "Location": "/admin",
              "Set-Cookie": createSessionCookie(sessionId)
            }
          });
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
    return { user: session.user, token: session.token };
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
  async function handleContentAPI(request, env) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts.length < 3 || pathParts[0] !== "api" || pathParts[1] !== "content") {
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
    const repoName = pathParts[2];
    const filePath = pathParts.slice(3).join("/") || "";
    if (filePath.includes("..") || filePath.includes("~") || filePath.startsWith("/")) {
      return new Response(
        JSON.stringify({ error: "Invalid path" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    const github = new GitHubAPI(auth.token);
    const [owner, repo] = repoName.split("/");
    if (!owner || !repo) {
      return new Response("Invalid repository name", { status: 400 });
    }
    try {
      switch (request.method) {
        case "GET":
          if (filePath) {
            const file = await github.getFile(owner, repo, filePath);
            return new Response(JSON.stringify(file), {
              headers: { "Content-Type": "application/json" }
            });
          } else {
            const files = await github.getDirectory(owner, repo, ".");
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

  // src/worker/index.ts
  addEventListener("fetch", (event) => {
    event.respondWith(handleRequest(event.request, event.env));
  });
  async function handleRequest(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" && url.searchParams.has("githubUrl")) {
      return handleEmbed(request);
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
    if (url.pathname.startsWith("/api/content")) {
      return handleContentAPI(request, env);
    }
    return new Response("Not Found", { status: 404 });
  }
  var worker_default = {
    fetch: handleRequest
  };
})();
