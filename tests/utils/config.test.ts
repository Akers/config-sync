import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadConfig, saveConfig, defaultConfig } from '../../src/utils/config.js';

const TEST_CONFIG_DIR = path.join(os.tmpdir(), 'config-sync-test-' + Date.now());

describe('Config utils', () => {
  beforeEach(() => {
    fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
  });

  it('should return default config', () => {
    const config = defaultConfig('test-device');
    expect(config.version).toBe('1.0');
    expect(config.device_id).toBe('test-device');
    expect(config.provider.type).toBe('git');
    expect(config.tools.opencode?.enabled).toBe(true);
  });

  it('should save and load config', () => {
    const configPath = path.join(TEST_CONFIG_DIR, 'config.json');
    const config = defaultConfig('test-device');
    config.provider.repo_url = 'https://github.com/test/repo.git';

    saveConfig(config, configPath);
    const loaded = loadConfig(configPath);

    expect(loaded.device_id).toBe('test-device');
    expect(loaded.provider.repo_url).toBe('https://github.com/test/repo.git');
  });

  it('should throw on missing config file', () => {
    const configPath = path.join(TEST_CONFIG_DIR, 'nonexistent.json');
    expect(() => loadConfig(configPath)).toThrow();
  });
});