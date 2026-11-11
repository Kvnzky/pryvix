import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const DEFAULT_GHL_LOCATION_ID = 'tSCoUOTHrXglK2BwDeYc';
export const REQUIRED_GHL_SCOPE = 'medias.readonly';

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

function getSecretFilePath(): string {
  const baseDir = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
  const settingsDir = path.join(baseDir, 'data', 'settings');
  if (!fs.existsSync(settingsDir)) {
    try {
      fs.mkdirSync(settingsDir, { recursive: true });
    } catch {
      // Fallback to os.tmpdir if read-only cwd
      return path.join(os.tmpdir(), '.pryvix-ghl-secrets.enc');
    }
  }
  return path.join(settingsDir, '.ghl-secrets.enc');
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
  const filePath = getSecretFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as StoredSecretPayload;
      return {
        ...parsed,
        locationId: (parsed.locationId || DEFAULT_GHL_LOCATION_ID).trim(),
      };
    } catch {
      // Corrupted file fallback
    }
  }
  return {
    locationId: (process.env.GHL_LOCATION_ID || DEFAULT_GHL_LOCATION_ID).trim(),
    lastStatus: 'unconfigured',
    lastStatusMessage: 'Not connected. Enter your GoHighLevel Private Integration Token to connect.',
    updatedAt: new Date().toISOString(),
  };
}

function writeStoredPayload(payload: StoredSecretPayload): void {
  const filePath = getSecretFilePath();
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
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
  if (payload.tokenCiphertext && payload.iv && payload.authTag) {
    return decryptToken(payload.tokenCiphertext, payload.iv, payload.authTag);
  }
  return null;
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
    updatedAt: new Date().toISOString(),
  };

  if (options.token !== undefined && options.token.trim().length > 0) {
    const cleanToken = options.token.trim().replace(/^Bearer\s+/i, '');
    const encrypted = encryptToken(cleanToken);
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
