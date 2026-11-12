import React, { useState, useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import {
  Code2,
  Save,
  RotateCcw,
  Copy,
  Check,
  Search,
  FileCode,
  FileText,
  Braces,
  FileJson,
} from 'lucide-react';
import { Project } from '@shared/types';
import { ErrorBoundary } from '../components/ErrorBoundary';

interface CodeEditorPageProps {
  project: Project;
  initialLineNumber?: number;
  onSaveCode: (newHtml: string) => void;
  onAutoSyncCode?: (newHtml: string) => void;
}

type TabType = 'full' | 'html' | 'css' | 'js';

export const CodeEditorPage: React.FC<CodeEditorPageProps> = ({
  project,
  initialLineNumber,
  onSaveCode,
  onAutoSyncCode,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('full');
  const [code, setCode] = useState(project.currentHtml);
  const [copied, setCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const editorRef = useRef<any>(null);
  const latestCodeRef = useRef(project.currentHtml);
  const isSelfUpdateRef = useRef(false);
  const autoSyncTimeoutRef = useRef<any>(null);

  // Synchronize incoming external changes from Landing Page Editor or Form Manager into Monaco
  useEffect(() => {
    if (isSelfUpdateRef.current) {
      isSelfUpdateRef.current = false;
      return;
    }

    latestCodeRef.current = project.currentHtml;
    setCode(project.currentHtml);
    setHasChanges(false);

    if (editorRef.current) {
      const currentVal = editorRef.current.getValue();
      if (currentVal !== project.currentHtml) {
        const viewState = editorRef.current.saveViewState();
        editorRef.current.setValue(project.currentHtml);
        if (viewState) {
          editorRef.current.restoreViewState(viewState);
        }
      }
    }
  }, [project.currentHtml]);

  // Flush any pending unsynced code changes on unmount or tab switch
  useEffect(() => {
    return () => {
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current);
      }
      if (latestCodeRef.current !== project.currentHtml && onAutoSyncCode) {
        onAutoSyncCode(latestCodeRef.current);
      }
    };
  }, [project.currentHtml, onAutoSyncCode]);

  // Scroll to targeted line when initialLineNumber changes
  useEffect(() => {
    if (editorRef.current && initialLineNumber && initialLineNumber > 0) {
      editorRef.current.revealLineInCenter(initialLineNumber);
      editorRef.current.setPosition({ lineNumber: initialLineNumber, column: 1 });
      editorRef.current.focus();
    }
  }, [initialLineNumber]);

  const handleEditorDidMount: OnMount = (editor, _monaco) => {
    editorRef.current = editor;

    if (editor.getValue() !== project.currentHtml) {
      editor.setValue(project.currentHtml);
    }

    if (initialLineNumber && initialLineNumber > 0) {
      setTimeout(() => {
        editor.revealLineInCenter(initialLineNumber);
        editor.setPosition({ lineNumber: initialLineNumber, column: 1 });
        editor.focus();
      }, 150);
    }
  };

  const handleCodeChange = (value?: string) => {
    if (value !== undefined) {
      latestCodeRef.current = value;
      setCode(value);
      setHasChanges(value !== project.currentHtml);

      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current);
      }

      if (value !== project.currentHtml && onAutoSyncCode) {
        autoSyncTimeoutRef.current = setTimeout(() => {
          if (latestCodeRef.current !== project.currentHtml) {
            isSelfUpdateRef.current = true;
            onAutoSyncCode(latestCodeRef.current);
          }
        }, 400);
      }
    }
  };

  const handleSave = () => {
    try {
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current);
      }
      onSaveCode(code);
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      console.error('Failed to save code:', err);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFormat = () => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  };

  // Determine language mode based on tab
  const getLanguage = () => {
    switch (activeTab) {
      case 'css':
        return 'css';
      case 'js':
        return 'javascript';
      case 'html':
      case 'full':
      default:
        return 'html';
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-[#0a0e1a] overflow-hidden">
      {/* Top Editor Toolbar */}
      <div className="h-14 bg-[#0e1426] border-b border-[#1e2942] px-6 flex items-center justify-between z-10">
        {/* Left: Editor Tabs */}
        <div className="flex items-center gap-1.5 bg-[#121829] border border-[#1e2942] p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('full')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'full'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" /> Full Document
          </button>
          <button
            onClick={() => setActiveTab('html')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'html'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> HTML
          </button>
          <button
            onClick={() => setActiveTab('css')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'css'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Braces className="w-3.5 h-3.5" /> CSS
          </button>
          <button
            onClick={() => setActiveTab('js')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'js'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" /> JavaScript
          </button>
        </div>

        {/* Center: Line Number or Status Notice */}
        <div className="text-xs text-gray-400 font-mono">
          {initialLineNumber ? (
            <span className="text-violet-400 font-bold">Jumped to Line {initialLineNumber}</span>
          ) : (
            <span>Monaco Source-Preserving Editor</span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFormat}
            className="px-3 py-1.5 rounded-lg bg-[#121829] hover:bg-[#18223a] text-gray-300 text-xs font-medium border border-[#1e2942] transition-colors"
            title="Auto-format code document"
          >
            Format
          </button>

          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-[#121829] hover:bg-[#18223a] text-gray-300 text-xs font-medium border border-[#1e2942] transition-colors flex items-center gap-1"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy Code
              </>
            )}
          </button>

          {saveSuccess && (
            <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1 font-mono animate-fade-in">
              <Check className="w-3.5 h-3.5" /> Saved!
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#7c3aed] hover:from-[#1d4ed8] hover:to-[#6d28d9] disabled:opacity-40 text-white text-xs font-semibold shadow-md shadow-blue-950/40 transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Save className="w-3.5 h-3.5" /> Save Changes
          </button>
        </div>
      </div>

      {/* Editor Main Canvas */}
      <div className="flex-1 overflow-hidden relative">
        <ErrorBoundary
          fallbackTitle="Editor Fallback Mode"
          onReset={() => setCode(project.currentHtml)}
        >
          <Editor
            height="100%"
            language={getLanguage()}
            value={code}
            theme="vs-dark"
            onChange={handleCodeChange}
            onMount={handleEditorDidMount}
            loading={
              <div className="flex items-center justify-center h-full text-gray-500 font-mono text-xs">
                Loading Code Editor...
              </div>
            }
            options={{
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              lineNumbers: 'on',
              renderWhitespace: 'selection',
              smoothScrolling: true,
              bracketPairColorization: { enabled: true },
            }}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
};
