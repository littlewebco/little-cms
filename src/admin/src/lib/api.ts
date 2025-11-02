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

  // Content endpoints
  content: {
    list: (repo: string, path?: string) =>
      apiRequest(`/content/${repo}${path ? `?path=${path}` : ''}`),
    get: (repo: string, path: string) =>
      apiRequest(`/content/${repo}/${encodeURIComponent(path)}`),
    create: (repo: string, path: string, content: string) =>
      apiRequest(`/content/${repo}/${encodeURIComponent(path)}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    update: (repo: string, path: string, content: string) =>
      apiRequest(`/content/${repo}/${encodeURIComponent(path)}`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),
    delete: (repo: string, path: string) =>
      apiRequest(`/content/${repo}/${encodeURIComponent(path)}`, {
        method: 'DELETE',
      }),
  },
};

