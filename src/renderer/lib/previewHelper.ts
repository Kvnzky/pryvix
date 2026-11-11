/**
 * Preview Helper for Landing Page Studio
 *
 * Injects preview-only initialization scripts, interactive playback controls,
 * timeline seek bar, and non-intrusive diagnostics for live preview iframe rendering.
 *
 * CRITICAL ARCHITECTURAL GUARANTEE:
 * 1. This is ONLY injected into the live preview iframe srcDoc.
 * 2. It is NEVER saved to project.currentHtml or project files.
 * 3. It is NEVER included in exported HTML, ZIP packages, or Notepad exports.
 * 4. Production HTML remains 100% identical to the reference implementation.
 */

export const PREVIEW_MARKER_START = '<!-- LPS_PREVIEW_INJECTION_START -->';
export const PREVIEW_MARKER_END = '<!-- LPS_PREVIEW_INJECTION_END -->';

/**
 * Removes any preview-only injection markers or scripts if present.
 */
export function stripPreviewInjections(html: string): string {
  if (!html) return '';
  const regex = new RegExp(`${PREVIEW_MARKER_START}[\\s\\S]*?${PREVIEW_MARKER_END}`, 'g');
  return html.replace(regex, '').trim();
}

/**
 * Generates the live preview HTML by injecting a preview-only playback controller
 * directly before </body> (or appended at the end of the markup).
 */
