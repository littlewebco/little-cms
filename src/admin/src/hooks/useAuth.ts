import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { GitHubUser } from '@/types/auth';

/**
 * Auth hook for LittleCMS
 */
export function useAuth() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      try {
        // Try session endpoint first (more efficient)
        const session = await api.auth.session();
        if (session.authenticated && session.user) {
          return { user: session.user };
        }
        // Session not authenticated, try me endpoint
        try {
          return await api.auth.me();
        } catch {
          // Not authenticated
          return null;
        }
      } catch (err: any) {
        // Session endpoint failed, try me endpoint
        if (err?.status === 401) {
          // Not authenticated, return null
          return null;
        }
        // Other error, try me endpoint
        try {
          return await api.auth.me();
        } catch {
          return null;
        }
      }
    },
    retry: false,
    // Don't throw errors - just return null for 401
    throwOnError: false,
  });

  return {
    user: data?.user as GitHubUser | undefined,
    isLoading,
    isAuthenticated: !!data?.user,
    error,
  };
}

/**
 * Login mutation
 */
export function useLogin() {
  return useMutation({
    mutationFn: async () => {
      // Redirect to GitHub App installation page
      window.location.href = 'https://github.com/apps/littlecms/installations/new';
    },
  });
}

/**
 * Logout mutation
 */
export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await api.auth.logout();
      window.location.href = '/admin';
    },
  });
}

