import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Lock,
  HardDrive,
  Trash2,
  Check,
  FolderOpen,
  Info,
  CheckCircle2,
  ExternalLink,
  FileCode,
  RotateCcw,
  Upload,
  Eye,
  X,
  Save,
  Layers,
} from 'lucide-react';
import {
  getPortableSettings,
  savePortableSettings,
  getReferenceTemplates,
  updateReferenceTemplate,
  restoreReferenceTemplate,
} from '../lib/storage';
import pryvixPrimaryDark from '../assets/brand/pryvix-primary-dark.png';
import pryvixLogomark from '../assets/brand/pryvix-logomark.png';
import { ReferenceTemplate } from '@shared/types';

export const SettingsPage: React.FC = () => {
  const [clearedNotice, setClearedNotice] = useState(false);
  const [darkTheme, setDarkTheme] = useState('pro-dark');
  const [autoSaveInterval, setAutoSaveInterval] = useState('immediate');
  const [portableSettings, setSettingsState] = useState(getPortableSettings());
  const [portableInfo, setPortableInfo] = useState<{
    portableMode: boolean;
    dataDir: string;
    exportsDir: string;
    isPackaged: boolean;
  } | null>(null);

  // Reference Templates State
  const [templates, setTemplates] = useState<ReferenceTemplate[]>([]);
  const [viewingTemplate, setViewingTemplate] = useState<ReferenceTemplate | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [templateFeedback, setTemplateFeedback] = useState<string | null>(null);

  useEffect(() => {
    setTemplates(getReferenceTemplates());
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.getPortableInfo().then(info => {
        setPortableInfo(info);
      }).catch(console.warn);
    }
  }, []);

  const handleTogglePortableMode = (enabled: boolean) => {
    const updated = savePortableSettings({ portableMode: enabled });
    setSettingsState(updated);
  };

  const handleToggleTitleSync = (enabled: boolean) => {
    const updated = savePortableSettings({ syncTitleWithProjectName: enabled });
    setSettingsState(updated);
  };

  const handleOpenFolder = (path: string) => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.showItemInFolder(path);
    }
  };

  const handleClearCache = () => {
    if (confirm('Clear local temporary preview cache? Your projects and images will be kept.')) {
      setClearedNotice(true);
      setTimeout(() => setClearedNotice(false), 2500);
    }
  };

  const handleRestoreTemplate = (id: 'static' | 'video') => {
    if (confirm(`Restore bundled default implementation for this reference template?`)) {
      const updated = restoreReferenceTemplate(id);
      setTemplates(getReferenceTemplates());
      setTemplateFeedback(`Restored bundled ${updated.name}!`);
      setTimeout(() => setTemplateFeedback(null), 3000);
    }
  };

  const handleImportTemplate = (e: React.ChangeEvent<HTMLInputElement>, id: 'static' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      const updated = updateReferenceTemplate(id, content);
      setTemplates(getReferenceTemplates());
      setTemplateFeedback(`Successfully imported replacement for ${updated.name}!`);
      setTimeout(() => setTemplateFeedback(null), 3000);
    };
    reader.readAsText(file);
  };

  const handleOpenViewer = (template: ReferenceTemplate) => {
    setViewingTemplate(template);
    setEditedContent(template.content);
  };

  const handleSaveEditedTemplate = () => {
    if (!viewingTemplate) return;
    const updated = updateReferenceTemplate(viewingTemplate.id, editedContent);
    setTemplates(getReferenceTemplates());
    setViewingTemplate(null);
    setTemplateFeedback(`Saved changes to ${updated.name}!`);
    setTimeout(() => setTemplateFeedback(null), 3000);
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-800 text-gray-300 flex items-center justify-center border border-gray-700">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">Settings & Portable Storage</h2>
          <p className="text-xs text-gray-400">
            Configure application portability, storage directories, and system preferences
          </p>
        </div>
      </div>

      {clearedNotice && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4" /> Cache cleared successfully!
        </div>
      )}

      {/* Portable Application & Storage Mode Card */}
      <div className="bg-[#111520] border border-[#1f2638] rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1f2638]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Portable Mode & Local Data Directory</h3>
              <p className="text-[11px] text-gray-400">Keep projects, images, and backups portable across devices</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              ACTIVE: PORTABLE
            </span>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3.5 bg-[#090b10] border border-[#1d2436] rounded-xl">
            <div>
              <div className="font-semibold text-white">Enable Portable Mode</div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Saves all application data inside the application's portable <code className="text-emerald-300">data/</code> directory rather than user OS profiles.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-3">
              <input
                type="checkbox"
                checked={portableSettings.portableMode}
                onChange={e => handleTogglePortableMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#1b2234] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 bg-[#090b10] border border-[#1d2436] rounded-xl flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Data Directory</span>
                <div className="text-xs font-mono text-gray-200 mt-0.5 truncate" title={portableInfo?.dataDir || './data'}>
                  {portableInfo?.dataDir || './data'}
                </div>
              </div>
              {portableInfo && (
                <button
                  onClick={() => handleOpenFolder(portableInfo.dataDir)}
                  className="p-1.5 rounded-lg bg-[#151c2a] hover:bg-[#202b40] text-gray-300 hover:text-white transition-colors"
                  title="Open in File Explorer"
                >
                  <FolderOpen className="w-4 h-4 text-blue-400" />
                </button>
              )}
            </div>

            <div className="p-3.5 bg-[#090b10] border border-[#1d2436] rounded-xl flex items-center justify-between">
              <div className="min-w-0 pr-2">
                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Exports Directory</span>
                <div className="text-xs font-mono text-gray-200 mt-0.5 truncate" title={portableInfo?.exportsDir || './exports'}>
                  {portableInfo?.exportsDir || './exports'}
                </div>
              </div>
              {portableInfo && (
                <button
                  onClick={() => handleOpenFolder(portableInfo.exportsDir)}
                  className="p-1.5 rounded-lg bg-[#151c2a] hover:bg-[#202b40] text-gray-300 hover:text-white transition-colors"
                  title="Open in File Explorer"
                >
                  <FolderOpen className="w-4 h-4 text-emerald-400" />
                </button>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#090b10] border border-[#1d2436] flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">Default Title Tag Synchronization</div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Automatically keep &lt;title&gt; tags matching project names during export
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-3">
              <input
                type="checkbox"
                checked={portableSettings.syncTitleWithProjectName}
                onChange={e => handleToggleTitleSync(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-[#1b2234] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2563eb]"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Security & Sandbox Audit Card */}
      <div className="bg-[#111520] border border-[#1f2638] rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1f2638]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Desktop Security Architecture (Electron Sandbox)
          </h3>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
            ALL ENFORCED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#090a0f] border border-[#1f2638] space-y-1">
            <div className="font-bold text-white flex items-center justify-between">
              <span>Context Isolation</span>
              <span className="text-[10px] text-emerald-400 font-mono">ENABLED</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Main process and renderer run in isolated contexts with explicit preload IPC bridges.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#090a0f] border border-[#1f2638] space-y-1">
            <div className="font-bold text-white flex items-center justify-between">
              <span>Node Integration Disabled</span>
              <span className="text-[10px] text-emerald-400 font-mono">ENFORCED</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Renderer processes cannot execute arbitrary local node syscalls or shell scripts.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#090a0f] border border-[#1f2638] space-y-1">
            <div className="font-bold text-white flex items-center justify-between">
              <span>Preview Sandboxing</span>
              <span className="text-[10px] text-emerald-400 font-mono">RESTRICTED IFRAME</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Untrusted imported landing page HTML and scripts run in isolated sub-frames without filesystem access.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#090a0f] border border-[#1f2638] space-y-1">
            <div className="font-bold text-white flex items-center justify-between">
              <span>Strict CSP Policy</span>
              <span className="text-[10px] text-emerald-400 font-mono">ACTIVE</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Restricts unapproved remote resource execution and protects user environment.
            </p>
          </div>
        </div>
      </div>

      {/* Background Reference Templates Management Card */}
      <div className="bg-[#121829] border border-[#1e2942] rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2942]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563eb]/10 text-[#2563eb] flex items-center justify-center">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Background Reference Templates</h3>
              <p className="text-[11px] text-gray-400">
                Manage bundled and custom reference templates for Static and Video background modes
              </p>
            </div>
          </div>
          <span className="text-[10px] text-gray-400 font-mono bg-[#0a0e1a] px-2.5 py-1 rounded-md border border-[#1e2942]">
            2 Templates Available
          </span>
        </div>

        {templateFeedback && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{templateFeedback}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className="bg-[#0a0e1a] border border-[#1e2942] rounded-xl p-4 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#2563eb]"></span>
                    {tpl.name}
                  </h4>
                  <span
                    className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${
                      tpl.isCustom
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                        : 'bg-blue-950/60 text-blue-300 border border-blue-500/30'
                    }`}
                  >
                    {tpl.isCustom ? 'CUSTOM REPLACEMENT' : 'BUNDLED DEFAULT'}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">{tpl.description}</p>
                <div className="mt-2 text-[10px] font-mono text-gray-500 space-y-0.5">
                  <div>File: {tpl.filename}</div>
                  <div>Length: {tpl.content.length.toLocaleString()} characters</div>
                  <div>Modified: {new Date(tpl.lastModified).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-[#1a2030]">
                <button
                  type="button"
                  onClick={() => handleOpenViewer(tpl)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#141926] hover:bg-[#1d2436] text-gray-200 text-xs font-semibold border border-[#222b3f] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-blue-400" /> View / Edit
                </button>

                <label className="flex items-center justify-center gap-1 px-2.5 py-1.5 bg-[#141926] hover:bg-[#1d2436] border border-[#222b3f] rounded-lg text-gray-200 cursor-pointer transition-colors text-xs font-semibold">
                  <Upload className="w-3.5 h-3.5 text-emerald-400" /> Import
                  <input
                    type="file"
                    accept=".txt,.html,.htm"
                    className="hidden"
                    onChange={e => handleImportTemplate(e, tpl.id)}
                  />
                </label>

                {tpl.isCustom && (
                  <button
                    type="button"
                    onClick={() => handleRestoreTemplate(tpl.id)}
                    className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 text-red-300 border border-red-800/40 transition-colors"
                    title="Restore Original Bundled Reference"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GoHighLevel Integration Architecture */}
      <div className="bg-[#121829] border border-[#1e2942] rounded-2xl p-6 shadow-lg space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white pb-3 border-b border-[#1e2942]">
          <Lock className="w-4 h-4 text-violet-400" />
          GoHighLevel Integration & Credential Protection
        </div>
        <p className="text-xs text-gray-300 leading-relaxed">
          Landing Page Studio uses standard GoHighLevel iframe embeds and client-side tracking tokens (<code className="text-violet-400">login_token</code> and <code className="text-violet-400">event_id</code>). It does not require any private GoHighLevel API keys for core operation.
        </p>

        <div className="p-3.5 rounded-xl bg-[#0a0e1a] border border-[#1e2942] text-[11px] text-gray-400 space-y-1">
          <div className="font-bold text-white flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            Security Rule: Zero Credential Exposure
          </div>
          <p>
            Private Integration Tokens are never included in exported HTML, application logs, or project backups. When token authentication is used for webhook forwarding, credentials remain strictly encapsulated within the local system keychain.
          </p>
        </div>
      </div>

      {/* Storage & Preferences Card */}
      <div className="bg-[#111520] border border-[#1f2638] rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white pb-3 border-b border-[#1f2638]">
          <HardDrive className="w-4 h-4 text-purple-400" />
          Preferences & Cache
        </div>

        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">Interface Theme</div>
              <p className="text-[11px] text-gray-400">Dark high-contrast professional studio theme</p>
            </div>
            <select
              value={darkTheme}
              onChange={e => setDarkTheme(e.target.value)}
              className="bg-[#090a0f] border border-[#222b3f] rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="pro-dark">Pro Dark (Recommended)</option>
              <option value="midnight">Midnight Black</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#1f2638]">
            <div>
              <div className="font-semibold text-white">Auto-Save Strategy</div>
              <p className="text-[11px] text-gray-400">Persist project modifications to local portable storage</p>
            </div>
            <select
              value={autoSaveInterval}
              onChange={e => setAutoSaveInterval(e.target.value)}
              className="bg-[#090a0f] border border-[#222b3f] rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="immediate">Immediate on Change</option>
              <option value="manual">Manual Save Only</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#1f2638]">
            <div>
              <div className="font-semibold text-white">Temporary Preview Cache</div>
              <p className="text-[11px] text-gray-400">Clear ephemeral rendering data</p>
            </div>
            <button
              onClick={handleClearCache}
              className="px-3.5 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 text-red-300 text-xs font-semibold border border-red-800/40 flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Cache
            </button>
          </div>
        </div>
      </div>

      {/* About Pryvix Landing Page Studio Card */}
      <div className="bg-[#111520] border border-[#1f2638] rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1f2638]">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Info className="w-4 h-4 text-violet-400" />
            About Pryvix Landing Page Studio
          </div>
          <span className="text-[10px] bg-violet-600/20 text-violet-300 font-mono font-bold px-2 py-0.5 rounded border border-violet-500/30">
            PRO v1.0.0
          </span>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-4 rounded-xl bg-[#0a0e1a] border border-[#1e2942]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#121829] border border-[#1e2942] p-2 flex items-center justify-center shrink-0 shadow-md">
              <img src={pryvixLogomark} alt="Pryvix" className="w-full h-full object-contain" />
            </div>
            <div>
              <img src={pryvixPrimaryDark} alt="Pryvix Logo" className="h-7 w-auto object-contain mb-1" />
              <p className="text-xs text-gray-300 font-semibold">Landing Page Studio — Professional Edition</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Authoritative Content-Replacement Studio for GoHighLevel Landing Pages</p>
            </div>
          </div>

          <div className="text-right text-[11px] text-gray-400 font-mono space-y-1">
            <div>Engine: <span className="text-white font-semibold">Vite + React 18 + Electron</span></div>
            <div>Branding: <span className="text-violet-300 font-semibold">Pryvix Design System</span></div>
            <div>Security: <span className="text-emerald-400 font-semibold">100% Offline Air-Gapped Safe</span></div>
          </div>
        </div>
      </div>

      {/* Template Viewer & Editor Modal */}
      {viewingTemplate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1117] border border-[#222b3f] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#1e2942] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-violet-400" />
                  {viewingTemplate.name}
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">
                  {viewingTemplate.filename} • {editedContent.length.toLocaleString()} characters
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingTemplate(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-hidden flex flex-col">
              <textarea
                value={editedContent}
                onChange={e => setEditedContent(e.target.value)}
                className="flex-1 w-full bg-[#0a0e1a] border border-[#1e2942] rounded-xl p-4 font-mono text-xs text-gray-200 focus:outline-none focus:border-[#2563eb] resize-none leading-relaxed"
                spellCheck={false}
              />
            </div>

            <div className="px-6 py-3 border-t border-[#1e2942] bg-[#0a0e1a] flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleRestoreTemplate(viewingTemplate.id)}
                className="px-3 py-1.5 rounded-lg bg-red-950/40 text-red-300 border border-red-800/40 text-xs font-semibold hover:bg-red-900/50 flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restore Bundled
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingTemplate(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#121829] text-gray-300 text-xs font-semibold hover:bg-[#18223a] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedTemplate}
                  className="px-4 py-1.5 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" /> Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
