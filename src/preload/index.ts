import { contextBridge, ipcRenderer } from 'electron';
import type {
  GHLConnectionStatus,
  GHLMediaListParams,
  GHLMediaListResponse,
  GHLVerifyAssetResult,
} from '../shared/types';

export interface PortableInfo {
  isPortable: boolean;
  portableMode: boolean;
  dataDir: string;
  exportsDir: string;
  isPackaged: boolean;
  paths: {
    root: string;
    data: string;
    projects: string;
    imageLibrary: string;
    assets: string;
    backups: string;
    settings: string;
    database: string;
    exports: string;
    readme: string;
  };
  platform: string;
}

export interface SaveFileOptions {
  defaultName?: string;
  filters?: { name: string; extensions: string[] }[];
  content: string;
}

export interface IElectronAPI {
  openFile: () => Promise<{ canceled: boolean; filePath?: string; content?: string; filename?: string }>;
  saveFile: (
    contentOrOptions: string | SaveFileOptions,
    defaultName?: string
  ) => Promise<{ success?: boolean; canceled: boolean; filePath?: string; filename?: string; directory?: string }>;
  exportBackupZip: (
    backupData: string,
    defaultName?: string
  ) => Promise<{ success?: boolean; canceled: boolean; filePath?: string; filename?: string; directory?: string }>;
  importBackupZip: () => Promise<{ canceled: boolean; isZip?: boolean; buffer?: string; backupJson?: string; filename?: string }>;
  selectImage: () => Promise<{ canceled: boolean; filePath?: string; dataUrl?: string; name?: string; size?: number; type?: string }>;
  readLocalFile: (path: string) => Promise<string>;
  getPortableInfo: () => Promise<PortableInfo>;
  saveProjectPortable: (id: string, dataJson: string | object) => Promise<{ success: boolean; filePath?: string }>;
  loadAllProjectsPortable: () => Promise<string[]>;
  deleteProjectPortable: (id: string) => Promise<{ success: boolean }>;
  saveSettingsPortable: (json: string) => Promise<{ success: boolean }>;
  saveSettings: (settings: object | string) => Promise<{ success: boolean }>;
  loadSettingsPortable: () => Promise<string | null>;
  openInNotepad: (
    filenameOrContent: string,
    contentOrFilename: string
  ) => Promise<{ success: boolean; filePath: string; filename: string; directory: string; error?: string }>;
  readEditedFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  showItemInFolder: (filePath: string) => Promise<boolean>;
  openPath: (targetPath: string) => Promise<string>;
  ghlGetStatus: () => Promise<GHLConnectionStatus>;
  ghlSaveCredentials: (options: { token?: string; locationId?: string }) => Promise<GHLConnectionStatus>;
  ghlTestConnection: (options?: { token?: string; locationId?: string }) => Promise<GHLConnectionStatus>;
  ghlDisconnect: () => Promise<GHLConnectionStatus>;
  ghlListMedia: (params?: GHLMediaListParams) => Promise<GHLMediaListResponse>;
  ghlVerifyAsset: (url: string) => Promise<GHLVerifyAssetResult>;
  platform: string;
}

const api: IElectronAPI = {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (contentOrOptions: string | SaveFileOptions, defaultName?: string) =>
    ipcRenderer.invoke('dialog:saveFile', contentOrOptions, defaultName),
  exportBackupZip: (backupData: string, defaultName?: string) =>
    ipcRenderer.invoke('dialog:exportBackupZip', backupData, defaultName),
  importBackupZip: () => ipcRenderer.invoke('dialog:importBackupZip'),
  selectImage: () => ipcRenderer.invoke('dialog:selectImage'),
  readLocalFile: (path: string) => ipcRenderer.invoke('fs:readLocalFile', path),
  getPortableInfo: () => ipcRenderer.invoke('portable:getInfo'),
  saveProjectPortable: (id: string, dataJson: string | object) =>
    ipcRenderer.invoke('portable:saveProject', id, dataJson),
  loadAllProjectsPortable: () => ipcRenderer.invoke('portable:loadAllProjects'),
  deleteProjectPortable: (id: string) => ipcRenderer.invoke('portable:deleteProject', id),
  saveSettingsPortable: (json: string) => ipcRenderer.invoke('portable:saveSettings', json),
  saveSettings: (settings: object | string) =>
    ipcRenderer.invoke('portable:saveSettings', typeof settings === 'string' ? settings : JSON.stringify(settings)),
  loadSettingsPortable: () => ipcRenderer.invoke('portable:loadSettings'),
  openInNotepad: (filenameOrContent: string, contentOrFilename: string) =>
    ipcRenderer.invoke('editor:openInNotepad', filenameOrContent, contentOrFilename),
  readEditedFile: (filePath: string) => ipcRenderer.invoke('editor:readEditedFile', filePath),
  showItemInFolder: (filePath: string) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
  openPath: (targetPath: string) => ipcRenderer.invoke('shell:openPath', targetPath),
  ghlGetStatus: () => ipcRenderer.invoke('ghl:getStatus'),
  ghlSaveCredentials: (options: { token?: string; locationId?: string }) =>
    ipcRenderer.invoke('ghl:saveCredentials', options),
  ghlTestConnection: (options?: { token?: string; locationId?: string }) =>
    ipcRenderer.invoke('ghl:testConnection', options),
  ghlDisconnect: () => ipcRenderer.invoke('ghl:disconnect'),
  ghlListMedia: (params?: GHLMediaListParams) => ipcRenderer.invoke('ghl:listMedia', params),
  ghlVerifyAsset: (url: string) => ipcRenderer.invoke('ghl:verifyAsset', url),
  platform: process.platform,
};

contextBridge.exposeInMainWorld('electronAPI', api);
