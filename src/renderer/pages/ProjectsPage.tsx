import React, { useState } from 'react';
import {
  FolderKanban,
  Plus,
  Copy,
  Trash2,
  FolderOpen,
  Download,
  Upload,
  Calendar,
  Layers,
  Search,
  Archive,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { Project } from '@shared/types';
import { generateProjectBackupJson, restoreProjectBackupJson } from '../lib/storage';
import pryvixLogomark from '../assets/brand/pryvix-logomark.png';

interface ProjectsPageProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (id: string) => void;
  onOpenNewModal: () => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onUpdateProjectMeta: (id: string, name: string, campaignName: string, description: string) => void;
  onRefreshProjects: () => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenNewModal,
  onDuplicateProject,
  onDeleteProject,
  onUpdateProjectMeta,
  onRefreshProjects,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCampaign, setEditCampaign] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const filteredProjects = projects.filter(
    p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.campaignName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const startEdit = (project: Project) => {
    setEditingId(project.id);
    setEditName(project.name);
    setEditCampaign(project.campaignName);
    setEditDesc(project.description);
  };

  const saveEdit = (id: string) => {
    if (!editName.trim()) return;
    onUpdateProjectMeta(id, editName.trim(), editCampaign.trim(), editDesc.trim());
    setEditingId(null);
  };

  const handleExportBackup = (projectId: string, projectName: string) => {
    try {
      const json = generateProjectBackupJson(projectId);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.toLowerCase().replace(/\s+/g, '-')}-backup.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Error exporting project backup.');
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const project = restoreProjectBackupJson(text);
        onRefreshProjects();
        onSelectProject(project.id);
      } catch (err) {
        alert('Failed to parse backup JSON file: ' + String(err));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">Project Workspace</h2>
            <p className="text-xs text-gray-400">
              Manage multi-campaign landing page projects independently
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-[#121829] border border-[#1e2942] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          {/* Import Backup */}
          <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-[#121829] hover:bg-[#18223a] border border-[#1e2942] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-colors">
            <Upload className="w-3.5 h-3.5 text-gray-400" /> Import Backup
            <input
              type="file"
              accept=".json,.zip"
              className="hidden"
              onChange={handleImportBackup}
            />
          </label>

          {/* Create Button */}
          <button
            onClick={onOpenNewModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#7c3aed] hover:from-[#1d4ed8] hover:to-[#6d28d9] text-white text-xs font-semibold shadow-md shadow-blue-950/40 flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Create Project
          </button>
        </div>
      </div>

      {/* Projects Grid or Empty State */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl bg-[#121829] border border-[#1e2942]">
          <div className="w-16 h-16 rounded-2xl bg-[#0e1426] border border-[#1e2942] p-3 flex items-center justify-center mb-4 shadow-lg">
            <img src={pryvixLogomark} alt="Pryvix" className="w-full h-full object-contain opacity-80" />
          </div>
          <h3 className="text-sm font-bold text-white mb-1">
            {searchTerm ? 'No Matching Campaigns Found' : 'No Projects Yet'}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mb-5">
            {searchTerm
              ? `No landing page projects match "${searchTerm}". Try another search query.`
              : 'Create or import your first GoHighLevel landing page project to get started.'}
          </p>
          <button
            onClick={onOpenNewModal}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#7c3aed] text-white text-xs font-semibold shadow-md flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Create New Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map(project => {
          const isActive = project.id === activeProject?.id;
          const isEditing = editingId === project.id;
          const isConfirmingDelete = deleteConfirmId === project.id;

          return (
            <div
              key={project.id}
              className={`rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                isActive
                  ? 'bg-[#18223a] border-[#2563eb]/60 shadow-xl shadow-blue-950/20'
                  : 'bg-[#121829] border-[#1e2942] hover:border-[#2a3c61]'
              }`}
            >
              {/* Card Header & Content */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase ${
                      isActive
                        ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                        : 'bg-gray-800 text-gray-300'
                    }`}
                  >
                    {isActive ? 'CURRENT PROJECT' : project.status.toUpperCase()}
                  </span>

                  <div className="flex items-center gap-1">
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(project)}
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1a2030] transition-colors"
                        title="Edit metadata"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => onDuplicateProject(project.id)}
                      className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1a2030] transition-colors"
                      title="Duplicate project"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleExportBackup(project.id, project.name)}
                      className="p-1 rounded text-gray-400 hover:text-white hover:bg-[#1a2030] transition-colors"
                      title="Export backup JSON"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-2 mb-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      placeholder="Project Name"
                      className="w-full bg-[#090a0f] border border-[#222b3f] rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                    <input
                      type="text"
                      value={editCampaign}
                      onChange={e => setEditCampaign(e.target.value)}
                      placeholder="Campaign Name"
                      className="w-full bg-[#090a0f] border border-[#222b3f] rounded-lg px-2.5 py-1 text-xs text-white"
                    />
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      placeholder="Description"
                      rows={2}
                      className="w-full bg-[#090a0f] border border-[#222b3f] rounded-lg px-2.5 py-1 text-[11px] text-gray-300"
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 rounded text-gray-400 hover:text-white bg-[#1a2030]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => saveEdit(project.id)}
                        className="p-1 rounded text-emerald-400 hover:text-white bg-emerald-950/40 border border-emerald-800"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide truncate" title={project.name}>
                      {project.name}
                    </h3>
                    <div className="text-xs text-gray-400 font-medium mt-0.5 truncate">
                      {project.campaignName}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-2 line-clamp-2">
                      {project.description || 'No description provided.'}
                    </p>
                  </div>
                )}

                {/* Stats row */}
                <div className="mt-4 pt-3 border-t border-[#1a2030] grid grid-cols-2 gap-2 text-[11px] text-gray-400 font-mono">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-violet-400" />
                    <span>{project.assetCount} Images</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-blue-400" />
                    <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="px-5 py-3 bg-[#0d1018] border-t border-[#1a2030] flex items-center justify-between">
                {isConfirmingDelete ? (
                  <div className="flex items-center gap-2 w-full justify-between">
                    <span className="text-[10px] text-red-400 font-bold">Delete project?</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-[10px] text-gray-300 bg-[#1f2638] rounded"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          onDeleteProject(project.id);
                          setDeleteConfirmId(null);
                        }}
                        className="px-2 py-1 text-[10px] text-white bg-red-600 rounded font-bold"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setDeleteConfirmId(project.id)}
                      className="text-gray-400 hover:text-red-400 transition-colors p-1"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => onSelectProject(project.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isActive
                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#121829] hover:bg-[#2563eb] text-gray-200 hover:text-white border border-[#1e2942]'
                      }`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      {isActive ? 'Opened' : 'Open Project'}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}
    </div>
  );
};
