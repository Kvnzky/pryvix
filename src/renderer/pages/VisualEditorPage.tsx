import React, { useState, useMemo, useEffect } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  Layers,
  Columns,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Image as ImageIcon,
  Video,
  Sparkles,
  Layout,
  FileText,
  ExternalLink,
  Film,
} from 'lucide-react';
import {
  Project,
  ImageAsset,
  ComponentSection,
  BackgroundConfig,
  ReadMoreSectionConfig,
  SupportedSectionType,
} from '@shared/types';
import { extractBackgroundConfig, SUPPORTED_SECTIONS_REGISTRY } from '@shared/parser';
import { extractReadMoreConfigFromHtml } from '@shared/sectionManager';
import type { SectionPlacement } from '@shared/sectionManager';
import { AssetCard } from '../components/AssetCard';
import { VideoQualityInspectorModal } from '../components/VideoQualityInspectorModal';
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
  onToggleSectionVisibility?: (sectionId: string, visible: boolean, device?: 'all' | 'desktop' | 'mobile') => void;
  onUpdateReadMoreConfig?: (config: ReadMoreSectionConfig) => void;
  onAddSection?: (sectionType: SupportedSectionType, placement?: SectionPlacement) => void;
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
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isReadMoreModalOpen, setIsReadMoreModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<'all' | 'desktop' | 'tablet' | 'mobile'>('all');
  const [layoutMode, setLayoutMode] = useState<'split' | 'preview_only' | 'cards_only'>('split');
  const [previewKey, setPreviewKey] = useState(1);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [isVideoInspectorOpen, setIsVideoInspectorOpen] = useState(false);
  const [previewVideoStatus, setPreviewVideoStatus] = useState<string>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Background config
  const bgConfig = useMemo(() => {
    return project.backgroundConfiguration || extractBackgroundConfig(project.currentHtml);
  }, [project.backgroundConfiguration, project.currentHtml]);

  // Read More button config
  const readMoreConfig = useMemo(() => {
    return project.readMoreConfiguration || extractReadMoreConfigFromHtml(project.currentHtml);
  }, [project.readMoreConfiguration, project.currentHtml]);

  // Available addable sections not currently in project
  const availableToAdd = useMemo(() => {
    return SUPPORTED_SECTIONS_REGISTRY.filter(
      def => def.isAddable && !sections.some(s => s.id === def.id)
    );
  }, [sections]);

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

  // Filtered assets
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
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

  // Sections to display based on section filter
  const displaySections = useMemo(() => {
    if (selectedSectionId === 'all') {
      return sections;
    }
    return sections.filter(s => s.id === selectedSectionId);
  }, [sections, selectedSectionId]);

  const refreshPreview = () => {
    setPreviewKey(prev => prev + 1);
  };

  const getSectionIcon = (type: SupportedSectionType) => {
    switch (type) {
      case 'read_more_button':
        return <SlidersHorizontal className="w-4 h-4 text-violet-400" />;
      case 'popup':
        return <Layout className="w-4 h-4 text-blue-400" />;
      case 'hero':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'mobile_form':
        return <Smartphone className="w-4 h-4 text-emerald-400" />;
      case 'prize':
        return <Sparkles className="w-4 h-4 text-pink-400" />;
      case 'campaign_details':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      default:
        return <Layers className="w-4 h-4 text-gray-400" />;
    }
  };

  const handleToggleVisibility = (
    section: ComponentSection,
    device: 'all' | 'desktop' | 'mobile' = 'all'
  ) => {
    let targetVisible = true;
    if (device === 'desktop') {
      targetVisible = section.desktopVisible === false;
    } else if (device === 'mobile') {
      targetVisible = section.mobileVisible === false;
    } else {
      targetVisible = section.visible === false;
    }

    onToggleSectionVisibility?.(section.id, targetVisible, device);

    const actionText = targetVisible ? 'shown in' : 'hidden from';
    const deviceText = device === 'all' ? '' : ` (${device === 'desktop' ? 'Desktop' : 'Mobile'})`;
    showToast(`"${section.name}" ${actionText} preview${deviceText}.`);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[#0a0e1a] overflow-hidden">
      {/* Top Controls Bar */}
      <div className="h-14 bg-[#0e1426] border-b border-[#1e2942] px-6 flex items-center justify-between z-10">
        {/* Left: Section Filter, Device Filter & Search */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter assets..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-[#121829] border border-[#1e2942] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2563eb] w-40"
            />
          </div>

          <div className="relative">
            <select
              value={selectedSectionId}
              onChange={e => setSelectedSectionId(e.target.value)}
              className="bg-[#121829] border border-[#1e2942] rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none cursor-pointer"
            >
              <option value="all">All Sections ({sections.length})</option>
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>
                  {sec.name} {sec.visible === false ? '(Hidden)' : ''}
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

        {/* Right: Add Section, Mode Badge, Quality Inspection & Layout Switcher */}
        <div className="flex items-center gap-2.5">
          {/* Add Section Action Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAddMenuOpen(prev => !prev)}
              disabled={availableToAdd.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all bg-[#18223a] hover:bg-[#2563eb] text-blue-300 hover:text-white border-[#2563eb]/40 shadow-sm disabled:opacity-40"
              title="Add an approved modular section to the landing page"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>Add Section</span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {isAddMenuOpen && availableToAdd.length > 0 && (
              <div className="absolute right-0 top-full mt-1.5 w-72 rounded-xl bg-[#0e1426] border border-[#1e2942] shadow-2xl p-2 z-30 space-y-1 animate-fade-in">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2.5 py-1">
                  Approved Modular Sections
                </div>
                {availableToAdd.map(def => (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => {
                      onAddSection?.(def.type);
                      setIsAddMenuOpen(false);
                      showToast(`Added "${def.name}" to landing page.`);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#18223a] text-xs text-gray-200 hover:text-white flex items-start gap-2.5 transition-colors border border-transparent hover:border-[#1e2942]"
                  >
                    <div className="mt-0.5">{getSectionIcon(def.type)}</div>
                    <div>
                      <div className="font-semibold text-white">{def.name}</div>
                      <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{def.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

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

      {/* Main Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Direct Section Cards & Controls */}
        {(!isFullscreenPreview && (layoutMode === 'split' || layoutMode === 'cards_only')) && (
          <div
            className={`${
              layoutMode === 'cards_only' ? 'w-full max-w-5xl mx-auto' : 'w-[48%] min-w-[420px]'
            } border-r border-[#1e2942] bg-[#0e1426] overflow-y-auto p-6 space-y-6`}
          >
            {/* Header info */}
            <div className="flex items-center justify-between pb-2 border-b border-[#1e2942]">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-violet-400" />
                  Landing Page Sections &amp; Assets
                </h3>
                <p className="text-[11px] text-gray-400">
                  Control section visibility directly with one click, configure responsive display, and replace visual assets
                </p>
              </div>

              <div className="text-[10px] text-gray-400 font-mono bg-[#141926] px-2.5 py-1 rounded-md border border-[#222b3f]">
                {sections.filter(s => s.visible !== false).length} / {sections.length} Visible
              </div>
            </div>

            {/* List of Direct Section Items */}
            {displaySections.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-xs">
                No sections match the current filter.
              </div>
            ) : (
              displaySections.map(section => {
                const isSectionVisible = section.visible !== false;
                const isDesktopActive = section.desktopVisible !== false && isSectionVisible;
                const isMobileActive = section.mobileVisible !== false && isSectionVisible;
                const isMobileOnly = section.id === 'sec_mobile_form';
                const sectionAssets = filteredAssets.filter(a => a.sectionId === section.id);

                return (
                  <div
                    key={section.id}
                    className={`rounded-2xl border transition-all p-5 shadow-sm space-y-4 ${
                      isSectionVisible
                        ? 'bg-[#111520] border-[#1f2638]'
                        : 'bg-[#090b14] border-gray-800/80 opacity-70'
                    }`}
                  >
                    {/* DIRECT SECTION HEADER WITH VISIBILITY CONTROLS */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1b2233]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                            isSectionVisible
                              ? 'bg-[#18223a] text-blue-400 border-blue-500/30'
                              : 'bg-gray-900 text-gray-500 border-gray-800'
                          }`}
                        >
                          {getSectionIcon(section.type)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4
                              className={`text-xs font-bold tracking-wide ${
                                isSectionVisible ? 'text-white' : 'text-gray-400 line-through'
                              }`}
                            >
                              {section.name}
                            </h4>

                            {isSectionVisible ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-500/30 shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Visible
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700 shrink-0">
                                Hidden
                              </span>
                            )}

                            {isMobileOnly && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-500/30 shrink-0">
                                Mobile Viewport
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ACTION CONTROLS */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Context-aware Device Visibility Toggle matching active preview */}
                        {viewportMode === 'mobile' ? (
                          <button
                            type="button"
                            onClick={() => handleToggleVisibility(section, 'mobile')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1 border transition-colors ${
                              isMobileActive
                                ? 'bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600/30'
                                : 'bg-gray-900 text-gray-500 border-gray-800 hover:text-gray-300'
                            }`}
                            title={`Mobile Preview: ${isMobileActive ? 'Visible' : 'Hidden'} (Click to toggle mobile visibility)`}
                            aria-label={`Toggle mobile visibility for ${section.name}`}
                          >
                            <Smartphone className="w-3 h-3" />
                            <span>{isMobileActive ? 'Mobile: On' : 'Mobile: Off'}</span>
                          </button>
                        ) : viewportMode === 'desktop' ? (
                          <button
                            type="button"
                            disabled={isMobileOnly}
                            onClick={() => handleToggleVisibility(section, 'desktop')}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1 border transition-colors ${
                              isMobileOnly
                                ? 'opacity-30 cursor-not-allowed text-gray-600 border-gray-800'
                                : isDesktopActive
                                ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 hover:bg-blue-600/30'
                                : 'bg-gray-900 text-gray-500 border-gray-800 hover:text-gray-300'
                            }`}
                            title={
                              isMobileOnly
                                ? 'Mobile-only section (not rendered on Desktop)'
                                : `Desktop Preview: ${isDesktopActive ? 'Visible' : 'Hidden'} (Click to toggle desktop visibility)`
                            }
                            aria-label={`Toggle desktop visibility for ${section.name}`}
                          >
                            <Monitor className="w-3 h-3" />
                            <span>{isDesktopActive ? 'Desktop: On' : 'Desktop: Off'}</span>
                          </button>
                        ) : null}

                        {/* Read More Button Configure action */}
                        {section.type === 'read_more_button' && (
                          <button
                            type="button"
                            onClick={() => setIsReadMoreModalOpen(true)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#18223a] hover:bg-[#2563eb] text-violet-300 hover:text-white border border-violet-500/40 flex items-center gap-1 transition-colors"
                            title="Configure Desktop & Mobile Read More Button text, URLs, and styling"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            <span>Configure</span>
                          </button>
                        )}

                        {/* DIRECT SHOW / HIDE CONTROL (Always Visible Beside Section Title) */}
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(section, 'all')}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                            isSectionVisible
                              ? 'bg-[#121829] hover:bg-rose-950/60 border-[#1e2942] hover:border-rose-500/50 text-gray-200 hover:text-rose-200'
                              : 'bg-emerald-950/80 hover:bg-emerald-900/80 border-emerald-500/50 text-emerald-300'
                          }`}
                          title={
                            isSectionVisible
                              ? `Hide ${section.name} from live preview and export`
                              : `Show ${section.name} on live preview and export`
                          }
                          aria-label={
                            isSectionVisible
                              ? `Hide Section: ${section.name}`
                              : `Show Section: ${section.name}`
                          }
                        >
                          {isSectionVisible ? (
                            <>
                              <Eye className="w-3.5 h-3.5 text-blue-400" />
                              <span>Hide Section</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Show Section</span>
                            </>
                          )}
                        </button>

                        {/* Delete button for custom added sections */}
                        {section.isDeletable && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to remove the section "${section.name}"?`)) {
                                onRemoveSection?.(section.id);
                                showToast(`Removed "${section.name}".`);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-[#121829] hover:bg-rose-950 border border-[#1e2942] hover:border-rose-500/40 text-gray-400 hover:text-rose-300 transition-colors"
                            title="Delete section from landing page"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* HIDDEN NOTICE BANNER (when section is hidden) */}
                    {!isSectionVisible && (
                      <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800 text-xs text-gray-400 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <EyeOff className="w-4 h-4 text-gray-500 shrink-0" />
                          <span>This section is currently hidden from the live preview and HTML export.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(section, 'all')}
                          className="px-2.5 py-1 rounded bg-[#1e2942] hover:bg-[#2563eb] text-white text-[11px] font-semibold transition-colors shrink-0"
                        >
                          Show Section
                        </button>
                      </div>
                    )}

                    {/* SECTION BODY CONTENT */}
                    {/* 1. Hero Section: Background Mode Selector */}
                    {section.id === 'sec_hero' && onUpdateBackgroundConfig && (
                      <div className="bg-[#0a0e1a] border border-[#1e2942] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
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

                        <div className="flex items-center bg-[#121829] border border-[#1e2942] rounded-lg p-1 self-start sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (bgConfig.mode !== 'static') {
                                onUpdateBackgroundConfig({ ...bgConfig, mode: 'static' });
                                showToast('Switched to Static Background Mode.');
                              }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                              bgConfig.mode === 'static'
                                ? 'bg-[#2563eb] text-white shadow-sm font-semibold'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            <ImageIcon className="w-3 h-3" /> Static Mode
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (bgConfig.mode !== 'video') {
                                onUpdateBackgroundConfig({ ...bgConfig, mode: 'video' });
                                showToast('Switched to Video Background Mode.');
                              }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                              bgConfig.mode === 'video'
                                ? 'bg-[#2563eb] text-white shadow-sm font-semibold'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            <Video className="w-3 h-3" /> Video Mode
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 2. Read More Button Section Card */}
                    {section.type === 'read_more_button' && (
                      <div className="p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2942] space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-white">Responsive Button Previews:</div>
                          <button
                            type="button"
                            onClick={() => setIsReadMoreModalOpen(true)}
                            className="text-xs text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1"
                          >
                            <SlidersHorizontal className="w-3 h-3" /> Edit Styling &amp; URLs
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {/* Desktop Button Preview */}
                          <div className="p-3 rounded-lg bg-[#121829] border border-[#1e2942] space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-300">
                              <span className="flex items-center gap-1 text-blue-300">
                                <Monitor className="w-3.5 h-3.5" /> Desktop Version
                              </span>
                              <span className="text-[10px] font-mono text-gray-400">
                                {readMoreConfig.desktop.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <div className="py-2 flex justify-center bg-[#070912] rounded border border-[#1e2942]/60">
                              <div
                                style={{
                                  backgroundColor: readMoreConfig.desktop.backgroundColor,
                                  color: readMoreConfig.desktop.textColor,
                                  fontSize: readMoreConfig.desktop.fontSize,
                                  fontWeight: readMoreConfig.desktop.fontWeight,
                                  borderRadius: readMoreConfig.desktop.borderRadius,
                                  padding: '8px 18px',
                                }}
                                className="text-center font-semibold truncate max-w-[220px]"
                              >
                                {readMoreConfig.desktop.text || 'READ MORE'}
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-400 truncate font-mono">
                              URL: {readMoreConfig.desktop.url || '(none)'}
                            </div>
                          </div>

                          {/* Mobile Button Preview */}
                          <div className="p-3 rounded-lg bg-[#121829] border border-[#1e2942] space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-gray-300">
                              <span className="flex items-center gap-1 text-purple-300">
                                <Smartphone className="w-3.5 h-3.5" /> Mobile Version
                              </span>
                              <span className="text-[10px] font-mono text-gray-400">
                                {readMoreConfig.mobile.enabled ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                            <div className="py-2 flex justify-center bg-[#070912] rounded border border-[#1e2942]/60">
                              <div
                                style={{
                                  backgroundColor: readMoreConfig.mobile.backgroundColor,
                                  color: readMoreConfig.mobile.textColor,
                                  fontSize: readMoreConfig.mobile.fontSize,
                                  fontWeight: readMoreConfig.mobile.fontWeight,
                                  borderRadius: readMoreConfig.mobile.borderRadius,
                                  padding: '8px 18px',
                                }}
                                className="text-center font-semibold truncate max-w-[220px]"
                              >
                                {readMoreConfig.mobile.text || 'READ MORE'}
                              </div>
                            </div>
                            <div className="text-[10px] text-gray-400 truncate font-mono">
                              URL: {readMoreConfig.mobile.url || '(none)'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. Mobile Form Section Note */}
                    {section.id === 'sec_mobile_form' && (
                      <div className="p-3.5 rounded-xl bg-[#0a0e1a] border border-[#1e2942] text-xs text-gray-400 space-y-1">
                        <div className="font-semibold text-white flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-emerald-400" />
                          Dedicated Mobile Registration Form
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                          This separated form instance renders exclusively on mobile screens (&lt;992px) for improved conversion. Configure Form ID, Height, and security cookies in the <strong>Form Manager</strong> tab.
                        </p>
                      </div>
                    )}

                    {/* 4. Asset Cards for this Section */}
                    {sectionAssets.length > 0 ? (
                      <div className={`grid ${sectionAssets.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'} gap-3.5`}>
                        {sectionAssets.map(asset => (
                          <AssetCard
                            key={asset.id}
                            asset={asset}
                            onReplaceUrl={onReplaceUrl}
                            onRestoreOriginal={onRestoreOriginal}
                            onJumpToCode={onJumpToCode}
                          />
                        ))}
                      </div>
                    ) : (
                      section.type !== 'read_more_button' && section.id !== 'sec_mobile_form' && (
                        <div className="text-center py-6 text-gray-500 text-xs italic">
                          {searchTerm ? 'No assets in this section match the search query.' : 'This section is active with no separate replaceable image assets.'}
                        </div>
                      )
                    )}
                  </div>
                );
              })
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
                      <AlertTriangle className="w-3 h-3 text-rose-400" /> Video Load Error
                    </span>
                  ) : (
                    <span className="text-gray-400 font-mono">Video Standby</span>
                  )}
                </>
              )}
            </div>

            {/* Responsive Iframe Frame */}
            <div
              className="transition-all duration-300 ease-in-out shadow-2xl bg-[#0a0a0c] border border-[#222b3f] rounded-2xl overflow-hidden relative flex flex-col items-center"
              style={{
                width: `${viewportWidth}px`,
                maxWidth: '100%',
                height: isFullscreenPreview ? 'calc(100vh - 4rem)' : 'calc(100vh - 9rem)',
              }}
            >
              <iframe
                key={previewKey}
                title="Live Landing Page Preview"
                srcDoc={previewSrcDoc}
                className="w-full h-full border-0 bg-black"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          </div>
        )}
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#121829] border border-[#2563eb]/60 text-white text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Read More Button Configuration Modal */}
      <ReadMoreButtonModal
        isOpen={isReadMoreModalOpen}
        onClose={() => setIsReadMoreModalOpen(false)}
        config={readMoreConfig}
        onSave={newConfig => {
          onUpdateReadMoreConfig?.(newConfig);
          showToast('Read More Button configuration saved.');
        }}
      />

      {/* Video Quality Inspector Modal */}
      <VideoQualityInspectorModal
        isOpen={isVideoInspectorOpen}
        onClose={() => setIsVideoInspectorOpen(false)}
        desktopVideoUrl={bgConfig.video.desktopVideo}
        mobileVideoUrl={bgConfig.video.mobileVideo}
      />
    </div>
  );
};
