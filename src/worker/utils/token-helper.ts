/**
 * Helper function to get installation token for a repository
 * Finds which installation has access to the repo and returns a token
 */
import { getAuthenticatedUser } from './handlers/auth.js';
import { getInstallationToken, getInstallationInfo, getInstallationRepos } from './utils/github-app.js';

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  SESSIONS?: KVNamespace;
}

/**
 * Get installation token for a specific repository
 * Returns the token and installation ID, or null if not found
 */
export async function getTokenForRepo(
  repoFullName: string,
  userInstallations: string[],
  env: Env
): Promise<{ token: string; installationId: string } | null> {
  const appId = env.GITHUB_APP_ID;
  const privateKey = env.GITHUB_APP_PRIVATE_KEY;
  const sessions = env.SESSIONS;

  if (!appId || !privateKey || !sessions) {
    return null;
  }

  // Check each installation to see if it has access to this repo
  for (const installationId of userInstallations) {
    try {
      const installationInfo = await getInstallationInfo(sessions, installationId);
      if (installationInfo && installationInfo.repos.includes(repoFullName)) {
        // This installation has access to the repo
        const token = await getInstallationToken(appId, privateKey, installationId);
        return { token, installationId };
      }
    } catch (error) {
      // Continue to next installation
      console.error(`Error checking installation ${installationId}:`, error);
    }
  }

  return null;
}

