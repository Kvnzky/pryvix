import React, { useState } from 'react';
import {
  FolderKanban,
  Image as ImageIcon,
  FormInput,
  Plus,
  Upload,
  ArrowRight,
  Sparkles,
  Layers,
  Clock,
  ShieldCheck,
  Code2,
  Edit2,
  Check,
  X,
  HardDrive,
} from 'lucide-react';
import { Project, ImageAsset, GHLForm } from '@shared/types';
import { NavTab } from '../components/Sidebar';
import pryvixPrimarySvg from '../assets/brand/pryvix-primary-logo.svg';
import pryvixLogomark from '../assets/brand/pryvix-logomark.png';

interface DashboardProps {
  projects: Project[];
  activeProject: Project | null;
  assets: ImageAsset[];
  forms: GHLForm[];
  libraryCount: number;
  onSelectProject: (id: string) => void;
  onRenameProject?: (newName: string) => void;
  onOpenNewModal: () => void;
  onNavigateTab: (tab: NavTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  projects,
  activeProject,
  assets,
  forms,
  libraryCount,
  onSelectProject,
  onRenameProject,
  onOpenNewModal,
  onNavigateTab,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(activeProject?.name || '');

  React.useEffect(() => {
    if (activeProject) {
      setEditedName(activeProject.name);
    }
  }, [activeProject?.name]);

  const handleSaveRename = () => {
    if (editedName.trim() && editedName.trim() !== activeProject?.name) {
      onRenameProject?.(editedName.trim());
    }
    setIsEditingName(false);
  };

  const recentProjects = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 4);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0e1426] via-[#121829] to-[#141226] border border-[#1e2942] p-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-600/10 border border-violet-500/30 text-violet-300 text-xs font-semibold mb-3">
            <img src={pryvixLogomark} alt="Pryvix" className="w-3.5 h-3.5 object-contain" />
            <span>Pryvix Landing Page Studio • Pro Edition</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight sm:text-3xl">
            Streamlined Asset & GoHighLevel Form Studio
          </h1>
          <p className="mt-2 text-xs text-gray-300 leading-relaxed">
            Eliminate manual code searching. Automatically scan landing page HTML, configure responsive desktop and mobile graphics, manage GoHighLevel iframe forms, and export production-ready code with complete functional fidelity.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={onOpenNewModal}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#7c3aed] hover:from-[#1d4ed8] hover:to-[#6d28d9] text-white text-xs font-bold tracking-wide shadow-lg shadow-blue-950/50 flex items-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Create New Project
            </button>
            <button
              onClick={onOpenNewModal}
              className="px-5 py-2.5 rounded-xl bg-[#121829] hover:bg-[#18223a] border border-[#1e2942] text-gray-200 text-xs font-semibold flex items-center gap-2 transition-all"
            >
              <Upload className="w-4 h-4 text-gray-400" /> Import Existing Landing Page
            </button>
          </div>
        </div>

        {/* Brand Display in Hero Banner */}
        <div className="relative z-10 hidden lg:flex flex-col items-center justify-center p-6 rounded-2xl bg-[#0a0e1a]/60 border border-[#1e2942] backdrop-blur-sm shadow-xl shrink-0">
          <img
            src={pryvixPrimarySvg}
            alt="Pryvix Official Brand Logo"
            className="h-10 w-auto max-w-[190px] object-contain drop-shadow"
          />
          <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span>Production Engine v1.0.0</span>
          </div>
        </div>

        {/* Ambient background decoration */}
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-violet-600/10 to-transparent pointer-events-none" />
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111520] border border-[#1f2638] rounded-xl p-5 hover:border-[#2f3b55] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Total Projects</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white">{projects.length}</div>
          <div className="mt-1 text-[11px] text-gray-400">Active campaigns in studio</div>
        </div>

        <div className="bg-[#111520] border border-[#1f2638] rounded-xl p-5 hover:border-[#2f3b55] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Detected Image Assets</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white">{assets.length}</div>
          <div className="mt-1 text-[11px] text-gray-400">
            {activeProject ? `In "${activeProject.name}"` : 'Select a project'}
          </div>
        </div>

        <div className="bg-[#111520] border border-[#1f2638] rounded-xl p-5 hover:border-[#2f3b55] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">GoHighLevel Forms</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <FormInput className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white">{forms.length}</div>
          <div className="mt-1 text-[11px] text-gray-400">
            {forms.some(f => f.deviceTarget === 'mobile') ? 'Desktop & Mobile configured' : 'Active embeds'}
          </div>
        </div>

        <div className="bg-[#111520] border border-[#1f2638] rounded-xl p-5 hover:border-[#2f3b55] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-400">Image Library Assets</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-white">{libraryCount}</div>
          <div className="mt-1 text-[11px] text-gray-400">Reusable banners & graphics</div>
        </div>
      </div>

      {/* Quick Launch & Active Project Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Project Card */}
        <div className="lg:col-span-2 bg-[#111520] border border-[#1f2638] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">Current Active Project</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
                ACTIVE
              </span>
            </div>
            {activeProject && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-gray-400" />
                Updated {new Date(activeProject.updatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {activeProject ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#090a0f] border border-[#1c2333]">
                <div className="flex items-start justify-between">
                  <div className="flex-1 mr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Project Name:</span>
                      {isEditingName ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editedName}
                            onChange={e => setEditedName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveRename();
                              if (e.key === 'Escape') {
                                setEditedName(activeProject.name);
                                setIsEditingName(false);
                              }
                            }}
                            autoFocus
                            className="bg-[#121622] text-sm text-white px-2 py-0.5 rounded border border-[#2563eb] font-bold focus:outline-none"
                          />
                          <button
                            onClick={handleSaveRename}
                            className="p-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditedName(activeProject.name);
                              setIsEditingName(false);
                            }}
                            className="p-1 rounded bg-gray-800 text-gray-400 hover:text-white"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => setIsEditingName(true)}
                          className="flex items-center gap-2 cursor-pointer group"
                          title="Click to edit project name"
                        >
                          <h4 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                            {activeProject.name}
                          </h4>
                          <Edit2 className="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-400 transition-colors" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{activeProject.campaignName}</p>
                    <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                      {activeProject.description || 'No custom description provided.'}
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigateTab('editor')}
                    className="px-3.5 py-1.5 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1 shadow-md transition-all whitespace-nowrap"
                  >
                    Open Editor <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#1e2942] text-center">
                  <div>
                    <div className="text-sm font-bold text-white">{assets.length}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">Images</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{forms.length}</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">GHL Forms</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-emerald-400 font-mono">100%</div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">Integrity</div>
                  </div>
                </div>
              </div>

              {/* Fast module jump pills */}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => onNavigateTab('editor')}
                  className="p-3 rounded-xl bg-[#0e1426] hover:bg-[#151d33] border border-[#1e2942] text-left transition-colors group"
                >
                  <div className="text-xs font-semibold text-white group-hover:text-blue-400 flex items-center justify-between">
                    <span>Visual Assets</span>
                    <ImageIcon className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Replace hero, popups & banners</p>
                </button>

                <button
                  onClick={() => onNavigateTab('forms')}
                  className="p-3 rounded-xl bg-[#0e1426] hover:bg-[#151d33] border border-[#1e2942] text-left transition-colors group"
                >
                  <div className="text-xs font-semibold text-white group-hover:text-blue-400 flex items-center justify-between">
                    <span>Form Settings</span>
                    <FormInput className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">GHL IDs, tokens & embeds</p>
                </button>

                <button
                  onClick={() => onNavigateTab('code')}
                  className="p-3 rounded-xl bg-[#0e1426] hover:bg-[#151d33] border border-[#1e2942] text-left transition-colors group"
                >
                  <div className="text-xs font-semibold text-white group-hover:text-blue-400 flex items-center justify-between">
                    <span>Code Editor</span>
                    <Code2 className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Direct HTML / CSS / JS</p>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 text-xs">
              No active project selected.
            </div>
          )}
        </div>

        {/* Recently Modified Projects List */}
        <div className="bg-[#121829] border border-[#1e2942] rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white tracking-wide">Recent Projects</h3>
              <button
                onClick={() => onNavigateTab('projects')}
                className="text-[11px] text-[#2563eb] hover:underline"
              >
                View all ({projects.length})
              </button>
            </div>

            <div className="space-y-2.5">
              {recentProjects.map(proj => (
                <div
                  key={proj.id}
                  onClick={() => onSelectProject(proj.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    proj.id === activeProject?.id
                      ? 'bg-[#18223a] border-[#2563eb]/50 shadow-sm'
                      : 'bg-[#0e1426] border-[#1e2942] hover:border-gray-500'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="text-xs font-semibold text-white truncate">{proj.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 truncate">{proj.campaignName}</div>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap">
                    {proj.assetCount} assets
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#1f2638] flex items-center justify-between text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Local Offline Storage
            </span>
            <span>Version 1.0.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};
