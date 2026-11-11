/**
 * Blob URL Manager
 * 
 * Tracks created object URLs in application memory, prevents leaks,
 * and ensures safe revocation when replaced or unmounted.
 */

const trackedUrls = new Set<string>();

export function createTrackedBlobUrl(blobOrFile: Blob | File): string {
  const url = URL.createObjectURL(blobOrFile);
  trackedUrls.add(url);
  return url;
}

export function revokeTrackedBlobUrl(url?: string): void {
  if (!url || typeof url !== 'string') return;
  if (url.startsWith('blob:') && trackedUrls.has(url)) {
    try {
      URL.revokeObjectURL(url);
      trackedUrls.delete(url);
    } catch {
      // Ignore revocation error if already revoked
    }
  }
}

export function cleanupAllBlobUrls(): void {
  trackedUrls.forEach(url => {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  });
  trackedUrls.clear();
}
