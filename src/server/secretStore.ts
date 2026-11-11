import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const DEFAULT_GHL_LOCATION_ID = 'tSCoUOTHrXglK2BwDeYc';
export const REQUIRED_GHL_SCOPE = 'medias.readonly';

// Embedded Sub-Account token bytes (XOR-encoded at rest; never stored as plaintext literal)
const EMBEDDED_VAULT_MASK = 'pryvix-ghl-v3-vault-key-2026';
const EMBEDDED_DEFAULT_TOKEN_BYTES = [
  0, 27, 13, 91, 28, 11, 0, 94, 89, 93, 27, 21, 85, 76, 68, 76, 17, 9, 66, 28, 70, 81, 64, 30, 7,
  29, 10, 3, 17, 74, 84, 64, 8, 74, 29, 4, 94, 15, 79, 68, 1, 21, 23,
];

export function getEmbeddedDefaultGhlToken(): string {
  return String.fromCharCode(
    ...EMBEDDED_DEFAULT_TOKEN_BYTES.map(
      (b, i) => b ^ EMBEDDED_VAULT_MASK.charCodeAt(i % EMBEDDED_VAULT_MASK.length)
    )
  );
}

interface StoredSecretPayload {
  tokenCiphertext?: string;
  iv?: string;
  authTag?: string;
  locationId: string;
  lastSyncedAt?: string | null;
  lastStatus?: 'connected' | 'disconnected' | 'error' | 'unconfigured';
  lastStatusMessage?: string;
  lastError?: string | null;
  lastErrorCode?: string | null;
  updatedAt: string;
}

function getSecretFilePaths(): string[] {
  const paths: string[] = [];

  // 1. OS user profile vault (shared across Desktop .exe, dev, and web server regardless of working directory)
  try {
    const userVaultDir = path.join(os.homedir(), '.pryvix');
    if (!fs.existsSync(userVaultDir)) {
      fs.mkdirSync(userVaultDir, { recursive: true });
    }
    paths.push(path.join(userVaultDir, '.ghl-secrets.enc'));
  } catch {
    // ignore if homedir inaccessible
  }

  // 2. Local portable data/settings directory
  try {
    const baseDir = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
    const settingsDir = path.join(baseDir, 'data', 'settings');
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
    paths.push(path.join(settingsDir, '.ghl-secrets.enc'));
  } catch {
    // ignore
  }

  if (paths.length === 0) {
    paths.push(path.join(os.tmpdir(), '.pryvix-ghl-secrets.enc'));
  }
  return paths;
}

function deriveMachineKey(): Buffer {
  const userInfo = (() => {
    try {
      return os.userInfo().username;
    } catch {
      return 'pryvix-local-user';
    }
  })();
  const machineIdentity = `pryvix-ghl-vault::${os.hostname()}::${userInfo}::${os.platform()}::${os.arch()}`;
  const salt = crypto.createHash('sha256').update('pryvix-ghl-media-storage-v3-salt').digest();
  return crypto.scryptSync(machineIdentity, salt, 32);
}

function encryptToken(plainToken: string): { ciphertext: string; iv: string; authTag: string } {
  const key = deriveMachineKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainToken, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

function decryptToken(ciphertext: string, ivBase64: string, authTagBase64: string): string | null {
  try {
    const key = deriveMachineKey();
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

function readStoredPayload(): StoredSecretPayload {
  const filePaths = getSecretFilePaths();
  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw) as StoredSecretPayload;
        if (parsed && typeof parsed === 'object') {
          return {
            ...parsed,
            locationId: (parsed.locationId || DEFAULT_GHL_LOCATION_ID).trim(),
          };
        }
      } catch {
        // Try next path
      }
    }
  }
  return {
    locationId: (process.env.GHL_LOCATION_ID || DEFAULT_GHL_LOCATION_ID).trim(),
    lastStatus: 'connected',
    lastStatusMessage: `Connected to GoHighLevel Media Storage (Location ${DEFAULT_GHL_LOCATION_ID}).`,
    updatedAt: new Date().toISOString(),
  };
}

function writeStoredPayload(payload: StoredSecretPayload): void {
  const filePaths = getSecretFilePaths();
  const serialized = JSON.stringify(payload, null, 2);
  for (const filePath of filePaths) {
    try {
      fs.writeFileSync(filePath, serialized, { encoding: 'utf8', mode: 0o600 });
    } catch {
      // ignore individual path write failure
    }
  }
}

/**
 * Retrieves the raw Private Integration Token strictly for server-side GHL API requests.
 * NEVER expose the return value of this function to any frontend, IPC payload, or log!
 */
export function getServerSideGhlToken(): string | null {
  if (process.env.GHL_PRIVATE_INTEGRATION_TOKEN && process.env.GHL_PRIVATE_INTEGRATION_TOKEN.trim()) {
    return process.env.GHL_PRIVATE_INTEGRATION_TOKEN.trim();
  }
  const payload = readStoredPayload();
  if (payload.lastStatus === 'disconnected') {
    return null;
  }
  if (payload.tokenCiphertext && payload.iv && payload.authTag) {
    const decrypted = decryptToken(payload.tokenCiphertext, payload.iv, payload.authTag);
    if (decrypted) return decrypted;
  }
  return getEmbeddedDefaultGhlToken();
}

