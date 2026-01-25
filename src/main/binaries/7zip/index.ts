// ────────── 7zip Binary Manager ──────────

import { app, dialog } from "electron";
import path from "path";
import fs from "fs";
import { is } from "@electron-toolkit/utils";
import { ProgressController } from "../../core/utils/progress";

function getUnpackedPath(): string {
  // In production, binaries are in app.asar.unpacked
  // In development, they're in the source directory
  const isDev = is.dev;

  if (isDev) {
    return path.join(__dirname, '..', '..', '7zip-bin');
  } else {
    return path.join(process.resourcesPath, 'app.asar.unpacked', '7zip-bin');
  }
}

function get7zaPath(): string {
  try {
    if (process.env.USE_SYSTEM_7ZA === 'true') {
      return '7za';
    }

    const baseDir = getUnpackedPath();

    if (process.platform === 'darwin') {
      return path.join(baseDir, 'mac', process.arch, '7za');
    } else if (process.platform === 'win32') {
      return path.join(baseDir, 'win', process.arch, '7za.exe');
    } else {
      return path.join(baseDir, 'linux', process.arch, '7za');
    }
  } catch (error) {
    dialog.showErrorBox(
      '7zip Binary Error',
      `Failed to locate 7za binary: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    app.quit();
    throw error;
  }
}

function get7xPath(): string {
  try {
    const baseDir = getUnpackedPath();
    return path.join(baseDir, '7x.sh');
  } catch (error) {
    dialog.showErrorBox(
      '7zip Script Error',
      `Failed to locate 7x.sh script: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    app.quit();
    throw error;
  }
}

/**
 * Validates that 7zip binaries exist and are accessible
 * Shows progress during validation
 */
export async function validate7zipBinaries(
  progressController?: ProgressController
): Promise<{ path7za: string; path7x: string }> {
  try {
    if (progressController) {
      progressController.setTitle('Validating 7zip binaries…');
      progressController.setIndeterminate(true);
    }

    const path7za = get7zaPath();
    const path7x = get7xPath();

    // Validate 7za exists
    if (progressController) {
      progressController.setMessage('Checking 7za binary…');
      progressController.setProgress(33);
      progressController.setIndeterminate(false);
    }

    if (!fs.existsSync(path7za)) {
      throw new Error(`7za binary not found at: ${path7za}`);
    }

    // Validate 7x.sh exists (on non-Windows platforms)
    if (process.platform !== 'win32') {
      if (progressController) {
        progressController.setMessage('Checking 7x script…');
        progressController.setProgress(66);
      }

      if (!fs.existsSync(path7x)) {
        throw new Error(`7x.sh script not found at: ${path7x}`);
      }

      // Make sure it's executable
      try {
        fs.chmodSync(path7za, 0o755);
        fs.chmodSync(path7x, 0o755);
      } catch (chmodError) {
        console.warn('Could not set executable permissions:', chmodError);
      }
    }

    if (progressController) {
      progressController.setMessage('Binaries validated');
      progressController.setProgress(100);
    }

    return { path7za, path7x };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    dialog.showErrorBox(
      '7zip Binary Validation Failed',
      `Could not validate 7zip binaries:\n\n${errorMessage}\n\nPlatform: ${process.platform}\nArchitecture: ${process.arch}\n\nPlease reinstall the application.`
    );
    app.quit();

    throw error;
  }
}

/**
 * Export paths for 7zip binaries
 * Use validate7zipBinaries() for safer initialization with error handling
 */
export const path7za = get7zaPath();
export const path7x = get7xPath();
