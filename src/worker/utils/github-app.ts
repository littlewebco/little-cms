/**
 * GitHub App JWT utility for authenticating as a GitHub App
 */

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  SESSIONS?: KVNamespace;
}

/**
 * Encode DER length
 */
function encodeDERLength(length: number): Uint8Array {
  if (length < 128) {
    return new Uint8Array([length]);
  }
  // For lengths >= 128, use long form
  const lengthBytes: number[] = [];
  let len = length;
  while (len > 0) {
    lengthBytes.unshift(len & 0xff);
    len >>= 8;
  }
  return new Uint8Array([0x80 | lengthBytes.length, ...lengthBytes]);
}

/**
 * Convert PKCS#1 RSA private key to PKCS#8 format
 * PKCS#1: SEQUENCE { version, modulus, publicExponent, privateExponent, ... }
 * PKCS#8: SEQUENCE { version, AlgorithmIdentifier { algorithm, parameters }, PrivateKeyInfo }
 */
function convertPKCS1ToPKCS8(pkcs1Bytes: Uint8Array): Uint8Array {
  // RSA Algorithm Identifier OID: 1.2.840.113549.1.1.1
  // NULL parameters
  const rsaAlgorithmId = new Uint8Array([
    0x30, 0x0d, // SEQUENCE, length 13
    0x06, 0x09, // OID, length 9
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // 1.2.840.113549.1.1.1
    0x05, 0x00, // NULL
  ]);

  // PKCS#8 version = 0
  const version = new Uint8Array([0x02, 0x01, 0x00]); // INTEGER 0

  // Build OCTET STRING containing PKCS#1 key
  const pkcs1Length = pkcs1Bytes.length;
  const octetStringLengthBytes = encodeDERLength(pkcs1Length);
  const octetString = new Uint8Array(1 + octetStringLengthBytes.length + pkcs1Length);
  let offset = 0;
  octetString[offset++] = 0x04; // OCTET STRING
  octetString.set(octetStringLengthBytes, offset);
  offset += octetStringLengthBytes.length;
  octetString.set(pkcs1Bytes, offset);

  // Build inner sequence: version + algorithmId + octetString
  const versionLength = version.length;
  const algorithmIdLength = rsaAlgorithmId.length;
  const octetStringLength = octetString.length;
  const innerSequenceLength = versionLength + algorithmIdLength + octetStringLength;
  const innerSequenceLengthBytes = encodeDERLength(innerSequenceLength);

  // Build PKCS#8 structure
  const pkcs8 = new Uint8Array(
    1 + // SEQUENCE tag
    innerSequenceLengthBytes.length + // length encoding
    innerSequenceLength // actual content
  );
  
  offset = 0;
  pkcs8[offset++] = 0x30; // SEQUENCE
  pkcs8.set(innerSequenceLengthBytes, offset);
  offset += innerSequenceLengthBytes.length;

  // Version
  pkcs8.set(version, offset);
  offset += version.length;

  // Algorithm Identifier
  pkcs8.set(rsaAlgorithmId, offset);
  offset += rsaAlgorithmId.length;

  // OCTET STRING containing PKCS#1 key
  pkcs8.set(octetString, offset);

  return pkcs8;
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
  const isPKCS8 = privateKey.includes('BEGIN PRIVATE KEY') && !privateKey.includes('BEGIN RSA PRIVATE KEY');
  const isPKCS1 = privateKey.includes('BEGIN RSA PRIVATE KEY');
  
  // Import the key for signing
  // Cloudflare Workers Web Crypto API requires PKCS#8 format
  let cryptoKey: CryptoKey;
  try {
    if (isPKCS8) {
      // Already PKCS#8 format
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
    } else if (isPKCS1) {
      // PKCS#1 format - convert to PKCS#8
      const pkcs8Bytes = convertPKCS1ToPKCS8(keyBytes);
      cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        pkcs8Bytes,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        false,
        ['sign']
      );
    } else {
      throw new Error('Unknown key format. Expected BEGIN PRIVATE KEY (PKCS#8) or BEGIN RSA PRIVATE KEY (PKCS#1)');
    }
  } catch (error) {
    // If import fails, provide helpful error message
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    // Check if it's a conversion error or import error
    if (errorMsg.includes('PKCS#1') || errorMsg.includes('PKCS#8')) {
      throw error;
    }
    throw new Error(`Failed to import private key: ${errorMsg}. Please ensure the key is a valid RSA private key in PKCS#1 or PKCS#8 format.`);
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
 * List all installations for the GitHub App
 */
export async function listInstallations(
  appId: string,
  privateKey: string
): Promise<Array<{
  id: number;
  account: { login: string; type: string };
  repository_selection: string;
  permissions: Record<string, string>;
}>> {
  const jwt = await generateAppJWT(appId, privateKey);

  const response = await fetch('https://api.github.com/app/installations', {
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'LittleCMS',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list installations: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Get repositories accessible to an installation
 * Uses installation token for authentication (more reliable than JWT)
 */
export async function getInstallationRepos(
  appId: string,
  privateKey: string,
  installationId: string
): Promise<Array<{ id: number; name: string; full_name: string; private: boolean; default_branch: string }>> {
  // Get installation token first (more reliable than using JWT directly)
  const installationToken = await getInstallationToken(appId, privateKey, installationId);

  // Use installation token to fetch repositories
  const response = await fetch(`https://api.github.com/installation/repositories`, {
    headers: {
      'Authorization': `Bearer ${installationToken}`,
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
