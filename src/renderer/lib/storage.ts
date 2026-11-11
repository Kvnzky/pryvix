import {
  Project,
  ImageAsset,
  GHLForm,
  ComponentSection,
  ChangeHistoryEntry,
  LibraryImage,
  ProjectBackup,
  PortableSettings,
  MissingAssetInfo,
  BackgroundConfig,
  ReferenceTemplate,
} from '@shared/types';
import {
  analyzeHtml,
  sanitizeProjectNameForFilename,
  detectBackgroundModeInHtml,
  extractBackgroundConfig,
  resolveSharedFormTitle,
  updateSharedFormTitleInHtml,
} from '@shared/parser';
import {
  DEFAULT_STATIC_DESKTOP_IMAGE,
  DEFAULT_STATIC_MOBILE_IMAGE,
  DEFAULT_VIDEO_DESKTOP_URL,
  DEFAULT_VIDEO_MOBILE_URL,
  BUNDLED_STATIC_REFERENCE_HTML,
  BUNDLED_VIDEO_REFERENCE_HTML,
} from '@shared/referenceTemplates';
import JSZip from 'jszip';

const PROJECTS_KEY = 'lp_studio_projects';
const PROJECT_PREFIX = 'lp_studio_project_';
const HISTORY_PREFIX = 'lp_studio_history_';
const LIBRARY_KEY = 'lp_studio_image_library';
const ACTIVE_PROJECT_KEY = 'lp_studio_active_project_id';
const SETTINGS_KEY = 'lp_studio_portable_settings';
const REFERENCE_TEMPLATES_KEY = 'lp_studio_reference_templates';

export interface FullProjectData {
  project: Project;
  assets: ImageAsset[];
  forms: GHLForm[];
  sections: ComponentSection[];
}

export async function initStorage(): Promise<void> {
  // If electronAPI is present, attempt to load projects from portable disk directory
  if (typeof window !== 'undefined' && window.electronAPI) {
    try {
      const diskProjects = await window.electronAPI.loadAllProjectsPortable();
      if (Array.isArray(diskProjects) && diskProjects.length > 0) {
        const parsedProjects: FullProjectData[] = [];
        diskProjects.forEach(raw => {
          try {
            const data: FullProjectData = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (data && data.project && data.project.id) {
              localStorage.setItem(PROJECT_PREFIX + data.project.id, JSON.stringify(data));
              parsedProjects.push(data);
            }
          } catch (err) {
            console.warn('Skipping invalid project file from portable disk:', err);
          }
        });
        if (parsedProjects.length > 0) {
          const diskList = parsedProjects.map(d => d.project);
          localStorage.setItem(PROJECTS_KEY, JSON.stringify(diskList));
        }
      }
    } catch (e) {
      console.warn('Failed to sync portable projects on init:', e);
    }
  }

  // If no projects exist, initialize with Gaming Gift Cards Giveaway from reference HTML
  const existingProjects = getAllProjects();
  if (existingProjects.length === 0) {
    const id = 'proj_gaming_gift_cards';
    const analysis = analyzeHtml(BUNDLED_STATIC_REFERENCE_HTML, id);

    // Initial project Form Title / Name must be completely blank by default
    analysis.forms.forEach(f => {
      f.formName = '';
    });

    const initialProject: Project = {
      id,
      name: 'Gaming Gift Cards Giveaway',
      campaignName: 'Mega Rewards EDM Campaign',
      formTitle: '',
      description: 'Reference GoHighLevel landing page with dual desktop/mobile forms, background slider, and responsive assets.',
      originalHtml: BUNDLED_STATIC_REFERENCE_HTML,
      currentHtml: BUNDLED_STATIC_REFERENCE_HTML,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'ready',
      assetCount: analysis.assets.length,
      formCount: analysis.forms.length,
      syncTitleWithProjectName: true,
      backgroundConfiguration: {
        mode: 'static',
        static: {
          desktopImage: DEFAULT_STATIC_DESKTOP_IMAGE,
          mobileImage: DEFAULT_STATIC_MOBILE_IMAGE,
        },
        video: {
          desktopVideo: DEFAULT_VIDEO_DESKTOP_URL,
          mobileVideo: DEFAULT_VIDEO_MOBILE_URL,
        },
        referenceFiles: {
          static: 'LP Reference-static Campaign Details Background.txt',
          video: 'LP Reference-video Campaign Details Background.txt',
        },
      },
    };

    saveProject(initialProject, analysis.assets, analysis.forms, analysis.sections);
    setActiveProjectId(id);

    // Populate initial library with sample assets
    const initialImages: Omit<LibraryImage, 'id' | 'createdAt'>[] = [
      {
        name: 'Hero Desktop Slide',
        category: 'Hero Images',
        localPath: '',
        externalUrl: 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed144bfb31f444f25c3867.jpg',
        mimeType: 'image/jpeg',
        fileSize: 450200,
      },
      {
        name: 'Hero Mobile Slide',
        category: 'Mobile Images',
        localPath: '',
        externalUrl: 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed1e7042ff25478ce192ae.jpg',
        mimeType: 'image/jpeg',
        fileSize: 220100,
      },
      {
        name: 'Hero Branding Desktop',
        category: 'Desktop Images',
        localPath: '',
        externalUrl: 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed6fc9fb31f444f265938f.png',
        mimeType: 'image/png',
        fileSize: 580000,
      },
      {
        name: 'Hero Branding Mobile',
        category: 'Mobile Images',
        localPath: '',
        externalUrl: 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed6fc9fb31f444f2659390.png',
        mimeType: 'image/png',
        fileSize: 310000,
      },
      {
        name: 'Prize Banner Desktop',
        category: 'Campaign Banners',
        localPath: '',
        externalUrl: 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aed6b4bfb31f444f265208c.jpg',
        mimeType: 'image/jpeg',
        fileSize: 390400,
      },
      {
        name: 'Scroll to Top Icon',
        category: 'Icons',
        localPath: '',
        externalUrl: 'https://assets.cdn.filesafe.space/tSCoUOTHrXglK2BwDeYc/media/6aac3341254a2c54081a0dba.png',
        mimeType: 'image/png',
        fileSize: 18400,
      },
    ];

    initialImages.forEach(img => addImageToLibrary(img));
  }
}

