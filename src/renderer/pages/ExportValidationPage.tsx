import React, { useState, useMemo, useEffect } from 'react';
import {
  FileCheck2,
  Download,
  Copy,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ShieldCheck,
  FileCode2,
  Archive,
  History,
  FileSpreadsheet,
  Check,
  Code2,
  FileText,
  ExternalLink,
  Globe,
  FolderOpen,
  RefreshCw,
  GitCompare,
  X,
  AlertCircle,
  FileArchive,
  Shield,
  Lock,
  ShieldAlert,
} from 'lucide-react';
import { Project, ImageAsset, GHLForm, ChangeHistoryEntry, ExportFileInfo, SourceComparisonReport } from '@shared/types';
import { validateLandingPage, compareAndValidateSourcePreservation } from '@shared/validator';
import {
  generateProjectBackupJson,
  exportProjectAsZip,
  detectMissingAssets,
  getPortableSettings,
  savePortableSettings,
} from '../lib/storage';
import {
  sanitizeProjectNameForFilename,
  injectProjectHeaderComment,
  syncTitleTagWithProjectName,
} from '@shared/parser';
import {
  BUNDLED_STATIC_REFERENCE_HTML,
  BUNDLED_VIDEO_REFERENCE_HTML,
  DEFAULT_VIDEO_DESKTOP_URL,
  DEFAULT_VIDEO_MOBILE_URL,
} from '@shared/referenceTemplates';
import pryvixLogomark from '../assets/brand/pryvix-logomark.png';

interface ExportValidationPageProps {
  project: Project;
  assets: ImageAsset[];
  forms: GHLForm[];
  history: ChangeHistoryEntry[];
  onJumpToCode?: (lineNumber?: number) => void;
  onUpdateHtml?: (newHtml: string, description: string) => void;
  onNavigateTab?: (tab: any) => void;
}

