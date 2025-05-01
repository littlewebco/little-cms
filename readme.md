# GitShow - Embed GitHub Files Easily

GitShow is a helpful tool offered by [Little](https://little.cloud) that allows you to easily embed and display the content of public GitHub files directly within your HTML pages.

Simply add a script tag pointing to our hosted worker, and the content will appear right where you put the tag.

## Features

*   Embeds content from public GitHub files.
*   Renders Markdown (`.md`).
*   Formats code (`.js`, `.py`, etc.) in `<pre><code>` blocks.
*   Displays plain text.

## Quick Usage (Recommended)

The easiest way to use GitShow is by referencing our hosted worker URL. Just include the following script tag in your HTML:

```html
<script src="https://gitshow.am8.dev?githubUrl=PUBLIC_GITHUB_FILE_URL"></script>
```

Replace `PUBLIC_GITHUB_FILE_URL` with the **raw** URL of the public GitHub file you want to embed (e.g., `https://raw.githubusercontent.com/user/repo/branch/file.md`).

**Live Example:**

To embed this README file, you would use:
```html
<script src="https://gitshow.am8.dev?githubUrl=https://raw.githubusercontent.com/linq84/gitshow/main/readme.md"></script>
```

## Self-Hosting (Optional)

This repository contains the source code (`gitshow_worker.js` and `wrangler.toml`) for the Cloudflare Worker that powers GitShow. You are welcome to fork this repository and deploy your own instance if needed, but for most users, the hosted version is recommended for simplicity and reliability.

---

For more information about Little and other tools, please visit [https://little.cloud](https://little.cloud). 