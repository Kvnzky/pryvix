/**
 * Centralized, authoritative file-classification utility for GoHighLevel Media Storage.
 *
 * Requirements:
 * - Mutually exclusive: every file belongs to exactly one category ('image' | 'video' | 'pdf' | 'uncategorized').
 * - Primary classification is based strictly on the normalized file extension extracted from the filename.
 * - Case-insensitive, removes leading dot, ignores whitespace, ignores URL query/hash segments and folder paths.
 * - Classification is kept separate from browser preview/playback compatibility.
 */

export type ClassifiedMediaCategory = 'image' | 'video' | 'pdf' | 'uncategorized';

export const SUPPORTED_IMAGE_EXTENSIONS = new Set<string>([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'bmp',
  'tif',
  'tiff',
  'avif',
  'heic',
  'heif',
  'ico',
]);

export const SUPPORTED_VIDEO_EXTENSIONS = new Set<string>([
  'mp4',
  'mov',
  'webm',
  'm4v',
  'avi',
  'mkv',
  'wmv',
  'flv',
  'mpg',
  'mpeg',
  '3gp',
  'mts',
  'm2ts',
  'ts',
  'ogv',
]);

export const SUPPORTED_PDF_EXTENSIONS = new Set<string>(['pdf']);

// Extensions that standard Chromium / web browsers can natively render inline
export const BROWSER_NATIVE_IMAGE_EXTENSIONS = new Set<string>([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'bmp',
  'avif',
  'ico',
]);

export const BROWSER_NATIVE_VIDEO_EXTENSIONS = new Set<string>([
  'mp4',
  'webm',
  'mov',
  'm4v',
  'ogv',
]);

/**
 * Extracts and normalizes the extension from a filename or URL path.
 * - Extracts only from the basename (not from preceding directory/folder segments).
 * - Strips query strings (?...) and anchor hashes (#...).
 * - Converts to lowercase, strips leading dot, and trims whitespace.
 * - Returns empty string if the file has no extension or is a dotfile without extension (.gitignore).
 */
export function extractNormalizedExtension(filenameOrUrl: string): string {
  if (!filenameOrUrl || typeof filenameOrUrl !== 'string') return '';
  try {
    const cleanUrl = filenameOrUrl.split('?')[0].split('#')[0].trim();
    // Get basename (ignore folder paths)
    const baseName = cleanUrl.split(/[\/\\]/).pop() || '';
    const lastDotIndex = baseName.lastIndexOf('.');
    if (lastDotIndex <= 0 || lastDotIndex === baseName.length - 1) {
      return '';
    }
    const rawExt = baseName.substring(lastDotIndex + 1);
    return rawExt.toLowerCase().replace(/^\./, '').trim();
  } catch {
    return '';
  }
}

/**
 * Classifies any media filename or URL into exactly one of four mutually exclusive categories.
 */
export function classifyMediaFile(filenameOrUrl: string): ClassifiedMediaCategory {
  const ext = extractNormalizedExtension(filenameOrUrl);
  if (!ext) {
    return 'uncategorized';
  }
  if (SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
    return 'image';
  }
  if (SUPPORTED_VIDEO_EXTENSIONS.has(ext)) {
    return 'video';
  }
  if (SUPPORTED_PDF_EXTENSIONS.has(ext)) {
    return 'pdf';
  }
  return 'uncategorized';
}

/**
 * Checks whether an image extension can be previewed natively in an <img> tag.
 */
export function isBrowserNativeImage(filenameOrUrl: string): boolean {
  const ext = extractNormalizedExtension(filenameOrUrl);
  return BROWSER_NATIVE_IMAGE_EXTENSIONS.has(ext);
}

/**
 * Checks whether a video extension can be played natively in a <video> element.
 */
export function isBrowserNativeVideo(filenameOrUrl: string): boolean {
  const ext = extractNormalizedExtension(filenameOrUrl);
  return BROWSER_NATIVE_VIDEO_EXTENSIONS.has(ext);
}
