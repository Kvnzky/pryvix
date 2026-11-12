import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { NewProjectModal } from './components/NewProjectModal';
import { Dashboard } from './pages/Dashboard';
import { ProjectsPage } from './pages/ProjectsPage';
import { ImageLibraryPage } from './pages/ImageLibraryPage';
import { VisualEditorPage } from './pages/VisualEditorPage';
import { FormManagerPage } from './pages/FormManagerPage';
import { CodeEditorPage } from './pages/CodeEditorPage';
import { ExportValidationPage } from './pages/ExportValidationPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  Project,
  ImageAsset,
  GHLForm,
  ComponentSection,
  ChangeHistoryEntry,
  BackgroundConfig,
  ReadMoreSectionConfig,
  SupportedSectionType,
} from '@shared/types';
import {
  initStorage,
  getAllProjects,
  getActiveProjectId,
  setActiveProjectId,
  getFullProject,
  saveProject,
  createProjectFromHtml,
  duplicateProject,
  deleteProject,
  getHistory,
  addHistoryEntry,
  getImageLibrary,
  renameProject,
} from './lib/storage';
import {
  analyzeHtml,
  replaceImageUrlInHtml,
  updateGHLFormInHtml,
  applyBackgroundModeToHtml,
  updateStaticCampaignDetailsUrlsInHtml,
  updateVideoUrlsInHtml,
  detectBackgroundModeInHtml,
  extractBackgroundConfig,
  updateSharedFormTitleInHtml,
  resolveSharedFormTitle,
} from '@shared/parser';
import {
  toggleSectionVisibilityInHtml,
  updateReadMoreButtonInHtml,
  addSectionToHtml,
  removeSectionFromHtml,
} from '@shared/sectionManager';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectIdState, setActiveProjectIdState] = useState<string | null>(null);

  // Active project data
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<ImageAsset[]>([]);
  const [forms, setForms] = useState<GHLForm[]>([]);
  const [sections, setSections] = useState<ComponentSection[]>([]);
  const [history, setHistory] = useState<ChangeHistoryEntry[]>([]);

  // Jump to code target line
  const [targetCodeLine, setTargetCodeLine] = useState<number | undefined>(undefined);

  // Undo/Redo stack for current session
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);

  // Modals
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formManagerValidationError, setFormManagerValidationError] = useState<string | null>(null);

  // Refresh project list from storage
  const refreshProjectsList = useCallback(() => {
    const list = getAllProjects();
    setProjects(list);
    return list;
  }, []);

  // Load project by ID
  const loadProject = useCallback((id: string) => {
    const full = getFullProject(id);
    if (!full) return;

    setActiveProject(full.project);
    setAssets(full.assets);
    setForms(full.forms);
    setSections(full.sections);
    setActiveProjectId(id);
    setActiveProjectIdState(id);
    setHistory(getHistory(id));
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  // Preserve originalUrl across HTML re-analysis so AssetCard MODIFIED state, restore Original, and Export Fidelity Audit remain accurate
  const preserveOriginalAssetUrls = useCallback(
    (reanalyzedAssets: ImageAsset[], prevAssets: ImageAsset[], originalHtml: string, projectId: string): ImageAsset[] => {
      const origAnalysis = analyzeHtml(originalHtml, projectId);
      return reanalyzedAssets.map((asset, idx) => {
        const matchFromOrig =
          origAnalysis.assets.find(
            oa => oa.role === asset.role && oa.device === asset.device && oa.type === asset.type && oa.label === asset.label
          ) || origAnalysis.assets[idx];
        const matchFromPrev =
          prevAssets.find(
            pa => pa.role === asset.role && pa.device === asset.device && pa.type === asset.type && pa.label === asset.label
          ) || prevAssets[idx];
        const trueOriginalUrl = matchFromOrig?.originalUrl || matchFromPrev?.originalUrl || asset.originalUrl;
        return {
          ...asset,
          originalUrl: trueOriginalUrl,
          replacementUrl: asset.currentUrl !== trueOriginalUrl ? asset.currentUrl : undefined,
        };
      });
    },
    []
  );

  // Initialize on mount
  useEffect(() => {
    initStorage().then(() => {
      const list = refreshProjectsList();
      const storedActiveId = getActiveProjectId();
      if (storedActiveId && list.some(p => p.id === storedActiveId)) {
        loadProject(storedActiveId);
      } else if (list.length > 0) {
        loadProject(list[0].id);
      }
    });
  }, [refreshProjectsList, loadProject]);

  // Handle Project Selection from Header / Dashboard
  const handleSelectProject = (id: string) => {
    loadProject(id);
  };

  // Push state to undo stack before mutation
  const pushUndo = (prevHtml: string) => {
    setUndoStack(prev => [prevHtml, ...prev.slice(0, 30)]);
    setRedoStack([]);
  };

  // Centralized Authoritative Project HTML Update Pipeline
  const applyAuthoritativeHtmlUpdate = useCallback(
    (
      newHtml: string,
      options: {
        origin: 'editor' | 'forms' | 'code' | 'system';
        component?: string;
        description?: string;
        prevValue?: string;
        newValue?: string;
        type?: ChangeHistoryEntry['type'];
        pushToUndo?: boolean;
        extraProjectUpdates?: Partial<Project>;
      }
    ) => {
      if (!activeProject) return;
      if (newHtml === activeProject.currentHtml && !options.extraProjectUpdates) return;

      if (options.pushToUndo) {
        pushUndo(activeProject.currentHtml);
      }

      const reanalysis = analyzeHtml(newHtml, activeProject.id);
      const preservedAssets = preserveOriginalAssetUrls(
        reanalysis.assets,
        assets,
        activeProject.originalHtml,
        activeProject.id
      );

      const preservedTitle = (
        options.extraProjectUpdates?.formTitle ||
        activeProject.formTitle ||
        ''
      ).trim();
      if (preservedTitle) {
        reanalysis.forms.forEach(f => {
          if (!f.formName || f.formName.trim() === '') {
            f.formName = preservedTitle;
          }
        });
      }

      const updatedProject: Project = {
        ...activeProject,
        currentHtml: newHtml,
        updatedAt: new Date().toISOString(),
        assetCount: preservedAssets.length,
        formCount: reanalysis.forms.length,
        backgroundConfiguration:
          options.extraProjectUpdates?.backgroundConfiguration ||
          extractBackgroundConfig(newHtml),
        formTitle: preservedTitle || activeProject.formTitle,
        ...options.extraProjectUpdates,
      };

      setActiveProject(updatedProject);
      setAssets(preservedAssets);
      setForms(reanalysis.forms);
      setSections(reanalysis.sections);

      saveProject(updatedProject, preservedAssets, reanalysis.forms, reanalysis.sections);

      if (options.description) {
        addHistoryEntry(activeProject.id, {
          projectId: activeProject.id,
          component: options.component || 'Landing Page Studio',
          description: options.description,
          prevValue: options.prevValue || '',
          newValue: options.newValue || '',
          type: options.type || 'code_edit',
        });
        setHistory(getHistory(activeProject.id));
      }
    },
    [activeProject, assets, preserveOriginalAssetUrls, pushUndo]
  );

  // Replace Asset Image URL
  const handleReplaceImageUrl = (assetId: string, newUrl: string) => {
    if (!activeProject) return;
    const targetAsset = assets.find(a => a.id === assetId);
    if (!targetAsset || targetAsset.currentUrl === newUrl) return;

    const updatedHtml = replaceImageUrlInHtml(activeProject.currentHtml, targetAsset, newUrl);
    applyAuthoritativeHtmlUpdate(updatedHtml, {
      origin: 'editor',
      component: targetAsset.label,
      description: `Replaced image URL for ${targetAsset.label}`,
      prevValue: targetAsset.currentUrl,
      newValue: newUrl,
      type: 'image_url',
      pushToUndo: true,
      extraProjectUpdates: {
        backgroundConfiguration: extractBackgroundConfig(updatedHtml),
      },
    });
  };

  // Restore Original Image URL
  const handleRestoreOriginalImage = (assetId: string) => {
    const targetAsset = assets.find(a => a.id === assetId);
    if (!targetAsset || !targetAsset.originalUrl) return;
    handleReplaceImageUrl(assetId, targetAsset.originalUrl);
  };

  // Update Shared Form Title across project and both forms
  const handleUpdateSharedFormTitle = (newTitle: string) => {
    if (!activeProject) return;
    const trimmed = newTitle.trim();
    if (!trimmed) {
      setFormManagerValidationError('Form Title / Name is required. Please enter a name before continuing.');
      return;
    }
    setFormManagerValidationError(null);

    const updatedHtml = updateSharedFormTitleInHtml(activeProject.currentHtml, trimmed);
    applyAuthoritativeHtmlUpdate(updatedHtml, {
      origin: 'forms',
      component: 'Form Title / Name',
      description: `Updated shared Form Title / Name to "${trimmed}"`,
      prevValue: activeProject.formTitle || '',
      newValue: trimmed,
      type: 'form_setting',
      pushToUndo: true,
      extraProjectUpdates: { formTitle: trimmed },
    });
    refreshProjectsList();
  };

  // Update GHL Form
  const handleUpdateForm = (
    formId: string,
    updates: {
      formId?: string;
      formName?: string;
      height?: string | number;
      closingCustomValue?: string;
    }
  ) => {
    if (!activeProject) return;
    const targetForm = forms.find(f => f.id === formId);
    if (!targetForm) return;

    const updatedHtml = updateGHLFormInHtml(activeProject.currentHtml, targetForm, updates);
    const currentSharedTitle = (updates.formName !== undefined ? updates.formName : activeProject.formTitle) || '';

    applyAuthoritativeHtmlUpdate(updatedHtml, {
      origin: 'forms',
      component: targetForm.formName || 'GoHighLevel Form',
      description: `Updated GHL Form settings: ${updates.formId || updates.formName || updates.closingCustomValue || 'attributes'}`,
      prevValue: targetForm.formId,
      newValue: updates.formId || updates.closingCustomValue || '',
      type: 'form_id',
      pushToUndo: true,
      extraProjectUpdates: {
        formTitle: currentSharedTitle || activeProject.formTitle,
      },
    });
  };

  // Update Background Mode and URLs (Option B strict implementation)
  const handleUpdateBackgroundConfig = (newConfig: BackgroundConfig) => {
    if (!activeProject) return;
    let updatedHtml = activeProject.currentHtml;
    const currentMode = activeProject.backgroundConfiguration?.mode || detectBackgroundModeInHtml(updatedHtml);

    if (newConfig.mode !== currentMode) {
      updatedHtml = applyBackgroundModeToHtml(updatedHtml, newConfig.mode, newConfig);
    } else {
      if (newConfig.mode === 'static') {
        updatedHtml = updateStaticCampaignDetailsUrlsInHtml(
          updatedHtml,
          newConfig.static.desktopImage,
          newConfig.static.mobileImage
        );
      } else {
        updatedHtml = updateVideoUrlsInHtml(
          updatedHtml,
          newConfig.video.desktopVideo,
          newConfig.video.mobileVideo
        );
      }
    }

    applyAuthoritativeHtmlUpdate(updatedHtml, {
      origin: 'editor',
      component: 'Background Implementation Mode',
      description: `Switched / updated background mode to ${newConfig.mode.toUpperCase()}`,
      prevValue: currentMode,
      newValue: newConfig.mode,
      type: 'code_edit',
      pushToUndo: true,
      extraProjectUpdates: {
        backgroundConfiguration: newConfig,
      },
    });
  };

  // Toggle Section Visibility
  const handleToggleSectionVisibility = (sectionId: string, visible: boolean) => {
    if (!activeProject) return;
    const updatedHtml = toggleSectionVisibilityInHtml(activeProject.currentHtml, sectionId, visible);
    const reanalysis = analyzeHtml(updatedHtml, activeProject.id);
    const hiddenIds = reanalysis.sections.filter(s => s.visible === false).map(s => s.id);

    applyAuthoritativeHtmlUpdate(updatedHtml, {
      origin: 'editor',
      component: `Section: ${sectionId}`,
      description: `${visible ? 'Showed' : 'Hid'} section ${sectionId}`,
      prevValue: (!visible).toString(),
      newValue: visible.toString(),
      type: 'code_edit',
      pushToUndo: true,
      extraProjectUpdates: {
        sectionSettings: {
          hiddenSectionIds: hiddenIds,
          customSections: activeProject.sectionSettings?.customSections || [],
        },
      },
    });
  };

  // Update Read More Button Configuration
  const handleUpdateReadMoreConfig = (newConfig: ReadMoreSectionConfig) => {
    if (!activeProject) return;
    const updatedHtml = updateReadMoreButtonInHtml(activeProject.currentHtml, newConfig);

    applyAuthoritativeHtmlUpdate(updatedHtml, {
      origin: 'editor',
      component: 'Read More Button',
      description: 'Updated responsive Read More Button styling and URLs',
      prevValue: activeProject.readMoreConfiguration?.desktop?.url || '',
      newValue: newConfig.desktop.url || '',
      type: 'code_edit',
      pushToUndo: true,
      extraProjectUpdates: {
        readMoreConfiguration: newConfig,
      },
    });
  };

  // Add Supported Section
  const handleAddSection = (sectionType: SupportedSectionType) => {
    if (!activeProject) return;
    const updatedHtml = addSectionToHtml(activeProject.currentHtml, sectionType);

    applyAuthoritativeHtmlUpdate(updatedHtml, {
      origin: 'editor',
      component: 'Section Manager',
      description: `Added supported section ${sectionType}`,
      prevValue: '',
      newValue: sectionType,
      type: 'code_edit',
      pushToUndo: true,
    });
  };

  // Remove Custom Section
  const handleRemoveSection = (sectionId: string) => {
    if (!activeProject) return;
    const updatedHtml = removeSectionFromHtml(activeProject.currentHtml, sectionId);

    applyAuthoritativeHtmlUpdate(updatedHtml, {
      origin: 'editor',
      component: 'Section Manager',
      description: `Removed section ${sectionId}`,
      prevValue: sectionId,
      newValue: '',
      type: 'code_edit',
      pushToUndo: true,
    });
  };

  // Direct Code Editor Save
  const handleSaveCode = (newHtml: string, desc?: string) => {
    if (!activeProject) return;
    applyAuthoritativeHtmlUpdate(newHtml, {
      origin: 'code',
      component: 'Monaco Code Editor',
      description: desc || 'Direct code edits applied and re-analyzed',
      prevValue: '',
      newValue: 'Code Update',
      type: 'code_edit',
      pushToUndo: true,
    });
  };

  // Real-Time Auto-Sync from Code Editor (without undo spam)
  const handleAutoSyncCode = (newHtml: string) => {
    if (!activeProject) return;
    applyAuthoritativeHtmlUpdate(newHtml, {
      origin: 'code',
      pushToUndo: false,
    });
  };

  // Quick Manual Save
  const handleManualSave = () => {
    if (!activeProject) return;
    const sharedTitle = (activeProject.formTitle || '').trim();
    if (!sharedTitle) {
      setCurrentTab('forms');
      setFormManagerValidationError('Form Title / Name is required. Please enter a name before continuing.');
      return;
    }
    setFormManagerValidationError(null);
    setIsSaving(true);
    saveProject(activeProject, assets, forms, sections);
    setTimeout(() => {
      setIsSaving(false);
      refreshProjectsList();
    }, 400);
  };

  // Undo Action
  const handleUndo = () => {
    if (!activeProject || undoStack.length === 0) return;
    const [prevHtml, ...restUndo] = undoStack;
    setRedoStack(prev => [activeProject.currentHtml, ...prev]);
    setUndoStack(restUndo);

    const reanalysis = analyzeHtml(prevHtml, activeProject.id);
    const preservedAssets = preserveOriginalAssetUrls(
      reanalysis.assets,
      assets,
      activeProject.originalHtml,
      activeProject.id
    );
    const updatedProject: Project = {
      ...activeProject,
      currentHtml: prevHtml,
      updatedAt: new Date().toISOString(),
      backgroundConfiguration: extractBackgroundConfig(prevHtml),
    };

    setActiveProject(updatedProject);
    setAssets(preservedAssets);
    setForms(reanalysis.forms);
    setSections(reanalysis.sections);

    saveProject(updatedProject, preservedAssets, reanalysis.forms, reanalysis.sections);
  };

  // Redo Action
  const handleRedo = () => {
    if (!activeProject || redoStack.length === 0) return;
    const [nextHtml, ...restRedo] = redoStack;
    setUndoStack(prev => [activeProject.currentHtml, ...prev]);
    setRedoStack(restRedo);

    const reanalysis = analyzeHtml(nextHtml, activeProject.id);
    const preservedAssets = preserveOriginalAssetUrls(
      reanalysis.assets,
      assets,
      activeProject.originalHtml,
      activeProject.id
    );
    const updatedProject: Project = {
      ...activeProject,
      currentHtml: nextHtml,
      updatedAt: new Date().toISOString(),
      backgroundConfiguration: extractBackgroundConfig(nextHtml),
    };

    setActiveProject(updatedProject);
    setAssets(preservedAssets);
    setForms(reanalysis.forms);
    setSections(reanalysis.sections);

    saveProject(updatedProject, preservedAssets, reanalysis.forms, reanalysis.sections);
  };

  // Create Project
  const handleCreateProject = (
    name: string,
    campaignName: string,
    description: string,
    html: string,
    isImport?: boolean,
    formTitle?: string
  ) => {
    const newProj = createProjectFromHtml(name, campaignName, description, html, isImport, formTitle);
    refreshProjectsList();
    loadProject(newProj.id);
    setCurrentTab('editor');
  };

  // Duplicate Project
  const handleDuplicateProject = (id: string) => {
    const dup = duplicateProject(id);
    if (dup) {
      refreshProjectsList();
      loadProject(dup.id);
    }
  };

  // Delete Project
  const handleDeleteProject = (id: string) => {
    deleteProject(id);
    const list = refreshProjectsList();
    if (list.length > 0) {
      loadProject(list[0].id);
    } else {
      setActiveProject(null);
      setAssets([]);
      setForms([]);
      setSections([]);
    }
  };

  // Update Project Metadata
  const handleUpdateProjectMeta = (
    id: string,
    name: string,
    campaignName: string,
    description: string
  ) => {
    const full = getFullProject(id);
    if (!full) return;

    const updatedProj: Project = {
      ...full.project,
      name,
      campaignName,
      description,
      updatedAt: new Date().toISOString(),
    };

    saveProject(updatedProj, full.assets, full.forms, full.sections);
    refreshProjectsList();
    if (activeProject?.id === id) {
      setActiveProject(updatedProj);
    }
  };

  // Rename Project handler
  const handleRenameProject = (newName: string) => {
    if (!activeProject) return;
    const updated = renameProject(activeProject.id, newName);
    if (updated) {
      setActiveProject(updated);
      refreshProjectsList();
    }
  };

  // Jump to code navigation handler
  const handleJumpToCode = (lineNumber?: number) => {
    setTargetCodeLine(lineNumber);
    setCurrentTab('code');
  };

  const handleTriggerExport = () => {
    if (!activeProject) return;
    const sharedTitle = (activeProject.formTitle || '').trim();
    if (!sharedTitle) {
      setCurrentTab('forms');
      setFormManagerValidationError('Form Title / Name is required. Please enter a name before continuing.');
      return;
    }
    setFormManagerValidationError(null);
    setCurrentTab('export');
  };

  const libraryImages = getImageLibrary();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0e1a] text-gray-100">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        activeProject={activeProject}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          projects={projects}
          activeProject={activeProject}
          onSelectProject={handleSelectProject}
          onRenameProject={handleRenameProject}
          onOpenNewModal={() => setIsNewProjectModalOpen(true)}
          onSave={handleManualSave}
          onUndo={handleUndo}
          onRedo={handleRedo}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
          onExportTab={handleTriggerExport}
          onQuickExport={handleTriggerExport}
          isSaving={isSaving}
        />

        {/* View Switcher */}
        <main className="flex-1 overflow-hidden relative">
          <ErrorBoundary fallbackTitle="Active View Encountered an Error">
            {currentTab === 'dashboard' && (
              <Dashboard
                projects={projects}
                activeProject={activeProject}
                assets={assets}
                forms={forms}
                libraryCount={libraryImages.length}
                onSelectProject={handleSelectProject}
                onRenameProject={handleRenameProject}
                onOpenNewModal={() => setIsNewProjectModalOpen(true)}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'projects' && (
              <ProjectsPage
                projects={projects}
                activeProject={activeProject}
                onSelectProject={handleSelectProject}
                onOpenNewModal={() => setIsNewProjectModalOpen(true)}
                onDuplicateProject={handleDuplicateProject}
                onDeleteProject={handleDeleteProject}
                onUpdateProjectMeta={handleUpdateProjectMeta}
                onRefreshProjects={refreshProjectsList}
              />
            )}

            {currentTab === 'library' && <ImageLibraryPage />}

            {currentTab === 'editor' && activeProject && (
              <VisualEditorPage
                project={activeProject}
                assets={assets}
                sections={sections}
                onReplaceUrl={handleReplaceImageUrl}
                onRestoreOriginal={handleRestoreOriginalImage}
                onJumpToCode={handleJumpToCode}
                onUpdateBackgroundConfig={handleUpdateBackgroundConfig}
                onToggleSectionVisibility={handleToggleSectionVisibility}
                onUpdateReadMoreConfig={handleUpdateReadMoreConfig}
                onAddSection={handleAddSection}
                onRemoveSection={handleRemoveSection}
              />
            )}

            {currentTab === 'forms' && activeProject && (
              <FormManagerPage
                project={activeProject}
                forms={forms}
                onUpdateForm={handleUpdateForm}
                onUpdateSharedFormTitle={handleUpdateSharedFormTitle}
                onJumpToCode={handleJumpToCode}
                externalValidationError={formManagerValidationError}
              />
            )}

            {currentTab === 'code' && activeProject && (
              <CodeEditorPage
                project={activeProject}
                initialLineNumber={targetCodeLine}
                onSaveCode={handleSaveCode}
                onAutoSyncCode={handleAutoSyncCode}
              />
            )}

            {currentTab === 'export' && activeProject && (
              <ExportValidationPage
                project={activeProject}
                assets={assets}
                forms={forms}
                history={history}
                onJumpToCode={handleJumpToCode}
                onUpdateHtml={(newHtml, desc) => handleSaveCode(newHtml, desc)}
                onNavigateTab={setCurrentTab}
              />
            )}

            {currentTab === 'settings' && <SettingsPage />}
          </ErrorBoundary>
        </main>
      </div>

      {/* New Project Modal */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}
