import React, { useState, useEffect, useRef, memo } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  Globe,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Code,
  FolderPlus,
  Eye,
  Check,
  Palette,
  Image as ImageIcon,
  Video,
  Play,
} from 'lucide-react';
import { ImageAsset } from '@shared/types';
import { checkUrlStatus, checkVideoUrlStatus } from '@shared/parser';
import {
  DEFAULT_VIDEO_DESKTOP_URL,
  DEFAULT_VIDEO_MOBILE_URL,
} from '@shared/referenceTemplates';
import { LibraryModal } from './LibraryModal';
import { createTrackedBlobUrl, revokeTrackedBlobUrl } from '../lib/blobManager';

interface AssetCardProps {
  asset: ImageAsset;
  onReplaceUrl: (assetId: string, newUrl: string) => void;
  onRestoreOriginal: (assetId: string) => void;
  onJumpToCode?: (lineNumber?: number) => void;
}

const PRESET_COLORS = [
  { label: 'Pitch Black', hex: '#050505' },
  { label: 'Deep Charcoal', hex: '#0e1117' },
  { label: 'Navy Studio', hex: '#131722' },
  { label: 'Mega Red', hex: '#e10600' },
  { label: 'Vibrant Red', hex: '#ff1e18' },
  { label: 'Dark Slate', hex: '#1a1f2c' },
  { label: 'Neutral Gray', hex: '#384259' },
  { label: 'Pure White', hex: '#ffffff' },
];

