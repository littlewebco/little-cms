/**
 * HTML escaping utility for LittleCMS
 * Ensures HTML is properly escaped for security
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (typeof unsafe !== 'string') return '';
  
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

