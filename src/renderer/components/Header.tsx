import React, { useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  RotateCw,
  Download,
  Plus,
  FolderOpen,
  Edit2,
  Check,
  X,
  FileCode,
  FileText,
  FileArchive,
  ExternalLink,
  ChevronDown,
  HardDrive,
} from 'lucide-react';
import pryvixLogomark from '../assets/brand/pryvix-logomark.png';
import { Project } from '@shared/types';
import { NavTab } from './Sidebar';

interface HeaderProps {
  currentTab: NavTab;
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (id: string) => void;
  onRenameProject?: (newName: string) => void;
  onOpenNewModal: () => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExportTab: () => void;
  onQuickExport?: (type: 'html' | 'txt' | 'notepad' | 'zip') => void;
  isSaving?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  projects,
  activeProject,
  onSelectProject,
  onRenameProject,
  onOpenNewModal,
  onSave,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExportTab,
  onQuickExport,
  isSaving,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(activeProject?.name || '');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [showPortableTooltip, setShowPortableTooltip] = useState(false);

  useEffect(() => {
    if (activeProject) {
      setNameValue(activeProject.name);
    }
  }, [activeProject?.name]);

  const handleSaveName = () => {
    if (nameValue.trim() && nameValue.trim() !== activeProject?.name) {
      onRenameProject?.(nameValue.trim());
    }
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setNameValue(activeProject?.name || '');
      setIsEditingName(false);
    }
  };

  const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Overview of landing page projects, assets, and quick stats' },
    projects: { title: 'Project Management', subtitle: 'Manage campaigns, duplicate, backup, and organize projects' },
    library: { title: 'Image Library', subtitle: 'Reusable local media gallery and CDN asset manager' },
    editor: { title: 'Landing Page Editor', subtitle: 'Visual asset cards & live responsive preview' },
    forms: { title: 'GoHighLevel Form Manager', subtitle: 'Manage GHL iframe embeds, tokens, and responsive form instances' },
    code: { title: 'Direct Code Editor', subtitle: 'Monaco source editor with source-preserving synchronization' },
    export: { title: 'Export & Validation', subtitle: 'Code compliance scanner, Notepad sync, and production export' },
    settings: { title: 'Settings', subtitle: 'Portable storage configuration, title sync, and application preferences' },
  };

  const currentInfo = tabTitles[currentTab] || { title: 'Studio', subtitle: '' };

  return (
    <header className="h-16 bg-[#0e1426]/90 backdrop-blur-md border-b border-[#1e2942] px-6 flex items-center justify-between z-20 relative">
      {/* Left: Tab Title & Active Project Name */}
      <div className="flex items-center space-x-4 min-w-0">
        <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center p-1 border border-[#1e2942] bg-[#121829] shadow-sm shrink-0" title="Pryvix Studio">
          <img src={pryvixLogomark} alt="Pryvix Logomark" className="w-full h-full object-contain" />
        </div>

        <div className="min-w-0">
          <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
            {currentInfo.title}
          </h2>
          <p className="text-[11px] text-gray-400 truncate max-w-xs">
            {currentInfo.subtitle}
          </p>
        </div>

        {/* Dedicated Editable Project Name Field */}
        {activeProject && (
          <div className="flex items-center bg-[#121829]/90 border border-[#1e2942] hover:border-[#2a3c61] rounded-lg px-3 py-1.5 transition-all">
            <span className="text-[10px] uppercase font-bold text-violet-400 tracking-wider mr-2 select-none">
              Project:
            </span>

            {isEditingName ? (
              <div className="flex items-center space-x-1.5">
                <input
                  type="text"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveName}
                  autoFocus
                  className="bg-[#0a0e1a] text-xs text-white px-2 py-0.5 rounded border border-blue-500/60 focus:outline-none focus:ring-1 focus:ring-blue-500 w-52 font-semibold"
                />
                <button
                  onClick={handleSaveName}
                  className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                  title="Save Name (Enter)"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setNameValue(activeProject.name);
                    setIsEditingName(false);
                  }}
                  className="p-1 text-gray-400 hover:text-white rounded transition-colors"
                  title="Cancel (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => setIsEditingName(true)}
                className="flex items-center cursor-pointer group space-x-2"
                title="Click to rename project"
              >
                <span className="text-xs font-semibold text-white group-hover:text-blue-300 transition-colors truncate max-w-[200px]">
                  {activeProject.name}
                </span>
                <Edit2 className="w-3 h-3 text-gray-500 group-hover:text-blue-400 transition-colors" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center/Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Portable Storage Mode Indicator Pill */}
        <div
          className="relative"
          onMouseEnter={() => setShowPortableTooltip(true)}
          onMouseLeave={() => setShowPortableTooltip(false)}
        >
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#131b2c] border border-emerald-500/30 text-[11px] font-medium text-emerald-400 cursor-default">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <HardDrive className="w-3 h-3 text-emerald-400 ml-0.5" />
            <span>Portable Mode</span>
          </div>

          {showPortableTooltip && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-[#111624] border border-[#2b354e] rounded-lg p-3 text-[11px] text-gray-300 shadow-xl z-50 pointer-events-none">
              <p className="font-semibold text-white mb-1 flex items-center">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5"></span>
                Storage: Portable Local Data
              </p>
              <p className="text-gray-400 leading-relaxed">
                All projects, backups, image library, and exports are saved relative to the application directory (<code className="text-emerald-300">./data</code>). Safe to transfer to any computer!
              </p>
            </div>
          )}
        </div>

        {/* Project Selector */}
        {projects.length > 0 && (
          <div className="relative flex items-center bg-[#131722] border border-[#222b3f] rounded-lg px-2.5 py-1.5 text-xs text-gray-300">
            <FolderOpen className="w-3.5 h-3.5 text-gray-400 mr-2" />
            <select
              value={activeProject?.id || ''}
              onChange={e => onSelectProject(e.target.value)}
              className="bg-transparent border-none text-white focus:outline-none cursor-pointer pr-4 font-medium"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id} className="bg-[#131722] text-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Undo / Redo */}
        <div className="flex items-center bg-[#131722] border border-[#222b3f] rounded-lg overflow-hidden">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors border-r border-[#222b3f]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Save Button */}
        <button
          onClick={onSave}
          disabled={!activeProject || isSaving}
          className="flex items-center px-3 py-1.5 rounded-lg bg-[#182032] hover:bg-[#202b44] border border-[#263554] text-gray-200 text-xs font-medium transition-all shadow-sm active:scale-95"
        >
          <Save className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
          {isSaving ? 'Saving...' : 'Save'}
        </button>

        {/* Export Dropdown Menu */}
        <div className="relative">
          <div className="inline-flex rounded-lg shadow-md shadow-blue-950/40">
            <button
              onClick={onExportTab}
              disabled={!activeProject}
              className="flex items-center px-3 py-1.5 rounded-l-lg bg-gradient-to-r from-[#2563eb] to-[#7c3aed] hover:from-[#1d4ed8] hover:to-[#6d28d9] text-white text-xs font-semibold transition-all active:scale-95 border-r border-blue-700/60"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export
            </button>
            <button
              onClick={() => setIsExportMenuOpen(prev => !prev)}
              disabled={!activeProject}
              className="px-1.5 py-1.5 rounded-r-lg bg-[#1d4ed8] hover:bg-[#2563eb] text-white transition-colors"
              title="More export options"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {isExportMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setIsExportMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-[#121829] border border-[#1e2942] rounded-xl shadow-2xl py-1.5 z-40 text-xs">
                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onExportTab();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#18223a] flex items-center text-gray-200 hover:text-white"
                >
                  <FileCode className="w-4 h-4 mr-2.5 text-blue-400" />
                  <div>
                    <div className="font-semibold">Export Complete HTML</div>
                    <div className="text-[10px] text-gray-400">Save as production .html</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onQuickExport?.('txt');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#1c2336] flex items-center text-gray-200 hover:text-white"
                >
                  <FileText className="w-4 h-4 mr-2.5 text-blue-400" />
                  <div>
                    <div className="font-semibold">Export as TXT</div>
                    <div className="text-[10px] text-gray-400">Source code text file</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onQuickExport?.('notepad');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#1c2336] flex items-center text-gray-200 hover:text-white"
                >
                  <ExternalLink className="w-4 h-4 mr-2.5 text-amber-400" />
                  <div>
                    <div className="font-semibold">Open in Notepad</div>
                    <div className="text-[10px] text-gray-400">Edit and re-import sync</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setIsExportMenuOpen(false);
                    onQuickExport?.('zip');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-[#1c2336] flex items-center text-gray-200 hover:text-white border-t border-[#1e273b] mt-1 pt-1.5"
                >
                  <FileArchive className="w-4 h-4 mr-2.5 text-emerald-400" />
                  <div>
                    <div className="font-semibold">Export Project ZIP</div>
                    <div className="text-[10px] text-gray-400">Portable package backup</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* New Project Button */}
        <button
          onClick={onOpenNewModal}
          className="flex items-center px-3 py-1.5 rounded-lg bg-[#131722] hover:bg-[#1c2333] border border-[#26324b] text-gray-200 text-xs font-medium transition-all"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          New
        </button>
      </div>
    </header>
  );
};
