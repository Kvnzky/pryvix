import type { IncomingMessage, ServerResponse } from 'http';
import {
  checkBackendRateLimit,
  getGhlConnectionStatus,
  handleDisconnectGhl,
  listGhlMedia,
  testGhlConnection,
  verifyGhlMediaAssetUrl,
} from './ghlMediaService';
import { redactSecrets } from './secretStore';
import { GHLFilterTab, GHLSortBy, GHLSortOrder } from '../shared/types';

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on('data', chunk => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > 32 * 1024) {
        reject(new Error('Request payload too large'));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON request body'));
      }
    });
    req.on('error', reject);
  });
}

function verifyClientRequestAuth(req: IncomingMessage): boolean {
  const clientHeader = req.headers['x-pryvix-client'];
  if (clientHeader !== 'pryvix-studio-v1') {
    return false;
  }
  const requiredKey = process.env.PRYVIX_BACKEND_ACCESS_KEY;
  if (requiredKey && requiredKey.trim()) {
    const providedKey = req.headers['x-pryvix-access-key'];
    if (providedKey !== requiredKey.trim()) {
      return false;
    }
  }
  return true;
}

/**
 * Shared Node HTTP middleware serving `/api/ghl/*` for both Vite Web Mode and standalone production web server.
 */
export async function handleGhlApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void
): Promise<boolean> {
  const rawUrl = req.url || '';
  if (!rawUrl.startsWith('/api/ghl/')) {
    if (next) next();
    return false;
  }

  const clientIp = String(req.socket?.remoteAddress || 'local');
  if (!checkBackendRateLimit(clientIp)) {
    sendJson(res, 429, {
      success: false,
      error: 'Too many requests. Please wait a moment and try again.',
      errorCode: 'RATE_LIMITED',
    });
    return true;
  }

  if (!verifyClientRequestAuth(req)) {
    sendJson(res, 401, {
      success: false,
      error: 'Unauthorized application client request.',
      errorCode: 'UNAUTHORIZED',
    });
    return true;
  }

  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (pathname === '/api/ghl/status' && method === 'GET') {
      const status = getGhlConnectionStatus();
      sendJson(res, 200, status);
      return true;
    }

    if (pathname === '/api/ghl/credentials' && method === 'POST') {
      const body = await readJsonBody(req);
      const token = typeof body.token === 'string' ? body.token : undefined;
      const locationId = typeof body.locationId === 'string' ? body.locationId : undefined;
      const status = await testGhlConnection({ token, locationId });
      sendJson(res, 200, status);
      return true;
    }

    if (pathname === '/api/ghl/test-connection' && method === 'POST') {
      const body = await readJsonBody(req);
      const token = typeof body.token === 'string' && body.token.trim() ? body.token : undefined;
      const locationId = typeof body.locationId === 'string' ? body.locationId : undefined;
      const status = await testGhlConnection({ token, locationId });
      sendJson(res, 200, status);
      return true;
    }

    if (pathname === '/api/ghl/disconnect' && method === 'POST') {
      const status = handleDisconnectGhl();
      sendJson(res, 200, status);
      return true;
    }

    if (pathname === '/api/ghl/media' && method === 'GET') {
      const sp = parsedUrl.searchParams;
      const result = await listGhlMedia({
        locationId: sp.get('locationId') || undefined,
        parentId: sp.get('parentId') || null,
        query: sp.get('query') || undefined,
        filterTab: (sp.get('filterTab') as GHLFilterTab) || 'all',
        sortBy: (sp.get('sortBy') as GHLSortBy) || 'updatedAt',
        sortOrder: (sp.get('sortOrder') as GHLSortOrder) || 'desc',
        offset: sp.has('offset') ? Number(sp.get('offset')) : 0,
        limit: sp.has('limit') ? Number(sp.get('limit')) : 40,
        refresh: sp.get('refresh') === 'true',
      });
      sendJson(res, 200, result);
      return true;
    }

    if (pathname === '/api/ghl/verify-asset' && method === 'GET') {
      const assetUrl = parsedUrl.searchParams.get('url') || '';
      const result = await verifyGhlMediaAssetUrl(assetUrl);
      sendJson(res, 200, result);
      return true;
    }

    sendJson(res, 404, {
      success: false,
      error: `Unknown GHL API route: ${method} ${pathname}`,
    });
    return true;
  } catch (err: any) {
    sendJson(res, 500, {
      success: false,
      error: redactSecrets(err?.message || 'Internal backend server error'),
    });
    return true;
  }
}
