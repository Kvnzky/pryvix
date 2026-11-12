import React, { useState } from 'react';
import {
  Layers,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Plus,
  Trash2,
  CheckCircle2,
  Info,
  ChevronDown,
  Layout,
  ExternalLink,
  HelpCircle,
  FileText,
  Sparkles,
} from 'lucide-react';
import { ComponentSection, SupportedSectionType } from '@shared/types';
import { SUPPORTED_SECTIONS_REGISTRY } from '@shared/parser';

interface SectionManagerPanelProps {
  sections: ComponentSection[];
  onToggleVisibility: (sectionId: string, visible: boolean) => void;
  onOpenReadMoreConfig: () => void;
  onAddSection: (sectionType: SupportedSectionType) => void;
  onRemoveSection: (sectionId: string) => void;
}

export const SectionManagerPanel: React.FC<SectionManagerPanelProps> = ({
  sections,
  onToggleVisibility,
  onOpenReadMoreConfig,
  onAddSection,
  onRemoveSection,
}) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Available addable sections not currently in the project
  const addableRegistry = SUPPORTED_SECTIONS_REGISTRY.filter(def => def.isAddable);
  const availableToAdd = addableRegistry.filter(
    def => !sections.some(s => s.id === def.id)
  );

  const getSectionIcon = (type: SupportedSectionType) => {
    switch (type) {
      case 'read_more_button':
        return <SlidersHorizontal className="w-4 h-4 text-violet-400" />;
      case 'popup':
        return <Layout className="w-4 h-4 text-blue-400" />;
      case 'hero':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'mobile_form':
        return <Layout className="w-4 h-4 text-emerald-400" />;
      case 'prize':
        return <Sparkles className="w-4 h-4 text-pink-400" />;
      case 'campaign_details':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      default:
        return <Layers className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="bg-[#121829] border border-[#1e2942] rounded-2xl p-5 shadow-lg space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1e2942]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2563eb]/20 to-[#7c3aed]/20 border border-[#2563eb]/40 text-blue-400 flex items-center justify-center">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Section Manager
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-600/20 text-blue-300 border border-blue-500/30">
                {sections.filter(s => s.visible).length} / {sections.length} Visible
              </span>
            </h3>
            <p className="text-[11px] text-gray-400">
              Manage supported landing page sections, control visibility, and configure responsive elements
            </p>
          </div>
        </div>

        {/* Add Section Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsAddMenuOpen(prev => !prev)}
            disabled={availableToAdd.length === 0}
            className="px-3.5 py-1.5 rounded-xl bg-[#1e2942] hover:bg-[#2563eb] disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Section</span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {isAddMenuOpen && availableToAdd.length > 0 && (
            <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl bg-[#0e1426] border border-[#1e2942] shadow-2xl p-1.5 z-30 space-y-1 animate-fade-in">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2.5 py-1">
                Supported Predefined Sections
              </div>
              {availableToAdd.map(def => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => {
                    onAddSection(def.type);
                    setIsAddMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[#18223a] text-xs text-gray-200 hover:text-white flex items-start gap-2 transition-colors"
                >
                  <div className="mt-0.5">{getSectionIcon(def.type)}</div>
                  <div>
                    <div className="font-semibold text-white">{def.name}</div>
                    <div className="text-[10px] text-gray-400 leading-tight">{def.description}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-2.5">
        {sections.map(section => {
          const isConfigurable = section.type === 'read_more_button';
          const regDef = SUPPORTED_SECTIONS_REGISTRY.find(d => d.id === section.id);
          const isDeletable = regDef?.isDeletable || section.isDeletable;

          return (
            <div
              key={section.id}
              className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                section.visible
                  ? 'bg-[#0a0e1a] border-[#1e2942] hover:border-[#2563eb]/50'
                  : 'bg-[#070a12] border-gray-800/80 opacity-75'
              }`}
            >
              {/* Left: Icon & Title */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    section.visible
                      ? 'bg-[#121829] border-[#1e2942]'
                      : 'bg-gray-900 border-gray-800 text-gray-500'
                  }`}
                >
                  {getSectionIcon(section.type)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold truncate ${
                        section.visible ? 'text-white' : 'text-gray-400 line-through'
                      }`}
                    >
                      {section.name}
                    </span>

                    {/* Status Badge */}
                    {section.visible ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.2 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-500/30 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        VISIBLE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.2 rounded-full bg-gray-800 text-gray-400 border border-gray-700 shrink-0">
                        HIDDEN
                      </span>
                    )}

                    {isConfigurable && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-violet-950/70 text-violet-300 border border-violet-500/30">
                        Desktop &amp; Mobile
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {regDef?.description || 'Landing page structural section'}
                  </p>
                </div>
              </div>

              {/* Right Action Controls */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Edit / Configure Button where applicable */}
                {isConfigurable && (
                  <button
                    type="button"
                    onClick={onOpenReadMoreConfig}
                    className="px-2.5 py-1.5 rounded-lg bg-[#18223a] hover:bg-[#2563eb] text-blue-300 hover:text-white text-[11px] font-semibold flex items-center gap-1 border border-[#2563eb]/40 transition-colors"
                    title="Configure Desktop & Mobile Read More Button"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Edit Button</span>
                  </button>
                )}

                {/* Show/Hide Toggle Button */}
                <button
                  type="button"
                  onClick={() => onToggleVisibility(section.id, !section.visible)}
                  className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
                    section.visible
                      ? 'bg-[#121829] hover:bg-rose-950/50 border-[#1e2942] hover:border-rose-500/50 text-gray-300 hover:text-rose-300'
                      : 'bg-emerald-950/60 hover:bg-emerald-900/60 border-emerald-500/40 text-emerald-300'
                  }`}
                  title={section.visible ? 'Hide section from page' : 'Show section on page'}
                >
                  {section.visible ? (
                    <>
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[11px] font-mono px-1">Hide</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[11px] font-mono px-1">Show</span>
                    </>
                  )}
                </button>

                {/* Remove button for custom added sections */}
                {isDeletable && (
                  <button
                    type="button"
                    onClick={() => onRemoveSection(section.id)}
                    className="p-1.5 rounded-lg bg-[#121829] hover:bg-rose-950 border border-[#1e2942] hover:border-rose-500/40 text-gray-400 hover:text-rose-300 transition-colors"
                    title="Delete section"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
