/// <reference types="vite/client" />

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.ico' {
  const src: string;
  export default src;
}

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
  saveSettings?: (settings: object | string) => Promise<{ success: boolean }>;
  loadSettingsPortable: () => Promise<string | null>;
  openInNotepad: (
    filenameOrContent: string,
    contentOrFilename: string
  ) => Promise<{ success: boolean; filePath: string; filename: string; directory: string; error?: string }>;
  readEditedFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  showItemInFolder: (filePath: string) => Promise<boolean>;
  openPath: (targetPath: string) => Promise<string>;
  ghlGetStatus: () => Promise<import('@shared/types').GHLConnectionStatus>;
  ghlSaveCredentials: (options: { token?: string; locationId?: string }) => Promise<import('@shared/types').GHLConnectionStatus>;
  ghlTestConnection: (options?: { token?: string; locationId?: string }) => Promise<import('@shared/types').GHLConnectionStatus>;
  ghlDisconnect: () => Promise<import('@shared/types').GHLConnectionStatus>;
  ghlListMedia: (params?: import('@shared/types').GHLMediaListParams) => Promise<import('@shared/types').GHLMediaListResponse>;
  ghlVerifyAsset: (url: string) => Promise<import('@shared/types').GHLVerifyAssetResult>;
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: IElectronAPI;
  }
}
