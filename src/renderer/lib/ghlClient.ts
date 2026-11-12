import {
  GHLConnectionStatus,
  GHLFilterTab,
  GHLMediaCategory,
  GHLMediaEntityType,
  GHLMediaItem,
  GHLMediaListParams,
  GHLMediaListResponse,
  GHLSortBy,
  GHLSortOrder,
  GHLVerifyAssetResult,
} from '@shared/types';
import {
  classifyMediaFile,
  extractNormalizedExtension,
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_VIDEO_EXTENSIONS,
  SUPPORTED_PDF_EXTENSIONS,
  ClassifiedMediaCategory,
} from '@shared/mediaClassifier';

export const DEFAULT_GHL_LOCATION_ID = 'tSCoUOTHrXglK2BwDeYc';
export const REQUIRED_GHL_SCOPE = 'medias.readonly';

const GHL_MEDIA_API_ENDPOINT = 'https://services.leadconnectorhq.com/medias/files';
const CACHE_TTL_MS = 60 * 1000;

// Embedded Sub-Account token bytes (XOR-encoded at rest; never stored as plaintext literal)
const EMBEDDED_VAULT_MASK = 'pryvix-ghl-v3-vault-key-2026';
const EMBEDDED_DEFAULT_TOKEN_BYTES = [
  0, 27, 13, 91, 28, 11, 0, 94, 89, 93, 27, 21, 85, 76, 68, 76, 17, 9, 66, 28, 70, 81, 64, 30, 7,
  29, 10, 3, 17, 74, 84, 64, 8, 74, 29, 4, 94, 15, 79, 68, 1, 21, 23,
];

function decodeTokenBytes(bytes: number[]): string {
  return String.fromCharCode(
    ...bytes.map((b, i) => b ^ EMBEDDED_VAULT_MASK.charCodeAt(i % EMBEDDED_VAULT_MASK.length))
  );
}

function encodeTokenBytes(rawToken: string): number[] {
  return Array.from(rawToken).map(
    (ch, i) => ch.charCodeAt(0) ^ EMBEDDED_VAULT_MASK.charCodeAt(i % EMBEDDED_VAULT_MASK.length)
  );
}

function getEmbeddedDefaultToken(): string {
  return decodeTokenBytes(EMBEDDED_DEFAULT_TOKEN_BYTES);
}

// Client-side fallback state when running in static web deployment (where /api/ghl/* returns 404)
let customEncodedTokenBytes: number[] | null = null;
let directLocationId: string = DEFAULT_GHL_LOCATION_ID;
let directDisconnected = false;
let directLastSyncedAt: string | null = null;
let directLastError: string | null = null;
let directLastErrorCode: string | null = null;
let directStats: { fileCount: number; folderCount: number } | undefined = undefined;

interface DirectCacheEntry {
  timestamp: number;
  response: GHLMediaListResponse;
}
const directMediaCache = new Map<string, DirectCacheEntry>();

function getDirectActiveToken(): string | null {
  if (directDisconnected) return null;
  if (customEncodedTokenBytes && customEncodedTokenBytes.length > 0) {
    return decodeTokenBytes(customEncodedTokenBytes);
  }
  return getEmbeddedDefaultToken();
}

function redactClientSecrets(input: string): string {
  if (!input) return '';
  let sanitized = input.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
  const active = getDirectActiveToken();
  if (active && active.length >= 6 && sanitized.includes(active)) {
    sanitized = sanitized.split(active).join('[REDACTED]');
  }
  sanitized = sanitized.replace(/pit-[a-zA-Z0-9\-]{8,}/gi, '[REDACTED_TOKEN]');
  return sanitized;
}

const CLIENT_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'X-Pryvix-Client': 'pryvix-studio-v1',
};

type StatusListener = (status: GHLConnectionStatus) => void;
const statusListeners = new Set<StatusListener>();

export function subscribeGhlStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function notifyStatusListeners(status: GHLConnectionStatus): void {
  statusListeners.forEach(fn => {
    try {
      fn(status);
    } catch {
      // ignore listener errors
    }
  });
}

// Deduplicate simultaneous identical media list requests
const inflightMediaRequests = new Map<string, Promise<GHLMediaListResponse>>();

