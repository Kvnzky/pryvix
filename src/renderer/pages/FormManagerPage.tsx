import React, { useState } from 'react';
import {
  FormInput,
  Key,
  Shield,
  Monitor,
  Smartphone,
  Eye,
  Check,
  Code2,
  AlertCircle,
  ExternalLink,
  Copy,
  Info,
  Lock,
  Sparkles,
} from 'lucide-react';
import { Project, GHLForm } from '@shared/types';

interface FormManagerPageProps {
  project: Project;
  forms: GHLForm[];
  onUpdateForm: (
    formId: string,
    updates: {
      formId?: string;
      formName?: string;
      height?: string | number;
      closingCustomValue?: string;
    }
  ) => void;
  onUpdateSharedFormTitle: (newTitle: string) => void;
  onJumpToCode?: (lineNumber?: number) => void;
  externalValidationError?: string | null;
}

export const FormManagerPage: React.FC<FormManagerPageProps> = ({
  project,
  forms,
  onUpdateForm,
  onUpdateSharedFormTitle,
  onJumpToCode,
  externalValidationError,
}) => {
  const [activeFormIndex, setActiveFormIndex] = useState(0);
  const [formIdInput, setFormIdInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [closingCustomValueInput, setClosingCustomValueInput] = useState('');
  const [sharedFormTitle, setSharedFormTitle] = useState(project.formTitle || '');
  const [nameValidationError, setNameValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const currentForm = forms[activeFormIndex] || forms[0];

  React.useEffect(() => {
    if (project.formTitle !== undefined) {
      setSharedFormTitle(project.formTitle);
    }
  }, [project.formTitle]);

  React.useEffect(() => {
    if (externalValidationError) {
      setNameValidationError(externalValidationError);
    }
  }, [externalValidationError]);

  React.useEffect(() => {
    if (currentForm) {
      setFormIdInput(currentForm.formId || '');
      setHeightInput(String(currentForm.height || '1465'));
      setClosingCustomValueInput(currentForm.customScripts?.closingCustomValue || '');
    }
  }, [currentForm?.id, currentForm?.customScripts?.closingCustomValue]);

  if (forms.length === 0) {
    return (
      <div className="p-12 text-center max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 mx-auto flex items-center justify-center mb-3">
          <FormInput className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">No GoHighLevel Forms Detected</h3>
        <p className="text-xs text-gray-400 mt-1">
          No GoHighLevel form embed iframes or form scripts were identified in this landing page.
        </p>
      </div>
    );
  }

  const handleSharedTitleBlur = () => {
    const trimmed = sharedFormTitle.trim();
    if (!trimmed) {
      setNameValidationError('Form Title / Name is required. Please enter a name before continuing.');
      return;
    }
    setNameValidationError(null);
    setSharedFormTitle(trimmed);
    onUpdateSharedFormTitle(trimmed);
  };

  const handleApplyChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentForm) return;

    const trimmedTitle = sharedFormTitle.trim();
    if (!trimmedTitle) {
      setNameValidationError('Form Title / Name is required. Please enter a name before continuing.');
      return;
    }
    setNameValidationError(null);
    setSharedFormTitle(trimmedTitle);
    onUpdateSharedFormTitle(trimmedTitle);

    onUpdateForm(currentForm.id, {
      formId: formIdInput.trim(),
      formName: trimmedTitle,
      height: heightInput.trim(),
      closingCustomValue: closingCustomValueInput.trim(),
    });

    setSuccessMessage('Form configuration and custom value updated in HTML & scripts!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleApplyClosingCustomValue = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!currentForm) return;
    const trimmed = closingCustomValueInput.trim();
    if (!trimmed) return;

    onUpdateForm(currentForm.id, {
      closingCustomValue: trimmed,
    });

    setSuccessMessage('Form closing custom value updated in scripts!');
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto max-h-[calc(100vh-4rem)]">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-[#2563eb] flex items-center justify-center border border-blue-500/20">
            <FormInput className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">GoHighLevel Form Manager</h2>
            <p className="text-xs text-gray-400">
              Configure GHL form embed iframes, token cookies, and responsive instances
            </p>
          </div>
        </div>

        {/* Form Selector Tabs (Desktop vs Mobile) */}
        <div className="flex items-center bg-[#121829] border border-[#1e2942] rounded-xl p-1 gap-1">
          {forms.map((f, idx) => (
            <button
              key={f.id}
              onClick={() => setActiveFormIndex(idx)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFormIndex === idx
                  ? 'bg-[#2563eb] text-white shadow-md'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {f.deviceTarget === 'mobile' ? (
                <Smartphone className="w-3.5 h-3.5" />
              ) : (
                <Monitor className="w-3.5 h-3.5" />
              )}
              <span>{f.deviceTarget === 'mobile' ? 'Form - Mobile' : 'Form - Desktop'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Shared Configuration Area (Outside individual Desktop & Mobile panels) */}
      <div
        className={`bg-[#121829] border ${
          nameValidationError ? 'border-red-500 ring-1 ring-red-500/50' : 'border-[#1e2942]'
        } rounded-2xl p-6 shadow-lg transition-all`}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1e2942]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-600/10 text-violet-400 flex items-center justify-center border border-violet-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Shared Form Configuration
              </h3>
              <p className="text-[11px] text-gray-400">
                This name applies to both Desktop and Mobile forms.
              </p>
            </div>
          </div>
          {sharedFormTitle.trim() && !nameValidationError && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
              <Check className="w-3 h-3" /> Shared & Synced
            </span>
          )}
        </div>

        <div className="max-w-2xl space-y-1.5">
          <label className="block text-xs font-semibold text-gray-200">
            Form Title / Name <span className="text-violet-400 font-bold">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={sharedFormTitle}
              onChange={e => {
                setSharedFormTitle(e.target.value);
                if (e.target.value.trim()) {
                  setNameValidationError(null);
                }
              }}
              onBlur={handleSharedTitleBlur}
              placeholder="e.g. Mega Rewards EDM Form"
              className={`flex-1 bg-[#0a0e1a] border ${
                nameValidationError
                  ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500/50 text-red-200'
                  : 'border-[#1e2942] focus:border-[#2563eb] text-white'
              } rounded-lg px-3.5 py-2 text-xs focus:outline-none transition-colors font-medium`}
              required
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = sharedFormTitle.trim();
                if (!trimmed) {
                  setNameValidationError('Form Title / Name is required. Please enter a name before continuing.');
                  return;
                }
                setNameValidationError(null);
                setSharedFormTitle(trimmed);
                onUpdateSharedFormTitle(trimmed);
                setSuccessMessage('Shared Form Title / Name saved!');
                setTimeout(() => setSuccessMessage(null), 3000);
              }}
              className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 shrink-0 shadow-md"
            >
              <Check className="w-3.5 h-3.5" /> Save Name
            </button>
          </div>
          {nameValidationError ? (
            <p className="text-[11px] text-red-400 font-medium flex items-center gap-1.5 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {nameValidationError}
            </p>
          ) : (
            <p className="text-[10px] text-gray-400 mt-0.5">
              This name applies to both Desktop and Mobile forms.
            </p>
          )}
        </div>
      </div>

      {currentForm && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Form Configuration Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#121829] border border-[#1e2942] rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between pb-3 mb-5 border-b border-[#1e2942]">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#2563eb]" />
                    Form Embed Settings
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Modifying Form ID automatically updates iframe attributes, URLs, and initialization scripts
                  </p>
                </div>

                {currentForm.lineNumber && (
                  <button
                    onClick={() => onJumpToCode?.(currentForm.lineNumber)}
                    className="text-xs text-violet-400 hover:underline flex items-center gap-1 font-mono"
                  >
                    <Code2 className="w-3 h-3" /> Line {currentForm.lineNumber}
                  </button>
                )}
              </div>

              {successMessage && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" /> {successMessage}
                </div>
              )}

              <form onSubmit={handleApplyChanges} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      GoHighLevel Form ID *
                    </label>
                    <input
                      type="text"
                      value={formIdInput}
                      onChange={e => setFormIdInput(e.target.value)}
                      placeholder="e.g. DuEWLBc3a3oXylBTrYC7"
                      className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#2563eb]"
                      required
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Unique alphanumeric GHL Form key</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Target Device Instance
                    </label>
                    <input
                      type="text"
                      value={currentForm.deviceTarget.toUpperCase()}
                      disabled
                      className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-lg px-3 py-2 text-xs text-gray-400 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Iframe Height (px)
                    </label>
                    <input
                      type="text"
                      value={heightInput}
                      onChange={e => setHeightInput(e.target.value)}
                      placeholder="1465"
                      className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#2563eb]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 mb-1">
                      Iframe Element ID
                    </label>
                    <input
                      type="text"
                      value={currentForm.iframeId}
                      disabled
                      className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-lg px-3 py-2 text-xs text-gray-400 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Form Embed Script URL
                  </label>
                  <input
                    type="text"
                    value={currentForm.embedScriptUrl}
                    disabled
                    className="w-full bg-[#0a0e1a] border border-[#1e2942] rounded-lg px-3 py-2 text-xs text-gray-400 font-mono"
                  />
                </div>

                <div className="pt-3 border-t border-[#1e2942] flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#2563eb] to-[#7c3aed] hover:from-[#1d4ed8] hover:to-[#6d28d9] text-white text-xs font-semibold shadow-md shadow-blue-950/40 transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" /> Save Form Configuration
                  </button>
                </div>
              </form>
            </div>

            {/* Preserved Custom JavaScript Scripts Display */}
            <div className="bg-[#121829] border border-[#1e2942] rounded-2xl p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1e2942]">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Preserved Custom Tracking & Token Scripts
                </h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                  SECURE & PRESERVED
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#0a0e1a] border border-[#1e2942] space-y-1">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>login_token Generation</span>
                    {currentForm.customScripts?.hasLoginToken ? (
                      <span className="text-[10px] text-emerald-400 font-mono">ACTIVE</span>
                    ) : (
                      <span className="text-[10px] text-gray-500 font-mono">NOT DETECTED</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Uses crypto.getRandomValues to generate 32-byte registration token cookie (<code className="text-violet-400">mega_test_registration</code>).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0a0e1a] border border-[#1e2942] space-y-1">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span>event_id Cookie Tracking</span>
                    {currentForm.customScripts?.hasEventId ? (
                      <span className="text-[10px] text-emerald-400 font-mono">ACTIVE (Desktop)</span>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-mono">Mobile uses login_token only</span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Preserves unique lead event tracking cookie across domain sessions (<code className="text-violet-400">event_id</code>).
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0a0e1a] border border-[#1e2942] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">GoHighLevel Form Closing Custom Value:</span>
                  {closingCustomValueInput.trim() !== (currentForm.customScripts?.closingCustomValue || '').trim() && (
                    <span className="text-[9px] bg-violet-600/20 text-violet-300 font-mono px-1.5 py-0.5 rounded border border-violet-500/30">
                      MODIFIED
                    </span>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={closingCustomValueInput}
                    onChange={e => setClosingCustomValueInput(e.target.value)}
                    placeholder="e.g. {{custom_values.gtagaming_gift_cards_form_closing}}"
                    style={{ color: '#a78bfa', backgroundColor: '#0e1426' }}
                    className="flex-1 min-w-0 bg-[#0e1426] border border-[#1e2942] focus:border-[#2563eb] rounded-lg px-3 py-2 text-xs font-mono text-violet-300 placeholder-gray-600 focus:outline-none shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={handleApplyClosingCustomValue}
                    disabled={
                      !closingCustomValueInput.trim() ||
                      closingCustomValueInput.trim() === (currentForm.customScripts?.closingCustomValue || '').trim()
                    }
                    className="px-3.5 py-2 bg-[#2563eb] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center gap-1 shrink-0 shadow-sm"
                    title="Apply custom value to scripts"
                  >
                    <Check className="w-3.5 h-3.5" /> Apply
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">
                  Triggers popup overlay and celebratory confetti only when campaign is open.
                </p>
              </div>
            </div>
          </div>

          {/* Right Col: Isolated Form Preview & Credentials Note */}
          <div className="space-y-6">
            <div className="bg-[#121829] border border-[#1e2942] rounded-2xl p-6 shadow-lg flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1e2942]">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#2563eb]" />
                    Form Preview
                  </h3>
                  <span className="text-[10px] text-gray-400 font-mono">
                    ID: {currentForm.formId}
                  </span>
                </div>

                <div className="h-80 bg-[#090a0f] rounded-xl border border-[#1f2638] overflow-hidden flex flex-col items-center justify-center p-4 relative">
                  <iframe
                    src={`https://link.megarewards.au/widget/form/${currentForm.formId}`}
                    title={currentForm.formName}
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    className="w-full h-full border-none rounded-lg"
                  />

                  {/* Fallback overlay in case of iframe embed domain blocks */}
                  <div className="absolute bottom-2 left-2 right-2 p-2 rounded-lg bg-black/85 text-[10px] text-gray-400 border border-gray-800 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <span>External GHL forms may restrict cross-origin framing in local preview mode.</span>
                  </div>
                </div>
              </div>

              {/* API Security Notice */}
              <div className="mt-4 p-3.5 rounded-xl bg-[#090a0f] border border-[#1f2638] text-[11px] text-gray-400 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Secure Offline Architecture
                </div>
                <p>
                  Landing Page Studio operates entirely offline via standard GoHighLevel iframe and script embeds without requiring sensitive private API keys or subscription tokens.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
