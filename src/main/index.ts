import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import {
  initPortableDirectories,
  getPortablePaths,
  openInDefaultTextEditor,
  PortablePaths,
} from './portableStorage';

let mainWindow: BrowserWindow | null = null;
let portablePaths: PortablePaths;

// Catch unhandled exceptions gracefully
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  dialog.showErrorBox('Pryvix Landing Page Studio - Error', `An unexpected error occurred:\n${err.message || String(err)}`);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Promise Rejection:', reason);
});

// Configure Chromium switches for reliable media playback and autoplay
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-features', 'PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies');

function createWindow() {
  try {
    portablePaths = initPortableDirectories();

    // Determine robust preload script path
    const preloadCandidates = [
      path.join(app.getAppPath(), 'dist-electron/preload/index.cjs'),
      path.join(__dirname, '../preload/index.cjs'),
      path.join(__dirname, 'preload/index.cjs'),
    ];
    const preloadPath = preloadCandidates.find(p => fs.existsSync(p)) || preloadCandidates[0];

    // Resolve authoritative Pryvix desktop icon
    const iconCandidates = [
      path.join(app.getAppPath(), 'pryvix-brand-assets/favicon.ico'),
      path.join(app.getAppPath(), 'pryvix-brand-assets/favicon-256x256.png'),
      path.join(app.getAppPath(), 'dist/brand-assets/favicon.ico'),
      path.join(__dirname, '../../pryvix-brand-assets/favicon.ico'),
      path.join(__dirname, '../../pryvix-brand-assets/favicon-256x256.png'),
    ];
    const appIcon = iconCandidates.find(p => fs.existsSync(p));

    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      backgroundColor: '#0a0e1a',
      title: 'Pryvix Landing Page Studio',
      icon: appIcon,
      show: false, // Prevent white flicker while loading
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: false,
      },
    });

    mainWindow.once('ready-to-show', () => {
      mainWindow?.show();
    });

    // Enable emergency DevTools toggle via F12 or Ctrl+Shift+I
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        mainWindow?.webContents.toggleDevTools();
        event.preventDefault();
      }
    });

    // In development mode, load from Vite dev server; in production, load compiled dist/index.html
    const isDev = !app.isPackaged && !!process.env.VITE_DEV_SERVER_URL;
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else {
      const indexCandidates = [
        path.join(app.getAppPath(), 'dist/index.html'),
        path.join(__dirname, '../../dist/index.html'),
        path.join(__dirname, '../dist/index.html'),
      ];
      const indexPath = indexCandidates.find(p => fs.existsSync(p));

      if (indexPath) {
        mainWindow.loadFile(indexPath);
      } else {
        // Fallback for standalone dev preview
        mainWindow.loadURL('http://localhost:5188');
      }
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } catch (err) {
    console.error('Fatal initialization error:', err);
    dialog.showErrorBox(
      'Landing Page Studio - Startup Error',
      `Failed to initialize Landing Page Studio:\n\n${err instanceof Error ? err.message : String(err)}\n\nPlease ensure you have write permissions to the application directory.`
    );
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Portable Storage Information
ipcMain.handle('portable:getInfo', async () => {
  if (!portablePaths) portablePaths = initPortableDirectories();
  return {
    isPortable: true,
    portableMode: true,
    dataDir: portablePaths.data,
    exportsDir: portablePaths.exports,
    isPackaged: app.isPackaged,
    paths: portablePaths,
    platform: process.platform,
  };
});

// IPC: Portable Projects Filesystem Persistence
ipcMain.handle('portable:saveProject', async (_, projectId: string, projectDataJson: string | object) => {
  if (!portablePaths) portablePaths = initPortableDirectories();
  const filePath = path.join(portablePaths.projects, `${projectId}.json`);
  const serialized = typeof projectDataJson === 'string' ? projectDataJson : JSON.stringify(projectDataJson, null, 2);
  fs.writeFileSync(filePath, serialized, 'utf8');
  return { success: true, filePath };
});

ipcMain.handle('portable:loadAllProjects', async () => {
  if (!portablePaths) portablePaths = initPortableDirectories();
  if (!fs.existsSync(portablePaths.projects)) return [];

  const files = fs.readdirSync(portablePaths.projects);
  const projects: string[] = [];
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const content = fs.readFileSync(path.join(portablePaths.projects, file), 'utf8');
        projects.push(content);
      } catch (err) {
        console.error(`Error reading project file ${file}:`, err);
      }
    }
  }
  return projects;
});