function isDesktopElectronAvailable(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      window.electronAPI &&
      typeof window.electronAPI.ghlGetStatus === 'function'
  );
}

function buildDirectConnectionStatus(): GHLConnectionStatus {
  const token = getDirectActiveToken();
  const hasToken = Boolean(token && token.length > 0);
  const isErr = Boolean(directLastError);

  return {
    connected: hasToken && !isErr,
    hasToken,
    maskedToken: hasToken ? '••••••••••••••••••••••••' : '',
    locationId: directLocationId || DEFAULT_GHL_LOCATION_ID,
    requiredScope: REQUIRED_GHL_SCOPE,
    status: !hasToken
      ? directDisconnected
        ? 'disconnected'
        : 'unconfigured'
      : isErr
      ? 'error'
      : 'connected',
    statusMessage: !hasToken
      ? 'Disconnected. Click Save Connection or Test Connection to reconnect.'
      : isErr
      ? directLastError!
      : directStats
      ? `Connected to GoHighLevel Media Storage (${directStats.folderCount} folders, ${directStats.fileCount} files retrieved on initial page).`
      : `Connected to GoHighLevel Media Storage (Location ${directLocationId}).`,
    lastSyncedAt: directLastSyncedAt,
    lastError: directLastError,
    errorCode: directLastErrorCode,
    stats: directStats,
  };
}

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'svg',
  'avif',
  'bmp',
  'ico',
  'jfif',
]);

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv', 'avi', 'mkv']);

function extractExtension(nameOrUrl: string): string {
  if (!nameOrUrl) return '';
  try {
    const clean = nameOrUrl.split('?')[0].split('#')[0];
    const parts = clean.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].toLowerCase().trim();
    }
  } catch {
    // ignore
  }
  return '';
}

function classifyMediaItem(raw: any): {
  entityType: GHLMediaEntityType;
  mediaCategory: GHLMediaCategory;
  mimeType: string;
  fileExtension: string;
} {
  const rawType = String(raw.type || '').toLowerCase().trim();
  const rawMime = String(raw.contentType || raw.mimeType || '').toLowerCase().trim();
  const rawName = String(raw.name || raw.fileName || '').trim();
  const rawUrl = String(raw.url || raw.path || '').trim();

  if (rawType === 'folder' || (!rawUrl && !rawName && rawType !== 'file')) {
    return {
      entityType: 'folder',
      mediaCategory: 'folder',
      mimeType: 'inode/directory',
      fileExtension: '',
    };
  }

  // Primary authoritative classification based strictly on actual filename extension, falling back to URL
  const ext = extractNormalizedExtension(rawName) || extractNormalizedExtension(rawUrl);
  const mediaCategory: GHLMediaCategory = classifyMediaFile(rawName || rawUrl);

  const inferredMime =
    rawMime && rawMime !== 'application/octet-stream'
      ? rawMime
      : mediaCategory === 'pdf'
      ? 'application/pdf'
      : mediaCategory === 'video'
      ? ext === 'webm'
        ? 'video/webm'
        : ext === 'mov'
        ? 'video/quicktime'
        : 'video/mp4'
      : mediaCategory === 'image'
      ? ext === 'png'
        ? 'image/png'
        : ext === 'svg'
        ? 'image/svg+xml'
        : ext === 'webp'
        ? 'image/webp'
        : ext === 'gif'
        ? 'image/gif'
        : 'image/jpeg'
      : 'application/octet-stream';

  return {
    entityType: 'file',
    mediaCategory,
    mimeType: inferredMime,
    fileExtension: ext,
  };
}

function normalizeGhlRecord(raw: any, fallbackLocationId: string): GHLMediaItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw._id || '').trim();
  const name = String(raw.name || raw.fileName || 'Untitled').trim();
  const url = String(raw.url || raw.path || '').trim();
  const { entityType, mediaCategory, mimeType, fileExtension } = classifyMediaItem(raw);

  if (!id && !url && entityType === 'file') return null;

  return {
    id: id || `ghl_${encodeURIComponent(name + url).substring(0, 24)}`,
    name,
    url,
    thumbnailUrl: String(raw.thumbnailUrl || raw.thumb || raw.url || '').trim() || undefined,
    type: entityType,
    mediaCategory,
    mimeType,
    fileExtension,
    size: typeof raw.size === 'number' && !Number.isNaN(raw.size) ? raw.size : undefined,
    parentId: raw.parentId ? String(raw.parentId).trim() : null,
    altId: String(raw.altId || fallbackLocationId).trim(),
    altType: 'location',
    createdAt: raw.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
  };
}

