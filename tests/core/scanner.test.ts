import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { scanToolFiles } from '../../src/core/scanner.js';
import type { ToolConfig } from '../../src/types/index.js';

const TEST_DIR = path.join(os.tmpdir(), 'config-sync-scan-test-' + Date.now());

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

// Create a mock ToolConfig pointing at test directory
function mockToolConfig(): ToolConfig {
  return {
    name: 'test-tool',
    configRoot: TEST_DIR,
    includePatterns: ['**/*'],
    excludePatterns: ['excluded/**', '*.bak'],
    sensitiveFields: [],
    enableMcpSync: false,
  };
}

describe('Scanner', () => {
  beforeEach(() => {
    fs.mkdirSync(path.join(TEST_DIR, 'subdir'), { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, 'excluded'), { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, 'config.json'), '{"key": "value"}');
    fs.writeFileSync(path.join(TEST_DIR, 'subdir', 'nested.md'), '# Hello');
    fs.writeFileSync(path.join(TEST_DIR, 'excluded', 'skip.txt'), 'skip');
    fs.writeFileSync(path.join(TEST_DIR, 'old.bak'), 'backup');
  });

  afterEach(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should find files matching include patterns', async () => {
    const config = mockToolConfig();
    const files = await scanToolFiles(config);
    const paths = files.map(f => f.relPath);
    expect(paths).toContain('config.json');
    // relPath is normalized to forward slashes
    expect(paths).toContain('subdir/nested.md');
  });

  it('should exclude files matching exclude patterns', async () => {
    const config = mockToolConfig();
    const files = await scanToolFiles(config);
    const paths = files.map(f => f.relPath);
    expect(paths).not.toContain(path.join('excluded', 'skip.txt'));
    expect(paths).not.toContain('old.bak');
  });

  it('should include file metadata (size, modified)', async () => {
    const config = mockToolConfig();
    const files = await scanToolFiles(config);
    const configFile = files.find(f => f.relPath === 'config.json');
    expect(configFile).toBeDefined();
    expect(configFile!.size).toBeGreaterThan(0);
    expect(configFile!.modified).toBeDefined();
  });

  it('should detect symlinks', async () => {
    if (!hasSymlinkPermission) return; // Skip on Windows without admin permissions

    const targetPath = path.join(TEST_DIR, 'config.json');
    const linkPath = path.join(TEST_DIR, 'link.json');
    fs.symlinkSync(targetPath, linkPath);

    const config = mockToolConfig();
    const files = await scanToolFiles(config);
    const linkFile = files.find(f => f.relPath === 'link.json');
    expect(linkFile).toBeDefined();
    expect(linkFile!.type).toBe('symlink');
  });

  it('should return empty array for nonexistent directory', async () => {
    const config: ToolConfig = {
      ...mockToolConfig(),
      configRoot: path.join(os.tmpdir(), 'nonexistent-' + Date.now()),
    };
    const files = await scanToolFiles(config);
    expect(files).toEqual([]);
  });
});