ipcMain.handle('portable:deleteProject', async (_, projectId: string) => {
  if (!portablePaths) portablePaths = initPortableDirectories();
  const filePath = path.join(portablePaths.projects, `${projectId}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return { success: true };
});

// IPC: Settings Persistence
ipcMain.handle('portable:saveSettings', async (_, settingsJson: string | object) => {
  if (!portablePaths) portablePaths = initPortableDirectories();
  const filePath = path.join(portablePaths.settings, 'settings.json');
  const serialized = typeof settingsJson === 'string' ? settingsJson : JSON.stringify(settingsJson, null, 2);
  fs.writeFileSync(filePath, serialized, 'utf8');
  return { success: true };
});

ipcMain.handle('portable:loadSettings', async () => {
  if (!portablePaths) portablePaths = initPortableDirectories();
  const filePath = path.join(portablePaths.settings, 'settings.json');
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return null;
});

// IPC: Open in Notepad / Default Text Editor
ipcMain.handle('editor:openInNotepad', async (_, arg1: string, arg2: string) => {
  if (!portablePaths) portablePaths = initPortableDirectories();

  // Support both (filename, content) and (content, filename) call orders safely
  const isFirstArgContent = arg1 && (arg1.length > 260 || arg1.includes('<!DOCTYPE') || arg1.includes('<html') || arg1.includes('\n'));
  const filename = isFirstArgContent ? (arg2 || 'working-copy.txt') : (arg1 || 'working-copy.txt');
  const content = isFirstArgContent ? arg1 : (arg2 || '');

  // Clean filename
  const cleanName = filename.replace(/[<>:"/\\|?*]/g, '_');
  const targetDir = portablePaths.exports;
  const hasExt = cleanName.endsWith('.txt') || cleanName.endsWith('.html') || cleanName.endsWith('.htm');
  const filePath = path.join(targetDir, hasExt ? cleanName : `${cleanName}.txt`);

  // Write source to file
  fs.writeFileSync(filePath, content, 'utf8');

  // Spawn notepad or OS editor
  const opened = openInDefaultTextEditor(filePath);

  return {
    success: opened,
    filePath,
    filename: path.basename(filePath),
    directory: targetDir,
  };
});

ipcMain.handle('editor:readEditedFile', async (_, filePath: string) => {
  if (fs.existsSync(filePath)) {
    return { success: true, content: fs.readFileSync(filePath, 'utf8') };
  }
  return { success: false, error: 'File does not exist' };
});

// IPC: Shell Operations (Reveal in Explorer/Finder, Open Browser)
ipcMain.handle('shell:showItemInFolder', async (_, filePath: string) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

ipcMain.handle('shell:openPath', async (_, targetPath: string) => {
  if (fs.existsSync(targetPath)) {
    return await shell.openPath(targetPath);
  }
  return 'File not found';
});

// IPC Dialog Handlers
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'HTML & Text Files', extensions: ['html', 'htm', 'txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf8');
  return { canceled: false, filePath, content, filename: path.basename(filePath) };
});

ipcMain.handle(
  'dialog:saveFile',
  async (
    _,
    contentOrOptions: string | { defaultName?: string; filters?: { name: string; extensions: string[] }[]; content: string },
    defaultNameArg = 'landing-page.html'
  ) => {
    if (!portablePaths) portablePaths = initPortableDirectories();

    const isOptionsObj = typeof contentOrOptions === 'object' && contentOrOptions !== null;
    const content = isOptionsObj ? contentOrOptions.content : contentOrOptions;
    const defaultName = isOptionsObj ? contentOrOptions.defaultName || defaultNameArg : defaultNameArg;
    const customFilters = isOptionsObj && Array.isArray(contentOrOptions.filters) ? contentOrOptions.filters : null;

    const result = await dialog.showSaveDialog({
      defaultPath: path.join(portablePaths.exports, defaultName),
      filters: customFilters || [
        { name: 'HTML Files', extensions: ['html'] },
        { name: 'Text Source Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(result.filePath, content, 'utf8');
    return {
      success: true,
      canceled: false,
      filePath: result.filePath,
      filename: path.basename(result.filePath),
      directory: path.dirname(result.filePath),
    };
  }
);

ipcMain.handle('dialog:exportBackupZip', async (_, backupData: string, defaultName = 'project-backup.json') => {
  if (!portablePaths) portablePaths = initPortableDirectories();

  const isZipDefault = defaultName.toLowerCase().endsWith('.zip');
  const result = await dialog.showSaveDialog({
    defaultPath: path.join(portablePaths.backups, defaultName),
    filters: isZipDefault
      ? [
          { name: 'ZIP Archive (*.zip)', extensions: ['zip'] },
          { name: 'Backup Files (*.json, *.zip)', extensions: ['json', 'zip'] },
          { name: 'All Files', extensions: ['*'] },
        ]
      : [
          { name: 'Backup Files (*.json, *.zip)', extensions: ['json', 'zip'] },
          { name: 'All Files', extensions: ['*'] },
        ],
  });

  if (result.canceled || !result.filePath) {
    return { success: false, canceled: true };
  }

  if (result.filePath.toLowerCase().endsWith('.zip') && !backupData.trim().startsWith('{')) {
    fs.writeFileSync(result.filePath, Buffer.from(backupData, 'base64'));
  } else {
    fs.writeFileSync(result.filePath, backupData, 'utf8');
  }
  return {
    success: true,
    canceled: false,
    filePath: result.filePath,
    filename: path.basename(result.filePath),
    directory: path.dirname(result.filePath),
  };
});

ipcMain.handle('dialog:importBackupZip', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Backup Files (*.json, *.zip)', extensions: ['json', 'zip'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  if (filePath.endsWith('.zip')) {
    const buffer = fs.readFileSync(filePath);
    return { canceled: false, isZip: true, buffer: buffer.toString('base64'), filename: path.basename(filePath) };
  } else {
    const backupJson = fs.readFileSync(filePath, 'utf8');
    return { canceled: false, isZip: false, backupJson, filename: path.basename(filePath) };
  }
});

ipcMain.handle('dialog:selectImage', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'avif'] },
    ],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const mimeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    gif: 'image/gif',
    avif: 'image/avif',
  };
  const mime = mimeMap[ext] || 'image/png';
  const dataUrl = `data:${mime};base64,${fileBuffer.toString('base64')}`;
  const stats = fs.statSync(filePath);

  return {
    canceled: false,
    filePath,
    dataUrl,
    name: path.basename(filePath),
    size: stats.size,
    type: mime,
  };
});

ipcMain.handle('fs:readLocalFile', async (_, filePath: string) => {
  return fs.readFileSync(filePath, 'utf8');
});
