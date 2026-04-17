import type { ToolConfig, SensitiveFieldRule } from '../types/index.js';
import { getOpenCodeRoot } from '../utils/platform.js';

const SENSITIVE_FIELDS: SensitiveFieldRule[] = [
  { path: 'env.*', type: 'env_var' },
  { path: 'mcpServers.*.env.*', type: 'env_var' },
  { path: 'plugins.*.env.*', type: 'env_var' },
];

export function getOpenCodeConfig(enableMcpSync: boolean = false): ToolConfig {
  return {
    name: 'opencode',
    configRoot: getOpenCodeRoot(),
    includePatterns: [
      'rules/**/*',
      'agents/**/*',
      'skills/**/*',
      'superpowers/**/*',
      'opencode.json',
      'oh-my-opencode.json',
      'oh-my-opencode-slim.json',
      'dcp.jsonc',
    ],
    excludePatterns: [
      'node_modules/**',
      'plugins/**',
      '*.bak',
      '**/.git/**',
    ],
    sensitiveFields: SENSITIVE_FIELDS,
    enableMcpSync: enableMcpSync,
  };
}