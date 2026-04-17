import * as fs from 'fs';
import * as path from 'path';
import type { UserConfig } from '../types/index.js';
import { getConfigPath } from './platform.js';
import { v4 as uuidv4 } from 'uuid';

export function defaultConfig(deviceId: string): UserConfig {
  return {
    version: '1.0',
    device_id: deviceId || `device-${uuidv4().slice(0, 8)}`,
    provider: {
      type: 'git',
      repo_url: '',
      branch: 'main',
      auth: { type: 'ssh' },
    },
    tools: {
      opencode: { enabled: true, enable_mcp_sync: false },
      'claude-code': { enabled: true },
      'skill-sh': { enabled: true },
    },
    sensitive_patterns: [
      'API_KEY', 'api_key', 'SECRET', 'secret',
      'TOKEN', 'token', 'PASSWORD', 'password',
    ],
    extra_files: [],
    exclude_patterns: [],
  };
}

export function saveConfig(config: UserConfig, configPath?: string): void {
  const targetPath = configPath || getConfigPath();
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(targetPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function loadConfig(configPath?: string): UserConfig {
  const targetPath = configPath || getConfigPath();
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Config file not found: ${targetPath}. Run 'config-sync init' first.`);
  }
  const raw = fs.readFileSync(targetPath, 'utf-8');
  return JSON.parse(raw) as UserConfig;
}

export function configExists(configPath?: string): boolean {
  const targetPath = configPath || getConfigPath();
  return fs.existsSync(targetPath);
}