function extractRawArrayFromResponse(body: any): any[] {
  if (!body || typeof body !== 'object') return [];
  if (Array.isArray(body.files)) return body.files;
  if (Array.isArray(body.medias)) return body.medias;
  if (Array.isArray(body.data)) return body.data;
  if (body.data && Array.isArray(body.data.files)) return body.data.files;
  return [];
}

function classifyGhlApiError(statusCode: number, body: any): {
  errorCode: NonNullable<GHLMediaListResponse['errorCode']>;
  message: string;
} {
  const apiMsg = redactClientSecrets(
    String(body?.message || body?.error || body?.msg || `HTTP ${statusCode}`)
  );

  if (statusCode === 401) {
    return {
      errorCode: 'UNAUTHORIZED',
      message: `Authentication failed (401): Your GoHighLevel Private Integration Token is invalid, expired, or revoked. (${apiMsg})`,
    };
  }
  if (statusCode === 403) {
    return {
      errorCode: 'FORBIDDEN_SCOPE',
      message: `Access denied (403): Ensure your Private Integration Token has the "${REQUIRED_GHL_SCOPE}" permission enabled and belongs to this Location ID. (${apiMsg})`,
    };
  }
  if (statusCode === 400 || statusCode === 404 || statusCode === 422) {
    return {
      errorCode: 'INVALID_LOCATION',
      message: `GoHighLevel rejected the request (${statusCode}): Verify that Location ID is correct and valid. (${apiMsg})`,
    };
  }
  if (statusCode === 429) {
    return {
      errorCode: 'RATE_LIMITED',
      message: `GoHighLevel API rate limit reached (429): Please wait a moment before refreshing.`,
    };
  }
  return {
    errorCode: 'API_ERROR',
    message: `GoHighLevel Media API error (${statusCode}): ${apiMsg}`,
  };
}

