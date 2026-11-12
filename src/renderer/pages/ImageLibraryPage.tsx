import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Image as ImageIcon,
  Video,
  Folder,
  FolderOpen,
  Search,
  Copy,
  ExternalLink,
  AlertTriangle,
  Check,
  RefreshCw,
  ChevronRight,
  ArrowUpLeft,
  Eye,
  X,
  KeyRound,
  CheckCircle2,
  Clock,
  SlidersHorizontal,
  ChevronLeft,
  HardDrive,
  FileQuestion,
  Play,
  Home,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import {
  GHLConnectionStatus,
  GHLFilterTab,
  GHLFolderBreadcrumb,
  GHLMediaItem,
  GHLSortBy,
  GHLSortOrder,
  GHLVerifyAssetResult,
} from '@shared/types';
import {
  fetchGhlConnectionStatus,
  fetchGhlMediaLibrary,
  subscribeGhlStatus,
  verifyGhlAssetAccessibility,
} from '../lib/ghlClient';
import { GhlConnectionCard } from '../components/GhlConnectionCard';
import { formatBytes, formatDuration, calculateAspectRatio } from '@shared/videoQuality';

type SortOptionKey =
  | 'newest'
  | 'oldest'
  | 'name_asc'
  | 'name_desc'
  | 'size_desc'
  | 'size_asc';

const PAGE_LIMIT = 40;

