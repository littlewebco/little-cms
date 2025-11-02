/**
 * Markdown rendering utility for LittleCMS
 * Converts markdown to HTML
 */
export function renderMarkdown(md: string): string {
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
    // Links [text](url) - with security attributes
    .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Code blocks (```lang\ncode\n```)
    .replace(/```(\w+)?\n([\s\S]*?)?\n```/gim, (match, lang, code) => {
      const languageClass = lang ? ` class="language-${lang}"` : '';
      const escapedCode = code || '';
      return `<pre><code${languageClass}>${escapedCode.trim()}</code></pre>`;
    })
    // Inline code (`code`) - needs to be after block code
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    // Lists (unordered *, -, +; ordered 1.)
    .replace(/^\s*([\*\-\+])\s+(.*)/gim, '<ul>\n<li>$2</li>\n</ul>')
    .replace(/^\s*(\d+)\.\s+(.*)/gim, '<ol>\n<li>$2</li>\n</ol>')
    // Combine adjacent list items
    .replace(/<\/ul>\n<ul>/gim, '')
    .replace(/<\/ol>\n<ol>/gim, '');

  // Wrap paragraphs
  html = html.split('\n').map(line => {
    line = line.trim();
    if (line.length === 0 || line.match(/^<\/?(h[1-6]|ul|ol|li|pre|code|a|strong|em)/)) {
      return line;
    }
    // Avoid wrapping lines in pre blocks
    if (html.substring(html.indexOf(line) - 10, html.indexOf(line)).includes('<pre>')) {
      return line;
    }
    return `<p>${line}</p>`;
  }).join('\n')
    .replace(/\n{2,}/g, '\n');

  return html;
}