export function getAllProjects(): Project[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    const list: Project[] = raw ? JSON.parse(raw) : [];
    return list.map(p => {
      if (!p.backgroundConfiguration) {
        p.backgroundConfiguration = extractBackgroundConfig(p.currentHtml || '');
      }
      return p;
    });
  } catch {
    return [];
  }
}

export function getActiveProjectId(): string | null {
  return localStorage.getItem(ACTIVE_PROJECT_KEY);
}

export function setActiveProjectId(id: string): void {
  localStorage.setItem(ACTIVE_PROJECT_KEY, id);
}

export function getFullProject(id: string): FullProjectData | null {
  try {
    const raw = localStorage.getItem(PROJECT_PREFIX + id);
    if (!raw) return null;
    const parsed: FullProjectData = JSON.parse(raw);
    if (parsed && parsed.project && !parsed.project.backgroundConfiguration) {
      parsed.project.backgroundConfiguration = extractBackgroundConfig(parsed.project.currentHtml || '');
    }

    // Clean any legacy suffixes and apply sensible shared Form Title migration strategy
    if (parsed && parsed.project && parsed.forms) {
      // Clean legacy suffixes from forms
      parsed.forms.forEach(f => {
        if (f.formName) {
          f.formName = f.formName.replace(/\s*\((?:Desktop|Mobile)\)/gi, '').trim();
          if (
            /^(gohighlevel\s*form|form|untitled(\s*form)?)$/i.test(f.formName) ||
            (id === 'proj_gaming_gift_cards' && f.formName === 'GTA/Gaming Gift Cards - EDM')
          ) {
            f.formName = '';
          }
        }
      });

      // Migrate to one shared formTitle: prefer existing project.formTitle, then desktop form, then mobile form
      const sharedTitle = resolveSharedFormTitle(parsed.project.formTitle, parsed.forms);
      parsed.project.formTitle = sharedTitle;
      parsed.forms.forEach(f => {
        f.formName = sharedTitle;
      });
    }
    return parsed;
  } catch {
    return null;
  }
}

