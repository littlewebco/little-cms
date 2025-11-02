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
 * Recursively fetch all markdown files from a repository
 */
export async function getAllMarkdownFiles(repo: string, path: string = ''): Promise<MarkdownFile[]> {
  const markdownFiles: MarkdownFile[] = [];
  
  try {
    const files = await api.content.list(repo, path || undefined) as GitHubFile[];
    
    for (const file of files) {
      if (file.type === 'dir') {
        // Recursively fetch files from subdirectories
        const subFiles = await getAllMarkdownFiles(repo, file.path);
        markdownFiles.push(...subFiles);
      } else if (file.type === 'file' && (file.name.endsWith('.md') || file.name.endsWith('.markdown'))) {
        // Add markdown file with repo context
        markdownFiles.push({
          name: file.name,
          path: file.path,
          sha: file.sha,
          repo,
        });
      }
    }
  } catch (error) {
    console.error(`Error fetching files from ${repo}/${path}:`, error);
    // Continue with other files/directories even if one fails
  }
  
  return markdownFiles;
}

