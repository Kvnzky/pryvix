import {
  GHLConnectionStatus,
  GHLMediaListParams,
  GHLMediaListResponse,
  GHLVerifyAssetResult,
} from '@shared/types';

export const DEFAULT_GHL_LOCATION_ID = 'tSCoUOTHrXglK2BwDeYc';
export const REQUIRED_GHL_SCOPE = 'medias.readonly';

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
  return Boolean(typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.ghlGetStatus === 'function');
}

export async function fetchGhlConnectionStatus(): Promise<GHLConnectionStatus> {
  try {
    if (isDesktopElectronAvailable()) {
      const status = await window.electronAPI!.ghlGetStatus();
      notifyStatusListeners(status);
      return status;
    }

    const res = await fetch('/api/ghl/status', {
      method: 'GET',
      headers: CLIENT_HEADERS,
    });
    if (!res.ok) {
      throw new Error(`Backend status returned HTTP ${res.status}`);
    }
    const status = (await res.json()) as GHLConnectionStatus;
    notifyStatusListeners(status);
    return status;
  } catch (err: any) {
    const fallback: GHLConnectionStatus = {
      connected: false,
      hasToken: false,
      maskedToken: '',
      locationId: DEFAULT_GHL_LOCATION_ID,
      requiredScope: REQUIRED_GHL_SCOPE,
      status: 'error',
      statusMessage: 'Pryvix backend service is unreachable. Ensure the backend server is running.',
      lastError: err?.message || 'Backend unavailable',
      errorCode: 'NETWORK_ERROR',
    };
    return fallback;
  }
}

export async function saveAndTestGhlCredentials(options: {
  token?: string;
  locationId: string;
}): Promise<GHLConnectionStatus> {
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
    const status = (await res.json()) as GHLConnectionStatus;
    notifyStatusListeners(status);
    return status;
  } catch (err: any) {
    return {
      connected: false,
      hasToken: false,
      maskedToken: '',
      locationId: options.locationId || DEFAULT_GHL_LOCATION_ID,
      requiredScope: REQUIRED_GHL_SCOPE,
      status: 'error',
      statusMessage: `Failed to communicate with Pryvix backend: ${err?.message || 'Network error'}`,
      lastError: err?.message || 'Backend unavailable',
      errorCode: 'NETWORK_ERROR',
    };
  }
}

export async function testGhlConnectionRequest(options?: {
  token?: string;
  locationId?: string;
}): Promise<GHLConnectionStatus> {
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
    const status = (await res.json()) as GHLConnectionStatus;
    notifyStatusListeners(status);
    return status;
  } catch (err: any) {
    return {
      connected: false,
      hasToken: false,
      maskedToken: '',
      locationId: options?.locationId || DEFAULT_GHL_LOCATION_ID,
      requiredScope: REQUIRED_GHL_SCOPE,
      status: 'error',
      statusMessage: `Connection test failed: ${err?.message || 'Backend unavailable'}`,
      lastError: err?.message || 'Backend unavailable',
      errorCode: 'NETWORK_ERROR',
    };
  }
}

export async function disconnectGhlAccount(): Promise<GHLConnectionStatus> {
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
    const status = (await res.json()) as GHLConnectionStatus;
    notifyStatusListeners(status);
    return status;
  } catch (err: any) {
    return {
      connected: false,
      hasToken: false,
      maskedToken: '',
      locationId: DEFAULT_GHL_LOCATION_ID,
      requiredScope: REQUIRED_GHL_SCOPE,
      status: 'disconnected',
      statusMessage: 'Disconnected.',
      lastError: err?.message || null,
    };
  }
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
        return await window.electronAPI!.ghlListMedia(params);
      }

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
      if (!res.ok) {
        throw new Error(`Backend media endpoint returned HTTP ${res.status}`);
      }
      return (await res.json()) as GHLMediaListResponse;
    } catch (err: any) {
      return {
        success: false,
        items: [],
        folders: [],
        files: [],
        totalCount: 0,
        offset: params.offset || 0,
        limit: params.limit || 40,
        hasMore: false,
        locationId: params.locationId || DEFAULT_GHL_LOCATION_ID,
        parentId: params.parentId || null,
        fromCache: false,
        syncedAt: new Date().toISOString(),
        errorCode: 'NETWORK_ERROR',
        error: `Unable to reach Pryvix backend service: ${err?.message || 'Network interruption'}`,
      };
    } finally {
      inflightMediaRequests.delete(key);
    }
  })();

  inflightMediaRequests.set(key, requestPromise);
  return requestPromise;
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
    return (await res.json()) as GHLVerifyAssetResult;
  } catch (err: any) {
    return {
      accessible: false,
      status: 0,
      error: err?.message || 'Network error verifying asset',
    };
  }
}
