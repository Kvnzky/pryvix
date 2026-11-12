import * as https from 'https';
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
} from '../shared/types';
import {
  classifyMediaFile,
  extractNormalizedExtension,
} from '../shared/mediaClassifier';
import {
  DEFAULT_GHL_LOCATION_ID,
  REQUIRED_GHL_SCOPE,
  disconnectGhlCredentials,
  getConfiguredLocationId,
  getSafeCredentialStatus,
  getServerSideGhlToken,
  recordGhlSyncOutcome,
  redactSecrets,
  saveGhlCredentials,
} from './secretStore';

const GHL_MEDIA_API_ENDPOINT = 'https://services.leadconnectorhq.com/medias/files';
const CACHE_TTL_MS = 60 * 1000; // 60 seconds metadata cache

interface FolderDatasetEntry {
  timestamp: number;
  folders: GHLMediaItem[];
  files: GHLMediaItem[];
  syncedAt: string;
}

const folderDatasetCache = new Map<string, FolderDatasetEntry>();

// Simple token-bucket rate limiter per client key
const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 40;

export function checkBackendRateLimit(clientKey = 'local'): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(clientKey);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(clientKey, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  bucket.count += 1;
  return true;
}

export function clearGhlMediaCache(): void {
  folderDatasetCache.clear();
}

export function classifyMediaItem(raw: any): {
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

  // Authoritative extension-based classification strictly from the filename (or URL)
  const ext = extractNormalizedExtension(rawName) || extractNormalizedExtension(rawUrl);
  const mediaCategory = classifyMediaFile(rawName || rawUrl);

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
    id: id || `ghl_${Buffer.from(name + url).toString('base64').substring(0, 16)}`,
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

function validateLocationId(input?: string): string {
  const loc = (input || getConfiguredLocationId() || DEFAULT_GHL_LOCATION_ID).trim();
  if (!/^[a-zA-Z0-9_\-]{5,64}$/.test(loc)) {
    throw new Error('Invalid Location ID format.');
  }
  return loc;
}

interface RawGhlFetchResult {
  statusCode: number;
  body: any;
  rawText: string;
}

function executeGhlHttpsGet(urlObj: URL, token: string, apiVersion: string): Promise<RawGhlFetchResult> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      urlObj,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Version: apiVersion,
          Accept: 'application/json',
          'User-Agent': 'Pryvix-LandingPageStudio/1.0',
        },
        timeout: 15000,
      },
      res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const rawText = Buffer.concat(chunks).toString('utf8');
          let parsed: any = null;
          try {
            parsed = rawText ? JSON.parse(rawText) : {};
          } catch {
            parsed = { message: rawText };
          }
          resolve({
            statusCode: res.statusCode || 500,
            body: parsed,
            rawText,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Request to GoHighLevel Media Storage API timed out.'));
    });

    req.on('error', err => {
      reject(err);
    });

    req.end();
  });
}

async function fetchGhlMediaEndpoint(params: {
  token: string;
  locationId: string;
  type: 'file' | 'folder';
  sortBy: GHLSortBy;
  sortOrder: GHLSortOrder;
  parentId?: string | null;
  query?: string;
  offset?: number;
  limit?: number;
}): Promise<RawGhlFetchResult> {
  const urlObj = new URL(GHL_MEDIA_API_ENDPOINT);
  // Required query parameters per official GHL Media Storage API v3 documentation
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

  // Primary request using documented Version: v3
  const primaryRes = await executeGhlHttpsGet(urlObj, params.token, 'v3');

  // If the endpoint specifically rejects the Version string 'v3' with 400/422 mentioning version, fallback to '2021-07-28'
  if (
    (primaryRes.statusCode === 400 || primaryRes.statusCode === 422) &&
    /version/i.test(JSON.stringify(primaryRes.body || ''))
  ) {
    return await executeGhlHttpsGet(urlObj, params.token, '2021-07-28');
  }

  return primaryRes;
}