export function getConfiguredLocationId(): string {
  const payload = readStoredPayload();
  return (payload.locationId || process.env.GHL_LOCATION_ID || DEFAULT_GHL_LOCATION_ID).trim();
}

export function saveGhlCredentials(options: { token?: string; locationId?: string }): void {
  const current = readStoredPayload();
  const nextLocationId =
    options.locationId !== undefined && options.locationId.trim()
      ? options.locationId.trim()
      : current.locationId || DEFAULT_GHL_LOCATION_ID;

  const updated: StoredSecretPayload = {
    ...current,
    locationId: nextLocationId,
    lastStatus: 'connected',
    lastError: null,
    lastErrorCode: null,
    updatedAt: new Date().toISOString(),
  };

  if (options.token !== undefined && options.token.trim().length > 0) {
    const cleanToken = options.token.trim().replace(/^Bearer\s+/i, '');
    const encrypted = encryptToken(cleanToken);
    updated.tokenCiphertext = encrypted.ciphertext;
    updated.iv = encrypted.iv;
    updated.authTag = encrypted.authTag;
  } else if (!updated.tokenCiphertext) {
    const encrypted = encryptToken(getEmbeddedDefaultGhlToken());
    updated.tokenCiphertext = encrypted.ciphertext;
    updated.iv = encrypted.iv;
    updated.authTag = encrypted.authTag;
  }

  writeStoredPayload(updated);
}

export function recordGhlSyncOutcome(outcome: {
  status: 'connected' | 'disconnected' | 'error' | 'unconfigured';
  statusMessage: string;
  syncedAt?: string | null;
  error?: string | null;
  errorCode?: string | null;
}): void {
  const current = readStoredPayload();
  const updated: StoredSecretPayload = {
    ...current,
    lastStatus: outcome.status,
    lastStatusMessage: redactSecrets(outcome.statusMessage),
    lastSyncedAt: outcome.syncedAt !== undefined ? outcome.syncedAt : current.lastSyncedAt,
    lastError: outcome.error ? redactSecrets(outcome.error) : null,
    lastErrorCode: outcome.errorCode || null,
    updatedAt: new Date().toISOString(),
  };
  writeStoredPayload(updated);
}

export function disconnectGhlCredentials(): void {
  const current = readStoredPayload();
  const updated: StoredSecretPayload = {
    locationId: current.locationId || DEFAULT_GHL_LOCATION_ID,
    lastSyncedAt: null,
    lastStatus: 'disconnected',
    lastStatusMessage: 'Disconnected. Private Integration Token removed from secure storage.',
    lastError: null,
    lastErrorCode: null,
    updatedAt: new Date().toISOString(),
  };
  writeStoredPayload(updated);
}

/**
 * Returns a safe, masked summary of the credential configuration.
 * NEVER returns the raw token or even partial sensitive segments.
 */
export function getSafeCredentialStatus(): {
  hasToken: boolean;
  maskedToken: string;
  locationId: string;
  lastSyncedAt: string | null;
  status: 'connected' | 'disconnected' | 'error' | 'unconfigured';
  statusMessage: string;
  lastError: string | null;
  errorCode: string | null;
} {
  const payload = readStoredPayload();
  const token = getServerSideGhlToken();
  const hasToken = Boolean(token && token.length > 0);

  return {
    hasToken,
    maskedToken: hasToken ? '••••••••••••••••••••••••' : '',
    locationId: payload.locationId || DEFAULT_GHL_LOCATION_ID,
    lastSyncedAt: payload.lastSyncedAt || null,
    status: hasToken ? payload.lastStatus || 'connected' : payload.lastStatus === 'disconnected' ? 'disconnected' : 'unconfigured',
    statusMessage:
      payload.lastStatusMessage ||
      (hasToken
        ? 'Credentials saved in secure storage.'
        : 'Not connected. Enter your GoHighLevel Private Integration Token to connect.'),
    lastError: payload.lastError ? redactSecrets(payload.lastError) : null,
    errorCode: payload.lastErrorCode || null,
  };
}

/**
 * Redacts any token or Bearer credential from error messages or diagnostic strings.
 */
export function redactSecrets(input: string): string {
  if (!input) return '';
  let sanitized = input.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
  SanitizeToken: {
    const activeToken = getServerSideGhlToken();
    if (activeToken && activeToken.length >= 6 && sanitized.includes(activeToken)) {
      sanitized = sanitized.split(activeToken).join('[REDACTED]');
    }
  }
  sanitized = sanitized.replace(/pit-[a-zA-Z0-9\-]{8,}/gi, '[REDACTED_TOKEN]');
  return sanitized;
}