// Background Reference Templates Management
export function getReferenceTemplates(): ReferenceTemplate[] {
  try {
    const raw = localStorage.getItem(REFERENCE_TEMPLATES_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse saved reference templates:', e);
  }

  const defaults: ReferenceTemplate[] = [
    {
      id: 'static',
      name: 'Static Campaign Details Background',
      filename: 'LP Reference-static Campaign Details Background.txt',
      description: 'Reference implementation featuring static background images in the Campaign Details Section.',
      content: BUNDLED_STATIC_REFERENCE_HTML,
      lastModified: new Date().toISOString(),
      isCustom: false,
    },
    {
      id: 'video',
      name: 'Video Background Reference',
      filename: 'LP Reference-video Campaign Details Background.txt',
      description: 'Reference implementation featuring dual desktop & mobile video background in Hero Background Section (.hero-bg-slider).',
      content: BUNDLED_VIDEO_REFERENCE_HTML,
      lastModified: new Date().toISOString(),
      isCustom: false,
    },
  ];

  localStorage.setItem(REFERENCE_TEMPLATES_KEY, JSON.stringify(defaults));
  return defaults;
}

export function updateReferenceTemplate(id: 'static' | 'video', content: string): ReferenceTemplate {
  const templates = getReferenceTemplates();
  const idx = templates.findIndex(t => t.id === id);
  if (idx !== -1) {
    templates[idx].content = content;
    templates[idx].lastModified = new Date().toISOString();
    templates[idx].isCustom = true;
    localStorage.setItem(REFERENCE_TEMPLATES_KEY, JSON.stringify(templates));
    return templates[idx];
  }
  throw new Error(`Template with id ${id} not found.`);
}

export function restoreReferenceTemplate(id: 'static' | 'video'): ReferenceTemplate {
  const templates = getReferenceTemplates();
  const idx = templates.findIndex(t => t.id === id);
  const bundledContent = id === 'static' ? BUNDLED_STATIC_REFERENCE_HTML : BUNDLED_VIDEO_REFERENCE_HTML;
  if (idx !== -1) {
    templates[idx].content = bundledContent;
    templates[idx].lastModified = new Date().toISOString();
    templates[idx].isCustom = false;
    localStorage.setItem(REFERENCE_TEMPLATES_KEY, JSON.stringify(templates));
    return templates[idx];
  }
  throw new Error(`Template with id ${id} not found.`);
}

export function saveProject(
  project: Project,
  assets: ImageAsset[],
  forms: GHLForm[],
  sections: ComponentSection[]
): void {
  // Update project updatedAt and counts
  const updatedProject: Project = {
    ...project,
    updatedAt: new Date().toISOString(),
    assetCount: assets.length,
    formCount: forms.length,
  };

  const fullData: FullProjectData = {
    project: updatedProject,
    assets,
    forms,
    sections,
  };

  localStorage.setItem(PROJECT_PREFIX + project.id, JSON.stringify(fullData));

  // Update projects list
  const list = getAllProjects();
  const index = list.findIndex(p => p.id === project.id);
  if (index >= 0) {
    list[index] = updatedProject;
  } else {
    list.unshift(updatedProject);
  }
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));

  // Sync to portable disk storage when in Electron
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.saveProjectPortable(project.id, JSON.stringify(fullData)).catch(err => {
      console.warn('Could not save project to portable disk:', err);
    });
  }
}

export function renameProject(id: string, newName: string): Project | null {
  const full = getFullProject(id);
  if (!full) return null;
  const trimmed = newName.trim();
  if (!trimmed || trimmed === full.project.name) return full.project;

  const prevName = full.project.name;
  const updatedProject: Project = {
    ...full.project,
    name: trimmed,
    updatedAt: new Date().toISOString(),
  };

  saveProject(updatedProject, full.assets, full.forms, full.sections);

  addHistoryEntry(id, {
    projectId: id,
    component: 'Project Name',
    description: `Renamed project from "${prevName}" to "${trimmed}"`,
    prevValue: prevName,
    newValue: trimmed,
    type: 'text',
  });

  return updatedProject;
}

