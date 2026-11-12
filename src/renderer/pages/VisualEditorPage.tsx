import React, { useState, useMemo, useEffect } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  Filter,
  Layers,
  Columns,
  Eye,
  ChevronDown,
  Film,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  SlidersHorizontal,
  Image as ImageIcon,
  Video,
  LayoutGrid,
} from 'lucide-react';
import {
  Project,
  ImageAsset,
  ComponentSection,
  BackgroundConfig,
  ReadMoreSectionConfig,
  SupportedSectionType,
} from '@shared/types';
import { extractBackgroundConfig } from '@shared/parser';
import { extractReadMoreConfigFromHtml } from '@shared/sectionManager';
import { AssetCard } from '../components/AssetCard';
import { VideoQualityInspectorModal } from '../components/VideoQualityInspectorModal';
import { SectionManagerPanel } from '../components/SectionManagerPanel';
import { ReadMoreButtonModal } from '../components/ReadMoreButtonModal';
import { generatePreviewHtml } from '../lib/previewHelper';

interface VisualEditorPageProps {
  project: Project;
  assets: ImageAsset[];
  sections: ComponentSection[];
  onReplaceUrl: (assetId: string, newUrl: string) => void;
  onRestoreOriginal: (assetId: string) => void;
  onJumpToCode?: (lineNumber?: number) => void;
  onUpdateBackgroundConfig?: (config: BackgroundConfig) => void;
  onToggleSectionVisibility?: (sectionId: string, visible: boolean) => void;
  onUpdateReadMoreConfig?: (config: ReadMoreSectionConfig) => void;
  onAddSection?: (sectionType: SupportedSectionType) => void;
  onRemoveSection?: (sectionId: string) => void;
}

type ViewportMode = 'desktop' | 'tablet' | 'mobile' | 'custom';

