import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { restoreLinks, detectLinks } from '../../src/core/linker.js';

const TEST_DIR = path.join(os.tmpdir(), 'config-sync-linker-' + Date.now());

/** Check if symlinks can be created (requires elevated permissions on Windows) */
function canCreateSymlinks(): boolean {
  const testFile = path.join(os.tmpdir(), 'config-sync-symlink-check-' + Date.now());
  const testLink = testFile + '.link';
  try {
    fs.writeFileSync(testFile, 'test');
    fs.symlinkSync(testFile, testLink);
    return true;
  } catch {
    return false;
  } finally {
    try { fs.unlinkSync(testLink); } catch { /* ignore */ }
    try { fs.unlinkSync(testFile); } catch { /* ignore */ }
  }
}

const hasSymlinkPermission = canCreateSymlinks();

describe('Linker', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('detectLinks', () => {
    it('should detect symlinks in scanned files', () => {
      if (!hasSymlinkPermission) return; // Skip on Windows without admin permissions

      const target = path.join(TEST_DIR, 'real.txt');
      const link = path.join(TEST_DIR, 'link.txt');
      fs.writeFileSync(target, 'content');
      fs.symlinkSync(target, link);

      const links = detectLinks(TEST_DIR);
      expect(links).toHaveLength(1);
      expect(links[0].relPath).toBe('link.txt');
      expect(links[0].type).toBe('symlink');
    });

    it('should return empty for directory with no symlinks', () => {
      fs.writeFileSync(path.join(TEST_DIR, 'plain.txt'), 'content');
      const links = detectLinks(TEST_DIR);
      expect(links).toEqual([]);
    });
  });

  describe('restoreLinks', () => {
    it('should create symlink from manifest metadata', () => {
      if (!hasSymlinkPermission) return; // Skip on Windows without admin permissions

      const target = path.join(TEST_DIR, 'target.txt');
      fs.writeFileSync(target, 'content');

      const linkPath = path.join(TEST_DIR, 'restored-link.txt');
      restoreLinks([{
        relPath: 'restored-link.txt',
        type: 'symlink',
        linkTarget: target,
        platformOrigin: 'win32',
      }], TEST_DIR);

      expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    });
  });
});