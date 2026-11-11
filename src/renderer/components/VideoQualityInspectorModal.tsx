import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Film,
  Monitor,
  Smartphone,
  Info,
  Maximize,
  Sparkles,
} from 'lucide-react';
import { VideoMetadata, VideoQualityAssessment, VideoQualityRating } from '@shared/types';
import {
  extractVideoMetadata,
  assessVideoQuality,
  formatBytes,
  formatDuration,
} from '@shared/videoQuality';

interface VideoQualityInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  desktopVideoUrl: string;
  mobileVideoUrl: string;
}

export const VideoQualityInspectorModal: React.FC<VideoQualityInspectorModalProps> = ({
  isOpen,
  onClose,
  desktopVideoUrl,
  mobileVideoUrl,
}) => {
  const [activeTab, setActiveTab] = useState<'desktop' | 'mobile'>('desktop');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [assessment, setAssessment] = useState<VideoQualityAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Inspector video player state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  const currentUrl = activeTab === 'desktop' ? desktopVideoUrl : mobileVideoUrl;

  useEffect(() => {
    if (!isOpen || !currentUrl) return;

    let isCancelled = false;
    setIsLoading(true);

    extractVideoMetadata(currentUrl)
      .then(meta => {
        if (isCancelled) return;
        setMetadata(meta);
        const assess = assessVideoQuality(meta, activeTab);
        setAssessment(assess);
        setIsLoading(false);
      })
      .catch(err => {
        if (isCancelled) return;
        console.warn('Failed to extract video metadata:', err);
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, currentUrl, activeTab]);

  if (!isOpen) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleReplay = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current || !duration) return;
    const pct = parseFloat(e.target.value);
    const target = (pct / 100) * duration;
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const renderRatingBadge = (rating: VideoQualityRating) => {
    switch (rating) {
      case 'good':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-semibold text-xs shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Good — Ready for Production
          </span>
        );
      case 'needs_attention':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/60 font-semibold text-xs shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Needs Attention
          </span>
        );
      case 'poor':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/60 font-semibold text-xs shadow-sm">
            <XCircle className="w-3.5 h-3.5 text-rose-400" /> Poor — Optimization Recommended
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-800 text-gray-300 border border-gray-700 font-semibold text-xs">
            <HelpCircle className="w-3.5 h-3.5 text-gray-400" /> Unable to Verify
          </span>
        );
    }
  };

  const renderCheckItemIcon = (rating: 'pass' | 'warn' | 'fail' | 'unknown') => {
    switch (rating) {
      case 'pass':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />;
      default:
        return <HelpCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0e1426] border border-[#1e2942] rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#121829] border-b border-[#1e2942] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-300">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Video Information & Quality Assessment
              </h2>
              <p className="text-xs text-gray-400">
                Inspect video metadata, assess resolution and aspect ratio, and verify playback suitability
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switch between desktop and mobile video */}
            <div className="flex items-center bg-[#0a0e1a] border border-[#1e2942] rounded-xl p-1 text-xs">
              <button
                onClick={() => setActiveTab('desktop')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'desktop'
                    ? 'bg-[#2563eb] text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" /> Desktop Video
              </button>
              <button
                onClick={() => setActiveTab('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  activeTab === 'mobile'
                    ? 'bg-[#2563eb] text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Mobile Video
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[#18223a] hover:bg-[#202e4e] text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Video Inspection Player (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-[#0a0e1a] border border-[#1e2942] rounded-xl p-3 flex flex-col overflow-hidden shadow-inner">
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center group">
                <video
                  ref={videoRef}
                  src={currentUrl}
                  loop
                  muted={isMuted}
                  playsInline
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime);
                      setDuration(videoRef.current.duration || 0);
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                />

                {/* Overlaid badges */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-black/80 border border-white/20 text-[10px] font-mono font-bold text-white uppercase">
                    {activeTab}
                  </span>
                  {metadata?.width && metadata?.height && (
                    <span className="px-2 py-0.5 rounded bg-violet-600/90 text-white text-[10px] font-mono font-bold">
                      {metadata.width}×{metadata.height}
                    </span>
                  )}
                </div>

                <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 border border-white/20 text-[10px] font-mono text-gray-300">
                  {metadata?.aspectRatioString || '16:9'}
                </div>
              </div>

              {/* Player Timeline & Controls */}
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={duration ? (currentTime / duration) * 100 : 0}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-300">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="p-1.5 rounded-md bg-[#18223a] hover:bg-[#2563eb] text-white transition-colors"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={handleReplay}
                      className="p-1.5 rounded-md bg-[#182030] hover:bg-[#222b3f] text-gray-300 hover:text-white transition-colors"
                      title="Replay from start"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={toggleMute}
                      className="p-1.5 rounded-md bg-[#182030] hover:bg-[#222b3f] text-gray-300 hover:text-white transition-colors"
                      title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                    >
                      {isMuted ? <VolumeX className="w-3.5 h-3.5 text-gray-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  </div>

                  <span className="font-mono text-[11px] text-gray-400">
                    {formatDuration(currentTime)} / {formatDuration(duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* Video Source URL Pill */}
            <div className="bg-[#090a0f] border border-[#1f2638] rounded-xl p-3 text-xs">
              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                Configured Source URL:
              </span>
              <p className="font-mono text-[11px] text-gray-300 break-all bg-[#111520] p-2 rounded border border-[#1b2233]">
                {currentUrl}
              </p>
            </div>
          </div>

          {/* Right: Metadata Table & Quality Assessment (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400 gap-3">
                <div className="w-7 h-7 border-2 border-[#2563eb] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs">Inspecting video stream metadata...</span>
              </div>
            ) : (
              <>
                {/* Overall Quality Rating Banner */}
                {assessment && (
                  <div className="bg-[#111520] border border-[#1f2638] rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                        Suitability Assessment ({activeTab.toUpperCase()} Background)
                      </span>
                      {renderRatingBadge(assessment.overallRating)}
                    </div>
                    <p className="text-xs text-gray-300 font-medium">
                      {assessment.scoreSummary}
                    </p>
                  </div>
                )}

                {/* Video Information Table (Section 4 Table) */}
                <div className="bg-[#090a0f] border border-[#1f2638] rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#141926] border-b border-[#1f2638] text-xs font-bold text-white flex items-center justify-between">
                    <span>Source Video Metadata</span>
                    <span className="text-[10px] font-mono text-gray-400">Section 4 Specification</span>
                  </div>

                  <table className="w-full text-xs text-left">
                    <tbody className="divide-y divide-[#1b2233]">
                      <tr className="hover:bg-[#111520]">
                        <td className="px-4 py-2 font-medium text-gray-400 w-36">Filename</td>
                        <td className="px-4 py-2 font-mono text-white truncate max-w-xs">{metadata?.filename || 'Not available'}</td>
                      </tr>
                      <tr className="hover:bg-[#111520]">
                        <td className="px-4 py-2 font-medium text-gray-400">File Size</td>
                        <td className="px-4 py-2 font-mono text-white">{formatBytes(metadata?.fileSizeBytes)}</td>
                      </tr>
                      <tr className="hover:bg-[#111520]">
                        <td className="px-4 py-2 font-medium text-gray-400">Duration</td>
                        <td className="px-4 py-2 font-mono text-white">{formatDuration(metadata?.durationSeconds)}</td>
                      </tr>
                      <tr className="hover:bg-[#111520]">
                        <td className="px-4 py-2 font-medium text-gray-400">Source Resolution</td>
                        <td className="px-4 py-2 font-mono text-white">
                          {metadata?.width && metadata?.height ? `${metadata.width} × ${metadata.height} px` : 'Not available'}
                        </td>
                      </tr>
                      <tr className="hover:bg-[#111520]">
                        <td className="px-4 py-2 font-medium text-gray-400">Aspect Ratio</td>
                        <td className="px-4 py-2 font-mono text-white">{metadata?.aspectRatioString || 'Not available'}</td>
                      </tr>
                      <tr className="hover:bg-[#111520]">
                        <td className="px-4 py-2 font-medium text-gray-400">Container / Format</td>
                        <td className="px-4 py-2 font-mono text-white">{metadata?.format || 'MP4'}</td>
                      </tr>
                      <tr className="hover:bg-[#111520]">
                        <td className="px-4 py-2 font-medium text-gray-400">Video Codec</td>
                        <td className="px-4 py-2 font-mono text-white">{metadata?.codec || 'Standard Web Compatible'}</td>
                      </tr>
                      <tr className="hover:bg-[#111520]">
                        <td className="px-4 py-2 font-medium text-gray-400">Audio Track</td>
                        <td className="px-4 py-2 font-mono text-white">
                          {metadata?.hasAudio ? 'Audio Detected (Muted in Background)' : 'None / Silent'}
                        </td>
                      </tr>
                      <tr className="hover:bg-[#111520]">
                        <td className="px-4 py-2 font-medium text-gray-400">Source Accessibility</td>
                        <td className="px-4 py-2 font-mono">
                          {metadata?.sourceStatus === 'accessible' ? (
                            <span className="text-emerald-400 font-bold">Accessible (HTTPS)</span>
                          ) : (
                            <span className="text-rose-400 font-bold">Inaccessible or Failed</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Quality Assessment Breakdown */}
                {assessment && (
                  <div className="bg-[#090a0f] border border-[#1f2638] rounded-xl p-4 flex flex-col gap-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Detailed Assessment Checks
                    </span>

                    <div className="space-y-2.5">
                      {assessment.items.map((item, index) => (
                        <div
                          key={index}
                          className="p-2.5 rounded-lg bg-[#111520] border border-[#1b2233] flex items-start gap-2.5 text-xs"
                        >
                          {renderCheckItemIcon(item.rating)}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-gray-200">{item.name}</span>
                              <span className="text-[10px] uppercase font-mono text-gray-400">
                                {item.rating}
                              </span>
                            </div>
                            <p className="text-gray-300 mt-0.5">{item.message}</p>
                            {item.recommendation && (
                              <p className="text-amber-400/90 text-[11px] mt-1 italic">
                                💡 Recommendation: {item.recommendation}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#141926] border-t border-[#222b3f] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Option B strict architecture: Video backgrounds loop automatically and remain muted on production pages.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#222b3f] hover:bg-[#2b3750] text-white font-medium transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
