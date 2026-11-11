import React from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  Image as ImageIcon,
  LayoutTemplate,
  FormInput,
  Code2,
  FileCheck2,
  Settings,
  Sparkles,
} from 'lucide-react';
import pryvixPrimarySvg from '../assets/brand/pryvix-primary-logo.svg';
import { Project } from '@shared/types';

export type NavTab =
  | 'dashboard'
  | 'projects'
  | 'library'
  | 'editor'
  | 'forms'
  | 'code'
  | 'export'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeProject: Project | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  activeProject,
}) => {
  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects' as NavTab, label: 'My Projects', icon: FolderKanban },
    { id: 'library' as NavTab, label: 'Image Library', icon: ImageIcon },
    { id: 'editor' as NavTab, label: 'Landing Page Editor', icon: LayoutTemplate },
    { id: 'forms' as NavTab, label: 'Form Manager', icon: FormInput },
    { id: 'code' as NavTab, label: 'Code Editor', icon: Code2 },
    { id: 'export' as NavTab, label: 'Export & Validation', icon: FileCheck2 },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0e1426] border-r border-[#1e2942] flex flex-col h-screen select-none z-20">
      {/* Brand Header */}
      <div className="p-5 border-b border-[#1e2942] flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <img
              src={pryvixPrimarySvg}
              alt="Pryvix"
              className="h-7 w-auto object-contain"
            />
            <span className="text-[9px] bg-violet-600/20 text-violet-300 font-mono font-bold px-1.5 py-0.5 rounded border border-violet-500/30">
              PRO
            </span>
          </div>
          <p className="text-[10px] text-gray-400 font-medium tracking-wide">Landing Page Studio</p>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
          Main Navigation
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600/20 via-violet-600/10 to-transparent text-white border-l-2 border-[#2563eb] pl-3'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#131b2e]'
              }`}
            >
              <Icon
                className={`w-4 h-4 mr-3 transition-colors ${
                  isActive ? 'text-[#2563eb]' : 'text-gray-400'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Active Project Footer Card */}
      <div className="p-3 m-3 rounded-xl bg-[#121829] border border-[#1e2942]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase font-semibold text-gray-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#7c3aed]" /> Active Project
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        {activeProject ? (
          <div>
            <div className="text-xs font-semibold text-white truncate" title={activeProject.name}>
              {activeProject.name}
            </div>
            <div className="text-[11px] text-gray-400 truncate mt-0.5">
              {activeProject.campaignName}
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#1e2942] text-[10px] text-gray-400 font-mono">
              <span>{activeProject.assetCount} Images</span>
              <span>•</span>
              <span>{activeProject.formCount} GHL Forms</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">No project loaded</div>
        )}
      </div>
    </aside>
  );
};
