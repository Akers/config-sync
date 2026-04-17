import type { ToolConfig } from '../types/index.js';
import { getSkillShRoot } from '../utils/platform.js';

export function getSkillShConfig(): ToolConfig {
  return {
    name: 'skill-sh',
    configRoot: getSkillShRoot(),
    includePatterns: [
      'skills/**/*',
      '.skill-lock.json',
    ],
    excludePatterns: [
      '.obsidian-zettelkasten-note-rc/**',
      '**/.git/**',
    ],
    sensitiveFields: [],
    enableMcpSync: false,
  };
}