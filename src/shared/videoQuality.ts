import { VideoMetadata, VideoQualityAssessment, VideoQualityRating, VideoQualityCheckItem } from './types';

/**
 * Parses a clean, human-readable filename from a URL or file path.
 */
export function extractVideoFilename(url: string): string {
  if (!url) return 'Unknown video';
  if (url.startsWith('data:')) {
    return 'Embedded Data Video';
  }
  if (url.startsWith('blob:')) {
    return 'Local Uploaded Video (Blob)';
  }
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const parts = pathname.split('/');
    const last = parts[parts.length - 1];
    return last ? decodeURIComponent(last) : 'online-video.mp4';
  } catch {
    const parts = url.split(/[/\\]/);
    return parts[parts.length - 1] || 'video.mp4';
  }
}

/**
 * Formats bytes into human-readable string (KB, MB, GB).
 */
export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes <= 0) {
    return 'Not available';
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Formats duration in seconds into mm:ss format.
 */
export function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds <= 0) {
    return 'Not available';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Computes standard aspect ratio string and decimal.
 */
export function calculateAspectRatio(width?: number, height?: number): { ratioString: string; decimal: number } {
  if (!width || !height || width <= 0 || height <= 0) {
    return { ratioString: 'Not available', decimal: 0 };
  }

  const decimal = parseFloat((width / height).toFixed(2));

  // Determine common standard aspect ratios
  if (Math.abs(decimal - 1.78) <= 0.05) return { ratioString: '16:9 (Widescreen)', decimal };
  if (Math.abs(decimal - 0.56) <= 0.05) return { ratioString: '9:16 (Vertical)', decimal };
  if (Math.abs(decimal - 1.33) <= 0.05) return { ratioString: '4:3 (Standard)', decimal };
  if (Math.abs(decimal - 1.0) <= 0.03) return { ratioString: '1:1 (Square)', decimal };
  if (Math.abs(decimal - 2.33) <= 0.1) return { ratioString: '21:9 (Ultrawide)', decimal };
  if (Math.abs(decimal - 0.8) <= 0.05) return { ratioString: '4:5 (Portrait)', decimal };

  return { ratioString: `${width}:${height} (${decimal}:1)`, decimal };
}

/**
 * Inspects a video URL or File and returns comprehensive VideoMetadata.
 */
export async function extractVideoMetadata(
  source: string | File,
  fileSizeOverride?: number
): Promise<VideoMetadata> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  const filename = typeof source === 'string' ? extractVideoFilename(source) : source.name;
  let fileSizeBytes = typeof source === 'string' ? fileSizeOverride : source.size;

  // Initial metadata structure
  const metadata: VideoMetadata = {
    url: typeof source === 'string' ? source : url,
    filename,
    fileSizeBytes,
    sourceStatus: 'loading',
    playbackStatus: 'ready',
    format: filename.split('.').pop()?.toUpperCase() || 'MP4',
  };

  // If online URL and no fileSize yet, attempt HEAD request
  if (typeof source === 'string' && !fileSizeBytes && url.startsWith('http')) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        metadata.fileSizeBytes = parseInt(contentLength, 10);
      }
      const contentType = response.headers.get('content-type');
      if (contentType) {
        metadata.format = contentType.split('/').pop()?.toUpperCase() || metadata.format;
      }
    } catch {
      // CORS or network might prevent HEAD request; fallback gracefully
    }
  }

  // Load video element to probe dimension, duration, and audio
  return new Promise<VideoMetadata>((resolve) => {
    if (typeof window === 'undefined') {
      metadata.sourceStatus = 'unverified';
      return resolve(metadata);
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.crossOrigin = 'anonymous';

    let resolved = false;
    const finalize = (status: 'accessible' | 'inaccessible', err?: string) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutId);

      metadata.sourceStatus = status;
      if (err) {
        metadata.errorMessage = err;
        metadata.playbackStatus = 'error';
      }

      if (video.videoWidth && video.videoHeight) {
        metadata.width = video.videoWidth;
        metadata.height = video.videoHeight;
        const ratio = calculateAspectRatio(video.videoWidth, video.videoHeight);
        metadata.aspectRatioString = ratio.ratioString;
        metadata.aspectRatioDecimal = ratio.decimal;
      }

      if (!isNaN(video.duration) && isFinite(video.duration) && video.duration > 0) {
        metadata.durationSeconds = parseFloat(video.duration.toFixed(2));
      }

      // Check for audio track
      const hasAudioTrack =
        Boolean((video as any).mozHasAudio) ||
        Boolean((video as any).webkitAudioDecodedByteCount && (video as any).webkitAudioDecodedByteCount > 0) ||
        Boolean((video as any).audioTracks && (video as any).audioTracks.length > 0);
      metadata.hasAudio = hasAudioTrack;

      // Detect container/codec hints
      if (video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) {
        metadata.codec = 'H.264 (AVC) / AAC compatible';
      } else if (video.canPlayType('video/webm; codecs="vp8, vorbis"') || video.canPlayType('video/webm; codecs="vp9"')) {
        metadata.codec = 'VP8 / VP9 WebM compatible';
      } else {
        metadata.codec = 'Standard Web-compatible';
      }

      // Cleanup probe element
      video.src = '';
      video.remove();
      resolve(metadata);
    };

    // 8 second timeout safeguard
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        finalize('inaccessible', 'Timed out retrieving video stream metadata');
      }
    }, 8000);

    video.onloadedmetadata = () => {
      finalize('accessible');
    };

    video.onerror = () => {
      const errorMsg = video.error
        ? `Media error code ${video.error.code}: ${video.error.message || 'Source unreachable or unsupported format'}`
        : 'Failed to load video';
      finalize('inaccessible', errorMsg);
    };

    video.src = url;
  });
}

