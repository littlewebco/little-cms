/**
 * User type definitions
 */
export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name?: string;
  email?: string;
  html_url: string;
  type: string;
}

export interface AuthSession {
  authenticated: boolean;
  user: GitHubUser | null;
}

