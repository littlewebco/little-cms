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
      // Try session endpoint first (more efficient)
      const session = await api.auth.session();
      if (session.authenticated && session.user) {
        return { user: session.user };
      }
      // Fallback to me endpoint
      return api.auth.me();
    },
    retry: false,
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
      // Redirect to login endpoint
      window.location.href = '/api/auth/login';
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