/**
 * Assesses whether a video is suitable for use as a Desktop or Mobile background.
 */
export function assessVideoQuality(
  metadata: VideoMetadata,
  targetRole: 'desktop' | 'mobile' | 'universal'
): VideoQualityAssessment {
  const items: VideoQualityCheckItem[] = [];

  // 1. Accessibility & Source check
  if (metadata.sourceStatus === 'inaccessible' || metadata.playbackStatus === 'error') {
    const playbackCheck: VideoQualityCheckItem = {
      name: 'Source & Playback Status',
      rating: 'fail',
      message: metadata.errorMessage || 'Video source failed to load or is unreachable.',
      recommendation: 'Check that the URL is public, accessible over HTTPS, and uses an MP4 container with H.264 codec.',
    };
    return {
      overallRating: 'unable_to_verify',
      targetRole,
      scoreSummary: 'Unable to verify video source',
      items: [playbackCheck],
      resolutionCheck: { name: 'Resolution Check', rating: 'unknown', message: 'Resolution unavailable.' },
      aspectRatioCheck: { name: 'Aspect Ratio Check', rating: 'unknown', message: 'Aspect ratio unavailable.' },
      fileSizeCheck: { name: 'File Size Check', rating: 'unknown', message: 'File size unavailable.' },
      playbackCheck,
      loopingCheck: { name: 'Looping Check', rating: 'unknown', message: 'Duration unavailable.' },
    };
  }

  // 2. Resolution Check
  let resolutionCheck: VideoQualityCheckItem;
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (!width || !height) {
    resolutionCheck = {
      name: 'Resolution Check',
      rating: 'unknown',
      message: 'Resolution dimensions could not be read from stream.',
      recommendation: 'Ensure the video has standard metadata headers.',
    };
  } else if (targetRole === 'desktop') {
    if (width >= 1920 && height >= 1080) {
      resolutionCheck = {
        name: 'Resolution Check',
        rating: 'pass',
        message: `High Definition ${width}x${height}px — crisp rendering across large desktop displays.`,
      };
    } else if (width >= 1280 && height >= 720) {
      resolutionCheck = {
        name: 'Resolution Check',
        rating: 'pass',
        message: `Standard HD ${width}x${height}px — adequate for most desktop screens.`,
      };
    } else if (width >= 854 && height >= 480) {
      resolutionCheck = {
        name: 'Resolution Check',
        rating: 'warn',
        message: `Medium resolution ${width}x${height}px — may appear soft or slightly blurred on 1440p/4K monitors.`,
        recommendation: 'Use a 1920x1080 resolution video for optimal visual fidelity on desktop hero sections.',
      };
    } else {
      resolutionCheck = {
        name: 'Resolution Check',
        rating: 'fail',
        message: `Low resolution ${width}x${height}px — will appear heavily pixelated on desktop devices.`,
        recommendation: 'Replace with at least 1280x720 (HD) or 1920x1080 (Full HD) video.',
      };
    }
  } else {
    // Mobile role
    if (height >= 1280 && width >= 720) {
      resolutionCheck = {
        name: 'Resolution Check',
        rating: 'pass',
        message: `Crisp vertical resolution ${width}x${height}px — excellent clarity on modern mobile screens.`,
      };
    } else if (height >= 854 || width >= 480) {
      resolutionCheck = {
        name: 'Resolution Check',
        rating: 'pass',
        message: `Standard mobile resolution ${width}x${height}px — adequate for mobile viewports.`,
      };
    } else {
      resolutionCheck = {
        name: 'Resolution Check',
        rating: 'warn',
        message: `Low resolution ${width}x${height}px — may appear fuzzy on high-DPI retina displays.`,
        recommendation: 'Provide a video with at least 720x1280 vertical resolution for mobile backgrounds.',
      };
    }
  }
  items.push(resolutionCheck);

  // 3. Aspect Ratio Match
  let aspectRatioCheck: VideoQualityCheckItem;
  const aspectDecimal = metadata.aspectRatioDecimal || 0;

  if (aspectDecimal <= 0) {
    aspectRatioCheck = {
      name: 'Aspect Ratio Check',
      rating: 'unknown',
      message: 'Aspect ratio could not be determined.',
    };
  } else if (targetRole === 'desktop') {
    if (aspectDecimal >= 1.6 && aspectDecimal <= 1.9) {
      aspectRatioCheck = {
        name: 'Aspect Ratio Check',
        rating: 'pass',
        message: `Standard landscape widescreen (${metadata.aspectRatioString}) matches desktop hero layout.`,
      };
    } else if (aspectDecimal > 1.9) {
      aspectRatioCheck = {
        name: 'Aspect Ratio Check',
        rating: 'warn',
        message: `Ultrawide aspect ratio (${metadata.aspectRatioString}) — vertical edges may be cropped by object-fit: cover.`,
        recommendation: 'Verify in Live Preview that key subject matter remains centered.',
      };
    } else {
      aspectRatioCheck = {
        name: 'Aspect Ratio Check',
        rating: 'fail',
        message: `Portrait/Square aspect ratio (${metadata.aspectRatioString}) used for desktop background — significant top/bottom cropping will occur.`,
        recommendation: 'Use a 16:9 landscape video for desktop hero background.',
      };
    }
  } else {
    // Mobile role
    if (aspectDecimal <= 0.75) {
      aspectRatioCheck = {
        name: 'Aspect Ratio Check',
        rating: 'pass',
        message: `Vertical aspect ratio (${metadata.aspectRatioString}) naturally fits mobile portrait viewports.`,
      };
    } else if (aspectDecimal <= 1.1) {
      aspectRatioCheck = {
        name: 'Aspect Ratio Check',
        rating: 'warn',
        message: `Square ratio (${metadata.aspectRatioString}) on mobile screen will be cropped on top and bottom under object-fit: cover.`,
        recommendation: 'Use a 9:16 vertical video for mobile hero background.',
      };
    } else {
      aspectRatioCheck = {
        name: 'Aspect Ratio Check',
        rating: 'fail',
        message: `Horizontal landscape video (${metadata.aspectRatioString}) used for mobile background — horizontal framing will suffer severe cropping on narrow mobile screens.`,
        recommendation: 'Provide a dedicated 9:16 vertical video specifically optimized for mobile devices.',
      };
    }
  }
  items.push(aspectRatioCheck);

  // 4. File Size Practicality
  let fileSizeCheck: VideoQualityCheckItem;
  const size = metadata.fileSizeBytes || 0;

  if (!size) {
    fileSizeCheck = {
      name: 'File Size Check',
      rating: 'unknown',
      message: 'File size not reported by host server.',
      recommendation: 'Ensure your CDN or host server provides Content-Length headers.',
    };
  } else {
    const sizeMb = size / (1024 * 1024);
    const maxRecommendedMb = targetRole === 'mobile' ? 8 : 16;
    const warnThresholdMb = targetRole === 'mobile' ? 14 : 25;

    if (sizeMb <= maxRecommendedMb) {
      fileSizeCheck = {
        name: 'File Size Check',
        rating: 'pass',
        message: `Optimal file size (${formatBytes(size)}) for high-speed landing page delivery.`,
      };
    } else if (sizeMb <= warnThresholdMb) {
      fileSizeCheck = {
        name: 'File Size Check',
        rating: 'warn',
        message: `Moderate file size (${formatBytes(size)}) — may increase page weight on slower mobile connections.`,
        recommendation: `Consider compressing video to under ${maxRecommendedMb}MB using H.264 at CRF 24-26.`,
      };
    } else {
      fileSizeCheck = {
        name: 'File Size Check',
        rating: 'fail',
        message: `Excessive file size (${formatBytes(size)}) — will severely impact initial page load time and mobile bandwidth.`,
        recommendation: `Compress this background video below ${maxRecommendedMb}MB. Since background video plays automatically, bitrate can be trimmed without loss of visible quality.`,
      };
    }
  }
  items.push(fileSizeCheck);

  // 5. Looping Suitability Check
  let loopingCheck: VideoQualityCheckItem;
  const duration = metadata.durationSeconds || 0;

  if (!duration) {
    loopingCheck = {
      name: 'Looping Check',
      rating: 'unknown',
      message: 'Duration unavailable.',
    };
  } else if (duration >= 3 && duration <= 30) {
    loopingCheck = {
      name: 'Looping Check',
      rating: 'pass',
      message: `Ideal background loop duration (${formatDuration(duration)}) — repeats smoothly without ballooning memory.`,
    };
  } else if (duration < 3) {
    loopingCheck = {
      name: 'Looping Check',
      rating: 'warn',
      message: `Very short duration (${formatDuration(duration)}) — may produce a jittery or jarring loop cycle.`,
      recommendation: 'Use a seamless loop of at least 4-8 seconds for a polished ambient background.',
    };
  } else {
    loopingCheck = {
      name: 'Looping Check',
      rating: 'warn',
      message: `Long background duration (${formatDuration(duration)}) — extended videos consume excessive user bandwidth.`,
      recommendation: 'Trim background loop to 10-20 seconds of continuous ambient motion.',
    };
  }
  items.push(loopingCheck);

  // 6. Playback check
  const playbackCheck: VideoQualityCheckItem = {
    name: 'Playback & Codec Compatibility',
    rating: 'pass',
    message: `${metadata.format} container with ${metadata.codec || 'standard web'} codec confirmed playable in browser.`,
  };
  items.push(playbackCheck);

  // Compute Overall Rating
  const hasFail = items.some((i) => i.rating === 'fail');
  const hasWarn = items.some((i) => i.rating === 'warn');

  let overallRating: VideoQualityRating;
  let scoreSummary: string;

  if (hasFail) {
    overallRating = 'poor';
    scoreSummary = 'Requires Optimization — Key properties (resolution, aspect ratio, or file size) need adjustment.';
  } else if (hasWarn) {
    overallRating = 'needs_attention';
    scoreSummary = 'Usable with Minor Warnings — Video functions as background but could be optimized.';
  } else {
    overallRating = 'good';
    scoreSummary = 'Excellent Background Asset — Meets all resolution, aspect ratio, and performance standards.';
  }

  return {
    overallRating,
    targetRole,
    scoreSummary,
    items,
    resolutionCheck,
    aspectRatioCheck,
    fileSizeCheck,
    playbackCheck,
    loopingCheck,
  };
}