export const ImageLibraryPage: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<GHLConnectionStatus | null>(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Navigation & query state
  const [activeTab, setActiveTab] = useState<GHLFilterTab>('all');
  const [breadcrumbs, setBreadcrumbs] = useState<GHLFolderBreadcrumb[]>([
    { id: null, name: 'All Media' },
  ]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOptionKey>('newest');
  const [offset, setOffset] = useState(0);

  // Data state
  const [items, setItems] = useState<GHLMediaItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<{
    all: number;
    image: number;
    video: number;
    pdf: number;
    uncategorized: number;
    folder: number;
  } | null>(null);

  // UI interactions
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [brokenThumbIds, setBrokenThumbIds] = useState<Record<string, boolean>>({});

  // Media Preview Modal state
  const [previewItem, setPreviewItem] = useState<GHLMediaItem | null>(null);
  const [previewVerifyStatus, setPreviewVerifyStatus] = useState<GHLVerifyAssetResult | null>(null);
  const [isVerifyingPreview, setIsVerifyingPreview] = useState(false);
  const [previewImageDims, setPreviewImageDims] = useState<{ width: number; height: number } | null>(null);
  const [previewLoadError, setPreviewLoadError] = useState<string | null>(null);
  const [previewVideoMeta, setPreviewVideoMeta] = useState<{
    width: number;
    height: number;
    duration: number;
    aspectRatio: string;
  } | null>(null);
  const [pdfZoom, setPdfZoom] = useState<number>(100);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);

  const currentFolder = breadcrumbs[breadcrumbs.length - 1];

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Map sort option to GHL API sortBy and sortOrder
  const getApiSortParams = useCallback(
    (opt: SortOptionKey): { sortBy: GHLSortBy; sortOrder: GHLSortOrder } => {
      switch (opt) {
        case 'oldest':
          return { sortBy: 'updatedAt', sortOrder: 'asc' };
        case 'name_asc':
          return { sortBy: 'name', sortOrder: 'asc' };
        case 'name_desc':
          return { sortBy: 'name', sortOrder: 'desc' };
        case 'newest':
        case 'size_desc':
        case 'size_asc':
        default:
          return { sortBy: 'updatedAt', sortOrder: 'desc' };
      }
    },
    []
  );

  const loadMedia = useCallback(
    async (forceRefresh = false) => {
      setIsLoading(true);
      setErrorMessage(null);
      setErrorCode(null);

      const { sortBy, sortOrder } = getApiSortParams(sortOption);
      const response = await fetchGhlMediaLibrary({
        parentId: currentFolder?.id || null,
        query: debouncedQuery || undefined,
        filterTab: activeTab,
        sortBy,
        sortOrder,
        offset,
        limit: PAGE_LIMIT,
        refresh: forceRefresh,
      });

      setIsLoading(false);

      if (!response.success) {
        setItems([]);
        setTotalCount(0);
        setHasMore(false);
        setErrorMessage(response.error || 'Failed to load GoHighLevel Media Storage.');
        setErrorCode(response.errorCode || 'API_ERROR');
        if (response.errorCode === 'NOT_CONFIGURED' || response.errorCode === 'UNAUTHORIZED') {
          setShowSettingsPanel(true);
        }
        return;
      }

      setItems(response.items);
      setTotalCount(response.totalCount);
      setHasMore(response.hasMore);
      setLastSyncedAt(response.syncedAt);
      setIsFromCache(response.fromCache);
      if (response.categoryCounts) {
        setCategoryCounts(response.categoryCounts);
      }
      setConnectionStatus(prev => ({
        connected: true,
        hasToken: true,
        maskedToken: prev?.maskedToken || '••••••••••••••••••••••••',
        locationId: response.locationId,
        requiredScope: prev?.requiredScope || 'medias.readonly',
        status: 'connected',
        statusMessage: `Connected to GoHighLevel Media Storage (Location ${response.locationId}).`,
        lastSyncedAt: response.syncedAt,
        lastError: null,
        errorCode: null,
        stats: {
          folderCount: response.folders.length,
          fileCount: response.files.length,
        },
      }));
    },
    [activeTab, currentFolder?.id, debouncedQuery, getApiSortParams, offset, sortOption]
  );

  // Initial status check and subscription
  useEffect(() => {
    fetchGhlConnectionStatus().then(st => {
      setConnectionStatus(st);
      if (!st.hasToken) {
        setShowSettingsPanel(true);
      }
    });

    const unsub = subscribeGhlStatus(st => {
      setConnectionStatus(st);
      if (st.connected) {
        loadMedia(true);
      }
    });
    return unsub;
  }, []);

  // Trigger media load when query/folder/tab/sort/offset changes and token exists
  useEffect(() => {
    if (connectionStatus?.hasToken) {
      loadMedia(false);
    } else if (connectionStatus && !connectionStatus.hasToken) {
      setItems([]);
      setErrorCode('NOT_CONFIGURED');
      setErrorMessage(
        'GoHighLevel Private Integration Token is not configured. Enter your replacement token below to connect.'
      );
    }
  }, [connectionStatus?.hasToken, activeTab, currentFolder?.id, debouncedQuery, sortOption, offset, loadMedia]);

  // Verify asset URL when opening Preview Modal
  useEffect(() => {
    if (!previewItem || previewItem.type === 'folder' || !previewItem.url) {
      setPreviewVerifyStatus(null);
      setPreviewImageDims(null);
      setPreviewVideoMeta(null);
      setPreviewLoadError(null);
      setPdfLoadError(null);
      setPdfZoom(100);
      return;
    }

    setPreviewImageDims(null);
    setPreviewVideoMeta(null);
    setPreviewLoadError(null);
    setPdfLoadError(null);
    setPdfZoom(100);
    setIsVerifyingPreview(true);

    verifyGhlAssetAccessibility(previewItem.url)
      .then(res => {
        setPreviewVerifyStatus(res);
      })
      .finally(() => {
        setIsVerifyingPreview(false);
      });
  }, [previewItem]);

  // Apply client-side metadata sorting when size sort is chosen
  const displayedItems = useMemo(() => {
    const folders = items.filter(i => i.type === 'folder');
    const files = items.filter(i => i.type === 'file');

    if (sortOption === 'size_desc') {
      files.sort((a, b) => (b.size || 0) - (a.size || 0));
    } else if (sortOption === 'size_asc') {
      files.sort((a, b) => (a.size || 0) - (b.size || 0));
    }

    if (activeTab === 'folder') return folders;
    if (activeTab === 'image') return files.filter(f => f.mediaCategory === 'image');
    if (activeTab === 'video') return files.filter(f => f.mediaCategory === 'video');
    if (activeTab === 'pdf') return files.filter(f => f.mediaCategory === 'pdf');
    if (activeTab === 'uncategorized') return files.filter(f => f.mediaCategory === 'uncategorized');
    return [...folders, ...files];
  }, [items, sortOption, activeTab]);

  const handleOpenFolder = (folder: GHLMediaItem) => {
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setOffset(0);
    if (activeTab === 'folder') {
      setActiveTab('all');
    }
  };

  const handleNavigateBreadcrumb = (index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1));
    setOffset(0);
  };

  const handleNavigateParent = () => {
    if (breadcrumbs.length > 1) {
      setBreadcrumbs(prev => prev.slice(0, prev.length - 1));
      setOffset(0);
    }
  };

  const handleReturnRoot = () => {
    setBreadcrumbs([{ id: null, name: 'All Media' }]);
    setOffset(0);
  };

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const navTabs: { id: GHLFilterTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'all', label: 'All Media', icon: FolderOpen },
    { id: 'image', label: 'Images', icon: ImageIcon },
    { id: 'video', label: 'Videos', icon: Video },
    { id: 'pdf', label: 'PDFs', icon: FileText },
    { id: 'uncategorized', label: 'Uncategorized', icon: FileQuestion },
    { id: 'folder', label: 'Folders', icon: Folder },
  ];

  const currentPage = Math.floor(offset / PAGE_LIMIT) + 1;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Top Header & Connection Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563eb]/20 to-[#7c3aed]/20 text-blue-400 flex items-center justify-center border border-[#2563eb]/30">
            <ImageIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-white tracking-wide">
                GoHighLevel Media Storage
              </h2>
              {connectionStatus?.connected ? (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE • {connectionStatus.locationId}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-500/30">
                  {connectionStatus?.hasToken ? 'CONNECTION ERROR' : 'TOKEN REQUIRED'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
              <span>Browse real GoHighLevel folders, images, and videos for landing page replacement</span>
              {lastSyncedAt && (
                <>
                  <span>•</span>
                  <span className="text-[11px] font-mono text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-blue-400" />
                    Synced {new Date(lastSyncedAt).toLocaleTimeString()}{' '}
                    {isFromCache ? '(Cached)' : '(Live)'}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right Controls: Search, Refresh, Connection Settings */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search GHL media by filename..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-60 bg-[#121829] border border-[#1e2942] rounded-xl pl-8 pr-7 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2563eb]"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => loadMedia(true)}
            disabled={isLoading || !connectionStatus?.hasToken}
            className="px-3.5 py-2 rounded-xl bg-[#121829] hover:bg-[#18223a] disabled:opacity-40 border border-[#1e2942] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Clear metadata cache and fetch latest files from GoHighLevel"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setShowSettingsPanel(prev => !prev)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              showSettingsPanel
                ? 'bg-[#2563eb] border-[#2563eb] text-white'
                : 'bg-[#121829] hover:bg-[#18223a] border-[#1e2942] text-gray-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-violet-300" />
            {showSettingsPanel ? 'Hide GHL Settings' : 'GHL Connection Settings'}
          </button>
        </div>
      </div>

      {/* Collapsible GHL Connection Settings Card */}
      {showSettingsPanel && (
        <GhlConnectionCard
          onConnectionChange={st => {
            setConnectionStatus(st);
            if (st.connected) {
              setShowSettingsPanel(false);
            }
          }}
        />
      )}

      {/* Main Navigation Tabs + Sorting Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0e1426] border border-[#1e2942] p-3 rounded-2xl">
        {/* Main Navigation Tabs: All Media | Images | Videos | Folders */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {navTabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const count = categoryCounts ? categoryCounts[tab.id] : undefined;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setOffset(0);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-[#2563eb] to-[#7c3aed] text-white shadow-md shadow-blue-950/40'
                    : 'bg-[#121829] text-gray-400 hover:text-white border border-[#1e2942]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {typeof count === 'number' && (
                  <span
                    className={`ml-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white font-bold'
                        : 'bg-[#1a233b] text-gray-400'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-400">Sort by:</span>
          <select
            value={sortOption}
            onChange={e => {
              setSortOption(e.target.value as SortOptionKey);
              setOffset(0);
            }}
            className="bg-[#121829] border border-[#1e2942] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#2563eb]"
          >
            <option value="newest">Newest Updated</option>
            <option value="oldest">Oldest Updated</option>
            <option value="name_asc">Name (A → Z)</option>
            <option value="name_desc">Name (Z → A)</option>
            <option value="size_desc">File Size (Largest)</option>
            <option value="size_asc">File Size (Smallest)</option>
          </select>
        </div>
      </div>

      {/* Folder Breadcrumb & Parent Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-[#121829] border border-[#1e2942] text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={`${crumb.id || 'root'}_${idx}`}>
                <button
                  onClick={() => handleNavigateBreadcrumb(idx)}
                  disabled={isLast}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${
                    isLast
                      ? 'bg-[#1e2942] text-white font-semibold cursor-default'
                      : 'text-gray-400 hover:text-white hover:bg-[#18223a]'
                  }`}
                >
                  {idx === 0 ? <Home className="w-3.5 h-3.5 text-blue-400" /> : <Folder className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{crumb.name}</span>
                </button>
                {!isLast && <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
              </React.Fragment>
            );
          })}
        </div>

        {breadcrumbs.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleNavigateParent}
              className="px-2.5 py-1 rounded-lg bg-[#0a0e1a] hover:bg-[#18223a] border border-[#1e2942] text-gray-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
            >
              <ArrowUpLeft className="w-3 h-3 text-blue-400" /> Parent Folder
            </button>
            <button
              onClick={handleReturnRoot}
              className="px-2.5 py-1 rounded-lg bg-[#0a0e1a] hover:bg-[#18223a] border border-[#1e2942] text-gray-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
            >
              <Home className="w-3 h-3 text-violet-400" /> Return to All Media
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {errorMessage && (
        <div className="p-6 rounded-2xl bg-rose-950/30 border border-rose-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-rose-200">
                {errorCode === 'NOT_CONFIGURED'
                  ? 'GoHighLevel Connection Required'
                  : errorCode === 'UNAUTHORIZED'
                  ? 'Authentication Failed — Invalid or Revoked Token'
                  : errorCode === 'FORBIDDEN_SCOPE'
                  ? 'Permission Denied — Missing medias.readonly Scope'
                  : errorCode === 'INVALID_LOCATION'
                  ? 'Invalid Location ID'
                  : errorCode === 'RATE_LIMITED'
                  ? 'API Rate Limit Reached'
                  : 'Unable to Retrieve GoHighLevel Media Storage'}
              </h3>
              <p className="text-xs text-rose-200/80 mt-1 leading-relaxed">{errorMessage}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowSettingsPanel(true)}
              className="px-3.5 py-2 rounded-xl bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" /> Configure Token
            </button>
            {connectionStatus?.hasToken && (
              <button
                onClick={() => loadMedia(true)}
                className="px-3.5 py-2 rounded-xl bg-[#121829] hover:bg-[#18223a] border border-[#1e2942] text-gray-200 text-xs font-semibold flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-[#121829] border border-[#1e2942] rounded-2xl overflow-hidden h-64 animate-pulse flex flex-col justify-between p-4"
            >
              <div className="h-36 bg-[#0a0e1a] rounded-xl" />
              <div className="space-y-2">
                <div className="h-3 bg-[#1e2942] rounded w-3/4" />
                <div className="h-2.5 bg-[#1e2942] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty Library / Empty Folder State */}
      {!isLoading && !errorMessage && displayedItems.length === 0 && (
        <div className="bg-[#121829] border border-[#1e2942] rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0a0e1a] border border-[#1e2942] text-gray-400 flex items-center justify-center mx-auto">
            {currentFolder.id ? (
              <FolderOpen className="w-6 h-6 text-amber-400" />
            ) : (
              <FileQuestion className="w-6 h-6 text-blue-400" />
            )}
          </div>
          <h3 className="text-sm font-bold text-white">
            {debouncedQuery
              ? `No GHL media matching "${debouncedQuery}"`
              : currentFolder.id
              ? activeTab === 'pdf'
                ? `Folder "${currentFolder.name}" has no PDF documents`
                : `Folder "${currentFolder.name}" is empty`
              : activeTab === 'pdf'
              ? 'No PDF documents found in this view'
              : 'No media items found in this view'}
          </h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            {debouncedQuery
              ? 'Try clearing your search filter or navigating back to All Media.'
              : currentFolder.id
              ? activeTab === 'pdf'
                ? 'There are no PDF files inside this GoHighLevel folder.'
                : 'There are no files or subfolders inside this GoHighLevel folder.'
              : activeTab === 'pdf'
              ? 'Your GoHighLevel Media Storage returned 0 PDF files for this location.'
              : 'Your GoHighLevel Media Storage returned 0 items for the selected filter.'}
          </p>
          {(debouncedQuery || currentFolder.id || activeTab !== 'all') && (
            <div className="pt-2 flex items-center justify-center gap-2">
              {debouncedQuery && (
                <button
                  onClick={() => setSearchInput('')}
                  className="px-3.5 py-1.5 rounded-xl bg-[#18223a] text-gray-200 text-xs font-semibold hover:text-white"
                >
                  Clear Search
                </button>
              )}
              {currentFolder.id && (
                <button
                  onClick={handleNavigateParent}
                  className="px-3.5 py-1.5 rounded-xl bg-[#2563eb] text-white text-xs font-semibold hover:bg-blue-600"
                >
                  Back to Parent Folder
                </button>
              )}
              {activeTab !== 'all' && (
                <button
                  onClick={() => setActiveTab('all')}
                  className="px-3.5 py-1.5 rounded-xl bg-[#18223a] text-gray-200 text-xs font-semibold hover:text-white"
                >
                  Show All Media
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Media & Folders Grid */}
      {!isLoading && !errorMessage && displayedItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {displayedItems.map(item => {
            const isFolder = item.type === 'folder';
            const isPdf = item.mediaCategory === 'pdf';
            const isVideo = item.mediaCategory === 'video';
            const isImage = item.mediaCategory === 'image';
            const isUncategorized = item.mediaCategory === 'uncategorized' || (!isFolder && !isPdf && !isVideo && !isImage);
            const isBrokenThumb = Boolean(brokenThumbIds[item.id]);

            if (isFolder) {
              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenFolder(item)}
                  className="bg-[#121829] border border-[#1e2942] hover:border-[#2563eb] rounded-2xl p-5 flex flex-col justify-between cursor-pointer shadow-lg transition-all duration-200 group"
                >
                  <div className="h-36 rounded-xl bg-[#0a0e1a] border border-[#1e2942] flex flex-col items-center justify-center p-4 group-hover:bg-[#0e1526] transition-colors">
                    <Folder className="w-14 h-14 text-amber-400 group-hover:scale-105 transition-transform" />
                    <span className="mt-2 text-[10px] font-mono uppercase tracking-wider text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                      GHL FOLDER
                    </span>
                  </div>

                  <div className="mt-4">
                    <h4
                      className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors"
                      title={item.name}
                    >
                      {item.name}
                    </h4>
                    <div className="mt-2 pt-2.5 border-t border-[#1e2942] flex items-center justify-between text-[10px] text-gray-400 font-mono">
                      <span>
                        {item.updatedAt
                          ? new Date(item.updatedAt).toLocaleDateString()
                          : 'Directory'}
                      </span>
                      <span className="text-blue-400 font-sans font-semibold flex items-center gap-0.5">
                        Open <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className="bg-[#121829] border border-[#1e2942] hover:border-[#2a3c61] rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg transition-all duration-200 group"
              >
                {/* Thumbnail Area (Lazy loaded for images; static non-autoplay metadata frame for videos; document preview for PDFs) */}
                <div
                  onClick={() => setPreviewItem(item)}
                  className="relative h-44 bg-[#0a0e1a] p-3 flex items-center justify-center overflow-hidden border-b border-[#1e2942] cursor-pointer"
                >
                  {isVideo ? (
                    <div className="w-full h-full relative flex items-center justify-center bg-black rounded-lg overflow-hidden">
                      {item.url && !isBrokenThumb ? (
                        <video
                          src={item.url}
                          preload="metadata"
                          muted
                          playsInline
                          onError={() =>
                            setBrokenThumbIds(prev => ({ ...prev, [item.id]: true }))
                          }
                          className="max-h-full max-w-full object-contain pointer-events-none"
                        />
                      ) : (
                        <Video className="w-10 h-10 text-violet-400" />
                      )}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/15 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-black/75 border border-white/30 flex items-center justify-center text-white shadow-lg">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : isPdf ? (
                    <div className="w-full h-full relative flex flex-col items-center justify-center bg-[#0d1322] rounded-xl border border-rose-500/20 group-hover:border-rose-500/40 transition-colors p-3">
                      {item.thumbnailUrl && item.thumbnailUrl !== item.url && !isBrokenThumb ? (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.name}
                          loading="lazy"
                          onError={() =>
                            setBrokenThumbIds(prev => ({ ...prev, [item.id]: true }))
                          }
                          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-12 h-14 rounded-lg bg-gradient-to-b from-rose-950/70 to-rose-900/30 border border-rose-500/40 flex flex-col items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                            <FileText className="w-6 h-6 text-rose-400" />
                            <span className="text-[8px] font-mono font-bold text-rose-300 mt-0.5 tracking-wider">PDF</span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono mt-2 truncate max-w-[90%] text-center">
                            PDF Document
                          </span>
                        </div>
                      )}
                    </div>
                  ) : isImage && (item.thumbnailUrl || item.url) && !isBrokenThumb ? (
                    <img
                      src={item.thumbnailUrl || item.url}
                      alt={item.name}
                      loading="lazy"
                      onError={() =>
                        setBrokenThumbIds(prev => ({ ...prev, [item.id]: true }))
                      }
                      className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : isUncategorized ? (
                    <div className="w-full h-full relative flex flex-col items-center justify-center bg-[#0d1322] rounded-xl border border-gray-700/40 group-hover:border-gray-500/50 transition-colors p-3">
                      <div className="w-12 h-14 rounded-lg bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-600/50 flex flex-col items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                        <FileQuestion className="w-6 h-6 text-gray-300" />
                        <span className="text-[8px] font-mono font-bold text-gray-300 mt-0.5 tracking-wider uppercase truncate max-w-[40px]">
                          {item.fileExtension || 'FILE'}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-mono mt-2 truncate max-w-[90%] text-center">
                        {item.fileExtension ? `${item.fileExtension.toUpperCase()} File` : 'Uncategorized'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-500 text-center p-2">
                      <ImageIcon className="w-10 h-10 mb-1 text-gray-600" />
                      <span className="text-[10px]">Preview Unavailable</span>
                    </div>
                  )}

                  {/* Top-left Media Type Badge */}
                  <div className="absolute top-2 left-2">
                    {isVideo ? (
                      <span className="flex items-center gap-1 text-[9px] font-mono font-bold bg-gradient-to-r from-[#2563eb] to-[#7c3aed] text-white px-2 py-0.5 rounded-full shadow">
                        <Video className="w-2.5 h-2.5" />
                        VIDEO {item.fileExtension ? `• ${item.fileExtension.toUpperCase()}` : ''}
                      </span>
                    ) : isPdf ? (
                      <span className="flex items-center gap-1 text-[9px] font-mono font-bold bg-rose-950/90 text-rose-300 border border-rose-700/40 px-2 py-0.5 rounded-full shadow">
                        <FileText className="w-2.5 h-2.5" />
                        PDF {item.fileExtension ? `• ${item.fileExtension.toUpperCase()}` : ''}
                      </span>
                    ) : isUncategorized ? (
                      <span className="flex items-center gap-1 text-[9px] font-mono font-bold bg-gray-800 text-gray-200 border border-gray-600/70 px-2 py-0.5 rounded-full shadow">
                        <FileQuestion className="w-2.5 h-2.5 text-gray-300" />
                        {item.fileExtension ? item.fileExtension.toUpperCase() : 'UNCATEGORIZED'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] font-mono font-bold bg-blue-950/90 text-blue-300 border border-blue-700/40 px-2 py-0.5 rounded-full">
                        <ImageIcon className="w-2.5 h-2.5" />
                        IMAGE {item.fileExtension ? `• ${item.fileExtension.toUpperCase()}` : ''}
                      </span>
                    )}
                  </div>

                  {/* Top-right Inspect Preview Button */}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setPreviewItem(item);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/75 text-gray-300 hover:text-white border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Preview Media Asset"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Metadata & Actions */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4
                      className="text-xs font-bold text-white tracking-wide truncate"
                      title={item.name}
                    >
                      {item.name}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-1 font-mono">
                      <span>{item.size ? formatBytes(item.size) : isPdf ? 'PDF Document' : 'Cloud Asset'}</span>
                      {item.updatedAt && (
                        <>
                          <span>•</span>
                          <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>

                    {item.url && (
                      <div
                        className="text-[10px] font-mono text-gray-400 mt-2 truncate bg-[#0a0e1a] p-1.5 rounded border border-[#1e2942]"
                        title={item.url}
                      >
                        {item.url}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#1e2942] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      className="px-2.5 py-1 rounded-lg bg-[#0a0e1a] hover:bg-[#18223a] text-gray-300 hover:text-white text-[10px] font-semibold flex items-center gap-1 border border-[#1e2942] transition-colors"
                    >
                      <Eye className="w-3 h-3 text-blue-400" /> Preview
                    </button>

                    <button
                      type="button"
                      onClick={() => copyToClipboard(item.url, item.id)}
                      disabled={!item.url}
                      className="px-2.5 py-1 rounded-lg bg-[#161f36] hover:bg-[#2563eb] text-gray-200 hover:text-white text-[10px] font-semibold flex items-center gap-1 border border-[#263554] transition-colors"
                    >
                      {copiedId === item.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-300" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" /> Copy URL
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {!isLoading && !errorMessage && (displayedItems.length > 0 || offset > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#1e2942] text-xs text-gray-400">
          <div>
            Showing <span className="text-white font-semibold">{displayedItems.length}</span> item(s) on Page{' '}
            <span className="text-white font-semibold">{currentPage}</span>
            {totalCount > 0 && (
              <>
                {' '}
                (Total reported by GHL: <span className="text-white font-mono">{totalCount}</span>)
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset(prev => Math.max(0, prev - PAGE_LIMIT))}
              disabled={offset === 0 || isLoading}
              className="px-3 py-1.5 rounded-xl bg-[#121829] hover:bg-[#18223a] disabled:opacity-40 border border-[#1e2942] text-gray-200 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="px-3 py-1.5 rounded-xl bg-[#0a0e1a] border border-[#1e2942] font-mono text-white">
              Page {currentPage}
            </span>
            <button
              type="button"
              onClick={() => setOffset(prev => prev + PAGE_LIMIT)}
              disabled={!hasMore || isLoading}
              className="px-3 py-1.5 rounded-xl bg-[#121829] hover:bg-[#18223a] disabled:opacity-40 border border-[#1e2942] text-gray-200 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Media Preview Modal (Phase 6: Real Image & Video Playback + Accessibility Verification) */}
      {previewItem && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-[#0e1426] border border-[#1e2942] rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#1e2942]">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate">{previewItem.name}</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-600/20 text-violet-300 border border-violet-500/30 uppercase">
                    {previewItem.mediaCategory}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-gray-400 break-all mt-1">
                  {previewItem.url || 'No direct URL returned by API'}
                </p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-lg bg-[#121829] text-gray-400 hover:text-white border border-[#1e2942]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Viewport Box */}
            <div className="bg-[#090b10] border border-[#1e2942] rounded-xl p-4 min-h-[300px] flex flex-col items-center justify-center overflow-hidden relative">
              {!previewItem.url ? (
                <div className="text-center space-y-2 p-6">
                  <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                  <div className="text-xs font-bold text-white">Missing Asset URL</div>
                  <p className="text-[11px] text-gray-400">
                    GoHighLevel returned metadata for this record without a public media URL.
                  </p>
                </div>
              ) : previewLoadError ? (
                <div className="text-center space-y-2 p-6 max-w-md">
                  <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
                  <div className="text-xs font-bold text-rose-200">Media Preview Unavailable</div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">{previewLoadError}</p>
                </div>
              ) : previewItem.mediaCategory === 'pdf' ? (
                <div className="w-full flex flex-col space-y-3">
                  {/* PDF Toolbar with Zoom, Reset & Open Tab */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-[#121829] border border-[#1e2942] text-xs">
                    <div className="flex items-center gap-2 text-rose-300 font-mono text-[11px] min-w-0">
                      <FileText className="w-4 h-4 text-rose-400 shrink-0" />
                      <span className="truncate max-w-[280px]">{previewItem.name}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPdfZoom(prev => Math.max(50, prev - 25))}
                        disabled={pdfZoom <= 50}
                        className="p-1.5 rounded-lg bg-[#0a0e1a] hover:bg-[#18223a] disabled:opacity-40 text-gray-300 hover:text-white border border-[#1e2942] transition-colors"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#0a0e1a] text-white border border-[#1e2942]">
                        {pdfZoom}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setPdfZoom(prev => Math.min(200, prev + 25))}
                        disabled={pdfZoom >= 200}
                        className="p-1.5 rounded-lg bg-[#0a0e1a] hover:bg-[#18223a] disabled:opacity-40 text-gray-300 hover:text-white border border-[#1e2942] transition-colors"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfZoom(100)}
                        className="px-2.5 py-1 rounded-lg bg-[#0a0e1a] hover:bg-[#18223a] text-gray-300 hover:text-white text-[11px] font-mono border border-[#1e2942] flex items-center gap-1 transition-colors"
                        title="Reset Zoom"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </button>
                      <a
                        href={previewItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 rounded-lg bg-[#18223a] hover:bg-blue-600 text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
                        title="Open PDF in New Browser Tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open Tab
                      </a>
                    </div>
                  </div>

                  {/* Multipage Scrollable PDF Viewport */}
                  <div className="w-full h-[480px] bg-[#0c0f17] rounded-xl overflow-hidden border border-[#1e2942] relative flex items-center justify-center">
                    {pdfLoadError ? (
                      <div className="text-center p-6 max-w-md space-y-3">
                        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                        <div className="text-xs font-bold text-white">In-App PDF View Restricted</div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">{pdfLoadError}</p>
                        <a
                          href={previewItem.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-semibold"
                        >
                          Open Document in New Tab <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <iframe
                        key={`${previewItem.url}_${pdfZoom}`}
                        src={`${previewItem.url}#toolbar=1&navpanes=1&scrollbar=1&zoom=${pdfZoom}`}
                        title={previewItem.name}
                        className="w-full h-full border-0"
                        onError={() =>
                          setPdfLoadError(
                            'Browser restriction prevented embedding this PDF directly. You can view the document directly by opening it in a new tab.'
                          )
                        }
                      />
                    )}
                  </div>
                </div>
              ) : previewItem.mediaCategory === 'video' ? (
                <video
                  key={previewItem.url}
                  src={previewItem.url}
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={e => {
                    const v = e.currentTarget;
                    setPreviewVideoMeta({
                      width: v.videoWidth,
                      height: v.videoHeight,
                      duration: v.duration,
                      aspectRatio: calculateAspectRatio(v.videoWidth, v.videoHeight).ratioString,
                    });
                  }}
                  onError={() =>
                    setPreviewLoadError(
                      'This video URL could not be played in the browser (inaccessible URL, expired link, or unsupported video codec).'
                    )
                  }
                  className="max-h-[440px] max-w-full rounded-lg shadow-xl"
                />
              ) : previewItem.mediaCategory === 'uncategorized' ? (
                <div className="w-full flex flex-col items-center justify-center p-8 space-y-4">
                  <div className="w-20 h-24 rounded-2xl bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-600/60 flex flex-col items-center justify-center shadow-2xl">
                    <FileQuestion className="w-10 h-10 text-gray-300" />
                    <span className="text-[10px] font-mono font-bold text-gray-200 mt-1 tracking-wider uppercase">
                      {previewItem.fileExtension || 'FILE'}
                    </span>
                  </div>
                  <div className="text-center space-y-1 max-w-md">
                    <div className="text-sm font-bold text-white break-all">{previewItem.name}</div>
                    <p className="text-[11px] text-gray-400">
                      This file format ({previewItem.fileExtension ? `.${previewItem.fileExtension}` : 'no extension'}) is classified as Uncategorized.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <a
                      href={previewItem.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-xl bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Open / Download File
                    </a>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(previewItem.url, previewItem.id)}
                      className="px-4 py-2 rounded-xl bg-[#121829] hover:bg-[#18223a] text-gray-200 text-xs font-semibold flex items-center gap-1.5 border border-[#1e2942] transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-blue-400" /> Copy URL
                    </button>
                  </div>
                </div>
              ) : (
                <img
                  src={previewItem.url}
                  alt={previewItem.name}
                  onLoad={e => {
                    const img = e.currentTarget;
                    setPreviewImageDims({
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                    });
                  }}
                  onError={() =>
                    setPreviewLoadError(
                      'This image URL could not be loaded (inaccessible URL, CORS restriction, or expired link).'
                    )
                  }
                  className="max-h-[440px] max-w-full object-contain rounded-lg"
                />
              )}
            </div>

            {/* Metadata & Verification Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#121829] border border-[#1e2942]">
                <div className="text-[10px] text-gray-400 uppercase font-bold">File Size</div>
                <div className="text-white font-mono mt-0.5">
                  {previewItem.size
                    ? formatBytes(previewItem.size)
                    : previewVerifyStatus?.contentLength
                    ? formatBytes(previewVerifyStatus.contentLength)
                    : 'Not reported'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#121829] border border-[#1e2942]">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Document / Media Info</div>
                <div className="text-white font-mono mt-0.5">
                  {previewItem.mediaCategory === 'pdf'
                    ? 'PDF Document (Multipage)'
                    : previewItem.mediaCategory === 'uncategorized'
                    ? `${previewItem.fileExtension ? previewItem.fileExtension.toUpperCase() : 'Unknown'} Document`
                    : previewImageDims
                    ? `${previewImageDims.width} × ${previewImageDims.height} px`
                    : previewVideoMeta
                    ? `${previewVideoMeta.width} × ${previewVideoMeta.height} (${formatDuration(previewVideoMeta.duration)})`
                    : previewItem.fileExtension?.toUpperCase() || 'Standard'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#121829] border border-[#1e2942]">
                <div className="text-[10px] text-gray-400 uppercase font-bold">Updated Date</div>
                <div className="text-white font-mono mt-0.5">
                  {previewItem.updatedAt
                    ? new Date(previewItem.updatedAt).toLocaleDateString()
                    : 'Unknown'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#121829] border border-[#1e2942]">
                <div className="text-[10px] text-gray-400 uppercase font-bold">CDN Accessibility</div>
                <div className="mt-0.5 font-mono">
                  {isVerifyingPreview ? (
                    <span className="text-blue-400">Verifying URL...</span>
                  ) : previewVerifyStatus?.accessible ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> HTTP {previewVerifyStatus.status} OK
                    </span>
                  ) : previewLoadError ? (
                    <span className="text-rose-400">Unavailable</span>
                  ) : (
                    <span className="text-emerald-400">Accessible</span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1e2942]">
              <div className="text-[11px] text-gray-400 font-mono">
                Location ID: <span className="text-gray-200">{previewItem.altId}</span>
              </div>
              <div className="flex items-center gap-2">
                {previewItem.url && (
                  <>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(previewItem.url, previewItem.id)}
                      className="px-3.5 py-2 rounded-xl bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      {copiedId === previewItem.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied {previewItem.mediaCategory === 'pdf' ? 'PDF' : 'Asset'} URL!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy {previewItem.mediaCategory === 'pdf' ? 'PDF' : 'Asset'} URL
                        </>
                      )}
                    </button>
                    <a
                      href={previewItem.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-[#121829] hover:bg-[#18223a] border border-[#1e2942] text-gray-200 text-xs font-semibold flex items-center gap-1.5"
                    >
                      {previewItem.mediaCategory === 'pdf' ? 'Open PDF in Tab' : 'Open Raw URL'} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
