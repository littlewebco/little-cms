/**
 * File type detection utility for LittleCMS
 */
export function isCodeFile(extension: string, contentType: string | null): boolean {
  const codeExtensions = [
    'js', 'ts', 'py', 'java', 'c', 'cpp', 'go', 'rb', 'php', 'cs',
    'swift', 'kt', 'rs', 'sh', 'css', 'html', 'xml', 'json', 'yaml', 'sql'
  ];
  
  return codeExtensions.includes(extension) ||
    contentType?.startsWith('text/') === true ||
    contentType?.includes('application/json') === true ||
    contentType?.includes('application/xml') === true;
}