export function generatePreviewHtml(rawHtml: string): string {
  if (!rawHtml) return '';

  // Ensure clean base HTML without nested injection markers
  const cleanHtml = stripPreviewInjections(rawHtml);

  const previewScriptAndStyles = `
${PREVIEW_MARKER_START}
<style id="__lps_preview_video_styles">
  .__lps-video-play-btn {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(37, 99, 235, 0.95);
    color: #ffffff;
    padding: 10px 24px;
    border-radius: 9999px;
    font-family: 'Montserrat', system-ui, -apple-system, sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.5px;
    box-shadow: 0 4px 25px rgba(0, 0, 0, 0.8), 0 0 15px rgba(37, 99, 235, 0.6);
    cursor: pointer;
    z-index: 9999999;
    display: none;
    align-items: center;
    gap: 8px;
    border: 1px solid rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(8px);
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease;
    user-select: none;
  }
  .__lps-video-play-btn:hover {
    transform: translateX(-50%) scale(1.05);
    background: #1d4ed8;
  }
  .__lps-video-play-btn:active {
    transform: translateX(-50%) scale(0.97);
  }

  /* Live Preview Playback Toolbar */
  .__lps-preview-toolbar {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(14, 18, 27, 0.94);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 8px 14px;
    display: none;
    align-items: center;
    gap: 10px;
    z-index: 9999998;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255,255,255,0.05);
    backdrop-filter: blur(12px);
    font-family: 'Montserrat', system-ui, -apple-system, sans-serif;
    color: #ffffff;
    font-size: 11px;
    user-select: none;
    max-width: 90%;
    transition: opacity 0.2s ease;
  }
  .__lps-preview-toolbar button {
    background: transparent;
    border: none;
    color: #ffffff;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, transform 0.1s;
  }
  .__lps-preview-toolbar button:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .__lps-preview-toolbar button:active {
    transform: scale(0.92);
  }
  .__lps-preview-time {
    font-family: monospace;
    font-size: 10px;
    color: #94a3b8;
    white-space: nowrap;
  }
  .__lps-preview-scrubber {
    -webkit-appearance: none;
    appearance: none;
    width: 120px;
    height: 4px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.25);
    outline: none;
    cursor: pointer;
  }
  .__lps-preview-scrubber::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #2563eb;
    cursor: pointer;
    box-shadow: 0 0 6px rgba(37, 99, 235, 0.8);
    transition: transform 0.1s;
  }
  .__lps-preview-scrubber::-webkit-slider-thumb:hover {
    transform: scale(1.25);
  }
  .__lps-preview-badge {
    background: rgba(124, 58, 237, 0.2);
    border: 1px solid rgba(124, 58, 237, 0.4);
    color: #c4b5fd;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .__lps-video-diag-badge {
    position: fixed;
    top: 14px;
    right: 14px;
    background: rgba(20, 20, 20, 0.94);
    color: #ffaa00;
    padding: 8px 14px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 11px;
    border: 1px solid rgba(255, 170, 0, 0.4);
    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    z-index: 9999999;
    display: none;
    max-width: 340px;
    word-break: break-all;
    line-height: 1.4;
  }
</style>

<!-- Fallback Play Button for restricted autoplay -->
<div id="__lps_video_play_btn" class="__lps-video-play-btn" title="Click to enable video playback in preview">
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
  <span>▶ Click to Play Video</span>
</div>

<!-- Live Preview Playback Toolbar -->
<div id="__lps_preview_toolbar" class="__lps-preview-toolbar">
  <span id="__lps_preview_badge" class="__lps-preview-badge">DESKTOP VIDEO</span>
  <button id="__lps_ctrl_playpause" title="Play / Pause">
    <svg id="__lps_icon_play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
    <svg id="__lps_icon_pause" style="display:none;" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
  </button>
  <button id="__lps_ctrl_replay" title="Replay">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
  </button>
  <input type="range" id="__lps_ctrl_scrubber" class="__lps-preview-scrubber" min="0" max="100" value="0" step="0.1" title="Scrub timeline">
  <span id="__lps_ctrl_time" class="__lps-preview-time">0:00 / 0:00</span>
  <button id="__lps_ctrl_mute" title="Mute / Unmute preview audio">
    <svg id="__lps_icon_muted" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
    <svg id="__lps_icon_unmuted" style="display:none;" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
  </button>
</div>

<div id="__lps_video_diag_badge" class="__lps-video-diag-badge"></div>

<script id="__lps_preview_video_helper">
(function() {
  var playBtn = document.getElementById('__lps_video_play_btn');
  var toolbar = document.getElementById('__lps_preview_toolbar');
  var diagBadge = document.getElementById('__lps_video_diag_badge');
  var badge = document.getElementById('__lps_preview_badge');
  var playPauseBtn = document.getElementById('__lps_ctrl_playpause');
  var replayBtn = document.getElementById('__lps_ctrl_replay');
  var scrubber = document.getElementById('__lps_ctrl_scrubber');
  var timeDisplay = document.getElementById('__lps_ctrl_time');
  var muteBtn = document.getElementById('__lps_ctrl_mute');
  var iconPlay = document.getElementById('__lps_icon_play');
  var iconPause = document.getElementById('__lps_icon_pause');
  var iconMuted = document.getElementById('__lps_icon_muted');
  var iconUnmuted = document.getElementById('__lps_icon_unmuted');

  var currentActiveVideo = null;
  var isUserScrubbing = false;

  function formatTime(s) {
    if (!s || isNaN(s) || s < 0) return '0:00';
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }

  function showDiag(msg) {
    if (diagBadge) {
      diagBadge.textContent = msg;
      diagBadge.style.display = 'block';
    }
  }

  var lastPostedStatus = null;
  function postStatusToParent(status, video) {
    if (status === lastPostedStatus) return;
    lastPostedStatus = status;
    try {
      window.parent.postMessage({
        type: 'LPS_VIDEO_PLAYBACK_UPDATE',
        status: status,
        currentTime: video ? video.currentTime : 0,
        duration: video ? video.duration : 0,
        videoWidth: video ? video.videoWidth : 0,
        videoHeight: video ? video.videoHeight : 0,
        isMuted: video ? video.muted : true,
      }, '*');
    } catch(e) {}
  }

  function getActiveAndInactiveVideos() {
    var isMobile = window.innerWidth < 768;
    var mobileBox = document.querySelector('.slider-mobile');
    var desktopBox = document.querySelector('.hero-section');

    var mobileVideo = mobileBox ? mobileBox.querySelector('video') : null;
    var desktopVideo = desktopBox ? desktopBox.querySelector('video') : null;

    if (isMobile && mobileVideo) {
      return { active: mobileVideo, inactive: desktopVideo, role: 'mobile' };
    }
    if (!isMobile && desktopVideo) {
      return { active: desktopVideo, inactive: mobileVideo, role: 'desktop' };
    }

    // Generic fallback
    var all = document.querySelectorAll('video');
    for (var i = 0; i < all.length; i++) {
      var v = all[i];
      if (v.offsetParent !== null || window.getComputedStyle(v).display !== 'none') {
        return { active: v, inactive: null, role: 'universal' };
      }
    }
    return { active: all[0] || null, inactive: null, role: 'universal' };
  }

  function updateToolbarState(video) {
    if (!video || !toolbar) return;
    toolbar.style.display = 'flex';

    if (video.paused) {
      if (iconPlay) iconPlay.style.display = 'block';
      if (iconPause) iconPause.style.display = 'none';
    } else {
      if (iconPlay) iconPlay.style.display = 'none';
      if (iconPause) iconPause.style.display = 'block';
    }

    if (video.muted) {
      if (iconMuted) iconMuted.style.display = 'block';
      if (iconUnmuted) iconUnmuted.style.display = 'none';
    } else {
      if (iconMuted) iconMuted.style.display = 'none';
      if (iconUnmuted) iconUnmuted.style.display = 'block';
    }

    if (!isUserScrubbing && video.duration) {
      var pct = (video.currentTime / video.duration) * 100;
      if (scrubber) scrubber.value = isNaN(pct) ? 0 : pct;
      if (timeDisplay) timeDisplay.textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);
    }
  }

  function initVideoPlayback() {
    var allVideos = document.querySelectorAll('video');
    if (!allVideos || allVideos.length === 0) {
      if (toolbar) toolbar.style.display = 'none';
      return;
    }

    allVideos.forEach(function(v) {
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('autoplay', '');
      v.setAttribute('loop', '');

      // CRITICAL: Ensure video has direct src and load only if not yet initialized
      var srcEl = v.querySelector('source');
      var sourceUrl = v.getAttribute('src') || (srcEl ? srcEl.getAttribute('src') : '') || v.src || (srcEl ? srcEl.src : '');
      if (sourceUrl && (!v.src || v.src === '' || v.src.endsWith('/'))) {
        v.src = sourceUrl;
        try {
          v.load();
        } catch(e) {}
      } else if (v.readyState === 0 && sourceUrl) {
        try {
          v.load();
        } catch(e) {}
      }
    });

    var targets = getActiveAndInactiveVideos();
    var active = targets.active;
    var inactive = targets.inactive;
    var role = targets.role;

    // Immediately pause inactive video to eliminate duplicate decoding workload
    if (inactive) {
      try {
        if (!inactive.paused) inactive.pause();
      } catch(e) {}
    }

    if (active) {
      currentActiveVideo = active;
      if (badge) {
        badge.textContent = role === 'mobile' ? 'MOBILE VIDEO' : 'DESKTOP VIDEO';
      }

      // Check source URL
      var srcEl = active.querySelector('source');
      var sourceUrl = active.src || (srcEl ? srcEl.src : '');
      if (!sourceUrl || sourceUrl.trim() === '') {
        showDiag('⚠️ No video source URL configured');
      }

      active.onerror = function() {
        showDiag('⚠️ Background Video Error: Video failed to load or unsupported codec');
        postStatusToParent('error', active);
      };
      if (srcEl) {
        srcEl.onerror = function() {
          showDiag('⚠️ Background Video Error: Source URL unreachable');
          postStatusToParent('error', active);
        };
      }

      // Listen to time updates for preview toolbar (update DOM directly, zero parent churn)
      active.ontimeupdate = function() {
        updateToolbarState(active);
      };

      active.onplay = function() {
        updateToolbarState(active);
        if (playBtn) playBtn.style.display = 'none';
        postStatusToParent('playing', active);
      };

      active.onpause = function() {
        updateToolbarState(active);
        postStatusToParent('paused', active);
      };

      // Play active video immediately
      var playPromise = active.play();
      if (playPromise !== undefined) {
        playPromise.then(function() {
          if (playBtn) playBtn.style.display = 'none';
          updateToolbarState(active);
        }).catch(function(err) {
          console.warn('[Landing Page Studio Preview] Autoplay prevented:', err);
          if (playBtn) playBtn.style.display = 'flex';
          updateToolbarState(active);
          postStatusToParent('autoplay_blocked', active);
        });
      }
    }
  }

  // Play/Pause button
  if (playPauseBtn) {
    playPauseBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!currentActiveVideo) return;
      if (currentActiveVideo.paused) {
        currentActiveVideo.play().catch(function(){});
      } else {
        currentActiveVideo.pause();
      }
      updateToolbarState(currentActiveVideo);
    });
  }

  // Replay button
  if (replayBtn) {
    replayBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!currentActiveVideo) return;
      currentActiveVideo.currentTime = 0;
      currentActiveVideo.play().catch(function(){});
      updateToolbarState(currentActiveVideo);
    });
  }

  // Scrubber seeking
  if (scrubber) {
    scrubber.addEventListener('input', function(e) {
      isUserScrubbing = true;
      if (currentActiveVideo && currentActiveVideo.duration) {
        var pct = parseFloat(e.target.value);
        var targetTime = (pct / 100) * currentActiveVideo.duration;
        if (timeDisplay) timeDisplay.textContent = formatTime(targetTime) + ' / ' + formatTime(currentActiveVideo.duration);
      }
    });

    scrubber.addEventListener('change', function(e) {
      if (currentActiveVideo && currentActiveVideo.duration) {
        var pct = parseFloat(e.target.value);
        currentActiveVideo.currentTime = (pct / 100) * currentActiveVideo.duration;
      }
      isUserScrubbing = false;
      updateToolbarState(currentActiveVideo);
    });
  }

  // Mute toggle
  if (muteBtn) {
    muteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!currentActiveVideo) return;
      currentActiveVideo.muted = !currentActiveVideo.muted;
      updateToolbarState(currentActiveVideo);
    });
  }

  // Fallback play button click
  if (playBtn) {
    playBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var all = document.querySelectorAll('video');
      all.forEach(function(v) {
        v.muted = true;
        v.defaultMuted = true;
        v.play().catch(function(){});
      });
      initVideoPlayback();
      playBtn.style.display = 'none';
    });
  }

  // Pointer click fallback to unlock media
  document.addEventListener('pointerdown', function() {
    var targets = getActiveAndInactiveVideos();
    if (targets.active && targets.active.paused) {
      targets.active.muted = true;
      targets.active.play().then(function() {
        if (playBtn) playBtn.style.display = 'none';
      }).catch(function(){});
    }
  }, { once: true });

  // Responsive resizing
  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(initVideoPlayback, 60);
  });

  if (window.matchMedia) {
    var mq = window.matchMedia('(max-width: 767.98px)');
    if (mq.addEventListener) {
      mq.addEventListener('change', initVideoPlayback);
    } else if (mq.addListener) {
      mq.addListener(initVideoPlayback);
    }
  }

  // Initial load
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initVideoPlayback();
    setTimeout(initVideoPlayback, 200);
    setTimeout(initVideoPlayback, 800);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      initVideoPlayback();
      setTimeout(initVideoPlayback, 200);
      setTimeout(initVideoPlayback, 800);
    });
  }
})();
</script>
${PREVIEW_MARKER_END}
`;

  // Ensure preview iframe allows all media and data streaming without CSP restrictions
  const previewCspMeta = `${PREVIEW_MARKER_START}<meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; media-src * https: http: blob: data:; img-src * data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline';">${PREVIEW_MARKER_END}`;

  let finalHtml = cleanHtml;
  if (finalHtml.includes('<head>')) {
    finalHtml = finalHtml.replace('<head>', `<head>\n  ${previewCspMeta}`);
  } else if (finalHtml.includes('<head ')) {
    finalHtml = finalHtml.replace(/(<head[^>]*>)/i, `$1\n  ${previewCspMeta}`);
  }

  if (finalHtml.includes('</body>')) {
    return finalHtml.replace('</body>', `${previewScriptAndStyles}\n</body>`);
  }
  return finalHtml + previewScriptAndStyles;
}
