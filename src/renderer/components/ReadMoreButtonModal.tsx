import React, { useState, useEffect } from 'react';
import {
  X,
  Monitor,
  Smartphone,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
  Palette,
  Link,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { ReadMoreButtonConfig, ReadMoreSectionConfig } from '@shared/types';
import { isValidDestinationUrl } from '@shared/parser';

interface ReadMoreButtonModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ReadMoreSectionConfig;
  onSave: (newConfig: ReadMoreSectionConfig) => void;
}

export const ReadMoreButtonModal: React.FC<ReadMoreButtonModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'desktop' | 'mobile'>('desktop');
  const [draftConfig, setDraftConfig] = useState<ReadMoreSectionConfig>(config);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDraftConfig(JSON.parse(JSON.stringify(config)));
      setUrlError(null);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const currentBtn: ReadMoreButtonConfig = draftConfig[activeTab];

  const updateCurrent = (fields: Partial<ReadMoreButtonConfig>) => {
    setDraftConfig(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        ...fields,
      },
    }));

    if (fields.url !== undefined) {
      if (fields.url.trim() && !isValidDestinationUrl(fields.url)) {
        setUrlError('Please enter a valid URL (starting with https:// or http://)');
      } else {
        setUrlError(null);
      }
    }
  };

  const handleSave = () => {
    // Validate both URLs if enabled
    if (draftConfig.desktop.enabled && !isValidDestinationUrl(draftConfig.desktop.url)) {
      setActiveTab('desktop');
      setUrlError('Desktop destination URL must be a valid URL starting with https:// or http://');
      return;
    }
    if (draftConfig.mobile.enabled && !isValidDestinationUrl(draftConfig.mobile.url)) {
      setActiveTab('mobile');
      setUrlError('Mobile destination URL must be a valid URL starting with https:// or http://');
      return;
    }

    onSave(draftConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121829] border border-[#1e2942] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2942] bg-[#0e1426]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2563eb]/20 to-[#7c3aed]/20 border border-[#2563eb]/40 text-blue-400 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Read More Button Configuration
              </h3>
              <p className="text-xs text-gray-400">
                Independent responsive styling and destination URLs for Desktop and Mobile viewports
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e2942] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device View Switcher Tabs */}
        <div className="flex items-center px-6 pt-4 border-b border-[#1e2942] bg-[#0e1426]/50 gap-2">
          <button
            onClick={() => setActiveTab('desktop')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'desktop'
                ? 'border-[#2563eb] text-white bg-[#121829]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Monitor className="w-4 h-4 text-blue-400" />
            <span>Desktop Version</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                draftConfig.desktop.enabled
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {draftConfig.desktop.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('mobile')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'mobile'
                ? 'border-[#7c3aed] text-white bg-[#121829]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Smartphone className="w-4 h-4 text-violet-400" />
            <span>Mobile Version</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                draftConfig.mobile.enabled
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {draftConfig.mobile.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Live Preview Box */}
          <div className="rounded-xl border border-[#1e2942] bg-[#0a0e1a] p-5">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1e2942] text-xs">
              <span className="font-semibold text-gray-300 flex items-center gap-2">
                {activeTab === 'desktop' ? (
                  <Monitor className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <Smartphone className="w-3.5 h-3.5 text-violet-400" />
                )}
                Interactive {activeTab === 'desktop' ? 'Desktop' : 'Mobile'} Preview
              </span>
              <span className="text-[10px] font-mono text-gray-500">
                {activeTab === 'desktop' ? 'Breakpoint: ≥ 768px' : 'Breakpoint: < 768px'}
              </span>
            </div>

            <div
              className="py-6 px-4 flex items-center justify-center min-h-[100px] transition-all bg-[#080b14] rounded-lg"
              style={{
                justifyContent:
                  currentBtn.alignment === 'left'
                    ? 'flex-start'
                    : currentBtn.alignment === 'right'
                    ? 'flex-end'
                    : 'center',
              }}
            >
              {currentBtn.enabled ? (
                <a
                  href={currentBtn.url || '#'}
                  target={currentBtn.openInNewTab ? '_blank' : '_self'}
                  rel="noopener noreferrer"
                  onClick={e => e.preventDefault()}
                  style={{
                    backgroundColor: currentBtn.backgroundColor,
                    color: currentBtn.textColor,
                    fontSize: currentBtn.fontSize,
                    fontWeight: currentBtn.fontWeight,
                    width: currentBtn.width === '100%' ? '100%' : currentBtn.width === 'auto' ? 'auto' : currentBtn.width,
                    padding: currentBtn.padding,
                    borderRadius: currentBtn.borderRadius,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    transition: 'all 0.2s ease',
                  }}
                  className="hover:opacity-90 active:scale-95"
                >
                  <span>{currentBtn.text || 'Button Text'}</span>
                  {currentBtn.openInNewTab && <ExternalLink className="w-3.5 h-3.5 ml-1.5 opacity-80" />}
                </a>
              ) : (
                <div className="text-center text-xs text-gray-500 py-3 font-mono">
                  (Button disabled for {activeTab} view)
                </div>
              )}
            </div>
          </div>

          {/* Toggle Enable/Disable */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#0e1426] border border-[#1e2942]">
            <div>
              <div className="text-xs font-bold text-white">
                Enable {activeTab === 'desktop' ? 'Desktop' : 'Mobile'} Read More Button
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {currentBtn.enabled
                  ? `Button will display at the ${activeTab} breakpoint`
                  : `Button is hidden on ${activeTab} viewports`}
              </div>
            </div>
            <button
              type="button"
              onClick={() => updateCurrent({ enabled: !currentBtn.enabled })}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                currentBtn.enabled ? 'bg-[#2563eb]' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  currentBtn.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Settings Grid */}
          <div className="space-y-4">
            {/* Button Text & Destination URL */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Button Text</label>
                <input
                  type="text"
                  value={currentBtn.text}
                  onChange={e => updateCurrent({ text: e.target.value })}
                  placeholder="Read Full Terms and Conditions"
                  className="w-full bg-[#0a0e1a] border border-[#1e2942] focus:border-[#2563eb] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center justify-between">
                  <span>Destination URL</span>
                  {currentBtn.url && !urlError && (
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Valid URL
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={currentBtn.url}
                    onChange={e => updateCurrent({ url: e.target.value })}
                    placeholder="https://example.com/terms.pdf"
                    className={`w-full bg-[#0a0e1a] border ${
                      urlError ? 'border-rose-500' : 'border-[#1e2942] focus:border-[#2563eb]'
                    } rounded-xl px-3.5 py-2 text-xs font-mono text-white placeholder-gray-500 focus:outline-none`}
                  />
                </div>
                {urlError && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {urlError}
                  </p>
                )}
              </div>
            </div>

            {/* Open in New Tab checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="openNewTabCheck"
                checked={currentBtn.openInNewTab}
                onChange={e => updateCurrent({ openInNewTab: e.target.checked })}
                className="w-4 h-4 rounded bg-[#0a0e1a] border-[#1e2942] text-blue-600 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="openNewTabCheck" className="text-xs text-gray-300 cursor-pointer select-none">
                Open destination link in new browser tab (<code className="text-blue-300">target="_blank" rel="noopener noreferrer"</code>)
              </label>
            </div>

            {/* Colors */}
            <div className="p-4 rounded-xl bg-[#0e1426] border border-[#1e2942] space-y-3">
              <div className="text-xs font-bold text-gray-300 flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-blue-400" /> Color Styling
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Background</label>
                  <div className="flex items-center gap-2 bg-[#0a0e1a] border border-[#1e2942] rounded-xl px-2.5 py-1.5">
                    <input
                      type="color"
                      value={currentBtn.backgroundColor.startsWith('#') ? currentBtn.backgroundColor : '#2563eb'}
                      onChange={e => updateCurrent({ backgroundColor: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={currentBtn.backgroundColor}
                      onChange={e => updateCurrent({ backgroundColor: e.target.value })}
                      className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Text Color</label>
                  <div className="flex items-center gap-2 bg-[#0a0e1a] border border-[#1e2942] rounded-xl px-2.5 py-1.5">
                    <input
                      type="color"
                      value={currentBtn.textColor.startsWith('#') ? currentBtn.textColor : '#ffffff'}
                      onChange={e => updateCurrent({ textColor: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={currentBtn.textColor}
                      onChange={e => updateCurrent({ textColor: e.target.value })}
                      className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Hover Background</label>
                  <div className="flex items-center gap-2 bg-[#0a0e1a] border border-[#1e2942] rounded-xl px-2.5 py-1.5">
                    <input
                      type="color"
                      value={currentBtn.hoverBackgroundColor?.startsWith('#') ? currentBtn.hoverBackgroundColor : '#1d4ed8'}
                      onChange={e => updateCurrent({ hoverBackgroundColor: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={currentBtn.hoverBackgroundColor || ''}
                      onChange={e => updateCurrent({ hoverBackgroundColor: e.target.value })}
                      placeholder="#1d4ed8"
                      className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Hover Text Color</label>
                  <div className="flex items-center gap-2 bg-[#0a0e1a] border border-[#1e2942] rounded-xl px-2.5 py-1.5">
                    <input
                      type="color"
                      value={currentBtn.hoverTextColor?.startsWith('#') ? currentBtn.hoverTextColor : '#ffffff'}
                      onChange={e => updateCurrent({ hoverTextColor: e.target.value })}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                    />
                    <input
                      type="text"
                      value={currentBtn.hoverTextColor || ''}
                      onChange={e => updateCurrent({ hoverTextColor: e.target.value })}
                      placeholder="#ffffff"
                      className="w-full bg-transparent text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Geometry, Sizing & Alignment */}
            <div className="p-4 rounded-xl bg-[#0e1426] border border-[#1e2942] space-y-3">
              <div className="text-xs font-bold text-gray-300">Dimensions &amp; Alignment</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Width</label>
                  <select
                    value={currentBtn.width}
                    onChange={e => updateCurrent({ width: e.target.value })}
                    className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="auto">Auto (Content)</option>
                    <option value="240px">240px</option>
                    <option value="280px">280px</option>
                    <option value="320px">320px</option>
                    <option value="90%">90% Width</option>
                    <option value="100%">100% Full Width</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Padding</label>
                  <input
                    type="text"
                    value={currentBtn.padding}
                    onChange={e => updateCurrent({ padding: e.target.value })}
                    placeholder="12px 28px"
                    className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563eb]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Border Radius</label>
                  <select
                    value={currentBtn.borderRadius}
                    onChange={e => updateCurrent({ borderRadius: e.target.value })}
                    className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="0px">Square (0px)</option>
                    <option value="4px">Slight (4px)</option>
                    <option value="8px">Medium (8px)</option>
                    <option value="12px">Rounded (12px)</option>
                    <option value="30px">Full Pill (30px)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Alignment</label>
                  <div className="flex items-center gap-1 bg-[#0a0e1a] p-1 border border-[#1e2942] rounded-xl">
                    <button
                      type="button"
                      onClick={() => updateCurrent({ alignment: 'left' })}
                      className={`flex-1 py-1 flex items-center justify-center rounded-lg ${
                        currentBtn.alignment === 'left' ? 'bg-[#2563eb] text-white' : 'text-gray-400 hover:text-white'
                      }`}
                      title="Left"
                    >
                      <AlignLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCurrent({ alignment: 'center' })}
                      className={`flex-1 py-1 flex items-center justify-center rounded-lg ${
                        currentBtn.alignment === 'center' ? 'bg-[#2563eb] text-white' : 'text-gray-400 hover:text-white'
                      }`}
                      title="Center"
                    >
                      <AlignCenter className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCurrent({ alignment: 'right' })}
                      className={`flex-1 py-1 flex items-center justify-center rounded-lg ${
                        currentBtn.alignment === 'right' ? 'bg-[#2563eb] text-white' : 'text-gray-400 hover:text-white'
                      }`}
                      title="Right"
                    >
                      <AlignRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs border-t border-[#1e2942]">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Font Size</label>
                  <input
                    type="text"
                    value={currentBtn.fontSize}
                    onChange={e => updateCurrent({ fontSize: e.target.value })}
                    placeholder="14px"
                    className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563eb]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Font Weight</label>
                  <select
                    value={currentBtn.fontWeight}
                    onChange={e => updateCurrent({ fontWeight: e.target.value })}
                    className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="400">Regular (400)</option>
                    <option value="500">Medium (500)</option>
                    <option value="600">Semibold (600)</option>
                    <option value="700">Bold (700)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Margin Top</label>
                  <input
                    type="text"
                    value={currentBtn.marginTop}
                    onChange={e => updateCurrent({ marginTop: e.target.value })}
                    placeholder="30px"
                    className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563eb]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Margin Bottom</label>
                  <input
                    type="text"
                    value={currentBtn.marginBottom}
                    onChange={e => updateCurrent({ marginBottom: e.target.value })}
                    placeholder="20px"
                    className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2563eb]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e2942] bg-[#0e1426]">
          <button
            type="button"
            onClick={() => setDraftConfig(JSON.parse(JSON.stringify(config)))}
            className="px-3.5 py-2 rounded-xl bg-[#0a0e1a] hover:bg-[#18223a] text-gray-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-[#1e2942] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#0a0e1a] hover:bg-[#18223a] text-gray-300 text-xs font-semibold border border-[#1e2942] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#7c3aed] text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-950/40 hover:opacity-95 transition-opacity"
            >
              <CheckCircle2 className="w-4 h-4" /> Save &amp; Apply Button
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
