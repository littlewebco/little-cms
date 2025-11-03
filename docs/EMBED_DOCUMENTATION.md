# LittleCMS Embed Documentation

Complete guide to using and styling the LittleCMS embed renderer on your website.

## 📚 Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Basic Usage](#basic-usage)
4. [Advanced Usage](#advanced-usage)
5. [Styling Guide](#styling-guide)
6. [Customization Examples](#customization-examples)
7. [Supported File Types](#supported-file-types)
8. [Troubleshooting](#troubleshooting)

---

## Overview

LittleCMS Embed is a lightweight JavaScript embed system that allows you to render GitHub files directly in your HTML pages. Content is fetched from GitHub and rendered on-the-fly, providing a seamless way to display documentation, blog posts, code examples, and more without managing static files.

### Key Features

- ✅ **Zero Dependencies**: No frameworks or libraries required
- ✅ **GitHub Integration**: Fetch files directly from GitHub repositories
- ✅ **Multiple Formats**: Support for Markdown, code files, and plain text
- ✅ **Automatic Rendering**: Content is automatically converted to HTML
- ✅ **Syntax Highlighting**: Code files are syntax-highlighted automatically
- ✅ **Fully Customizable**: Easy to style with CSS

---

## Tech Stack

### Architecture

LittleCMS Embed is built on a modern serverless architecture:

#### Backend (Cloudflare Workers)

- **Runtime**: Cloudflare Workers (Edge Computing)
- **Language**: TypeScript
- **Deployment**: Edge-deployed globally for low latency
- **Key Libraries**:
  - `marked` - Markdown parsing and rendering
  - `highlight.js` - Syntax highlighting for code blocks

#### Frontend (Embed Script)

- **Technology**: Vanilla JavaScript (no dependencies)
- **Execution**: Immediately Invoked Function Expression (IIFE)
- **DOM Manipulation**: Uses `document.currentScript` for precise insertion
- **Browser Support**: All modern browsers (ES2020+)

### How It Works

1. **Script Tag Loads**: Browser requests the embed script from LittleCMS
2. **Content Fetching**: LittleCMS Worker fetches the file from GitHub
3. **Content Processing**: File is processed based on its type:
   - Markdown → HTML conversion
   - Code files → Syntax highlighting
   - Plain text → HTML escaping
4. **Dynamic Insertion**: Script creates a `<div>` and inserts rendered content
5. **Script Removal**: Original script tag is removed from DOM

### Data Flow

```
User's Website
    ↓
<script src="https://cms.little.cloud/?githubUrl=...">
    ↓
Cloudflare Worker (Edge)
    ↓
Fetch from GitHub (raw.githubusercontent.com)
    ↓
Process Content (Markdown/Code/Text)
    ↓
Return JavaScript with HTML
    ↓
Browser executes script
    ↓
Content inserted into DOM
```

---

## Basic Usage

### Simple Markdown Embed

The simplest way to embed content is to add a script tag pointing to a GitHub file:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Page</title>
</head>
<body>
  <h1>Welcome</h1>
  
  <!-- Embed a markdown file -->
  <script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/main/readme.md"></script>
  
  <footer>Footer content</footer>
</body>
</html>
```

### URL Formats

LittleCMS accepts two GitHub URL formats:

**Format 1: Raw GitHub URL** (Recommended)
```html
<script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/branch/path/to/file.md"></script>
```

**Format 2: GitHub.com URL** (Auto-converted)
```html
<script src="https://cms.little.cloud/?githubUrl=https://github.com/user/repo/blob/branch/path/to/file.md"></script>
```

### URL Parameters

- `githubUrl` (required): The GitHub URL to fetch
  - Must be from `github.com` or `raw.githubusercontent.com`
  - Can be a raw URL or a blob URL (will be auto-converted)

### Example: Embedding a Blog Post

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Blog</title>
</head>
<body>
  <header>
    <h1>My Blog</h1>
  </header>
  
  <main>
    <!-- Embed a blog post from GitHub -->
    <script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/username/blog-repo/main/posts/2024-01-15-my-first-post.md"></script>
  </main>
  
  <footer>
    <p>&copy; 2024 My Blog</p>
  </footer>
</body>
</html>
```

---

## Advanced Usage

### Multiple Embeds

You can embed multiple files on the same page:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Documentation</title>
</head>
<body>
  <h1>Documentation</h1>
  
  <section id="getting-started">
    <h2>Getting Started</h2>
    <script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/main/docs/getting-started.md"></script>
  </section>
  
  <section id="api-reference">
    <h2>API Reference</h2>
    <script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/main/docs/api.md"></script>
  </section>
  
  <section id="examples">
    <h2>Code Examples</h2>
    <script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/main/examples/example.js"></script>
  </section>
</body>
</html>
```

### Custom Containers

Wrap embeds in custom containers for better control:

```html
<div class="blog-post">
  <div class="blog-post-header">
    <h2>My Post Title</h2>
    <span class="date">January 15, 2024</span>
  </div>
  
  <div class="blog-post-content">
    <script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/main/posts/post.md"></script>
  </div>
  
  <div class="blog-post-footer">
    <a href="#">Share</a>
  </div>
</div>
```

### Dynamic Loading

You can dynamically load embeds using JavaScript:

```javascript
function loadEmbed(githubUrl, containerId) {
  const script = document.createElement('script');
  script.src = `https://cms.little.cloud/?githubUrl=${encodeURIComponent(githubUrl)}`;
  
  const container = document.getElementById(containerId);
  if (container) {
    container.appendChild(script);
  }
}

// Load an embed when a button is clicked
document.getElementById('loadContent').addEventListener('click', () => {
  loadEmbed('https://raw.githubusercontent.com/user/repo/main/content.md', 'content-container');
});
```

---

## Styling Guide

### Default Structure

When content is embedded, LittleCMS creates a `<div>` element with the rendered HTML. The structure depends on the content type:

#### Markdown Content

Markdown is rendered with standard HTML tags:

```html
<div>
  <h1>Heading</h1>
  <p>Paragraph text</p>
  <ul>
    <li>List item</li>
  </ul>
  <pre><code class="language-javascript">code</code></pre>
  <img src="..." alt="..." />
</div>
```

#### Code Files

Code files are wrapped in `<pre><code>` tags:

```html
<div>
  <pre><code class="language-javascript">
    // Your code here
  </code></pre>
</div>
```

### CSS Classes

LittleCMS uses standard HTML tags and classes that you can style:

#### Markdown Elements

- `h1`, `h2`, `h3`, `h4`, `h5`, `h6` - Headings
- `p` - Paragraphs
- `ul`, `ol` - Lists
- `li` - List items
- `strong`, `em` - Bold and italic text
- `a` - Links
- `blockquote` - Blockquotes
- `pre` - Code blocks
- `code` - Inline code
- `img` - Images
- `table`, `thead`, `tbody`, `tr`, `th`, `td` - Tables

#### Code Highlighting Classes

Code blocks use `highlight.js` classes:

- `language-javascript` - JavaScript
- `language-typescript` - TypeScript
- `language-python` - Python
- `language-html` - HTML
- `language-css` - CSS
- `language-json` - JSON
- And many more...

### Basic Styling Example

```css
/* Style the container that wraps embedded content */
.littlecms-embed {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #333;
}

/* Style headings */
.littlecms-embed h1 {
  font-size: 2.5rem;
  margin-top: 2rem;
  margin-bottom: 1rem;
  color: #1a1a1a;
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 0.5rem;
}

.littlecms-embed h2 {
  font-size: 2rem;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  color: #2a2a2a;
}

.littlecms-embed h3 {
  font-size: 1.5rem;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  color: #3a3a3a;
}

/* Style paragraphs */
.littlecms-embed p {
  margin-bottom: 1rem;
  line-height: 1.8;
}

/* Style links */
.littlecms-embed a {
  color: #0066cc;
  text-decoration: underline;
}

.littlecms-embed a:hover {
  color: #004499;
}

/* Style code blocks */
.littlecms-embed pre {
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  overflow-x: auto;
  margin: 1rem 0;
}

.littlecms-embed code {
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.littlecms-embed pre code {
  background: transparent;
  padding: 0;
  border: none;
}

/* Style inline code */
.littlecms-embed p code,
.littlecms-embed li code {
  background: #f0f0f0;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-size: 0.9em;
}

/* Style lists */
.littlecms-embed ul,
.littlecms-embed ol {
  margin: 1rem 0;
  padding-left: 2rem;
}

.littlecms-embed li {
  margin: 0.5rem 0;
}

/* Style blockquotes */
.littlecms-embed blockquote {
  border-left: 4px solid #ccc;
  margin: 1rem 0;
  padding-left: 1rem;
  color: #666;
  font-style: italic;
}

/* Style images */
.littlecms-embed img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 1rem 0;
}

/* Style tables */
.littlecms-embed table {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.littlecms-embed th,
.littlecms-embed td {
  border: 1px solid #ddd;
  padding: 0.5rem;
  text-align: left;
}

.littlecms-embed th {
  background: #f5f5f5;
  font-weight: bold;
}
```

### Using the Styles

Apply the styles by wrapping your embed in a container:

```html
<div class="littlecms-embed">
  <script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/main/post.md"></script>
</div>
```

Or use CSS descendant selectors:

```css
/* Target all embedded content */
body > div:has(script[src*="cms.little.cloud"]) {
  /* Styles here */
}
```

---

## Customization Examples

### Example 1: Blog Post Styling

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Blog</title>
  <style>
    .blog-post {
      max-width: 700px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    .blog-post h1 {
      font-size: 3rem;
      margin-bottom: 1rem;
      color: #1a1a1a;
    }
    
    .blog-post h2 {
      font-size: 2rem;
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: #333;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 0.5rem;
    }
    
    .blog-post p {
      font-size: 1.1rem;
      line-height: 1.8;
      margin-bottom: 1.5rem;
      color: #444;
    }
    
    .blog-post pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 1.5rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.5rem 0;
    }
    
    .blog-post code {
      font-family: 'Fira Code', monospace;
    }
    
    .blog-post img {
      width: 100%;
      border-radius: 8px;
      margin: 2rem 0;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
  </style>
</head>
<body>
  <article class="blog-post">
    <script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/main/posts/post.md"></script>
  </article>
</body>
</html>
```

### Example 2: Documentation Site

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Documentation</title>
  <style>
    .docs-container {
      display: grid;
      grid-template-columns: 250px 1fr;
      gap: 2rem;
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    .docs-sidebar {
      border-right: 1px solid #e0e0e0;
      padding-right: 2rem;
    }
    
    .docs-content {
      min-width: 0; /* Prevent grid overflow */
    }
    
    .docs-content h1 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
      color: #1a1a1a;
    }
    
    .docs-content h2 {
      font-size: 2rem;
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: #333;
      scroll-margin-top: 80px; /* For smooth scrolling */
    }
    
    .docs-content h3 {
      font-size: 1.5rem;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: #444;
    }
    
    .docs-content code {
      background: #f5f5f5;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    
    .docs-content pre {
      background: #f8f8f8;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 1rem;
      overflow-x: auto;
    }
  </style>
</head>
<body>
  <div class="docs-container">
    <nav class="docs-sidebar">
      <h3>Navigation</h3>
      <ul>
        <li><a href="#getting-started">Getting Started</a></li>
        <li><a href="#api">API Reference</a></li>
      </ul>
    </nav>
    
    <main class="docs-content">
      <script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/main/docs/index.md"></script>
    </main>
  </div>
</body>
</html>
```

### Example 3: Dark Mode Support

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Site</title>
  <style>
    /* Light mode (default) */
    .content {
      color: #333;
      background: #fff;
    }
    
    .content pre {
      background: #f5f5f5;
      color: #333;
    }
    
    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .content {
        color: #e0e0e0;
        background: #1a1a1a;
      }
      
      .content h1,
      .content h2,
      .content h3 {
        color: #fff;
      }
      
      .content pre {
        background: #2d2d2d;
        color: #d4d4d4;
      }
      
      .content code {
        background: #2d2d2d;
        color: #d4d4d4;
      }
      
      .content a {
        color: #7cb3f0;
      }
    }
    
    /* Manual dark mode toggle */
    .dark .content {
      color: #e0e0e0;
      background: #1a1a1a;
    }
  </style>
</head>
<body>
  <div class="content">
    <script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/main/content.md"></script>
  </div>
</body>
</html>
```

### Example 4: Responsive Design

```css
.embed-container {
  width: 100%;
  padding: 1rem;
}

/* Mobile-first approach */
@media (min-width: 768px) {
  .embed-container {
    max-width: 768px;
    margin: 0 auto;
    padding: 2rem;
  }
}

@media (min-width: 1024px) {
  .embed-container {
    max-width: 1024px;
  }
}

/* Responsive typography */
.embed-container h1 {
  font-size: 2rem;
}

@media (min-width: 768px) {
  .embed-container h1 {
    font-size: 2.5rem;
  }
}

/* Responsive code blocks */
.embed-container pre {
  font-size: 0.875rem;
}

@media (min-width: 768px) {
  .embed-container pre {
    font-size: 1rem;
  }
}
```

---

## Supported File Types

### Markdown Files

**Extensions**: `.md`, `.markdown`

**Rendered as**: HTML with syntax highlighting for code blocks

**Features**:
- Headings (H1-H6)
- Paragraphs
- Lists (ordered and unordered)
- Links
- Images (with relative path resolution)
- Code blocks (syntax highlighted)
- Inline code
- Blockquotes
- Tables
- Horizontal rules

### Code Files

**Supported Languages**:
- JavaScript (`.js`)
- TypeScript (`.ts`)
- Python (`.py`)
- HTML (`.html`)
- CSS (`.css`)
- JSON (`.json`)
- And many more via `highlight.js`

**Rendered as**: Syntax-highlighted code blocks

**Example**:
```html
<script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/main/example.js"></script>
```

### Plain Text Files

**Extensions**: `.txt` and other text-based files

**Rendered as**: Preformatted text with HTML escaping

---

## Troubleshooting

### Content Not Loading

**Problem**: Script tag loads but content doesn't appear.

**Solutions**:
1. Check browser console for errors
2. Verify the GitHub URL is publicly accessible
3. Ensure the URL uses `raw.githubusercontent.com` or `github.com`
4. Check that the file exists at the specified path

### Styling Issues

**Problem**: Content appears but styling doesn't match your site.

**Solutions**:
1. Wrap embed in a container with specific CSS classes
2. Use more specific CSS selectors (e.g., `.container > div`)
3. Check for CSS conflicts with existing styles
4. Use `!important` sparingly if needed

### Code Highlighting Not Working

**Problem**: Code blocks appear but aren't syntax-highlighted.

**Solutions**:
1. Ensure file extension matches the language (`.js` for JavaScript)
2. Check that `highlight.js` is properly loaded (handled by LittleCMS)
3. Verify code blocks are properly formatted in markdown

### Images Not Displaying

**Problem**: Images in markdown don't show up.

**Solutions**:
1. Use absolute URLs for images (`https://example.com/image.jpg`)
2. For relative paths, ensure they're relative to the GitHub repository root
3. Check that images are publicly accessible

### Performance Issues

**Problem**: Page loads slowly when using embeds.

**Solutions**:
1. Limit the number of embeds per page
2. Use async/defer attributes (not supported, but script executes immediately)
3. Consider caching strategies
4. Optimize GitHub file sizes

### Cross-Origin Issues

**Problem**: Browser blocks the request.

**Solutions**:
1. Ensure your LittleCMS instance allows requests from your domain
2. Check CORS headers (handled by Cloudflare Workers)
3. Verify the script tag is loading from the correct domain

---

## Best Practices

### 1. Use Raw GitHub URLs

Always use `raw.githubusercontent.com` URLs when possible for better performance:

```html
<!-- Good -->
<script src="https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/main/file.md"></script>

<!-- Also works, but auto-converted -->
<script src="https://cms.little.cloud/?githubUrl=https://github.com/user/repo/blob/main/file.md"></script>
```

### 2. Wrap Embeds in Containers

Always wrap embeds in semantic containers:

```html
<!-- Good -->
<article class="blog-post">
  <script src="..."></script>
</article>

<!-- Less ideal -->
<script src="..."></script>
```

### 3. Use Semantic HTML

Structure your page with semantic HTML:

```html
<main>
  <article>
    <header>
      <h1>Post Title</h1>
    </header>
    <div class="content">
      <script src="..."></script>
    </div>
  </article>
</main>
```

### 4. Style Consistently

Create reusable CSS classes for embedded content:

```css
.littlecms-content {
  /* Base styles */
}

.littlecms-content.blog-post {
  /* Blog-specific styles */
}

.littlecms-content.docs {
  /* Documentation-specific styles */
}
```

### 5. Handle Errors Gracefully

Add error handling in your styles:

```css
.littlecms-error {
  border: 1px solid #ff0000;
  padding: 1rem;
  background: #ffe0e0;
  color: #cc0000;
}
```

### 6. Optimize for Accessibility

Ensure embedded content is accessible:

```html
<main role="main">
  <article aria-label="Blog post">
    <script src="..."></script>
  </article>
</main>
```

---

## Advanced: Custom Wrapper

If you need more control, you can wrap the embed script:

```html
<div id="content-wrapper" class="custom-content">
  <script>
    (function() {
      const wrapper = document.getElementById('content-wrapper');
      const script = document.createElement('script');
      script.src = 'https://cms.little.cloud/?githubUrl=https://raw.githubusercontent.com/user/repo/main/content.md';
      script.onerror = function() {
        wrapper.innerHTML = '<p>Error loading content. Please try again later.</p>';
      };
      wrapper.appendChild(script);
    })();
  </script>
</div>
```

---

## API Reference

### Endpoint

```
GET https://cms.little.cloud/?githubUrl={url}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `githubUrl` | string | Yes | GitHub URL to fetch (must be from `github.com` or `raw.githubusercontent.com`) |

### Response

Returns JavaScript code that:
1. Fetches content from GitHub
2. Processes content (markdown/code/text)
3. Inserts rendered HTML into DOM
4. Removes script tag

### Error Handling

If an error occurs, the script will:
- Log error to console
- Insert an error message div (if possible)
- Set `X-LittleCMS-Error` header

---

## Support

For issues, questions, or contributions:

- **GitHub**: https://github.com/littlewebco/little-cms
- **Documentation**: https://cms.little.cloud
- **Issues**: https://github.com/littlewebco/little-cms/issues

---

## License

LittleCMS is open source. Please refer to the repository for license information.

