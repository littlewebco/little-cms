/**
 * API client for LittleCMS admin
 */
import type { GitHubUser, AuthSession } from '@/types/auth';

const API_BASE = '/api';

export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `API request failed: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Auth endpoints
  auth: {
    login: (code: string) =>
      apiRequest<{ token: string }>('/auth/callback', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    logout: () => apiRequest('/auth/logout', { method: 'POST' }),
    me: () => apiRequest<{ user: GitHubUser }>('/auth/me'),
    session: () => apiRequest<AuthSession>('/auth/session'),
  },

  // Repository endpoints
  repos: {
    list: () => apiRequest<{ repos: Array<{
      id: number;
      name: string;
      full_name: string;
      owner: string;
      private: boolean;
      description: string | null;
      default_branch: string;
      selected: boolean;
    }> }>('/repos/list'),
    select: (repos: string[]) => apiRequest<{ success: boolean; repos: string[] }>('/repos/select', {
      method: 'POST',
      body: JSON.stringify({ repos }),
    }),
    selected: () => apiRequest<{ repos: string[] }>('/repos/selected'),
  },

  // Preview endpoints
  preview: {
    render: (markdown: string, repo?: string, filePath?: string) =>
      apiRequest<{ html: string }>('/preview', {
        method: 'POST',
        body: JSON.stringify({ markdown, repo, filePath }),
      }),
  },

  // Content endpoints
  // repo format: "owner/repo" (e.g., "littlewebco/little-blog")
  content: {
    list: (repo: string, path?: string) => {
      const [owner, repoName] = repo.split('/');
      if (!owner || !repoName) {
        throw new Error('Invalid repository format. Expected "owner/repo"');
      }
      const url = `/content/${owner}/${repoName}`;
      if (path) {
        return apiRequest(`${url}?path=${encodeURIComponent(path)}`);
      }
      return apiRequest(url);
    },
    get: (repo: string, path: string) => {
      const [owner, repoName] = repo.split('/');
      if (!owner || !repoName) {
        throw new Error('Invalid repository format. Expected "owner/repo"');
      }
      // Split path by / and encode each segment separately to preserve slashes
      const pathSegments = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
      return apiRequest(`/content/${owner}/${repoName}/${pathSegments}`);
    },
    create: (repo: string, path: string, content: string, message: string) => {
      const [owner, repoName] = repo.split('/');
      if (!owner || !repoName) {
        throw new Error('Invalid repository format. Expected "owner/repo"');
      }
      const pathSegments = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
      return apiRequest(`/content/${owner}/${repoName}/${pathSegments}`, {
        method: 'POST',
        body: JSON.stringify({ content, message }),
      });
    },
    update: (repo: string, path: string, content: string, message: string) => {
      const [owner, repoName] = repo.split('/');
      if (!owner || !repoName) {
        throw new Error('Invalid repository format. Expected "owner/repo"');
      }
      const pathSegments = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
      return apiRequest(`/content/${owner}/${repoName}/${pathSegments}`, {
        method: 'PUT',
        body: JSON.stringify({ content, message }),
      });
    },
    delete: (repo: string, path: string, message: string) => {
      const [owner, repoName] = repo.split('/');
      if (!owner || !repoName) {
        throw new Error('Invalid repository format. Expected "owner/repo"');
      }
      const pathSegments = path.split('/').map(segment => encodeURIComponent(segment)).join('/');
      return apiRequest(`/content/${owner}/${repoName}/${pathSegments}`, {
        method: 'DELETE',
        body: JSON.stringify({ message }),
      });
    },
  },
};