export const ExportValidationPage: React.FC<ExportValidationPageProps> = ({
  project,
  assets,
  forms,
  history,
  onJumpToCode,
  onUpdateHtml,
  onNavigateTab,
}) => {
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [strictSourcePreservation, setStrictSourcePreservation] = useState(true);
  const [syncTitle, setSyncTitle] = useState(project.syncTitleWithProjectName ?? false);
  const [exportConfirmation, setExportConfirmation] = useState<ExportFileInfo | null>(null);
  const [exportValidationError, setExportValidationError] = useState<string | null>(null);

  const validateFormTitle = (): boolean => {
    const sharedTitle = (project.formTitle || '').trim();
    if (!sharedTitle) {
      setExportValidationError('Form Title / Name is required. Please enter a name before continuing.');
      return false;
    }
    setExportValidationError(null);
    return true;
  };

  // Active Reference Template
  const referenceHtml = useMemo(() => {
    const isVideo =
      project.currentHtml.includes('.hero-bg-slider video') ||
      project.backgroundConfiguration?.mode === 'video';
    return isVideo ? BUNDLED_VIDEO_REFERENCE_HTML : BUNDLED_STATIC_REFERENCE_HTML;
  }, [project.currentHtml, project.backgroundConfiguration?.mode]);

  // Notepad synchronization state
  const [notepadWorkingPath, setNotepadWorkingPath] = useState<string | null>(null);
  const [isOpeningNotepad, setIsOpeningNotepad] = useState(false);
  const [notepadDiffModalOpen, setNotepadDiffModalOpen] = useState(false);
  const [notepadModifiedContent, setNotepadModifiedContent] = useState<string | null>(null);
  const [diffStats, setDiffStats] = useState<{ additions: number; deletions: number } | null>(null);

  // Prepare final processed HTML
  // In Strict Source Preservation mode (default), NO extra comments or title overrides are added!
  const finalHtml = useMemo(() => {
    let html = project.currentHtml || project.originalHtml;
    if (!strictSourcePreservation) {
      // Optional legacy comment injection only if user turns off strict preservation
      html = injectProjectHeaderComment(html, project.name);
      if (syncTitle) {
        html = syncTitleTagWithProjectName(html, project.name);
      }
    }
    return html;
  }, [project.currentHtml, project.originalHtml, project.name, syncTitle, strictSourcePreservation]);

  // Source Comparison and Fidelity Audit Report
  const fidelityReport = useMemo(() => {
    const refFormMatch = /data-form-id=["']([^"']+)["']/i.exec(referenceHtml);
    const refOriginalFormId = refFormMatch ? refFormMatch[1] : 'DuEWLBc3a3oXylBTrYC7';

    const videoAssets = assets
      .filter(a => a.type === 'html_video')
      .map(a => ({
        originalUrl: a.originalUrl,
        currentUrl: a.currentUrl,
        label: a.label,
      }));

    return compareAndValidateSourcePreservation(referenceHtml, finalHtml, {
      images: assets
        .filter(a => a.type !== 'html_video')
        .map(a => ({
          originalUrl: a.originalUrl,
          currentUrl: a.currentUrl,
          label: a.label,
        })),
      videos: [
        ...videoAssets,
        {
          originalUrl: DEFAULT_VIDEO_DESKTOP_URL,
          currentUrl: project.backgroundConfiguration?.video?.desktopVideo || '',
          label: 'Desktop Hero Video',
        },
        {
          originalUrl: DEFAULT_VIDEO_MOBILE_URL,
          currentUrl: project.backgroundConfiguration?.video?.mobileVideo || '',
          label: 'Mobile Hero Video',
        },
      ],
      forms: forms.map(f => ({
        originalFormId: refOriginalFormId,
        newFormId: f.formId,
        formName: f.formName,
      })),
    });
  }, [referenceHtml, finalHtml, assets, forms, project.backgroundConfiguration]);

  const report = useMemo(() => {
    return validateLandingPage(finalHtml, assets, forms);
  }, [finalHtml, assets, forms]);

  const missingAssets = useMemo(() => {
    return detectMissingAssets(assets);
  }, [assets]);

  const filteredIssues = useMemo(() => {
    if (activeFilter === 'all') return report.issues;
    return report.issues.filter(i => i.severity === activeFilter);
  }, [report, activeFilter]);

  const handleTitleSyncChange = (checked: boolean) => {
    setSyncTitle(checked);
    savePortableSettings({ syncTitleWithProjectName: checked });
  };

  const safeFilename = useMemo(() => {
    return sanitizeProjectNameForFilename(project.name);
  }, [project.name]);

  // Download browser fallback helper
  const triggerBrowserDownload = (content: BlobPart, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    setExportConfirmation({
      fileName: filename,
      filePath: `Downloads/${filename}`,
      fileSizeBytes: blob.size,
      exportedAt: new Date().toLocaleString(),
      type: filename.endsWith('.html') ? 'html' : filename.endsWith('.txt') ? 'txt' : 'zip',
    });
  };

  // 1. Export Complete HTML
  const handleExportHtml = async () => {
    if (!validateFormTitle()) return;
    const filename = `${safeFilename}-production.html`;
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const res = await window.electronAPI.saveFile({
          defaultName: filename,
          filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }],
          content: finalHtml,
        });
        if (res.success && res.filePath) {
          setExportConfirmation({
            fileName: filename,
            filePath: res.filePath,
            fileSizeBytes: new Blob([finalHtml]).size,
            exportedAt: new Date().toLocaleString(),
            type: 'html',
          });
          return;
        }
      } catch (err) {
        console.warn('Native save dialog cancelled or error, falling back:', err);
      }
    }
    triggerBrowserDownload(finalHtml, filename, 'text/html;charset=utf-8');
  };

  // 2. Export HTML as TXT
  const handleExportTxt = async () => {
    if (!validateFormTitle()) return;
    const filename = `${safeFilename}-source.txt`;
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const res = await window.electronAPI.saveFile({
          defaultName: filename,
          filters: [{ name: 'Text Files', extensions: ['txt'] }],
          content: finalHtml,
        });
        if (res.success && res.filePath) {
          setExportConfirmation({
            fileName: filename,
            filePath: res.filePath,
            fileSizeBytes: new Blob([finalHtml]).size,
            exportedAt: new Date().toLocaleString(),
            type: 'txt',
          });
          return;
        }
      } catch (err) {
        console.warn('Native save dialog cancelled or error, falling back:', err);
      }
    }
    triggerBrowserDownload(finalHtml, filename, 'text/plain;charset=utf-8');
  };

  // 3. Open in Notepad (and default text editor)
  const handleOpenInNotepad = async () => {
    if (!validateFormTitle()) return;
    setIsOpeningNotepad(true);
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const filename = `${safeFilename}-working-copy.html`;
        const res = await window.electronAPI.openInNotepad(filename, finalHtml);
        if (res.success && res.filePath) {
          setNotepadWorkingPath(res.filePath);
          setExportConfirmation({
            fileName: filename,
            filePath: res.filePath,
            fileSizeBytes: new Blob([finalHtml]).size,
            exportedAt: new Date().toLocaleString(),
            type: 'html',
          });
        } else {
          alert('Could not open Notepad: ' + (res.error || 'Unknown error'));
        }
      } else {
        // Fallback in pure browser: download as text
        handleExportTxt();
      }
    } finally {
      setIsOpeningNotepad(false);
    }
  };

  // Check and compare changes from Notepad
  const handleCheckNotepadChanges = async () => {
    if (!notepadWorkingPath || !window.electronAPI) return;
    try {
      const res = await window.electronAPI.readEditedFile(notepadWorkingPath);
      if (res.success && res.content !== undefined) {
        if (res.content === finalHtml) {
          alert('No changes detected in the Notepad file yet.');
          return;
        }
        setNotepadModifiedContent(res.content);

        // Simple line count diff approximation
        const origLines = finalHtml.split('\n');
        const newLines = res.content.split('\n');
        setDiffStats({
          additions: Math.max(0, newLines.length - origLines.length),
          deletions: Math.max(0, origLines.length - newLines.length),
        });
        setNotepadDiffModalOpen(true);
      } else {
        alert('Could not read working file: ' + (res.error || 'File not found'));
      }
    } catch (e) {
      alert('Error reading edited file: ' + String(e));
    }
  };

  // Apply changes from Notepad
  const handleApplyNotepadChanges = () => {
    if (notepadModifiedContent && onUpdateHtml) {
      onUpdateHtml(notepadModifiedContent, 'Synchronized changes from external Notepad editor');
      setNotepadDiffModalOpen(false);
      setNotepadModifiedContent(null);
    }
  };

  // 4. Open in Default Browser
  const handleOpenInBrowser = async () => {
    if (!validateFormTitle()) return;
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const filename = `${safeFilename}-preview.html`;
        const res = await window.electronAPI.saveFile({
          defaultName: filename,
          content: finalHtml,
        });
        if (res.success && res.filePath) {
          await window.electronAPI.openPath(res.filePath);
          return;
        }
      } catch (e) {
        console.warn('Electron browser preview fallback:', e);
      }
    }
    // Browser fallback: open blob in new tab
    const blob = new Blob([finalHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // 5. Export Project ZIP
  const handleExportZip = async () => {
    if (!validateFormTitle()) return;
    const filename = `${safeFilename}-package.zip`;
    try {
      const zipBlob = await exportProjectAsZip(project.id);
      if (typeof window !== 'undefined' && window.electronAPI) {
        const arrayBuffer = await zipBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Zip = btoa(binary);
        const res = await window.electronAPI.exportBackupZip(base64Zip, filename);
        if (res.success && res.filePath) {
          setExportConfirmation({
            fileName: filename,
            filePath: res.filePath,
            fileSizeBytes: zipBlob.size,
            exportedAt: new Date().toLocaleString(),
            type: 'zip',
          });
          return;
        }
      }
      triggerBrowserDownload(zipBlob, filename, 'application/zip');
    } catch (e) {
      alert('Error creating ZIP bundle: ' + String(e));
    }
  };

  const handleCopyHtml = () => {
    if (!validateFormTitle()) return;
    navigator.clipboard.writeText(finalHtml);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2500);
  };

  const handleExportBackup = () => {
    try {
      const json = generateProjectBackupJson(project.id);
      const filename = `${safeFilename}-backup.json`;
      triggerBrowserDownload(json, filename, 'application/json');
    } catch (err) {
      alert('Error exporting backup: ' + String(err));
    }
  };

  const handleExportManifest = () => {
    const manifest = {
      project: project.name,
      campaign: project.campaignName,
      exportedAt: new Date().toISOString(),
      totalAssets: assets.length,
      assets: assets.map(a => ({
        label: a.label,
        device: a.device,
        type: a.type,
        currentUrl: a.currentUrl,
        originalUrl: a.originalUrl,
        section: a.sectionName,
      })),
      forms: forms.map(f => ({
        name: f.formName,
        formId: f.formId,
        deviceTarget: f.deviceTarget,
        height: f.height,
      })),
    };
    triggerBrowserDownload(JSON.stringify(manifest, null, 2), `${safeFilename}-manifest.json`, 'application/json');
  };

  const handleExportHistory = () => {
    triggerBrowserDownload(JSON.stringify(history, null, 2), `${safeFilename}-history.json`, 'application/json');
  };

  const handleOpenContainingFolder = (filePath: string) => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.showItemInFolder(filePath);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Top Banner / Status Overview */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-white tracking-wide">
                Export & Code Quality Assurance
              </h2>
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#121829] border border-[#1e2942] text-[10px] font-mono text-gray-300">
                <img src={pryvixLogomark} alt="Pryvix" className="w-3 h-3 object-contain" />
                <span>Pryvix Strict Preservation Engine</span>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Validate code fidelity, manage Notepad synchronization, and generate production outputs
            </p>
          </div>
        </div>

        {/* Primary Action Row */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleCopyHtml}
            className="px-4 py-2 rounded-xl bg-[#151a27] hover:bg-[#1f273b] border border-[#26324b] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            {copiedHtml ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy HTML
              </>
            )}
          </button>

          <button
            onClick={handleExportHtml}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#7c3aed] hover:from-[#1d4ed8] hover:to-[#6d28d9] text-white text-xs font-bold tracking-wide shadow-lg shadow-blue-950/50 flex items-center gap-2 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" /> Export Complete HTML
          </button>
        </div>
      </div>

      {/* Required Form Title Validation Banner */}
      {(!project.formTitle || !project.formTitle.trim() || exportValidationError) && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/50 text-red-200 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-white">Validation Error</p>
              <p className="text-xs text-red-300">
                Form Title / Name is required. Please enter a name before continuing.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab?.('forms')}
            className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shrink-0"
          >
            Go to Form Manager
          </button>
        </div>
      )}

      {/* Missing Asset Detection & Recovery Alert (if any) */}
      {missingAssets.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-600/40 text-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-white">
              Potential Asset Portability Issues Detected ({missingAssets.length})
            </h4>
            <p className="text-[11px] text-amber-300/90 mt-0.5">
              Some assets reference unhosted local file paths or empty URLs that may not render correctly when the landing page is hosted online or transferred:
            </p>
            <div className="mt-2 space-y-1">
              {missingAssets.slice(0, 3).map((item, idx) => (
                <div key={idx} className="text-[11px] font-mono bg-black/40 px-2.5 py-1 rounded border border-amber-700/30 flex items-center justify-between">
                  <span>{item.label} ({item.device})</span>
                  <span className="text-amber-400">{item.reason}</span>
                </div>
              ))}
              {missingAssets.length > 3 && (
                <div className="text-[10px] text-amber-400/80">...and {missingAssets.length - 3} more assets</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MANDATORY SOURCE CODE PRESERVATION & FIDELITY AUDIT CARD */}
      <div
        className={`border rounded-2xl p-6 shadow-xl transition-all ${
          fidelityReport.passed
            ? 'bg-[#0b1219] border-emerald-500/40 shadow-emerald-950/20'
            : 'bg-[#180d11] border-red-500/50 shadow-red-950/30'
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-[#1f2638]">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                fidelityReport.passed
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border border-red-500/30'
              }`}
            >
              {fidelityReport.passed ? (
                <ShieldCheck className="w-5 h-5" />
              ) : (
                <ShieldAlert className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-wide">
                  SOURCE CODE PRESERVATION AUDIT:
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                    fidelityReport.passed
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}
                >
                  {fidelityReport.passed ? '100% PRESERVED' : 'AUDIT FAILED'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Authoritative Reference:{' '}
                <span className="font-mono text-gray-200 font-semibold">
                  {fidelityReport.referenceFilename}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-300 cursor-pointer bg-[#141926] px-3 py-1.5 rounded-xl border border-[#222b3f]">
              <input
                type="checkbox"
                checked={strictSourcePreservation}
                onChange={e => setStrictSourcePreservation(e.target.checked)}
                className="w-3.5 h-3.5 text-[#2563eb] rounded focus:ring-0 accent-[#2563eb]"
              />
              <span>Strict Source Preservation Mode</span>
            </label>
          </div>
        </div>

        {/* 9-Point Verification Grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <div className="p-2.5 bg-[#080b11] border border-[#1b2234] rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">HTML Elements</span>
            <div className="text-xs font-bold text-white mt-0.5 flex items-center gap-1.5">
              {fidelityReport.checks.addedHtmlElements === 0 && fidelityReport.checks.removedHtmlElements === 0 ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">0 Added / 0 Removed</span>
                </>
              ) : (
                <span className="text-red-400">
                  +{fidelityReport.checks.addedHtmlElements} / -{fidelityReport.checks.removedHtmlElements}
                </span>
              )}
            </div>
          </div>

          <div className="p-2.5 bg-[#080b11] border border-[#1b2234] rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">CSS & Styles</span>
            <div className="text-xs font-bold text-white mt-0.5 flex items-center gap-1.5">
              {fidelityReport.checks.changedCssRules === 0 ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">100% Verbatim</span>
                </>
              ) : (
                <span className="text-red-400">{fidelityReport.checks.changedCssRules} Modified</span>
              )}
            </div>
          </div>

          <div className="p-2.5 bg-[#080b11] border border-[#1b2234] rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Responsive Breakpoints</span>
            <div className="text-xs font-bold text-white mt-0.5 flex items-center gap-1.5">
              {fidelityReport.checks.modifiedResponsiveBreakpoints === 0 ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Preserved (768/991/1199)</span>
                </>
              ) : (
                <span className="text-red-400">{fidelityReport.checks.modifiedResponsiveBreakpoints} Altered</span>
              )}
            </div>
          </div>

          <div className="p-2.5 bg-[#080b11] border border-[#1b2234] rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">JavaScript Logic</span>
            <div className="text-xs font-bold text-white mt-0.5 flex items-center gap-1.5">
              {fidelityReport.checks.changedJavaScript === 0 && fidelityReport.checks.modifiedScripts === 0 ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">0 Altered Scripts</span>
                </>
              ) : (
                <span className="text-red-400">Modified</span>
              )}
            </div>
          </div>

          <div className="p-2.5 bg-[#080b11] border border-[#1b2234] rounded-xl">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Unrequested URLs</span>
            <div className="text-xs font-bold text-white mt-0.5 flex items-center gap-1.5">
              {fidelityReport.checks.unrequestedUrlChanges === 0 ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">0 Unrequested</span>
                </>
              ) : (
                <span className="text-red-400">{fidelityReport.checks.unrequestedUrlChanges} Unexpected</span>
              )}
            </div>
          </div>
        </div>

        {/* Audit Details & Replacement Breakdown */}
        <div className="mt-3.5 pt-3 border-t border-[#1b2234] flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-gray-400 gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {fidelityReport.summary}
            </span>
          </div>
          <div className="text-[11px] font-mono text-gray-300">
            {fidelityReport.permittedReplacementsCount} explicit replacements verified
          </div>
        </div>
      </div>


      {/* Five Dedicated Export Methods */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
        {/* Option 1: Complete HTML */}
        <div className="p-4 rounded-xl bg-[#111520] border border-[#1f2638] hover:border-[#2563eb]/40 transition-all flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-[#2563eb]/10 text-blue-400 flex items-center justify-center mb-2.5">
              <FileCode2 className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white">1. Complete HTML</div>
            <p className="text-[10px] text-gray-400 mt-1">
              Production-ready .html file for GoHighLevel.
            </p>
          </div>
          <button
            onClick={handleExportHtml}
            className="mt-3.5 w-full py-1.5 rounded-lg bg-[#182032] hover:bg-[#2563eb] hover:text-white border border-[#232f48] text-gray-200 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Save .html
          </button>
        </div>

        {/* Option 2: HTML Source as TXT */}
        <div className="p-4 rounded-xl bg-[#111520] border border-[#1f2638] hover:border-blue-500/40 transition-all flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2.5">
              <FileText className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white">2. Source as TXT</div>
            <p className="text-[10px] text-gray-400 mt-1">
              Clean text file format without browser association.
            </p>
          </div>
          <button
            onClick={handleExportTxt}
            className="mt-3.5 w-full py-1.5 rounded-lg bg-[#182032] hover:bg-blue-600 hover:text-white border border-[#232f48] text-gray-200 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Save .txt
          </button>
        </div>

        {/* Option 3: Open in Notepad */}
        <div className="p-4 rounded-xl bg-[#111520] border border-[#1f2638] hover:border-amber-500/40 transition-all flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center mb-2.5">
              <ExternalLink className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white">3. Open in Notepad</div>
            <p className="text-[10px] text-gray-400 mt-1">
              External editor with two-way sync & diff review.
            </p>
          </div>
          <div className="mt-3.5 space-y-1.5">
            <button
              onClick={handleOpenInNotepad}
              disabled={isOpeningNotepad}
              className="w-full py-1.5 rounded-lg bg-[#182032] hover:bg-amber-600 hover:text-white border border-[#232f48] text-gray-200 text-xs font-semibold flex items-center justify-center gap-1 transition-all disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5" /> {isOpeningNotepad ? 'Opening...' : 'Launch Editor'}
            </button>
            {notepadWorkingPath && (
              <button
                onClick={handleCheckNotepadChanges}
                className="w-full py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-medium flex items-center justify-center gap-1 border border-amber-500/30 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Sync Changes
              </button>
            )}
          </div>
        </div>

        {/* Option 4: Open in Browser */}
        <div className="p-4 rounded-xl bg-[#111520] border border-[#1f2638] hover:border-emerald-500/40 transition-all flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2.5">
              <Globe className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white">4. Open in Browser</div>
            <p className="text-[10px] text-gray-400 mt-1">
              Test rendered landing page directly in your browser.
            </p>
          </div>
          <button
            onClick={handleOpenInBrowser}
            className="mt-3.5 w-full py-1.5 rounded-lg bg-[#182032] hover:bg-emerald-600 hover:text-white border border-[#232f48] text-gray-200 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
          >
            <Globe className="w-3.5 h-3.5" /> Preview
          </button>
        </div>

        {/* Option 5: Export Project ZIP */}
        <div className="p-4 rounded-xl bg-[#111520] border border-[#1f2638] hover:border-purple-500/40 transition-all flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2.5">
              <FileArchive className="w-4 h-4" />
            </div>
            <div className="text-xs font-bold text-white">5. Project ZIP</div>
            <p className="text-[10px] text-gray-400 mt-1">
              Complete portable archive with JSON & manifest.
            </p>
          </div>
          <button
            onClick={handleExportZip}
            className="mt-3.5 w-full py-1.5 rounded-lg bg-[#182032] hover:bg-purple-600 hover:text-white border border-[#232f48] text-gray-200 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Save .zip
          </button>
        </div>
      </div>

      {/* Validation Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveFilter('all')}
          className={`cursor-pointer rounded-xl p-4 border transition-all ${
            activeFilter === 'all'
              ? 'bg-[#182030] border-gray-400'
              : 'bg-[#111520] border-[#1f2638] hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-gray-400 flex items-center justify-between">
            <span>Overall Status</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-xl font-bold text-white">
            {report.passed ? (
              <span className="text-emerald-400 flex items-center gap-1">Passed Checks</span>
            ) : (
              <span className="text-red-400 flex items-center gap-1">Action Required</span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-gray-400">{report.issues.length} total diagnostics</div>
        </div>

        <div
          onClick={() => setActiveFilter('error')}
          className={`cursor-pointer rounded-xl p-4 border transition-all ${
            activeFilter === 'error'
              ? 'bg-[#182030] border-red-500'
              : 'bg-[#111520] border-[#1f2638] hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-gray-400 flex items-center justify-between">
            <span>Critical Errors</span>
            <XCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-red-400">{report.totalErrors}</div>
          <div className="mt-1 text-[11px] text-gray-400">Must be resolved for live GHL</div>
        </div>

        <div
          onClick={() => setActiveFilter('warning')}
          className={`cursor-pointer rounded-xl p-4 border transition-all ${
            activeFilter === 'warning'
              ? 'bg-[#182030] border-amber-500'
              : 'bg-[#111520] border-[#1f2638] hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-gray-400 flex items-center justify-between">
            <span>Warnings</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">{report.totalWarnings}</div>
          <div className="mt-1 text-[11px] text-gray-400">Recommended improvements</div>
        </div>

        <div
          onClick={() => setActiveFilter('info')}
          className={`cursor-pointer rounded-xl p-4 border transition-all ${
            activeFilter === 'info'
              ? 'bg-[#182030] border-blue-500'
              : 'bg-[#111520] border-[#1f2638] hover:border-gray-700'
          }`}
        >
          <div className="text-xs text-gray-400 flex items-center justify-between">
            <span>Informational</span>
            <Info className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-400">{report.totalInfos}</div>
          <div className="mt-1 text-[11px] text-gray-400">Structure observations</div>
        </div>
      </div>

      {/* Main Validation Diagnostic List */}
      <div className="bg-[#111520] border border-[#1f2638] rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1f2638]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileCode2 className="w-4 h-4 text-violet-400" />
            Diagnostic Report ({filteredIssues.length})
          </h3>
          <span className="text-[11px] text-gray-400">
            Click any line number to inspect the code in the direct editor
          </span>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="p-8 text-center text-emerald-400 text-xs flex flex-col items-center">
            <CheckCircle2 className="w-8 h-8 mb-2" />
            <div className="font-bold">No issues found in this category!</div>
            <p className="text-gray-400 mt-1">Your landing page is verified and ready for GoHighLevel export.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIssues.map(issue => {
              const isError = issue.severity === 'error';
              const isWarning = issue.severity === 'warning';

              return (
                <div
                  key={issue.id}
                  className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                    isError
                      ? 'bg-red-950/20 border-red-900/40 text-red-200'
                      : isWarning
                      ? 'bg-amber-950/20 border-amber-900/40 text-amber-200'
                      : 'bg-blue-950/20 border-blue-900/40 text-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {isError ? (
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-white">{issue.title}</span>
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-black/40 border border-current">
                          {issue.category}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 mt-1 leading-relaxed">{issue.message}</p>
                      {issue.actionHint && (
                        <p className="text-[11px] text-emerald-300 font-medium mt-1">
                          Fix suggestion: {issue.actionHint}
                        </p>
                      )}
                    </div>
                  </div>

                  {issue.lineNumber && (
                    <button
                      onClick={() => onJumpToCode?.(issue.lineNumber)}
                      className="text-xs text-gray-300 hover:text-white flex items-center gap-1 font-mono bg-[#141926] px-2.5 py-1 rounded-lg border border-[#222b3f] hover:border-gray-500 transition-colors whitespace-nowrap"
                    >
                      <Code2 className="w-3 h-3 text-violet-400" /> Line {issue.lineNumber}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Secondary Backup & History Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-[#111520] border border-[#1f2638] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
              <Archive className="w-4 h-4 text-blue-400" /> Complete Project Backup
            </div>
            <p className="text-[11px] text-gray-400">
              Portable JSON backup containing original HTML, modified code, asset mappings, and forms.
            </p>
          </div>
          <button
            onClick={handleExportBackup}
            className="mt-4 px-3.5 py-2 rounded-lg bg-[#161c2b] hover:bg-[#202b40] border border-[#222b3f] text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download Backup (.json)
          </button>
        </div>

        <div className="p-5 rounded-2xl bg-[#111520] border border-[#1f2638] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
              <FileSpreadsheet className="w-4 h-4 text-purple-400" /> Asset Manifest
            </div>
            <p className="text-[11px] text-gray-400">
              Structured JSON catalog of all detected images, device assignments, and replacement URLs.
            </p>
          </div>
          <button
            onClick={handleExportManifest}
            className="mt-4 px-3.5 py-2 rounded-lg bg-[#161c2b] hover:bg-[#202b40] border border-[#222b3f] text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export Manifest (.json)
          </button>
        </div>

        <div className="p-5 rounded-2xl bg-[#111520] border border-[#1f2638] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-white mb-1">
              <History className="w-4 h-4 text-amber-400" /> Audit & Change History
            </div>
            <p className="text-[11px] text-gray-400">
              Export comprehensive history log of all modifications, timestamps, and previous values.
            </p>
          </div>
          <button
            onClick={handleExportHistory}
            className="mt-4 px-3.5 py-2 rounded-lg bg-[#161c2b] hover:bg-[#202b40] border border-[#222b3f] text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export History Log
          </button>
        </div>
      </div>

      {/* Export Confirmation Dialog */}
      {exportConfirmation && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#121622] border border-[#26324a] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1f273b]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Export Complete</h3>
              </div>
              <button
                onClick={() => setExportConfirmation(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-[#0a0d14] rounded-xl border border-[#1b2234] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">File Name:</span>
                  <span className="font-semibold text-white truncate max-w-xs">{exportConfirmation.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">File Path:</span>
                  <span className="font-mono text-gray-300 text-[11px] truncate max-w-xs" title={exportConfirmation.filePath}>
                    {exportConfirmation.filePath}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">File Size:</span>
                  <span className="text-emerald-400 font-mono">
                    {(exportConfirmation.fileSizeBytes / 1024).toFixed(1)} KB ({exportConfirmation.fileSizeBytes} bytes)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Export Timestamp:</span>
                  <span className="text-gray-300">{exportConfirmation.exportedAt}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              {typeof window !== 'undefined' && window.electronAPI && (
                <button
                  onClick={() => handleOpenContainingFolder(exportConfirmation.filePath)}
                  className="px-4 py-2 rounded-xl bg-[#1b2336] hover:bg-[#25324c] border border-[#2b3a56] text-gray-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-blue-400" /> Open Containing Folder
                </button>
              )}
              <button
                onClick={() => setExportConfirmation(null)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notepad Diff & Re-import Modal */}
      {notepadDiffModalOpen && notepadModifiedContent && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#121622] border border-[#26324a] rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1f273b]">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Review Notepad Edits Before Sync</h3>
                  <p className="text-[11px] text-gray-400">External changes detected in working copy file</p>
                </div>
              </div>
              <button
                onClick={() => setNotepadDiffModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-950/20 border border-amber-600/30 rounded-xl text-amber-200 text-xs flex items-center justify-between">
              <span>A backup of your previous code will be created automatically upon applying.</span>
              {diffStats && (
                <span className="font-mono text-[11px]">
                  +{diffStats.additions} / -{diffStats.deletions} lines
                </span>
              )}
            </div>

            <div className="h-64 overflow-y-auto bg-[#0a0d14] p-3 rounded-xl border border-[#1b2234] font-mono text-[11px] text-gray-300">
              <pre className="whitespace-pre-wrap">{notepadModifiedContent.slice(0, 3000)}...</pre>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setNotepadDiffModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-[#182030] hover:bg-[#202b40] text-gray-300 text-xs font-semibold transition-colors"
              >
                Discard & Keep Current
              </button>
              <button
                onClick={handleApplyNotepadChanges}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all"
              >
                <Check className="w-3.5 h-3.5" /> Apply Notepad Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
