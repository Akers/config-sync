import type { ToolConfig, UserConfig } from '../types/index.js';
import { getOpenCodeConfig } from './opencode.js';
import { getClaudeCodeConfig } from './claude-code.js';
import { getSkillShConfig } from './skill-sh.js';

export function getEnabledTools(userConfig: UserConfig): ToolConfig[] {
  const tools: ToolConfig[] = [];

  if (userConfig.tools.opencode?.enabled) {
    tools.push(getOpenCodeConfig(userConfig.tools.opencode.enable_mcp_sync));
  }
  if (userConfig.tools['claude-code']?.enabled) {
    tools.push(getClaudeCodeConfig());
  }
  if (userConfig.tools['skill-sh']?.enabled) {
    tools.push(getSkillShConfig());
  }

  return tools;
}

export { getOpenCodeConfig } from './opencode.js';
export { getClaudeCodeConfig } from './claude-code.js';
export { getSkillShConfig } from './skill-sh.js';