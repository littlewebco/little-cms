/**
 * GitHub API integration utilities
 */
export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

export interface GitHubCommit {
  message: string;
  content: string;
  sha?: string;
}

/**
 * GitHub API client
 */
export class GitHubAPI {
  private token: string;
  private baseUrl = 'https://api.github.com';

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'LittleCMS',
        ...options?.headers,
      },
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
  async getFile(owner: string, repo: string, path: string, ref = 'main'): Promise<GitHubFile> {
    return this.request<GitHubFile>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref}`
    );
  }

  /**
   * Get directory contents
   */
  async getDirectory(owner: string, repo: string, path: string, ref = 'main'): Promise<GitHubFile[]> {
    return this.request<GitHubFile[]>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${ref}`
    );
  }

  /**
   * Create or update file
   */
  async putFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string,
    branch = 'main'
  ): Promise<GitHubCommit> {
    // Base64 encode content (Cloudflare Workers compatible)
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const base64Content = btoa(String.fromCharCode(...data));

    const body: {
      message: string;
      content: string;
      branch?: string;
      sha?: string;
    } = {
      message,
      content: base64Content,
      branch,
    };

    if (sha) {
      body.sha = sha;
    }

    return this.request<GitHubCommit>(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    );
  }

  /**
   * Delete file
   */
  async deleteFile(
    owner: string,
    repo: string,
    path: string,
    message: string,
    sha: string,
    branch = 'main'
  ): Promise<void> {
    await this.request(
      `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({
          message,
          sha,
          branch,
        }),
      }
    );
  }
}

