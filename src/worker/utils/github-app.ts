/**
 * GitHub App JWT utility for authenticating as a GitHub App
 */

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  SESSIONS?: KVNamespace;
}

/**
 * Generate a JWT token for GitHub App authentication
 * Uses RS256 algorithm with the app's private key
 */
export async function generateAppJWT(appId: string, privateKey: string): Promise<string> {
  // Parse the private key (handle both PEM formats)
  let keyData = privateKey
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, '')
    .replace(/-----END RSA PRIVATE KEY-----/g, '')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');

  // Decode base64 private key
  const keyBytes = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

  // Determine key format (PKCS#1 or PKCS#8)
  const isPKCS8 = privateKey.includes('BEGIN PRIVATE KEY');
  
  // Import the key for signing
  // Cloudflare Workers Web Crypto API requires PKCS#8 format
  // If we have PKCS#1, we'll need to convert it or handle it differently
  let cryptoKey: CryptoKey;
  try {
    if (isPKCS8) {
      cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        keyBytes,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        false,
        ['sign']
      );
    } else {
      // PKCS#1 format - Cloudflare Workers may not support this directly
      // Try importing as raw or convert format
      // For now, throw a helpful error suggesting conversion
      throw new Error('PKCS#1 format not directly supported. Please convert to PKCS#8 format or ensure your GitHub App key is in PKCS#8 format.');
    }
  } catch (error) {
    // If import fails, provide helpful error message
    throw new Error(`Failed to import private key: ${error instanceof Error ? error.message : 'Unknown error'}. Ensure the key is in PKCS#8 format (BEGIN PRIVATE KEY).`);
  }

  // Create JWT header
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  // Create JWT payload
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: appId, // Issuer (GitHub App ID)
    iat: now, // Issued at
    exp: now + 600, // Expires in 10 minutes
  };

  // Encode header and payload
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  // Create signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signatureBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  // Encode signature
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signatureInput}.${signature}`;
}

/**
 * Get installation token for a GitHub App installation
 */
export async function getInstallationToken(
  appId: string,
  privateKey: string,
  installationId: string
): Promise<string> {
  // Generate JWT for app authentication
  const jwt = await generateAppJWT(appId, privateKey);

  // Request installation token
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'LittleCMS',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get installation token: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.token;
}

/**
 * Get installation information
 */
export async function getInstallation(
  appId: string,
  privateKey: string,
  installationId: string
): Promise<{
  id: number;
  account: { login: string; type: string };
  repository_selection: string;
  repositories?: Array<{ id: number; name: string; full_name: string }>;
  permissions: Record<string, string>;
}> {
  const jwt = await generateAppJWT(appId, privateKey);

  const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'LittleCMS',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get installation: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Get repositories accessible to an installation
 */
export async function getInstallationRepos(
  appId: string,
  privateKey: string,
  installationId: string
): Promise<Array<{ id: number; name: string; full_name: string; private: boolean; default_branch: string }>> {
  const jwt = await generateAppJWT(appId, privateKey);

  const response = await fetch(`https://api.github.com/app/installations/${installationId}/repositories`, {
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'LittleCMS',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get installation repositories: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.repositories || [];
}

/**
 * Store installation → user mapping
 * Uses account login as user identifier (since installations don't provide user ID)
 */
export async function storeInstallation(
  sessions: KVNamespace,
  installationId: string,
  userIdOrLogin: number | string,
  repos: string[],
  ttl = 3600 * 24 * 365 // 1 year
): Promise<void> {
  await sessions.put(`installation_${installationId}`, JSON.stringify({ userIdOrLogin, repos }), {
    expirationTtl: ttl,
  });

  // Store user's installations list (using login as key)
  const userKey = typeof userIdOrLogin === 'string' ? userIdOrLogin : `user_${userIdOrLogin}`;
  const userInstallationsKey = `user_installations_${userKey}`;
  const existingData = await sessions.get(userInstallationsKey);
  let installations: string[] = [];
  if (existingData) {
    try {
      installations = JSON.parse(existingData);
    } catch {
      installations = [];
    }
  }
  if (!installations.includes(installationId)) {
    installations.push(installationId);
    await sessions.put(userInstallationsKey, JSON.stringify(installations), {
      expirationTtl: ttl,
    });
  }
}

/**
 * Get installation info from KV
 */
export async function getInstallationInfo(
  sessions: KVNamespace,
  installationId: string
): Promise<{ userIdOrLogin: number | string; repos: string[] } | null> {
  const data = await sessions.get(`installation_${installationId}`);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Get user's installations (by login or user ID)
 */
export async function getUserInstallations(
  sessions: KVNamespace,
  userKey: string | number
): Promise<string[]> {
  const key = typeof userKey === 'string' ? userKey : `user_${userKey}`;
  const data = await sessions.get(`user_installations_${key}`);
  if (!data) return [];

  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}
