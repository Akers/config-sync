import type { ToolConfig, SensitiveFieldRule } from '../types/index.js';
import { getClaudeCodeRoot } from '../utils/platform.js';

const SENSITIVE_FIELDS: SensitiveFieldRule[] = [
  { path: 'env.*', type: 'env_var' },
  { path: 'apiProvider', type: 'api_key' },
];

const EXCLUDE_DIRS = [
  'transcripts/**',
  'debug/**',
  'file-history/**',
  'stats-cache.json',
  'projects/**',
  'paste-cache/**',
  'shell-snapshots/**',
  'statsig/**',
  'todos/**',
  'backup/**',
  'backups/**',
];

export function getClaudeCodeConfig(): ToolConfig {
  return {
    name: 'claude-code',
    configRoot: getClaudeCodeRoot(),
    includePatterns: [
      'CLAUDE.md',
      'settings.json',
      'agents/**/*',
      'skills/**/*',
      'commands/**/*',
      'hooks/**/*',
      'output-styles/**/*',
    ],
    excludePatterns: [...EXCLUDE_DIRS, '**/.git/**'],
    sensitiveFields: SENSITIVE_FIELDS,
    enableMcpSync: false,
  };
}