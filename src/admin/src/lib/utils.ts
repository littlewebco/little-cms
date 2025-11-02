import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { api } from './api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface MarkdownFile {
  name: string;
  path: string;
  sha: string;
  repo: string;
}

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
}

/**
 * Parse front matter from markdown content
 */
export function parseFrontMatter(content: string): Record<string, any> {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontMatterRegex);

  if (!match) {
    return {};
  }

  const frontMatterText = match[1];
  const frontMatter: Record<string, any> = {};
  
  frontMatterText.split('\n').forEach((line) => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      // Try to parse as number or boolean
      if (value === 'true') {
        frontMatter[key] = true;
      } else if (value === 'false') {
        frontMatter[key] = false;
      } else if (!isNaN(Number(value)) && value !== '') {
        frontMatter[key] = Number(value);
      } else {
        // Remove quotes if present
        value = value.replace(/^["']|["']$/g, '');
        frontMatter[key] = value;
      }
    }
  });

  return frontMatter;
}

/**
 * Fetch front matter for a markdown file
 */
export async function getFileFrontMatter(repo: string, path: string): Promise<Record<string, any>> {
  try {
    const fileData = await api.content.get(repo, path) as any;
    let content = '';
    
    // Decode base64 content if needed
    if (fileData.content) {
      try {
        content = atob(fileData.content);
      } catch {
        content = fileData.content;
      }
    } else if (fileData.download_url) {
      const response = await fetch(fileData.download_url);
      content = await response.text();
    }
    
    if (content) {
      return parseFrontMatter(content);
    }
  } catch (error) {
    console.error(`Error fetching front matter for ${repo}/${path}:`, error);
  }
  
  return {};
}

/**
 * Recursively fetch all markdown files from /posts directory in a repository
 */
export async function getAllMarkdownFiles(repo: string, path: string = 'posts'): Promise<MarkdownFile[]> {
  const markdownFiles: MarkdownFile[] = [];
  
  try {
    // Ensure we're starting from /posts
    const searchPath = path || 'posts';
    
    // Validate path is within /posts
    if (!searchPath.startsWith('posts') && searchPath !== 'posts') {
      console.warn(`Path ${searchPath} is outside /posts directory, skipping`);
      return markdownFiles;
    }
    
    const files = await api.content.list(repo, searchPath || undefined) as GitHubFile[];
    
    for (const file of files) {
      if (file.type === 'dir') {
        // Recursively fetch files from subdirectories (only within /posts)
        const subFiles = await getAllMarkdownFiles(repo, file.path);
        markdownFiles.push(...subFiles);
      } else if (file.type === 'file' && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
        // Only add markdown files that are within /posts
        if (file.path.startsWith('posts/') || file.path === 'posts') {
          markdownFiles.push({
            name: file.name,
            path: file.path,
            sha: file.sha,
            repo,
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching files from ${repo}/${path}:`, error);
    // Continue with other files/directories even if one fails
  }
  
  return markdownFiles;
}