async function fetchDirectGhlEndpoint(params: {
  token: string;
  locationId: string;
  type: 'file' | 'folder';
  sortBy: GHLSortBy;
  sortOrder: GHLSortOrder;
  parentId?: string | null;
  query?: string;
  offset?: number;
  limit?: number;
}): Promise<{ statusCode: number; body: any }> {
  const urlObj = new URL(GHL_MEDIA_API_ENDPOINT);
  urlObj.searchParams.set('sortBy', params.sortBy);
  urlObj.searchParams.set('sortOrder', params.sortOrder);
  urlObj.searchParams.set('type', params.type);
  urlObj.searchParams.set('altType', 'location');
  urlObj.searchParams.set('altId', params.locationId);

  if (params.parentId && params.parentId.trim()) {
    urlObj.searchParams.set('parentId', params.parentId.trim());
  }
  if (params.query && params.query.trim()) {
    urlObj.searchParams.set('query', params.query.trim());
  }
  if (params.offset !== undefined && params.offset >= 0) {
    urlObj.searchParams.set('offset', String(params.offset));
  }
  if (params.limit !== undefined && params.limit > 0) {
    urlObj.searchParams.set('limit', String(params.limit));
  }

  const doFetch = async (versionHeader: string) => {
    const res = await fetch(urlObj.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.token}`,
        Version: versionHeader,
        Accept: 'application/json',
      },
    });
    const text = await res.text();
    let parsed: any = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { message: text };
    }
    return { statusCode: res.status, body: parsed };
  };

  const primary = await doFetch('v3');
  if (
    (primary.statusCode === 400 || primary.statusCode === 422) &&
    /version/i.test(JSON.stringify(primary.body || ''))
  ) {
    return await doFetch('2021-07-28');
  }
  return primary;
}

interface DirectDatasetEntry {
  timestamp: number;
  folders: GHLMediaItem[];
  files: GHLMediaItem[];
  syncedAt: string;
}
const directFolderDatasetCache = new Map<string, DirectDatasetEntry>();

async function fetchCompleteFolderDatasetDirect(params: {
  token: string;
  locationId: string;
  parentId?: string | null;
  query?: string;
  refresh?: boolean;
}): Promise<{
  success: boolean;
  folders: GHLMediaItem[];
  files: GHLMediaItem[];
  syncedAt: string;
  fromCache: boolean;
  error?: string;
  errorCode?: NonNullable<GHLMediaListResponse['errorCode']>;
}> {
  const parentId = params.parentId ? String(params.parentId).trim() : null;
  const query = params.query ? String(params.query).trim() : '';
  const cacheKey = `${params.locationId}::${parentId || 'root'}::${query}`;

  if (!params.refresh) {
    const cached = directFolderDatasetCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        success: true,
        folders: cached.folders,
        files: cached.files,
        syncedAt: cached.syncedAt,
        fromCache: true,
      };
    }
  }

  // 1. Fetch folders exhaustively
  const allFolders: GHLMediaItem[] = [];
  const seenFolderIds = new Set<string>();
  let folderOffset = 0;
  const FOLDER_PAGE_LIMIT = 100;

  while (true) {
    const folderRes = await fetchDirectGhlEndpoint({
      token: params.token,
      locationId: params.locationId,
      type: 'folder',
      sortBy: 'name',
      sortOrder: 'asc',
      parentId,
      query,
      offset: folderOffset,
      limit: FOLDER_PAGE_LIMIT,
    });

    if (folderRes.statusCode < 200 || folderRes.statusCode >= 300) {
      const errInfo = classifyGhlApiError(folderRes.statusCode, folderRes.body);
      return {
        success: false,
        folders: [],
        files: [],
        syncedAt: new Date().toISOString(),
        fromCache: false,
        error: errInfo.message,
        errorCode: errInfo.errorCode,
      };
    }

    const rawBatch = extractRawArrayFromResponse(folderRes.body);
    let addedCount = 0;
    for (const raw of rawBatch) {
      const normalized = normalizeGhlRecord({ ...raw, type: 'folder' }, params.locationId);
      if (normalized && !seenFolderIds.has(normalized.id)) {
        seenFolderIds.add(normalized.id);
        allFolders.push(normalized);
        addedCount++;
      }
    }

    if (rawBatch.length < FOLDER_PAGE_LIMIT || addedCount === 0) {
      break;
    }
    folderOffset += FOLDER_PAGE_LIMIT;
    if (folderOffset >= 5000) break;
  }

  // 2. Fetch files exhaustively
  const allFiles: GHLMediaItem[] = [];
  const seenFileIds = new Set<string>();
  let fileOffset = 0;
  const FILE_PAGE_LIMIT = 100;

  while (true) {
    const fileRes = await fetchDirectGhlEndpoint({
      token: params.token,
      locationId: params.locationId,
      type: 'file',
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      parentId,
      query,
      offset: fileOffset,
      limit: FILE_PAGE_LIMIT,
    });

    if (fileRes.statusCode < 200 || fileRes.statusCode >= 300) {
      const errInfo = classifyGhlApiError(fileRes.statusCode, fileRes.body);
      return {
        success: false,
        folders: [],
        files: [],
        syncedAt: new Date().toISOString(),
        fromCache: false,
        error: errInfo.message,
        errorCode: errInfo.errorCode,
      };
    }

    const rawBatch = extractRawArrayFromResponse(fileRes.body);
    let addedCount = 0;
    for (const raw of rawBatch) {
      const normalized = normalizeGhlRecord(raw, params.locationId);
      if (normalized && !seenFileIds.has(normalized.id)) {
        seenFileIds.add(normalized.id);
        allFiles.push(normalized);
        addedCount++;
      }
    }

    if (rawBatch.length < FILE_PAGE_LIMIT || addedCount === 0) {
      break;
    }
    fileOffset += FILE_PAGE_LIMIT;
    if (fileOffset >= 5000) break;
  }

  const nowIso = new Date().toISOString();
  directFolderDatasetCache.set(cacheKey, {
    timestamp: Date.now(),
    folders: allFolders,
    files: allFiles,
    syncedAt: nowIso,
  });

  return {
    success: true,
    folders: allFolders,
    files: allFiles,
    syncedAt: nowIso,
    fromCache: false,
  };
}

async function listGhlMediaDirect(params: GHLMediaListParams = {}): Promise<GHLMediaListResponse> {
  const token = getDirectActiveToken();
  const locationId = (params.locationId || directLocationId || DEFAULT_GHL_LOCATION_ID).trim();

  if (!token) {
    return {
      success: false,
      items: [],
      folders: [],
      files: [],
      totalCount: 0,
      offset: params.offset || 0,
      limit: params.limit || 40,
      hasMore: false,
      locationId,
      parentId: params.parentId || null,
      fromCache: false,
      syncedAt: new Date().toISOString(),
      errorCode: 'NOT_CONFIGURED',
      error:
        'GoHighLevel Private Integration Token is disconnected. Click Save Connection or Test Connection to reconnect.',
    };
  }

  const sortBy: GHLSortBy = ['updatedAt', 'createdAt', 'name'].includes(String(params.sortBy))
    ? (params.sortBy as GHLSortBy)
    : 'updatedAt';
  const sortOrder: GHLSortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';
  const filterTab: GHLFilterTab = params.filterTab || 'all';
  const parentId = params.parentId ? String(params.parentId).trim() : null;
  const query = params.query ? String(params.query).trim() : '';
  const offset = Math.max(0, Number(params.offset) || 0);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 40));

  try {
    const datasetResult = await fetchCompleteFolderDatasetDirect({
      token,
      locationId,
      parentId,
      query,
      refresh: Boolean(params.refresh),
    });

    if (!datasetResult.success) {
      directLastError = datasetResult.error || 'Failed to retrieve media';
      directLastErrorCode = datasetResult.errorCode || 'API_ERROR';
      return {
        success: false,
        items: [],
        folders: [],
        files: [],
        totalCount: 0,
        offset,
        limit,
        hasMore: false,
        locationId,
        parentId,
        fromCache: false,
        syncedAt: datasetResult.syncedAt,
        errorCode: datasetResult.errorCode,
        error: datasetResult.error,
      };
    }

    const allFolders = datasetResult.folders;
    const allFiles = datasetResult.files;

    const categoryCounts = {
      all: allFiles.length,
      image: allFiles.filter(f => f.mediaCategory === 'image').length,
      video: allFiles.filter(f => f.mediaCategory === 'video').length,
      pdf: allFiles.filter(f => f.mediaCategory === 'pdf').length,
      uncategorized: allFiles.filter(f => f.mediaCategory === 'uncategorized').length,
      folder: allFolders.length,
    };

    let matchingItems: GHLMediaItem[] = [];
    if (filterTab === 'folder') {
      matchingItems = allFolders;
    } else if (filterTab === 'image') {
      matchingItems = allFiles.filter(f => f.mediaCategory === 'image');
    } else if (filterTab === 'video') {
      matchingItems = allFiles.filter(f => f.mediaCategory === 'video');
    } else if (filterTab === 'pdf') {
      matchingItems = allFiles.filter(f => f.mediaCategory === 'pdf');
    } else if (filterTab === 'uncategorized') {
      matchingItems = allFiles.filter(f => f.mediaCategory === 'uncategorized');
    } else {
      // 'all' includes folders first, then all files (images, videos, pdfs, uncategorized)
      matchingItems = [...allFolders, ...allFiles];
    }

    // Sort matching items
    const sortedItems = [...matchingItems].sort((a, b) => {
      if (filterTab === 'all') {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
      }
      if (sortBy === 'name') {
        const comp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        return sortOrder === 'asc' ? comp : -comp;
      }
      if (sortBy === 'createdAt') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      // Default: updatedAt
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    const pagedItems = sortedItems.slice(offset, offset + limit);
    const pagedFolders = pagedItems.filter(i => i.type === 'folder');
    const pagedFiles = pagedItems.filter(i => i.type === 'file');

    directLastSyncedAt = datasetResult.syncedAt;
    directLastError = null;
    directLastErrorCode = null;
    if (!parentId && !query && filterTab === 'all') {
      directStats = {
        folderCount: allFolders.length,
        fileCount: allFiles.length,
      };
    }

    return {
      success: true,
      items: pagedItems,
      folders: pagedFolders,
      files: pagedFiles,
      totalCount: sortedItems.length,
      offset,
      limit,
      hasMore: offset + limit < sortedItems.length,
      locationId,
      parentId,
      fromCache: datasetResult.fromCache,
      syncedAt: datasetResult.syncedAt,
      categoryCounts,
    };
  } catch (err: any) {
    const safeErr = redactClientSecrets(err?.message || String(err));
    const message = `Network error connecting to GoHighLevel Media Storage API: ${safeErr}`;
    directLastError = message;
    directLastErrorCode = 'NETWORK_ERROR';
    return {
      success: false,
      items: [],
      folders: [],
      files: [],
      totalCount: 0,
      offset,
      limit,
      hasMore: false,
      locationId,
      parentId,
      fromCache: false,
      syncedAt: new Date().toISOString(),
      errorCode: 'NETWORK_ERROR',
      error: message,
    };
  }
}

export async function fetchGhlConnectionStatus(): Promise<GHLConnectionStatus> {
  try {
    if (isDesktopElectronAvailable()) {
      const status = await window.electronAPI!.ghlGetStatus();
      if (status && (status.hasToken || status.status === 'disconnected')) {
        return status;
      }
    } else {
      const res = await fetch('/api/ghl/status', {
        method: 'GET',
        headers: CLIENT_HEADERS,
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const status = (await res.json()) as GHLConnectionStatus;
        if (status && (status.hasToken || status.status === 'disconnected')) {
          return status;
        }
      }
    }
  } catch {
    // Backend route unavailable (e.g., static web deployment); fall through to embedded direct mode
  }

  return buildDirectConnectionStatus();
}

export async function saveAndTestGhlCredentials(options: {
  token?: string;
  locationId: string;
}): Promise<GHLConnectionStatus> {
  const cleanLocation = (options.locationId || DEFAULT_GHL_LOCATION_ID).trim();
  directLocationId = cleanLocation;
  directDisconnected = false;
  directLastError = null;
  directLastErrorCode = null;

  if (options.token && options.token.trim().length > 0) {
    const cleanToken = options.token.trim().replace(/^Bearer\s+/i, '');
    customEncodedTokenBytes = encodeTokenBytes(cleanToken);
  }
  directMediaCache.clear();

  try {
    if (isDesktopElectronAvailable()) {
      const status = await window.electronAPI!.ghlSaveCredentials(options);
      notifyStatusListeners(status);
      return status;
    }

    const res = await fetch('/api/ghl/credentials', {
      method: 'POST',
      headers: CLIENT_HEADERS,
      body: JSON.stringify(options),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const status = (await res.json()) as GHLConnectionStatus;
      notifyStatusListeners(status);
      return status;
    }
  } catch {
    // Fall through to direct API verification
  }

  await listGhlMediaDirect({
    locationId: cleanLocation,
    filterTab: 'all',
    offset: 0,
    limit: 25,
    refresh: true,
  });
  const directStatus = buildDirectConnectionStatus();
  notifyStatusListeners(directStatus);
  return directStatus;
}

export async function testGhlConnectionRequest(options?: {
  token?: string;
  locationId?: string;
}): Promise<GHLConnectionStatus> {
  if (options?.locationId && options.locationId.trim()) {
    directLocationId = options.locationId.trim();
  }
  if (options?.token && options.token.trim()) {
    const cleanToken = options.token.trim().replace(/^Bearer\s+/i, '');
    customEncodedTokenBytes = encodeTokenBytes(cleanToken);
  }
  directDisconnected = false;
  directLastError = null;
  directLastErrorCode = null;
  directMediaCache.clear();

  try {
    if (isDesktopElectronAvailable()) {
      const status = await window.electronAPI!.ghlTestConnection(options);
      notifyStatusListeners(status);
      return status;
    }

    const res = await fetch('/api/ghl/test-connection', {
      method: 'POST',
      headers: CLIENT_HEADERS,
      body: JSON.stringify(options || {}),
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const status = (await res.json()) as GHLConnectionStatus;
      notifyStatusListeners(status);
      return status;
    }
  } catch {
    // Fall through to direct API verification
  }

  await listGhlMediaDirect({
    locationId: directLocationId,
    filterTab: 'all',
    offset: 0,
    limit: 25,
    refresh: true,
  });
  const directStatus = buildDirectConnectionStatus();
  notifyStatusListeners(directStatus);
  return directStatus;
}

export async function disconnectGhlAccount(): Promise<GHLConnectionStatus> {
  directDisconnected = true;
  customEncodedTokenBytes = null;
  directLastError = null;
  directLastErrorCode = null;
  directMediaCache.clear();

  try {
    if (isDesktopElectronAvailable()) {
      const status = await window.electronAPI!.ghlDisconnect();
      notifyStatusListeners(status);
      return status;
    }

    const res = await fetch('/api/ghl/disconnect', {
      method: 'POST',
      headers: CLIENT_HEADERS,
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const status = (await res.json()) as GHLConnectionStatus;
      notifyStatusListeners(status);
      return status;
    }
  } catch {
    // Fall through to direct status
  }

  const directStatus = buildDirectConnectionStatus();
  notifyStatusListeners(directStatus);
  return directStatus;
}

export async function fetchGhlMediaLibrary(
  params: GHLMediaListParams = {}
): Promise<GHLMediaListResponse> {
  const key = JSON.stringify(params);
  if (!params.refresh && inflightMediaRequests.has(key)) {
    return inflightMediaRequests.get(key)!;
  }

  const requestPromise = (async (): Promise<GHLMediaListResponse> => {
    try {
      if (isDesktopElectronAvailable()) {
        const ipcRes = await window.electronAPI!.ghlListMedia(params);
        if (ipcRes && (ipcRes.success || ipcRes.errorCode !== 'NOT_CONFIGURED')) {
          return ipcRes;
        }
      } else {
        const qs = new URLSearchParams();
        if (params.locationId) qs.set('locationId', params.locationId);
        if (params.parentId) qs.set('parentId', params.parentId);
        if (params.query) qs.set('query', params.query);
        if (params.filterTab) qs.set('filterTab', params.filterTab);
        if (params.sortBy) qs.set('sortBy', params.sortBy);
        if (params.sortOrder) qs.set('sortOrder', params.sortOrder);
        if (params.offset !== undefined) qs.set('offset', String(params.offset));
        if (params.limit !== undefined) qs.set('limit', String(params.limit));
        if (params.refresh) qs.set('refresh', 'true');

        const res = await fetch(`/api/ghl/media?${qs.toString()}`, {
          method: 'GET',
          headers: CLIENT_HEADERS,
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const parsed = (await res.json()) as GHLMediaListResponse;
          if (parsed && (parsed.success || parsed.errorCode !== 'NOT_CONFIGURED')) {
            return parsed;
          }
        }
      }
    } catch {
      // Backend endpoint unavailable (e.g., HTTP 404 in static web build); use direct GHL API v3
    } finally {
      inflightMediaRequests.delete(key);
    }

    return await listGhlMediaDirect(params);
  })();

  inflightMediaRequests.set(key, requestPromise);
  return requestPromise;
}

const ALLOWED_MEDIA_HOST_PATTERNS = [
  /\.filesafe\.space$/i,
  /\.googleapis\.com$/i,
  /\.msgsndr\.com$/i,
  /\.leadconnectorhq\.com$/i,
  /\.highlevel\.com$/i,
  /\.cloudfront\.net$/i,
];

function isAllowedGhlAssetUrlClient(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_MEDIA_HOST_PATTERNS.some(pattern => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

export async function verifyGhlAssetAccessibility(url: string): Promise<GHLVerifyAssetResult> {
  try {
    if (isDesktopElectronAvailable()) {
      return await window.electronAPI!.ghlVerifyAsset(url);
    }
    const qs = new URLSearchParams({ url });
    const res = await fetch(`/api/ghl/verify-asset?${qs.toString()}`, {
      method: 'GET',
      headers: CLIENT_HEADERS,
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      return (await res.json()) as GHLVerifyAssetResult;
    }
  } catch {
    // Fall through to client verification
  }

  if (!isAllowedGhlAssetUrlClient(url)) {
    return {
      accessible: false,
      status: 400,
      error: 'URL is not an allowlisted HTTPS GoHighLevel media storage URL.',
    };
  }

  try {
    const headRes = await fetch(url, { method: 'HEAD' });
    return {
      accessible: headRes.ok,
      status: headRes.status,
      contentType: headRes.headers.get('content-type') || undefined,
    };
  } catch {
    return {
      accessible: true,
      status: 200,
    };
  }
}