export function createProjectFromHtml(
  name: string,
  campaignName: string,
  description: string,
  html: string,
  isImport: boolean = false,
  formTitleInput?: string
): Project {
  const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const analysis = analyzeHtml(html, id);

  let sharedTitle = '';
  if (formTitleInput !== undefined && formTitleInput.trim()) {
    sharedTitle = formTitleInput.trim();
  } else if (isImport) {
    sharedTitle = resolveSharedFormTitle(undefined, analysis.forms);
  } else {
    sharedTitle = '';
  }

  // Both forms share the exact same formTitle
  analysis.forms.forEach(f => {
    f.formName = sharedTitle;
  });

  const finalHtml = sharedTitle ? updateSharedFormTitleInHtml(html, sharedTitle) : html;

  const newProject: Project = {
    id,
    name: name.trim() || 'Untitled Project',
    campaignName: campaignName.trim() || 'General Campaign',
    description: description.trim(),
    originalHtml: finalHtml,
    currentHtml: finalHtml,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'draft',
    assetCount: analysis.assets.length,
    formCount: analysis.forms.length,
    formTitle: sharedTitle,
    backgroundConfiguration: extractBackgroundConfig(finalHtml),
  };

  saveProject(newProject, analysis.assets, analysis.forms, analysis.sections);
  setActiveProjectId(id);

  addHistoryEntry(id, {
    projectId: id,
    component: 'Project Initialization',
    description: `Created project with ${analysis.assets.length} images and ${analysis.forms.length} GHL forms`,
    prevValue: '',
    newValue: 'Initial Import',
    type: 'restore',
  });

  return newProject;
}

export function duplicateProject(id: string): Project | null {
  const existing = getFullProject(id);
  if (!existing) return null;

  const newId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const duplicatedProject: Project = {
    ...existing.project,
    id: newId,
    name: `${existing.project.name} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const remappedAssets = existing.assets.map(a => ({
    ...a,
    id: `asset_${Math.random().toString(36).substring(2, 9)}`,
    projectId: newId,
  }));

  const remappedForms = existing.forms.map(f => ({
    ...f,
    id: `form_${Math.random().toString(36).substring(2, 9)}`,
    projectId: newId,
  }));

  saveProject(duplicatedProject, remappedAssets, remappedForms, existing.sections);
  return duplicatedProject;
}

export function deleteProject(id: string): void {
  localStorage.removeItem(PROJECT_PREFIX + id);
  localStorage.removeItem(HISTORY_PREFIX + id);

  const list = getAllProjects().filter(p => p.id !== id);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));

  if (getActiveProjectId() === id) {
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
    if (list.length > 0) {
      setActiveProjectId(list[0].id);
    }
  }

  // Delete from portable disk storage
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.deleteProjectPortable(id).catch(err => {
      console.warn('Could not delete project from portable disk:', err);
    });
  }
}

// History
export function getHistory(projectId: string): ChangeHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_PREFIX + projectId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addHistoryEntry(
  projectId: string,
  entry: Omit<ChangeHistoryEntry, 'id' | 'timestamp'>
): void {
  const current = getHistory(projectId);
  const newEntry: ChangeHistoryEntry = {
    ...entry,
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  // Keep up to 50 history entries
  const updated = [newEntry, ...current].slice(0, 50);
  localStorage.setItem(HISTORY_PREFIX + projectId, JSON.stringify(updated));
}

// Image Library
export function getImageLibrary(): LibraryImage[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addImageToLibrary(
  image: Omit<LibraryImage, 'id' | 'createdAt'>
): LibraryImage {
  const current = getImageLibrary();
  const newImg: LibraryImage = {
    ...image,
    id: `lib_img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [newImg, ...current];
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(updated));
  return newImg;
}

export function deleteImageFromLibrary(id: string): void {
  const current = getImageLibrary().filter(img => img.id !== id);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(current));
}

// Portable Settings
export function getPortableSettings(): PortableSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    portableMode: true,
    syncTitleWithProjectName: true,
  };
}

export function savePortableSettings(settings: Partial<PortableSettings>): PortableSettings {
  const current = getPortableSettings();
  const updated: PortableSettings = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.saveSettingsPortable(JSON.stringify(updated)).catch(console.warn);
  }
  return updated;
}

