import { describe, it, expect } from 'vitest';
import {
  getConfigDir,
  getHomeDir,
  isWindows,
  isMac,
  isLinux,
  toPlatformPath,
  createSymlink,
} from '../../src/utils/platform.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Platform utils', () => {
  it('should return home directory', () => {
    const home = getHomeDir();
    expect(home).toBe(os.homedir());
  });

  it('should return config-sync config directory', () => {
    const configDir = getConfigDir();
    expect(configDir).toContain('config-sync');
  });

  it('should detect current platform correctly', () => {
    expect(isWindows() || isMac() || isLinux()).toBe(true);
  });

  it('should convert path separators for current platform', () => {
    const result = toPlatformPath('some/path/to/file');
    if (isWindows()) {
      expect(result).toContain('\\');
    } else {
      expect(result).toBe('some/path/to/file');
    }
  });
});