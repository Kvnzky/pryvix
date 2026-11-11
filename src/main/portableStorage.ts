import * as fs from 'fs';
import * as path from 'path';
import { app, shell } from 'electron';
import { spawn } from 'child_process';

export interface PortablePaths {
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
}

export function getPortablePaths(): PortablePaths {
  let baseDir: string;
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    baseDir = process.env.PORTABLE_EXECUTABLE_DIR;
  } else if (app.isPackaged) {
    baseDir = path.dirname(app.getPath('exe'));
  } else {
    baseDir = process.cwd();
  }

  const dataDir = path.join(baseDir, 'data');
  const exportsDir = path.join(baseDir, 'exports');

  return {
    root: baseDir,
    data: dataDir,
    projects: path.join(dataDir, 'projects'),
    imageLibrary: path.join(dataDir, 'image-library'),
    assets: path.join(dataDir, 'assets'),
    backups: path.join(dataDir, 'backups'),
    settings: path.join(dataDir, 'settings'),
    database: path.join(dataDir, 'database'),
    exports: exportsDir,
    readme: path.join(baseDir, 'README.txt'),
  };
}

export function initPortableDirectories(): PortablePaths {
  const paths = getPortablePaths();

  const dirsToCreate = [
    paths.data,
    paths.projects,
    paths.imageLibrary,
    paths.assets,
    paths.backups,
    paths.settings,
    paths.database,
    paths.exports,
  ];

  dirsToCreate.forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.error(`Failed to create portable directory: ${dir}`, err);
      }
    }
  });

  // Ensure README.txt exists in root describing the portable structure
  if (!fs.existsSync(paths.readme)) {
    const readmeContent = `Landing Page Studio - Portable Data Structure
=====================================================

This directory holds the self-contained portable data for Landing Page Studio.
You can move this entire folder to any USB drive, drive letter, or computer.

Directory Structure:
- data/projects/      : Individual project JSON files, metadata, and HTML sources
- data/image-library/ : Reusable offline assets and local media files
- data/assets/        : Extracted project graphics and attachments
- data/backups/       : Portable ZIP and JSON project backups
- data/settings/      : Application configuration and user preferences
- data/database/      : SQLite and local storage tables
- exports/            : Generated HTML files, TXT source files, and manifests

Running the App:
- Windows: Run "Launch Landing Page Studio.bat" or "LandingPageStudio.exe"
- Web Mode: Run "Launch Browser App Mode.bat" (http://localhost:5188)
`;
    try {
      fs.writeFileSync(paths.readme, readmeContent, 'utf8');
    } catch (e) {
      // Ignore if write error
    }
  }

  return paths;
}

/**
 * Open a text file in Notepad on Windows, or the platform default text editor on macOS/Linux.
 */
export function openInDefaultTextEditor(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const platform = process.platform;
  try {
    if (platform === 'win32') {
      spawn('notepad.exe', [filePath], { detached: true, stdio: 'ignore' });
      return true;
    } else if (platform === 'darwin') {
      spawn('open', ['-t', filePath], { detached: true, stdio: 'ignore' });
      return true;
    } else {
      spawn('xdg-open', [filePath], { detached: true, stdio: 'ignore' });
      return true;
    }
  } catch (err) {
    console.error('Failed to open file in editor:', err);
    // Fallback using Electron shell
    shell.openPath(filePath);
    return true;
  }
}
