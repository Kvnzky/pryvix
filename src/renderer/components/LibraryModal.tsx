import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X,
  Search,
  Check,
  Image as ImageIcon,
  Video,
  Folder,
  FolderOpen,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ArrowUpLeft,
  Home,
  KeyRound,
  AlertTriangle,
  SlidersHorizontal,
  Play,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import {
  GHLConnectionStatus,
  GHLFolderBreadcrumb,
  GHLMediaItem,
  GHLSortBy,
  GHLSortOrder,
} from '@shared/types';
import {
  fetchGhlConnectionStatus,
  fetchGhlMediaLibrary,
  subscribeGhlStatus,
} from '../lib/ghlClient';
import { GhlConnectionCard } from './GhlConnectionCard';
import { formatBytes } from '@shared/videoQuality';

interface LibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectUrl: (url: string) => void;
  title?: string;
  mediaFilter?: 'image' | 'video';
}

const MODAL_PAGE_LIMIT = 30;

export const LibraryModal: React.FC<LibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectUrl,
  title = 'Browse GoHighLevel Media Storage',
  mediaFilter = 'image',
}) => {
  const [connectionStatus, setConnectionStatus] = useState<GHLConnectionStatus | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [breadcrumbs, setBreadcrumbs] = useState<GHLFolderBreadcrumb[]>([
    { id: null, name: 'All Media' },
  ]);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortBy, setSortBy] = useState<GHLSortBy>('updatedAt');
  const [sortOrder, setSortOrder] = useState<GHLSortOrder>('desc');
  const [offset, setOffset] = useState(0);

  const [items, setItems] = useState<GHLMediaItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected item for Step 1 (Show preview) & Step 2 (Confirm selected asset)
  const [selectedCandidate, setSelectedCandidate] = useState<GHLMediaItem | null>(null);
  const [candidatePreviewError, setCandidatePreviewError] = useState<string | null>(null);

  const currentFolder = breadcrumbs[breadcrumbs.length - 1];

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadModalMedia = useCallback(
    async (forceRefresh = false) => {
      if (!isOpen) return;
      setIsLoading(true);
      setErrorMessage(null);

      // Fetch 'all' so folders are also returned alongside files for navigation
      const res = await fetchGhlMediaLibrary({
        parentId: currentFolder?.id || null,
        query: debouncedQuery || undefined,
        filterTab: 'all',
        sortBy,
        sortOrder,
        offset,
        limit: MODAL_PAGE_LIMIT,
        refresh: forceRefresh,
      });

      setIsLoading(false);

      if (!res.success) {
        setItems([]);
        setHasMore(false);
        setErrorMessage(res.error || 'Unable to load GoHighLevel Media Storage.');
        if (res.errorCode === 'NOT_CONFIGURED' || res.errorCode === 'UNAUTHORIZED') {
          setShowSettings(true);
        }
        return;
      }

      setItems(res.items);
      setHasMore(res.hasMore);
    },
    [isOpen, currentFolder?.id, debouncedQuery, sortBy, sortOrder, offset]
  );

  useEffect(() => {
    if (!isOpen) return;
    setSelectedCandidate(null);
    setCandidatePreviewError(null);

    fetchGhlConnectionStatus().then(st => {
      setConnectionStatus(st);
      if (!st.hasToken) {
        setShowSettings(true);
      } else {
        setShowSettings(false);
      }
    });

    const unsub = subscribeGhlStatus(st => {
      setConnectionStatus(st);
      if (st.connected) {
        setShowSettings(false);
        loadModalMedia(true);
      }
    });
    return unsub;
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && connectionStatus?.hasToken) {
      loadModalMedia(false);
    }
  }, [isOpen, connectionStatus?.hasToken, currentFolder?.id, debouncedQuery, sortBy, sortOrder, offset, loadModalMedia]);

  // Filter items to folders + compatible media (or show incompatible files disabled)
  const { folders, compatibleFiles, incompatibleCount } = useMemo(() => {
    const folderList = items.filter(i => i.type === 'folder');
    const fileList = items.filter(i => i.type === 'file');
    const compat = fileList.filter(f => f.mediaCategory === mediaFilter);
    const incompat = fileList.length - compat.length;
    return {
      folders: folderList,
      compatibleFiles: compat,
      incompatibleCount: incompat,
    };
  }, [items, mediaFilter]);

  if (!isOpen) return null;

  const handleOpenFolder = (folder: GHLMediaItem) => {
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
    setOffset(0);
    setSelectedCandidate(null);
  };

  const handleConfirmSelection = () => {
    if (!selectedCandidate || !selectedCandidate.url) return;
    if (selectedCandidate.mediaCategory !== mediaFilter) return;
    onSelectUrl(selectedCandidate.url);
    onClose();
  };

  const currentPage = Math.floor(offset / MODAL_PAGE_LIMIT) + 1;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0e1426] border border-[#1e2942] rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#1e2942] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563eb]/20 to-[#7c3aed]/20 text-blue-400 flex items-center justify-center border border-[#2563eb]/30">
              {mediaFilter === 'video' ? (
                <Video className="w-4 h-4 text-violet-400" />
              ) : (
                <ImageIcon className="w-4 h-4 text-blue-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 border border-violet-500/30 uppercase font-bold">
                  {mediaFilter === 'video' ? 'Video Assets Only' : 'Image Assets Only'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Select a live GoHighLevel {mediaFilter} asset, preview it, and confirm replacement
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings(prev => !prev)}
              className="px-3 py-1.5 rounded-lg bg-[#121829] hover:bg-[#18223a] border border-[#1e2942] text-gray-300 hover:text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-violet-400" />
              {showSettings ? 'Hide Settings' : 'GHL Connection'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a2030] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Optional Collapsible Connection Settings */}
        {showSettings && (
          <div className="p-4 border-b border-[#1e2942] bg-[#0a0e1a] max-h-80 overflow-y-auto">
            <GhlConnectionCard
              compact
              onConnectionChange={st => {
                setConnectionStatus(st);
                if (st.connected) {
                  setShowSettings(false);
                }
              }}
            />
          </div>
        )}

        {/* Filter, Search & Breadcrumb Bar */}
        <div className="p-4 border-b border-[#1e2942] bg-[#121829] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={`Search GoHighLevel ${mediaFilter}s by filename...`}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2563eb]"
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Sort & Refresh */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={`${sortBy}_${sortOrder}`}
                onChange={e => {
                  const [sb, so] = e.target.value.split('_') as [GHLSortBy, GHLSortOrder];
                  setSortBy(sb);
                  setSortOrder(so);
                  setOffset(0);
                }}
                className="bg-[#0a0e1a] border border-[#1e2942] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="updatedAt_desc">Newest First</option>
                <option value="updatedAt_asc">Oldest First</option>
                <option value="name_asc">Name (A → Z)</option>
                <option value="name_desc">Name (Z → A)</option>
              </select>

              <button
                type="button"
                onClick={() => loadModalMedia(true)}
                disabled={isLoading || !connectionStatus?.hasToken}
                className="px-3 py-1.5 rounded-xl bg-[#0a0e1a] hover:bg-[#18223a] border border-[#1e2942] text-gray-200 text-xs font-semibold flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Breadcrumbs */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1 flex-wrap">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={`${crumb.id || 'root'}_${idx}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setBreadcrumbs(prev => prev.slice(0, idx + 1));
                        setOffset(0);
                      }}
                      disabled={isLast}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-md ${
                        isLast
                          ? 'bg-[#1e2942] text-white font-semibold'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {idx === 0 ? (
                        <Home className="w-3 h-3 text-blue-400" />
                      ) : (
                        <Folder className="w-3 h-3 text-amber-400" />
                      )}
                      <span>{crumb.name}</span>
                    </button>
                    {!isLast && <ChevronRight className="w-3 h-3 text-gray-600" />}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              {incompatibleCount > 0 && (
                <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-gray-500" />
                  {incompatibleCount} incompatible {mediaFilter === 'video' ? 'image' : 'video'} file(s) hidden
                </span>
              )}
              {breadcrumbs.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setBreadcrumbs(prev => prev.slice(0, prev.length - 1));
                    setOffset(0);
                  }}
                  className="px-2 py-0.5 rounded bg-[#0a0e1a] border border-[#1e2942] text-gray-300 hover:text-white text-[11px] flex items-center gap-1"
                >
                  <ArrowUpLeft className="w-3 h-3 text-blue-400" /> Up
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Split: Grid on Left + Selected Asset Preview & Confirmation on Right */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Left: Media Grid */}
          <div className="flex-1 p-5 overflow-y-auto">
            {errorMessage ? (
              <div className="p-6 rounded-xl bg-rose-950/30 border border-rose-500/40 text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
                <div className="text-xs font-bold text-rose-200">{errorMessage}</div>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#2563eb] text-white text-xs font-semibold"
                >
                  Configure GHL Token
                </button>
              </div>
            ) : isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="h-44 rounded-xl bg-[#121829] border border-[#1e2942] animate-pulse"
                  />
                ))}
              </div>
            ) : folders.length === 0 && compatibleFiles.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-xs space-y-2">
                <FolderOpen className="w-8 h-8 text-gray-500 mx-auto" />
                <div className="font-semibold text-white">
                  No compatible {mediaFilter}s or folders found in this location.
                </div>
                {breadcrumbs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setBreadcrumbs([{ id: null, name: 'All Media' }])}
                    className="px-3 py-1.5 rounded-lg bg-[#2563eb] text-white text-xs font-semibold"
                  >
                    Return to All Media
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {/* Folders first */}
                {folders.map(folder => (
                  <div
                    key={folder.id}
                    onClick={() => handleOpenFolder(folder)}
                    className="bg-[#121829] border border-[#1e2942] hover:border-[#2563eb] rounded-xl p-3 cursor-pointer flex flex-col justify-between transition-all group"
                  >
                    <div className="h-28 bg-[#0a0e1a] rounded-lg flex flex-col items-center justify-center border border-[#1e2942]">
                      <Folder className="w-10 h-10 text-amber-400 group-hover:scale-105 transition-transform" />
                      <span className="text-[9px] font-mono text-amber-300 mt-1">FOLDER</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-white truncate" title={folder.name}>
                        {folder.name}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    </div>
                  </div>
                ))}

                {/* Compatible Media Files */}
                {compatibleFiles.map(file => {
                  const isSelected = selectedCandidate?.id === file.id;
                  const isVideo = file.mediaCategory === 'video';
                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        setSelectedCandidate(file);
                        setCandidatePreviewError(null);
                      }}
                      className={`bg-[#121829] border rounded-xl overflow-hidden cursor-pointer flex flex-col justify-between transition-all group ${
                        isSelected
                          ? 'border-[#2563eb] ring-2 ring-[#2563eb]/40'
                          : 'border-[#1e2942] hover:border-[#2a3c61]'
                      }`}
                    >
                      <div className="relative h-28 bg-[#0a0e1a] flex items-center justify-center p-2 overflow-hidden">
                        {isVideo ? (
                          <div className="w-full h-full relative flex items-center justify-center bg-black rounded overflow-hidden">
                            <video
                              src={file.url}
                              preload="metadata"
                              muted
                              playsInline
                              className="max-h-full max-w-full object-contain pointer-events-none"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <Play className="w-5 h-5 text-white fill-current" />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={file.thumbnailUrl || file.url}
                            alt={file.name}
                            loading="lazy"
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                          />
                        )}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#2563eb] text-white flex items-center justify-center shadow">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 border-t border-[#1e2942]">
                        <div className="text-xs font-semibold text-white truncate" title={file.name}>
                          {file.name}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-gray-400 font-mono">
                          <span>{file.size ? formatBytes(file.size) : file.fileExtension?.toUpperCase()}</span>
                          <span className="text-blue-400 font-sans font-medium">
                            {isSelected ? 'Selected' : 'Preview'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Selected Asset Preview & Confirmation Panel (Phase 7 steps 1-3) */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-[#1e2942] bg-[#0a0e1a] p-5 flex flex-col justify-between shrink-0">
            {selectedCandidate ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400 font-bold">
                    Selected {mediaFilter.toUpperCase()} Preview
                  </span>
                  <h4 className="text-xs font-bold text-white mt-0.5 break-words">
                    {selectedCandidate.name}
                  </h4>
                </div>

                {/* Live Asset Preview Box */}
                <div className="h-44 rounded-xl bg-[#121829] border border-[#1e2942] p-2 flex items-center justify-center overflow-hidden">
                  {candidatePreviewError ? (
                    <div className="text-center p-3 text-rose-300 text-[11px]">
                      <AlertTriangle className="w-5 h-5 text-rose-400 mx-auto mb-1" />
                      {candidatePreviewError}
                    </div>
                  ) : selectedCandidate.mediaCategory === 'video' ? (
                    <video
                      key={selectedCandidate.url}
                      src={selectedCandidate.url}
                      controls
                      playsInline
                      preload="metadata"
                      onError={() =>
                        setCandidatePreviewError('Video preview failed to load in browser.')
                      }
                      className="max-h-full max-w-full rounded"
                    />
                  ) : (
                    <img
                      src={selectedCandidate.url}
                      alt={selectedCandidate.name}
                      onError={() =>
                        setCandidatePreviewError('Image preview failed to load in browser.')
                      }
                      className="max-h-full max-w-full object-contain rounded"
                    />
                  )}
                </div>

                <div className="space-y-1.5 text-[11px] font-mono text-gray-400 bg-[#121829] p-3 rounded-xl border border-[#1e2942]">
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <span className="text-white uppercase">
                      {selectedCandidate.mediaCategory}{' '}
                      {selectedCandidate.fileExtension ? `(${selectedCandidate.fileExtension})` : ''}
                    </span>
                  </div>
                  {selectedCandidate.size && (
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span className="text-white">{formatBytes(selectedCandidate.size)}</span>
                    </div>
                  )}
                  <div className="pt-1 border-t border-[#1e2942] text-[10px] truncate" title={selectedCandidate.url}>
                    {selectedCandidate.url}
                  </div>
                </div>
              </div>
            ) : (
              <div className="my-auto text-center space-y-2 py-8 text-gray-400">
                <CheckCircle2 className="w-8 h-8 text-gray-600 mx-auto" />
                <div className="text-xs font-semibold text-gray-300">No Asset Selected</div>
                <p className="text-[11px] text-gray-500">
                  Click any {mediaFilter} in the grid to inspect its preview before applying it to your landing page.
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-[#1e2942] space-y-2">
              <button
                type="button"
                disabled={!selectedCandidate || !selectedCandidate.url}
                onClick={handleConfirmSelection}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#7c3aed] hover:from-[#1d4ed8] hover:to-[#6d28d9] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-950/50 transition-all"
              >
                <Check className="w-4 h-4" /> Confirm & Apply Asset
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 px-4 rounded-xl bg-[#121829] hover:bg-[#18223a] text-gray-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer Pagination */}
        <div className="px-6 py-3 border-t border-[#1e2942] bg-[#121829] flex items-center justify-between text-xs text-gray-400">
          <span>
            Showing {folders.length} folder(s), {compatibleFiles.length} compatible {mediaFilter}(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={offset === 0 || isLoading}
              onClick={() => setOffset(prev => Math.max(0, prev - MODAL_PAGE_LIMIT))}
              className="px-2.5 py-1 rounded-lg bg-[#0a0e1a] border border-[#1e2942] disabled:opacity-40 text-gray-200 flex items-center gap-1"
            >
              <ChevronLeft className="w-3 h-3" /> Prev
            </button>
            <span className="font-mono text-white">Page {currentPage}</span>
            <button
              type="button"
              disabled={!hasMore || isLoading}
              onClick={() => setOffset(prev => prev + MODAL_PAGE_LIMIT)}
              className="px-2.5 py-1 rounded-lg bg-[#0a0e1a] border border-[#1e2942] disabled:opacity-40 text-gray-200 flex items-center gap-1"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