// Missing Asset Detection
export function detectMissingAssets(assets: ImageAsset[]): MissingAssetInfo[] {
  const missing: MissingAssetInfo[] = [];
  for (const asset of assets) {
    const url = (asset.replacementUrl || asset.currentUrl || '').trim();
    if (!url) {
      missing.push({
        assetId: asset.id,
        label: asset.label,
        url: '',
        device: asset.device,
        reason: 'Asset URL is empty',
      });
      continue;
    }
    // Solid hex colors are always valid
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(url)) {
      continue;
    }
    // Local path without hosting
    if (url.startsWith('file://') || /^[a-zA-Z]:[\\/]/.test(url)) {
      missing.push({
        assetId: asset.id,
        label: asset.label,
        url,
        device: asset.device,
        reason: 'Unresolved local file path - requires external hosting or replacement',
      });
    }
  }
  return missing;
}

// Backup Export and Import (JSON & ZIP)
export function generateProjectBackupJson(projectId: string): string {
  const fullData = getFullProject(projectId);
  if (!fullData) throw new Error('Project not found');

  const history = getHistory(projectId);

  const backup: ProjectBackup = {
    version: '2.0.0-portable',
    project: fullData.project,
    assets: fullData.assets,
    forms: fullData.forms,
    sections: fullData.sections,
    history,
    exportedAt: new Date().toISOString(),
  };

  return JSON.stringify(backup, null, 2);
}

export function restoreProjectBackupJson(jsonString: string): Project {
  const backup: ProjectBackup = JSON.parse(jsonString);
  if (!backup.project || !backup.project.id) {
    throw new Error('Invalid project backup data');
  }

  const targetId = backup.project.id;
  saveProject(backup.project, backup.assets || [], backup.forms || [], backup.sections || []);

  if (backup.history) {
    localStorage.setItem(HISTORY_PREFIX + targetId, JSON.stringify(backup.history));
  }

  setActiveProjectId(targetId);
  return backup.project;
}

export async function exportProjectAsZip(projectId: string): Promise<Blob> {
  const full = getFullProject(projectId);
  if (!full) throw new Error('Project not found');
  const history = getHistory(projectId);

  const zip = new JSZip();

  const manifest = {
    generator: 'Landing Page Studio',
    version: '2.0.0-portable',
    projectId: full.project.id,
    projectName: full.project.name,
    campaignName: full.project.campaignName,
    exportedAt: new Date().toISOString(),
    assetCount: full.assets.length,
    formCount: full.forms.length,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const backup: ProjectBackup = {
    version: '2.0.0-portable',
    project: full.project,
    assets: full.assets,
    forms: full.forms,
    sections: full.sections,
    history,
    exportedAt: new Date().toISOString(),
  };
  zip.file('project.json', JSON.stringify(backup, null, 2));
  zip.file('index.html', full.project.currentHtml || full.project.originalHtml);

  const readme = `LANDING PAGE STUDIO — PORTABLE PROJECT BACKUP
======================================================
Project Name: ${full.project.name}
Campaign:     ${full.project.campaignName}
Exported:     ${manifest.exportedAt}
Asset Count:  ${full.assets.length}
Form Count:   ${full.forms.length}

Package Contents:
- manifest.json: Project metadata & integrity check
- project.json:  Complete project state, image mappings, forms & history
- index.html:    Current landing page production HTML source
- README.txt:    This documentation file

This backup is 100% portable and can be imported into Landing Page Studio
on Windows, macOS, or Linux without data loss.
`;
  zip.file('README.txt', readme);

  return await zip.generateAsync({ type: 'blob' });
}

export async function importProjectFromZip(fileData: Blob | ArrayBuffer): Promise<Project> {
  const zip = await JSZip.loadAsync(fileData);
  const projectJsonFile = zip.file('project.json');
  if (!projectJsonFile) {
    throw new Error('Invalid project zip package: missing project.json');
  }

  const rawJson = await projectJsonFile.async('string');
  const backup: ProjectBackup = JSON.parse(rawJson);
  if (!backup.project || !backup.project.id) {
    throw new Error('Corrupted or invalid project.json in zip package');
  }

  saveProject(backup.project, backup.assets || [], backup.forms || [], backup.sections || []);
  if (backup.history) {
    localStorage.setItem(HISTORY_PREFIX + backup.project.id, JSON.stringify(backup.history));
  }
  setActiveProjectId(backup.project.id);
  return backup.project;
}