export const VisualEditorPage: React.FC<VisualEditorPageProps> = ({
  project,
  assets,
  sections,
  onReplaceUrl,
  onRestoreOriginal,
  onJumpToCode,
  onUpdateBackgroundConfig,
  onToggleSectionVisibility,
  onUpdateReadMoreConfig,
  onAddSection,
  onRemoveSection,
}) => {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [customWidth, setCustomWidth] = useState(1200);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [isSectionManagerOpen, setIsSectionManagerOpen] = useState(false);
  const [isReadMoreModalOpen, setIsReadMoreModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<'all' | 'desktop' | 'tablet' | 'mobile'>('all');
  const [layoutMode, setLayoutMode] = useState<'split' | 'preview_only' | 'cards_only'>('split');
  const [previewKey, setPreviewKey] = useState(1);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [isVideoInspectorOpen, setIsVideoInspectorOpen] = useState(false);
  const [previewVideoStatus, setPreviewVideoStatus] = useState<string>('idle');

  // Background config
  const bgConfig = useMemo(() => {
    return project.backgroundConfiguration || extractBackgroundConfig(project.currentHtml);
  }, [project.backgroundConfiguration, project.currentHtml]);

  // Listen to live preview iframe messages with strict state guard
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'LPS_VIDEO_PLAYBACK_UPDATE') {
        const newStatus = e.data.status || 'playing';
        setPreviewVideoStatus(prev => (prev === newStatus ? prev : newStatus));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Allow exiting fullscreen preview with [Esc] key
  useEffect(() => {
    if (!isFullscreenPreview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreenPreview(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenPreview]);

  // Live Preview HTML with non-intrusive preview-only playback controller
  const previewSrcDoc = useMemo(() => {
    return generatePreviewHtml(project.currentHtml);
  }, [project.currentHtml]);

  // Viewport sizes
  const viewportWidth = useMemo(() => {
    switch (viewportMode) {
      case 'desktop':
        return 1440;
      case 'tablet':
        return 768;
      case 'mobile':
        return 390;
      case 'custom':
        return customWidth;
    }
  }, [viewportMode, customWidth]);

  // Filtered assets: All assets are displayed cleanly as standard component cards
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      // In Video mode, omit the raw CSS background-color (#050505) fallback on .hero-wrapper
      // so users only see the actual Hero Background Video cards without clutter.
      if (
        bgConfig.mode === 'video' &&
        asset.type === 'css_background' &&
        asset.role === 'hero_bg' &&
        (asset.currentUrl || '').startsWith('#')
      ) {
        return false;
      }

      const matchesSearch =
        (asset.label || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.currentUrl || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.sectionName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSection = selectedSectionId === 'all' || asset.sectionId === selectedSectionId;
      const matchesDevice =
        selectedDevice === 'all' ||
        asset.device === selectedDevice ||
        (selectedDevice === 'tablet' && (asset.device === 'tablet' || asset.device === 'mobile'));
      return matchesSearch && matchesSection && matchesDevice;
    });
  }, [assets, searchTerm, selectedSectionId, selectedDevice, bgConfig.mode]);

  // Group assets by component / parent if available, or section
  const groupedComponents = useMemo(() => {
    const groups: { title: string; sectionId: string; assets: ImageAsset[] }[] = [];
    const seen = new Set<string>();

    filteredAssets.forEach(asset => {
      const baseTitle =
        (asset.label || '').replace(/\s*–\s*(Desktop|Mobile|Tablet\/Mobile)$/i, '').trim() || asset.sectionName || 'Component';
      const groupKey = asset.parentComponentId || `group_${asset.sectionId}_${baseTitle}`;

      if (!seen.has(groupKey)) {
        seen.add(groupKey);
        const siblings = filteredAssets.filter(a => {
          if (asset.parentComponentId && a.parentComponentId === asset.parentComponentId) return true;
          const siblingBase =
            (a.label || '').replace(/\s*–\s*(Desktop|Mobile|Tablet\/Mobile)$/i, '').trim() || a.sectionName || 'Component';
          return a.sectionId === asset.sectionId && siblingBase === baseTitle;
        });

        groups.push({
          title: baseTitle,
          sectionId: asset.sectionId,
          assets: siblings,
        });
      }
    });

    return groups;
  }, [filteredAssets]);

  const refreshPreview = () => {
    setPreviewKey(prev => prev + 1);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[#0a0e1a] overflow-hidden">
      {/* Top Controls Bar */}
      <div className="h-14 bg-[#0e1426] border-b border-[#1e2942] px-6 flex items-center justify-between z-10">
        {/* Left: Section Filter & Search */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter assets..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-[#121829] border border-[#1e2942] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2563eb] w-44"
            />
          </div>

          <div className="relative">
            <select
              value={selectedSectionId}
              onChange={e => setSelectedSectionId(e.target.value)}
              className="bg-[#121829] border border-[#1e2942] rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none cursor-pointer"
            >
              <option value="all">All Sections ({assets.length} assets)</option>
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>
                  {sec.name} ({sec.assetIds.length})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-[#121829] border border-[#1e2942] rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setSelectedDevice('all')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                selectedDevice === 'all' ? 'bg-[#2563eb] text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedDevice('desktop')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                selectedDevice === 'desktop' ? 'bg-[#2563eb] text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              Desktop
            </button>
            <button
              onClick={() => setSelectedDevice('mobile')}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                selectedDevice === 'mobile' ? 'bg-[#2563eb] text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              Mobile
            </button>
          </div>
        </div>

        {/* Center: Viewport Mode Switcher & Responsive Width Control */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-[#121829] border border-[#1e2942] p-1 rounded-xl">
            <button
              onClick={() => setViewportMode('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewportMode === 'desktop'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" /> Desktop (1440px)
            </button>
            <button
              onClick={() => setViewportMode('tablet')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewportMode === 'tablet'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Tablet className="w-3.5 h-3.5" /> Tablet (768px)
            </button>
            <button
              onClick={() => setViewportMode('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewportMode === 'mobile'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile (390px)
            </button>
            <button
              onClick={() => setViewportMode('custom')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewportMode === 'custom'
                  ? 'bg-[#2563eb] text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /> Custom
            </button>
          </div>

          {/* Custom width range slider if custom mode active */}
          {viewportMode === 'custom' && (
            <div className="flex items-center gap-2 bg-[#141926] border border-[#222b3f] px-2.5 py-1 rounded-xl">
              <input
                type="range"
                min="320"
                max="1920"
                value={customWidth}
                onChange={e => setCustomWidth(parseInt(e.target.value, 10))}
                className="w-24 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#2563eb]"
              />
              <span className="font-mono text-[11px] text-white font-bold w-12">
                {customWidth}px
              </span>
            </div>
          )}
        </div>

        {/* Right: Background Mode Badge, Quality Inspection & Layout Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Mode Pill */}
          <span className="hidden xl:inline-flex items-center gap-1.5 text-[10px] font-bold font-mono px-2.5 py-1 rounded-lg bg-[#121829] border border-[#1e2942] text-gray-300">
            {bgConfig.mode === 'video' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></span>
                <span className="text-violet-300">Video Mode (Option B)</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-blue-300">Static Image Mode</span>
              </>
            )}
          </span>

          {/* Video Quality Inspector Trigger */}
          {bgConfig.mode === 'video' && (
            <button
              onClick={() => setIsVideoInspectorOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-950/60 hover:bg-violet-900/80 text-violet-300 hover:text-white border border-violet-800/50 text-xs font-bold transition-all shadow-sm"
              title="Inspect Video Quality, Metadata and Suitability"
            >
              <Film className="w-3.5 h-3.5 text-violet-400" />
              <span>Video Quality</span>
            </button>
          )}

          {/* Preview reload */}
          <button
            onClick={refreshPreview}
            className="p-1.5 rounded-lg bg-[#121829] hover:bg-[#18223a] text-gray-300 hover:text-white border border-[#1e2942] transition-colors"
            title="Reload Preview iframe"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Preview Toggle */}
          <button
            onClick={() => setIsFullscreenPreview(prev => !prev)}
            className={`p-1.5 rounded-lg border border-[#1e2942] transition-colors ${
              isFullscreenPreview
                ? 'bg-[#2563eb] text-white'
                : 'bg-[#121829] hover:bg-[#18223a] text-gray-300 hover:text-white'
            }`}
            title={isFullscreenPreview ? 'Exit Fullscreen' : 'Fullscreen Preview'}
          >
            {isFullscreenPreview ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Section Manager Toggle */}
          <button
            onClick={() => setIsSectionManagerOpen(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              isSectionManagerOpen
                ? 'bg-violet-600/30 text-violet-300 border-violet-500/50 shadow-sm'
                : 'bg-[#121829] hover:bg-[#18223a] text-gray-300 hover:text-white border-[#1e2942]'
            }`}
            title="Manage landing page sections visibility, add sections, and configure Read More Button"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-violet-400" />
            <span>Sections</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1e2942] text-violet-300">
              {sections.filter(s => s.visible !== false).length}/{sections.length}
            </span>
          </button>

          <div className="flex items-center bg-[#121829] border border-[#1e2942] rounded-lg p-0.5">
            <button
              onClick={() => setLayoutMode('split')}
              className={`p-1.5 rounded text-xs transition-colors ${
                layoutMode === 'split' ? 'bg-[#1e2942] text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Split View"
            >
              <Columns className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayoutMode('preview_only')}
              className={`p-1.5 rounded text-xs transition-colors ${
                layoutMode === 'preview_only' ? 'bg-[#1e2942] text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Full Preview"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setLayoutMode('cards_only')}
              className={`p-1.5 rounded text-xs transition-colors ${
                layoutMode === 'cards_only' ? 'bg-[#1e2942] text-white' : 'text-gray-400 hover:text-white'
              }`}
              title="Asset Cards Only"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Section Manager Drawer */}
      {isSectionManagerOpen && (
        <div className="p-4 bg-[#0a0e1a] border-b border-[#1e2942] max-h-96 overflow-y-auto">
          <SectionManagerPanel
            sections={sections}
            onToggleVisibility={(sectionId, visible) => {
              onToggleSectionVisibility?.(sectionId, visible);
            }}
            onConfigureReadMore={() => {
              setIsReadMoreModalOpen(true);
            }}
            onAddSection={(sectionType) => {
              onAddSection?.(sectionType);
            }}
            onRemoveSection={(sectionId) => {
              onRemoveSection?.(sectionId);
            }}
          />
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Visual Asset Cards */}
        {(!isFullscreenPreview && (layoutMode === 'split' || layoutMode === 'cards_only')) && (
          <div
            className={`${
              layoutMode === 'cards_only' ? 'w-full max-w-5xl mx-auto' : 'w-[48%] min-w-[420px]'
            } border-r border-[#1e2942] bg-[#0e1426] overflow-y-auto p-6 space-y-6`}
          >
            {/* Compact Background Mode Selector (Option A Static vs Option B Video) */}
            {onUpdateBackgroundConfig && (
              <div className="bg-[#121829] border border-[#1e2942] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-1.5 rounded-lg ${
                      bgConfig.mode === 'video'
                        ? 'bg-violet-500/10 text-violet-400'
                        : 'bg-blue-500/10 text-blue-400'
                    }`}
                  >
                    {bgConfig.mode === 'video' ? (
                      <Video className="w-4 h-4" />
                    ) : (
                      <ImageIcon className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Background Mode:</span>
                      <span className="text-xs font-semibold text-violet-400">
                        {bgConfig.mode === 'video' ? 'Video Background' : 'Static Background'}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {bgConfig.mode === 'video'
                        ? 'Option B (.hero-bg-slider Video in Hero Section)'
                        : 'Option A (Static Campaign Details Background)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center bg-[#0a0e1a] border border-[#1e2942] rounded-lg p-1 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (bgConfig.mode !== 'static') {
                        onUpdateBackgroundConfig({ ...bgConfig, mode: 'static' });
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      bgConfig.mode === 'static'
                        ? 'bg-[#2563eb] text-white shadow-sm font-semibold'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Static Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (bgConfig.mode !== 'video') {
                        onUpdateBackgroundConfig({ ...bgConfig, mode: 'video' });
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      bgConfig.mode === 'video'
                        ? 'bg-[#2563eb] text-white shadow-sm font-semibold'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" /> Video Mode
                  </button>
                </div>
              </div>
            )}

            {/* Component Assets Section (Logos, Graphics, Banners, Buttons) */}
            <div className="flex items-center justify-between pb-2 pt-2 border-b border-[#1e2942]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  Page Component Assets & Graphics
                </h3>
                <p className="text-[11px] text-gray-400">
                  Brand logos, graphics, banners, form assets, and buttons ({filteredAssets.length} components)
                </p>
              </div>

              <div className="text-[10px] text-gray-400 font-mono bg-[#141926] px-2.5 py-1 rounded-md border border-[#222b3f]">
                {groupedComponents.length} Component Groups
              </div>
            </div>

            {groupedComponents.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-xs">
                No image assets match the current filter.
              </div>
            ) : (
              groupedComponents.map((group, idx) => (
                <div
                  key={idx}
                  className="bg-[#111520] border border-[#1f2638] rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1b2233]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#2563eb]"></span>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        {group.title}
                      </h4>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {group.assets.length} variant{group.assets.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className={`grid ${group.assets.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-3.5`}>
                    {group.assets.map(asset => (
                      <AssetCard
                        key={asset.id}
                        asset={asset}
                        onReplaceUrl={onReplaceUrl}
                        onRestoreOriginal={onRestoreOriginal}
                        onJumpToCode={onJumpToCode}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Right Column: Live Responsive Preview */}
        {(layoutMode === 'split' || layoutMode === 'preview_only' || isFullscreenPreview) && (
          <div
            className={`flex-1 bg-[#06070a] flex flex-col items-center justify-start p-4 overflow-auto ${
              isFullscreenPreview ? 'fixed inset-0 z-50 p-6 bg-black/95' : ''
            }`}
          >
            {/* Viewport & Playback Status Pill */}
            <div className="mb-2 text-[10px] font-mono text-gray-400 bg-[#111520] border border-[#1f2638] px-3 py-1 rounded-full flex items-center gap-2.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Viewport: {viewportWidth}px wide</span>
              <span>•</span>
              <span className="text-gray-300">
                {bgConfig.mode === 'video' ? 'Option B Video Slider' : 'Static Image Background'}
              </span>
              {bgConfig.mode === 'video' && (
                <>
                  <span>•</span>
                  {previewVideoStatus === 'playing' ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      Video Playing
                    </span>
                  ) : previewVideoStatus === 'autoplay_blocked' ? (
                    <span className="text-amber-400 flex items-center gap-1 font-bold">
                      <AlertTriangle className="w-3 h-3 text-amber-400" /> Autoplay Blocked (Click Preview to Play)
                    </span>
                  ) : previewVideoStatus === 'error' ? (
                    <span className="text-rose-400 flex items-center gap-1 font-bold">
                      Source Error
                    </span>
                  ) : (
                    <span className="text-gray-400 font-bold">Video Ready</span>
                  )}
                </>
              )}
              {isFullscreenPreview && (
                <>
                  <span>•</span>
                  <button
                    onClick={() => setIsFullscreenPreview(false)}
                    className="text-violet-400 hover:text-violet-300 hover:underline font-bold"
                  >
                    Exit Fullscreen [Esc]
                  </button>
                </>
              )}
            </div>

            {/* Simulated Device Frame Container */}
            <div
              style={{ width: `${viewportWidth}px` }}
              className={`bg-black rounded-xl border border-[#222b3f] shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${
                isFullscreenPreview ? 'h-[calc(100vh-5rem)]' : 'h-[calc(100vh-8.5rem)]'
              }`}
            >
              {/* Simulated Device Top Bar */}
              <div className="h-7 bg-[#131722] border-b border-[#222b3f] px-3 flex items-center justify-between text-[10px] text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500/80"></span>
                  <span className="w-2 h-2 rounded-full bg-yellow-500/80"></span>
                  <span className="w-2 h-2 rounded-full bg-green-500/80"></span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono truncate max-w-xs">
                  {project.name} • Live Preview
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-gray-400 uppercase font-mono">
                    {viewportMode}
                  </span>
                  <button
                    onClick={() => setIsFullscreenPreview(prev => !prev)}
                    className="text-gray-400 hover:text-white transition-colors"
                    title={isFullscreenPreview ? 'Exit Fullscreen' : 'Fullscreen'}
                  >
                    {isFullscreenPreview ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Iframe Preview - unrestricted origin to permit video blobs and CDN streaming */}
              <iframe
                key={previewKey}
                title="Landing Page Live Preview"
                srcDoc={previewSrcDoc}
                allow="autoplay *; fullscreen *"
                className="w-full flex-1 border-none bg-black"
              />
            </div>
          </div>
        )}
      </div>

      {/* Video Quality Inspector Modal */}
      <VideoQualityInspectorModal
        isOpen={isVideoInspectorOpen}
        onClose={() => setIsVideoInspectorOpen(false)}
        desktopVideoUrl={bgConfig.video?.desktopVideo || ''}
        mobileVideoUrl={bgConfig.video?.mobileVideo || ''}
      />

      {/* Responsive Read More Button Modal */}
      {isReadMoreModalOpen && (
        <ReadMoreButtonModal
          initialConfig={
            project.readMoreConfiguration ||
            extractReadMoreConfigFromHtml(project.currentHtml)
          }
          onSave={(newConfig) => {
            onUpdateReadMoreConfig?.(newConfig);
            setIsReadMoreModalOpen(false);
          }}
          onClose={() => setIsReadMoreModalOpen(false)}
        />
      )}
    </div>
  );
};
