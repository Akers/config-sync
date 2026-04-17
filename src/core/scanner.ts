import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { createHash } from 'crypto';
import type { ToolConfig } from '../types/index.js';

export interface ScannedFile {
  absPath: string;
  relPath: string;
  content: string;
  hash: string;
  type: 'file' | 'symlink';
  linkTarget?: string;
  platformOrigin?: string;
  size: number;
  modified: string;
}

export async function scanToolFiles(toolConfig: ToolConfig): Promise<ScannedFile[]> {
  const { configRoot, includePatterns, excludePatterns } = toolConfig;

  if (!fs.existsSync(configRoot)) {
    return [];
  }

  const files: ScannedFile[] = [];

  for (const pattern of includePatterns) {
    const matches = await glob(pattern, {
      cwd: configRoot,
      nodir: true,
      dot: true,
      ignore: excludePatterns,
      absolute: false,
    });

    for (const relPath of matches) {
      const absPath = path.join(configRoot, relPath);
      const stat = fs.lstatSync(absPath);
      const isSymlink = stat.isSymbolicLink();

      const file: ScannedFile = {
        absPath,
        relPath: relPath.replace(/\\/g, '/'), // normalize to forward slashes
        content: '',
        hash: '',
        type: isSymlink ? 'symlink' : 'file',
        size: stat.size,
        modified: stat.mtime.toISOString(),
      };

      if (isSymlink) {
        // If symlink points to a directory, skip it — glob already followed it
        // and included the files inside. Syncing the symlink itself would cause
        // a file-vs-directory conflict when writing child files.
        try {
          const targetStat = fs.statSync(absPath); // follows symlink
          if (targetStat.isDirectory()) {
            continue;
          }
        } catch {
          continue; // broken symlink, skip
        }
        file.linkTarget = fs.readlinkSync(absPath);
        file.platformOrigin = process.platform;
        file.content = file.linkTarget;
        file.hash = computeHash(file.linkTarget!);
      } else {
        file.content = fs.readFileSync(absPath, 'utf-8');
        file.hash = computeHash(file.content);
      }

      files.push(file);
    }
  }

  return files;
}

export function computeHash(content: string): string {
  return 'sha256:' + createHash('sha256').update(content).digest('hex');
}

export function generateFileId(toolName: string, relPath: string): string {
  const pathPart = relPath.replace(/[\/\\]/g, '.').replace(/\.[^.]+$/, '');
  return `${toolName}.${pathPart}`;
}