function classifyGhlApiError(statusCode: number, body: any): {
  errorCode: NonNullable<GHLMediaListResponse['errorCode']>;
  message: string;
} {
  const apiMsg = redactSecrets(
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

function extractRawArrayFromResponse(body: any): any[] {
  if (!body || typeof body !== 'object') return [];
  if (Array.isArray(body.files)) return body.files;
  if (Array.isArray(body.medias)) return body.medias;
  if (Array.isArray(body.data)) return body.data;
  if (body.data && Array.isArray(body.data.files)) return body.data.files;
  return [];
}

/**
 * Exhaustively retrieves all folders and files for a given location and parent folder,
 * paginating until the complete available result set is gathered, deduplicating,
 * and caching the complete dataset.
 */
async function fetchCompleteFolderDataset(params: {
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
    const cached = folderDatasetCache.get(cacheKey);
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

  // 1. Fetch folders exhaustively for the current parentId / query
  const allFolders: GHLMediaItem[] = [];
  const seenFolderIds = new Set<string>();
  let folderOffset = 0;
  const FOLDER_PAGE_LIMIT = 100;

  while (true) {
    const folderRes = await fetchGhlMediaEndpoint({
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

  // 2. Fetch files exhaustively across all pages for the current parentId / query
  const allFiles: GHLMediaItem[] = [];
  const seenFileIds = new Set<string>();
  let fileOffset = 0;
  const FILE_PAGE_LIMIT = 100;

  while (true) {
    const fileRes = await fetchGhlMediaEndpoint({
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

  const syncedAt = new Date().toISOString();
  folderDatasetCache.set(cacheKey, {
    timestamp: Date.now(),
    folders: allFolders,
    files: allFiles,
    syncedAt,
  });

  return {
    success: true,
    folders: allFolders,
    files: allFiles,
    syncedAt,
    fromCache: false,
  };
}

/**
 * Lists files and folders from GoHighLevel Media Storage API v3 with complete multi-page accuracy.
 */
export async function listGhlMedia(params: GHLMediaListParams = {}): Promise<GHLMediaListResponse> {
  const token = getServerSideGhlToken();
  const locationId = (() => {
    try {
      return validateLocationId(params.locationId);
    } catch {
      return getConfiguredLocationId() || DEFAULT_GHL_LOCATION_ID;
    }
  })();

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
        'GoHighLevel Private Integration Token is not configured. Open GHL Connection Settings to enter your replacement token.',
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
    const datasetResult = await fetchCompleteFolderDataset({
      token,
      locationId,
      parentId,
      query,
      refresh: Boolean(params.refresh),
    });

    if (!datasetResult.success) {
      recordGhlSyncOutcome({
        status: 'error',
        statusMessage: datasetResult.error || 'Failed to fetch media from GoHighLevel',
        error: datasetResult.error || 'Failed to fetch media from GoHighLevel',
        errorCode: datasetResult.errorCode || 'API_ERROR',
      });
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

    // Mutually exclusive category counts across the entire folder dataset:
    // Images + Videos + PDFs + Uncategorized === Total files
    const categoryCounts = {
      all: allFiles.length,
      image: allFiles.filter(f => f.mediaCategory === 'image').length,
      video: allFiles.filter(f => f.mediaCategory === 'video').length,
      pdf: allFiles.filter(f => f.mediaCategory === 'pdf').length,
      uncategorized: allFiles.filter(f => f.mediaCategory === 'uncategorized').length,
      folder: allFolders.length,
    };

    // Filter items based on active tab
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

    recordGhlSyncOutcome({
      status: 'connected',
      statusMessage: `Connected to Location ${locationId}`,
      syncedAt: datasetResult.syncedAt,
      error: null,
      errorCode: null,
    });

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
    const safeErr = redactSecrets(err?.message || String(err));
    const message = `Network error connecting to GoHighLevel Media Storage API: ${safeErr}`;
    recordGhlSyncOutcome({
      status: 'error',
      statusMessage: message,
      error: message,
      errorCode: 'NETWORK_ERROR',
    });
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

/**
 * Tests the stored (or newly saved) GoHighLevel connection and returns current status.
 */
export async function testGhlConnection(options?: {
  token?: string;
  locationId?: string;
}): Promise<GHLConnectionStatus> {
  if (options && (options.token || options.locationId)) {
    saveGhlCredentials(options);
    clearGhlMediaCache();
  }

  const safeStatus = getSafeCredentialStatus();
  if (!safeStatus.hasToken) {
    return {
      connected: false,
      hasToken: false,
      maskedToken: '',
      locationId: safeStatus.locationId,
      requiredScope: REQUIRED_GHL_SCOPE,
      status: 'unconfigured',
      statusMessage: 'No Private Integration Token configured. Please enter your token to connect.',
      lastSyncedAt: safeStatus.lastSyncedAt,
      lastError: null,
      errorCode: 'NOT_CONFIGURED',
    };
  }

  const testResult = await listGhlMedia({
    locationId: safeStatus.locationId,
    filterTab: 'all',
    offset: 0,
    limit: 25,
    refresh: true,
  });

  const updatedSafe = getSafeCredentialStatus();

  if (testResult.success) {
    return {
      connected: true,
      hasToken: true,
      maskedToken: updatedSafe.maskedToken,
      locationId: testResult.locationId,
      requiredScope: REQUIRED_GHL_SCOPE,
      status: 'connected',
      statusMessage: `Connected to GoHighLevel Media Storage (${testResult.folders.length} folders, ${testResult.files.length} files retrieved on initial page).`,
      lastSyncedAt: testResult.syncedAt,
      lastError: null,
      errorCode: null,
      stats: {
        fileCount: testResult.files.length,
        folderCount: testResult.folders.length,
      },
    };
  }

  return {
    connected: false,
    hasToken: true,
    maskedToken: updatedSafe.maskedToken,
    locationId: testResult.locationId,
    requiredScope: REQUIRED_GHL_SCOPE,
    status: 'error',
    statusMessage: testResult.error || 'Connection test failed.',
    lastSyncedAt: updatedSafe.lastSyncedAt,
    lastError: testResult.error || 'Connection test failed.',
    errorCode: testResult.errorCode || 'API_ERROR',
  };
}

export function getGhlConnectionStatus(): GHLConnectionStatus {
  const safe = getSafeCredentialStatus();
  return {
    connected: safe.hasToken && safe.status === 'connected',
    hasToken: safe.hasToken,
    maskedToken: safe.maskedToken,
    locationId: safe.locationId,
    requiredScope: REQUIRED_GHL_SCOPE,
    status: safe.status,
    statusMessage: safe.statusMessage,
    lastSyncedAt: safe.lastSyncedAt,
    lastError: safe.lastError,
    errorCode: safe.errorCode,
  };
}

export function handleDisconnectGhl(): GHLConnectionStatus {
  disconnectGhlCredentials();
  clearGhlMediaCache();
  return getGhlConnectionStatus();
}

const ALLOWED_MEDIA_HOST_PATTERNS = [
  /\.filesafe\.space$/i,
  /\.googleapis\.com$/i,
  /\.msgsndr\.com$/i,
  /\.leadconnectorhq\.com$/i,
  /\.highlevel\.com$/i,
  /\.cloudfront\.net$/i,
];

export function isAllowedGhlAssetUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_MEDIA_HOST_PATTERNS.some(pattern => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

/**
 * Validated, read-only check of an asset URL's accessibility (without sending GHL credentials).
 */
export function verifyGhlMediaAssetUrl(rawUrl: string): Promise<GHLVerifyAssetResult> {
  return new Promise(resolve => {
    if (!isAllowedGhlAssetUrl(rawUrl)) {
      resolve({
        accessible: false,
        status: 400,
        error: 'URL is not an allowlisted HTTPS GoHighLevel media storage URL.',
      });
      return;
    }

    const urlObj = new URL(rawUrl);
    const req = https.request(
      urlObj,
      {
        method: 'HEAD',
        timeout: 8000,
        headers: {
          'User-Agent': 'Pryvix-LandingPageStudio/1.0',
        },
      },
      res => {
        const status = res.statusCode || 500;
        resolve({
          accessible: status >= 200 && status < 400,
          status,
          contentType: res.headers['content-type'],
          contentLength: res.headers['content-length']
            ? Number(res.headers['content-length'])
            : undefined,
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({ accessible: false, status: 408, error: 'Asset verification timed out.' });
    });

    req.on('error', err => {
      resolve({ accessible: false, status: 500, error: redactSecrets(err.message) });
    });

    req.end();
  });
}
