import * as fs from 'fs';
import * as path from 'path';

export interface LinkInfo {
  relPath: string;
  type: 'file' | 'symlink';
  linkTarget?: string;
  platformOrigin?: string;
}

export function detectLinks(rootDir: string): LinkInfo[] {
  const links: LinkInfo[] = [];

  if (!fs.existsSync(rootDir)) return links;

  const entries = walkDir(rootDir, rootDir);

  for (const entry of entries) {
    const stat = fs.lstatSync(entry.absPath);
    if (stat.isSymbolicLink()) {
      links.push({
        relPath: entry.relPath,
        type: 'symlink',
        linkTarget: fs.readlinkSync(entry.absPath),
        platformOrigin: process.platform,
      });
    }
  }

  return links;
}

export function restoreLinks(links: LinkInfo[], rootDir: string): void {
  for (const link of links) {
    if (link.type !== 'symlink' || !link.linkTarget) continue;

    const linkPath = path.join(rootDir, link.relPath);
    const dir = path.dirname(linkPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Remove existing file/link if present
    try {
      if (fs.existsSync(linkPath) || fs.lstatSync(linkPath).isSymbolicLink()) {
        fs.unlinkSync(linkPath);
      }
    } catch {
      // File doesn't exist, that's fine
    }

    try {
      if (process.platform === 'win32') {
        const targetExists = fs.existsSync(link.linkTarget);
        const isDir = targetExists && fs.statSync(link.linkTarget).isDirectory();
        fs.symlinkSync(link.linkTarget, linkPath, isDir ? 'junction' : 'file');
      } else {
        fs.symlinkSync(link.linkTarget, linkPath);
      }
    } catch (err) {
      if (fs.existsSync(link.linkTarget)) {
        fs.copyFileSync(link.linkTarget, linkPath);
      }
    }
  }
}

function walkDir(dir: string, root: string): Array<{ absPath: string; relPath: string }> {
  const results: Array<{ absPath: string; relPath: string }> = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name);
    const relPath = path.relative(root, absPath).replace(/\\/g, '/');

    if (entry.isSymbolicLink()) {
      results.push({ absPath, relPath });
    } else if (entry.isDirectory()) {
      results.push(...walkDir(absPath, root));
    }
  }

  return results;
}