const AssetCardComponent: React.FC<AssetCardProps> = ({
  asset,
  onReplaceUrl,
  onRestoreOriginal,
  onJumpToCode,
}) => {
  const isVideoAsset =
    asset.type === 'html_video' ||
    ['.mp4', '.webm', '.mov', '.m4v'].some(ext =>
      (asset.replacementUrl || asset.currentUrl || '').toLowerCase().includes(ext)
    ) ||
    (asset.replacementUrl || asset.currentUrl || '').startsWith('data:video/');

  const isCurrentColor =
    !isVideoAsset && (asset.replacementUrl || asset.currentUrl || '').trim().startsWith('#');

  const isCssBackground =
    !isVideoAsset &&
    (asset.type === 'css_background' ||
      asset.type === 'inline_style_bg' ||
      asset.role.includes('bg') ||
      /background/i.test(asset.label) ||
      /background/i.test(asset.selectorOrLocation));

  const defaultVideoForDevice =
    asset.device === 'mobile' || /mobile/i.test(asset.label)
      ? DEFAULT_VIDEO_MOBILE_URL
      : DEFAULT_VIDEO_DESKTOP_URL;

  const [inputUrl, setInputUrl] = useState(asset.replacementUrl || asset.currentUrl || '');
  const [bgMode, setBgMode] = useState<'url' | 'color' | 'video'>(
    isVideoAsset ? 'video' : isCurrentColor ? 'color' : 'url'
  );
  const [colorHex, setColorHex] = useState(
    isCurrentColor ? (asset.replacementUrl || asset.currentUrl || '').trim() : '#050505'
  );
  const [videoUrl, setVideoUrl] = useState(
    isVideoAsset
      ? (asset.replacementUrl || asset.currentUrl || '').trim() || defaultVideoForDevice
      : defaultVideoForDevice
  );

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);
  const [isThumbnailHovered, setIsThumbnailHovered] = useState(false);
  const videoThumbnailRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoThumbnailRef.current) return;
    if (isThumbnailHovered) {
      videoThumbnailRef.current.play().catch(() => {});
    } else {
      videoThumbnailRef.current.pause();
    }
  }, [isThumbnailHovered]);

  useEffect(() => {
    const val = asset.replacementUrl || asset.currentUrl || '';
    setInputUrl(val);

    if (isVideoAsset) {
      setBgMode('video');
      setVideoUrl(val.trim() || defaultVideoForDevice);
    } else if (val.trim().startsWith('#')) {
      setBgMode('color');
      setColorHex(val.trim());
    } else {
      setBgMode('url');
    }
  }, [asset.currentUrl, asset.replacementUrl, asset.type, isVideoAsset, defaultVideoForDevice]);

  const urlStatus =
    bgMode === 'video'
      ? checkVideoUrlStatus(videoUrl)
      : checkUrlStatus(bgMode === 'color' ? colorHex : inputUrl);

  const isModified = asset.currentUrl !== asset.originalUrl;

  const handleApplyUrl = () => {
    if (!inputUrl.trim()) return;
    onReplaceUrl(asset.id, inputUrl.trim());
    setLocalFeedback('Image Applied!');
    setTimeout(() => setLocalFeedback(null), 2000);
  };

  const handleApplyColor = (hexToApply?: string) => {
    const val = hexToApply || colorHex;
    if (!val.trim()) return;
    onReplaceUrl(asset.id, val.trim());
    setLocalFeedback('Color Applied!');
    setTimeout(() => setLocalFeedback(null), 2000);
  };

  const handleApplyVideo = (valToApply?: string) => {
    const val = (valToApply !== undefined ? valToApply : videoUrl).trim();
    if (!val) return;
    onReplaceUrl(asset.id, val);
    setLocalFeedback('Video Applied!');
    setTimeout(() => setLocalFeedback(null), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (bgMode === 'video' || file.type.startsWith('video/')) {
      revokeTrackedBlobUrl(videoUrl);
      const blobUrl = createTrackedBlobUrl(file);
      setVideoUrl(blobUrl);
      setBgMode('video');
      onReplaceUrl(asset.id, blobUrl);
      setLocalFeedback('Video Uploaded & Applied');
      setTimeout(() => setLocalFeedback(null), 2500);
      return;
    }

    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      setInputUrl(dataUrl);
      setBgMode('url');
      onReplaceUrl(asset.id, dataUrl);
      setLocalFeedback('Image Uploaded & Applied');
      setTimeout(() => setLocalFeedback(null), 2500);
    };
    reader.readAsDataURL(file);
  };

  const deviceBadge = () => {
    switch (asset.device) {
      case 'desktop':
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium bg-blue-950/60 text-blue-400 border border-blue-800/40 px-2 py-0.5 rounded-full">
            <Monitor className="w-2.5 h-2.5" /> Desktop
          </span>
        );
      case 'tablet':
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium bg-purple-950/60 text-purple-400 border border-purple-800/40 px-2 py-0.5 rounded-full">
            <Tablet className="w-2.5 h-2.5" /> Tablet/Mobile
          </span>
        );
      case 'mobile':
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium bg-amber-950/60 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded-full">
            <Smartphone className="w-2.5 h-2.5" /> Mobile
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[10px] font-medium bg-gray-800 text-gray-300 border border-gray-700 px-2 py-0.5 rounded-full">
            <Globe className="w-2.5 h-2.5" /> Universal
          </span>
        );
    }
  };

  const statusIndicator = () => {
    if (urlStatus.status === 'valid') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400" title={urlStatus.message}>
          <CheckCircle2 className="w-3 h-3" /> {bgMode === 'color' ? 'Valid Hex Color' : 'Valid URL'}
        </span>
      );
    }
    if (urlStatus.status === 'unhosted_local') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-amber-400" title={urlStatus.message}>
          <AlertTriangle className="w-3 h-3" /> Local File (Unhosted)
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] text-red-400" title={urlStatus.message}>
        <XCircle className="w-3 h-3" /> Invalid Value
      </span>
    );
  };

  const isCurrentValueHex = Boolean(asset.currentUrl?.trim().startsWith('#'));

  return (
    <div className="bg-[#121829] border border-[#1e2942] hover:border-[#2a3c61] rounded-xl p-4 transition-all duration-200 flex flex-col justify-between shadow-lg">
      <div>
        {/* Top Header */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-white tracking-wide">{asset.label}</h4>
              {deviceBadge()}
              {isModified && (
                <span className="text-[9px] bg-violet-600/20 text-violet-300 font-mono px-1.5 py-0.2 rounded border border-violet-500/30">
                  MODIFIED
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-400 font-mono mt-0.5 flex items-center gap-2">
              <span>{asset.type.replace('_', ' ').toUpperCase()}</span>
              <span>•</span>
              <span className="text-gray-400">{isCurrentValueHex ? 'HEX' : asset.fileType}</span>
              {asset.htmlLineNumber && (
                <>
                  <span>•</span>
                  <button
                    onClick={() => onJumpToCode?.(asset.htmlLineNumber)}
                    className="text-gray-400 hover:text-white flex items-center gap-0.5 underline transition-colors"
                  >
                    <Code className="w-2.5 h-2.5" /> Line {asset.htmlLineNumber}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Quick Preview Button */}
          <button
            onClick={() => setIsPreviewModalOpen(true)}
            title="Inspect Preview"
            className="p-1 rounded-md bg-[#182030] hover:bg-[#202b40] text-gray-300 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Thumbnail Preview Area */}
        <div
          className="relative h-32 rounded-lg border border-[#1f2638] overflow-hidden flex items-center justify-center p-2 mb-3 group transition-colors"
          style={{
            backgroundColor: isCurrentValueHex ? asset.currentUrl : '#090a0f',
          }}
        >
          {isVideoAsset ? (
            <div
              className="w-full h-full relative flex items-center justify-center bg-black rounded overflow-hidden cursor-pointer"
              onMouseEnter={() => setIsThumbnailHovered(true)}
              onMouseLeave={() => {
                setIsThumbnailHovered(false);
                if (videoThumbnailRef.current) {
                  videoThumbnailRef.current.pause();
                }
              }}
              title="Hover to preview playback"
            >
              <video
                ref={videoThumbnailRef}
                key={videoUrl || asset.currentUrl}
                src={videoUrl || asset.currentUrl}
                preload="metadata"
                loop
                muted
                playsInline
                className="max-h-full max-w-full object-contain"
              />
              <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-gradient-to-r from-[#2563eb] to-[#7c3aed] text-white font-mono text-[9px] font-bold flex items-center gap-1 shadow">
                <Video className="w-2.5 h-2.5" /> VIDEO
              </div>
              {!isThumbnailHovered && (
                <div className="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none transition-opacity">
                  <div className="w-7 h-7 rounded-full bg-black/60 border border-white/30 flex items-center justify-center text-white/90 shadow">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </div>
                </div>
              )}
            </div>
          ) : isCurrentValueHex ? (
            <div className="text-center select-none">
              <div
                className="w-10 h-10 rounded-full border-2 border-white/40 shadow-xl mx-auto mb-1.5 flex items-center justify-center"
                style={{ backgroundColor: asset.currentUrl }}
              >
                <Palette className={`w-4 h-4 ${asset.currentUrl === '#ffffff' ? 'text-black' : 'text-white'}`} />
              </div>
              <span className="text-xs font-mono font-bold text-white px-2.5 py-0.5 rounded bg-black/75 border border-white/20 shadow">
                {asset.currentUrl}
              </span>
            </div>
          ) : asset.currentUrl ? (
            <img
              src={asset.currentUrl}
              alt={asset.altText || asset.label}
              className="max-h-full max-w-full object-contain transition-transform group-hover:scale-105 duration-200"
              onError={e => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xs text-gray-500 italic">No asset URL configured</span>
          )}

          <div className="absolute bottom-1 right-1.5 text-[9px] font-mono bg-black/75 px-1.5 py-0.5 rounded text-gray-400 border border-gray-800">
            {asset.sectionName}
          </div>
        </div>

        {/* Input Mode Selector for CSS Backgrounds (Image URL vs Color Hex) */}
        {isCssBackground && (
          <div className="flex items-center gap-1 bg-[#090a0f] p-0.5 rounded-lg border border-[#222b3f] mb-2.5 w-fit">
            <button
              type="button"
              onClick={() => setBgMode('url')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                bgMode === 'url'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <ImageIcon className="w-2.5 h-2.5" /> Image URL
            </button>
            <button
              type="button"
              onClick={() => setBgMode('color')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                bgMode === 'color'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Palette className="w-2.5 h-2.5" /> Color (Hex)
            </button>
          </div>
        )}

        {/* Editable URL / Color / Video Fields */}
        <div className="space-y-2 mb-3">
          {isVideoAsset ? (
            <div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                <span>Video URL (MP4, WEBM, MOV, M4V):</span>
                {statusIndicator()}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                  placeholder="https://.../video.mp4"
                  style={{ color: '#ffffff', backgroundColor: '#0a0e1a' }}
                  className="flex-1 min-w-0 bg-[#0a0e1a] border border-[#1e2942] focus:border-[#2563eb] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => handleApplyVideo()}
                  disabled={videoUrl.trim() === (asset.currentUrl || '').trim()}
                  className="px-3 py-1.5 bg-[#2563eb] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center gap-1 shrink-0 shadow-sm"
                  title="Apply Video URL to background"
                >
                  <Check className="w-3.5 h-3.5" /> Apply
                </button>
              </div>
            </div>
          ) : bgMode === 'url' ? (
            <div>
              <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                <span>Image URL:</span>
                {statusIndicator()}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={e => setInputUrl(e.target.value)}
                  placeholder="https://..."
                  style={{ color: '#ffffff', backgroundColor: '#0a0e1a' }}
                  className="flex-1 min-w-0 bg-[#0a0e1a] border border-[#1e2942] focus:border-[#2563eb] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none shadow-inner"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  disabled={inputUrl.trim() === (asset.currentUrl || '').trim()}
                  className="px-3 py-1.5 bg-[#2563eb] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center gap-1 shrink-0 shadow-sm"
                  title="Apply new image URL to HTML"
                >
                  <Check className="w-3.5 h-3.5" /> Apply
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>Background Color:</span>
                {statusIndicator()}
              </div>
              <div className="flex items-center gap-2">
                {/* Visual Color Picker Box */}
                <div
                  className="relative w-8 h-8 rounded-lg overflow-hidden border border-[#1e2942] flex-shrink-0 cursor-pointer shadow-inner"
                  title="Click to open color palette"
                >
                  <input
                    type="color"
                    value={
                      colorHex.startsWith('#') && colorHex.length >= 7
                        ? colorHex.substring(0, 7)
                        : '#050505'
                    }
                    onChange={e => setColorHex(e.target.value)}
                    className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer border-none bg-transparent"
                  />
                </div>

                {/* Hex Input */}
                <input
                  type="text"
                  value={colorHex}
                  onChange={e => setColorHex(e.target.value)}
                  placeholder="#050505"
                  style={{ color: '#ffffff', backgroundColor: '#0a0e1a' }}
                  className="flex-1 min-w-0 bg-[#0a0e1a] border border-[#1e2942] focus:border-[#2563eb] rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-gray-500 focus:outline-none shadow-inner"
                />

                {/* Apply Color Button */}
                <button
                  type="button"
                  onClick={() => handleApplyColor()}
                  disabled={colorHex.trim() === (asset.currentUrl || '').trim()}
                  className="px-3 py-1.5 bg-[#2563eb] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center gap-1 shrink-0 shadow-sm"
                  title="Apply Hex Color to background"
                >
                  <Check className="w-3.5 h-3.5" /> Apply
                </button>
              </div>

              {/* Preset Color Swatches */}
              <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto pb-0.5">
                <span className="text-[9px] text-gray-500 font-mono mr-0.5">Presets:</span>
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    title={`${c.label} (${c.hex})`}
                    onClick={() => {
                      setColorHex(c.hex);
                      handleApplyColor(c.hex);
                    }}
                    className="w-5 h-5 rounded-md border border-gray-700 hover:scale-110 transition-transform flex-shrink-0 shadow-sm relative flex items-center justify-center"
                    style={{ backgroundColor: c.hex }}
                  >
                    {colorHex.toLowerCase() === c.hex.toLowerCase() && (
                      <Check
                        className={`w-3 h-3 ${c.hex === '#ffffff' ? 'text-black' : 'text-white'}`}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="pt-2.5 border-t border-[#1f2638] flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1">
          {isVideoAsset || bgMode === 'video' ? (
            <>
              {/* Upload Video Button */}
              <label
                className="cursor-pointer px-2 py-1 rounded bg-[#182030] hover:bg-[#202b40] text-gray-300 text-[10px] font-medium flex items-center gap-1 transition-colors border border-[#263554]"
                title="Upload replacement video file"
              >
                <Upload className="w-2.5 h-2.5 text-violet-400" /> Upload Video
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              {/* Video Library Button */}
              <button
                onClick={() => setIsLibraryOpen(true)}
                className="px-2 py-1 rounded bg-[#182030] hover:bg-[#202b40] text-gray-300 text-[10px] font-medium flex items-center gap-1 transition-colors border border-[#263554]"
                title="Select video from library"
              >
                <FolderPlus className="w-2.5 h-2.5 text-blue-400" /> Library
              </button>

              <button
                type="button"
                onClick={() => {
                  setVideoUrl(defaultVideoForDevice);
                  handleApplyVideo(defaultVideoForDevice);
                }}
                className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 text-[10px] font-medium flex items-center gap-1 transition-colors border border-gray-700"
                title="Restore default video URL"
              >
                <RotateCcw className="w-2.5 h-2.5" /> Default
              </button>
            </>
          ) : bgMode === 'url' ? (
            <>
              {/* Upload Button */}
              <label
                className="cursor-pointer px-2 py-1 rounded bg-[#182030] hover:bg-[#202b40] text-gray-300 text-[10px] font-medium flex items-center gap-1 transition-colors border border-[#263554]"
                title="Upload replacement image file"
              >
                <Upload className="w-2.5 h-2.5 text-violet-400" /> Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              {/* Library Button */}
              <button
                onClick={() => setIsLibraryOpen(true)}
                className="px-2 py-1 rounded bg-[#182030] hover:bg-[#202b40] text-gray-300 text-[10px] font-medium flex items-center gap-1 transition-colors border border-[#263554]"
                title="Select from reusable library"
              >
                <FolderPlus className="w-2.5 h-2.5 text-blue-400" /> Library
              </button>
            </>
          ) : (
            <span className="text-[10px] text-gray-500 font-mono flex items-center gap-1">
              <Palette className="w-2.5 h-2.5 text-purple-400" /> Solid Color Mode
            </span>
          )}

          {/* Restore Original Button */}
          {isModified && (
            <button
              onClick={() => {
                onRestoreOriginal(asset.id);
                setInputUrl(asset.originalUrl);
                if ((asset.originalUrl || '').startsWith('#')) {
                  setColorHex(asset.originalUrl || '#050505');
                  setBgMode('color');
                } else if (
                  ['.mp4', '.webm', '.mov', '.m4v'].some(ext =>
                    (asset.originalUrl || '').toLowerCase().includes(ext)
                  )
                ) {
                  setVideoUrl(asset.originalUrl);
                  setBgMode('video');
                } else {
                  setBgMode('url');
                }
              }}
              className="px-2 py-1 rounded bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 text-[10px] font-medium flex items-center gap-1 transition-colors border border-amber-700/40"
              title="Restore original from imported HTML"
            >
              <RotateCcw className="w-2.5 h-2.5" /> Restore
            </button>
          )}
        </div>

        {localFeedback && (
          <span className="text-[10px] text-emerald-400 font-semibold animate-pulse">
            {localFeedback}
          </span>
        )}
      </div>

      {/* Library Selection Modal */}
      <LibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onSelectUrl={url => {
          if (bgMode === 'video') {
            setVideoUrl(url);
            handleApplyVideo(url);
          } else {
            setInputUrl(url);
            setBgMode('url');
            onReplaceUrl(asset.id, url);
          }
        }}
        title={`Select Asset for: ${asset.label}`}
      />

      {/* Image / Color / Video Preview Large Modal */}
      {isPreviewModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setIsPreviewModalOpen(false)}
        >
          <div
            className="bg-[#0e1117] border border-[#222b3f] rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#1f2638]">
              <div>
                <h3 className="text-sm font-bold text-white">{asset.label}</h3>
                <p className="text-[11px] font-mono text-gray-400 break-all">{asset.currentUrl}</p>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-2.5 py-1 rounded bg-[#1a2030] text-gray-300 text-xs hover:text-white"
              >
                Close
              </button>
            </div>
            <div
              className="p-4 rounded-xl flex items-center justify-center min-h-[250px] max-h-[500px] overflow-hidden border border-[#1f2638]"
              style={{
                backgroundColor: isCurrentValueHex ? asset.currentUrl : '#090a0f',
              }}
            >
              {bgMode === 'video' || isVideoAsset ? (
                <div className="w-full flex flex-col items-center justify-center">
                  <video
                    src={asset.currentUrl || videoUrl}
                    controls
                    autoPlay
                    loop
                    className="max-h-[420px] max-w-full rounded-lg"
                  />
                  <span className="mt-2 text-xs font-mono text-gray-400">Video Background Player</span>
                </div>
              ) : isCurrentValueHex ? (
                <div className="text-center">
                  <div
                    className="w-20 h-20 rounded-full border-4 border-white/50 shadow-2xl mx-auto mb-3"
                    style={{ backgroundColor: asset.currentUrl }}
                  />
                  <div className="text-lg font-mono font-bold text-white bg-black/80 px-4 py-1.5 rounded-xl border border-white/20 shadow">
                    Solid Color: {asset.currentUrl}
                  </div>
                </div>
              ) : (
                <img
                  src={asset.currentUrl}
                  alt={asset.label}
                  className="max-h-[450px] max-w-full object-contain"
                />
              )}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
              <span>Section: {asset.sectionName}</span>
              {!isCurrentValueHex && (
                <a
                  href={asset.currentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-400 hover:underline flex items-center gap-1"
                >
                  Open in Browser <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AssetCard = memo(AssetCardComponent);
