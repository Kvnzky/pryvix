import React, { useState, useEffect } from 'react';
import { X, Upload, FileCode2, Sparkles, Image as ImageIcon, Video, CheckCircle2 } from 'lucide-react';
import pryvixLogomark from '../assets/brand/pryvix-logomark.png';
import { BUNDLED_STATIC_REFERENCE_HTML, BUNDLED_VIDEO_REFERENCE_HTML } from '@shared/referenceTemplates';
import { analyzeHtml, resolveSharedFormTitle } from '@shared/parser';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    campaignName: string,
    description: string,
    html: string,
    isImport?: boolean,
    formTitle?: string
  ) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [description, setDescription] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'template'>('upload');
  const [selectedTemplateType, setSelectedTemplateType] = useState<'static' | 'video'>('static');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  // Auto-detect recognizable form name when imported htmlContent changes
  useEffect(() => {
    if ((activeTab === 'upload' || activeTab === 'paste') && htmlContent.trim()) {
      try {
        const analysis = analyzeHtml(htmlContent, 'temp_detect');
        const detected = resolveSharedFormTitle(undefined, analysis.forms);
        if (detected) {
          setFormTitle(detected);
        }
      } catch {
        // ignore parse errors during intermediate typing
      }
    }
  }, [htmlContent, activeTab]);

  if (!isOpen) return null;

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm') && !file.name.endsWith('.txt')) {
      setError('Please select an HTML or TXT file.');
      return;
    }
    setError('');
    setFileName(file.name);
    if (!name) {
      setName(file.name.replace(/\.[^/.]+$/, ''));
    }

    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setHtmlContent(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a project name.');
      return;
    }

    let finalHtml = htmlContent;
    if (activeTab === 'template') {
      finalHtml = selectedTemplateType === 'video' ? BUNDLED_VIDEO_REFERENCE_HTML : BUNDLED_STATIC_REFERENCE_HTML;
    }

    if (!finalHtml.trim()) {
      setError('HTML source code is required to initialize the project.');
      return;
    }

    const isImport = activeTab === 'upload' || activeTab === 'paste';
    if (isImport && !formTitle.trim()) {
      setError('Form Title / Name is required. Please enter a name before continuing.');
      return;
    }

    onCreate(name.trim(), campaignName.trim(), description.trim(), finalHtml, isImport, formTitle.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0e1426] border border-[#1e2942] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1e2942] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#121829] border border-[#1e2942] p-1 flex items-center justify-center shrink-0">
              <img src={pryvixLogomark} alt="Pryvix" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create New Project</h3>
              <p className="text-[11px] text-gray-400">Pryvix Landing Page Studio • Content Replacement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#18223a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Project Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Gaming Gift Cards Giveaway"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2563eb]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Campaign Name
              </label>
              <input
                type="text"
                placeholder="e.g. Mega Rewards Q4 EDM"
                value={campaignName}
                onChange={e => setCampaignName(e.target.value)}
                className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2563eb]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="Brief details about this landing page variant..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          {(activeTab === 'upload' || activeTab === 'paste') && (
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Form Title / Name <span className="text-violet-400 font-bold">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Mega Rewards EDM Form"
                value={formTitle}
                onChange={e => {
                  setFormTitle(e.target.value);
                  if (e.target.value.trim()) setError('');
                }}
                className={`w-full bg-[#0a0e1a] border ${
                  error && !formTitle.trim() ? 'border-red-500 ring-1 ring-red-500/50' : 'border-[#1e2942] focus:border-[#2563eb]'
                } rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors`}
                required
              />
              <p className="text-[10px] text-gray-400 mt-1">
                This name applies to both Desktop and Mobile forms.
              </p>
            </div>
          )}

          {/* HTML Source Input Tabs */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2">
              HTML Source Code
            </label>
            <div className="flex border-b border-[#1e2942] mb-3">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'upload'
                    ? 'border-[#2563eb] text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Upload / Drop File
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('paste')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === 'paste'
                    ? 'border-[#2563eb] text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Paste Code
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('template')}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1 ${
                  activeTab === 'template'
                    ? 'border-[#2563eb] text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Sparkles className="w-3 h-3 text-violet-400" /> Use Reference LP
              </button>
            </div>

            {activeTab === 'upload' && (
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-[#2563eb] bg-blue-950/20'
                    : 'border-[#1e2942] bg-[#0a0e1a]/60 hover:border-gray-500'
                }`}
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <div className="text-xs font-semibold text-gray-200">
                  {fileName ? (
                    <span className="text-emerald-400 font-mono">{fileName}</span>
                  ) : (
                    'Click to upload or drag & drop HTML file here'
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Supports .html, .htm, .txt</p>
                <input
                  id="file-upload-input"
                  type="file"
                  accept=".html,.htm,.txt"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />
              </div>
            )}

            {activeTab === 'paste' && (
              <textarea
                placeholder="<!DOCTYPE html>..."
                value={htmlContent}
                onChange={e => setHtmlContent(e.target.value)}
                rows={6}
                className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-xl p-3 font-mono text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#2563eb]"
              />
            )}

            {activeTab === 'template' && (
              <div className="space-y-3">
                <p className="text-[11px] text-gray-400">
                  Select one of the two authoritative GoHighLevel reference templates:
                </p>

                {/* Option 1: Static Reference Template */}
                <div
                  onClick={() => setSelectedTemplateType('static')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedTemplateType === 'static'
                      ? 'bg-blue-950/20 border-[#2563eb] shadow-md shadow-blue-950/30'
                      : 'bg-[#0a0e1a] border-[#1e2942] hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-white text-xs">
                          Static Image Reference Template
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          LP Reference-static Campaign Details Background.txt
                        </div>
                      </div>
                    </div>
                    {selectedTemplateType === 'static' && (
                      <CheckCircle2 className="w-4 h-4 text-[#2563eb]" />
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Official static background reference featuring dual GHL forms, token cookies, and responsive banner graphics.
                  </p>
                  <div className="text-[10px] text-emerald-400 font-mono mt-1">
                    39.5 KB • 1,218 Lines • Authoritative Source
                  </div>
                </div>

                {/* Option 2: Video Reference Template */}
                <div
                  onClick={() => setSelectedTemplateType('video')}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    selectedTemplateType === 'video'
                      ? 'bg-violet-950/20 border-violet-500 shadow-md shadow-violet-950/30'
                      : 'bg-[#0a0e1a] border-[#1e2942] hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
                        <Video className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-white text-xs">
                          Video Background Reference Template
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          LP Reference-video Campaign Details Background.txt
                        </div>
                      </div>
                    </div>
                    {selectedTemplateType === 'video' && (
                      <CheckCircle2 className="w-4 h-4 text-violet-400" />
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Official video reference featuring dual desktop & mobile video background in Hero Background Section (.hero-bg-slider).
                  </p>
                  <div className="text-[10px] text-violet-300 font-mono mt-1">
                    46.5 KB • 1,327 Lines • Authoritative Source
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#1e2942]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#121829] hover:bg-[#18223a] text-gray-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#7c3aed] hover:from-[#1d4ed8] hover:to-[#6d28d9] text-white text-xs font-semibold shadow-md shadow-blue-950/40 transition-all"
            >
              Scan & Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
