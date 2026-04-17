import chalk from 'chalk';
import inquirer from 'inquirer';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig, saveConfig, defaultConfig } from '../utils/config.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();

export async function initCommand(): Promise<void> {
  logger.section('Config Sync Setup');

  // Check if already initialized
  try {
    const existing = loadConfig();
    const { reinit } = await inquirer.prompt([{
      type: 'confirm',
      name: 'reinit',
      message: `Already initialized (device: ${existing.device_id}). Reinitialize?`,
      default: false,
    }]);
    if (!reinit) {
      logger.info('Keeping existing configuration.');
      return;
    }
  } catch {
    // No config yet, proceed
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'repo_url',
      message: 'Git repository URL for config sync:',
      validate: (input: string) => input.trim() ? true : 'Repository URL is required',
    },
    {
      type: 'input',
      name: 'branch',
      message: 'Branch name:',
      default: 'main',
    },
    {
      type: 'list',
      name: 'auth_type',
      message: 'Authentication method:',
      choices: [
        { name: 'SSH key', value: 'ssh' },
        { name: 'HTTPS + token', value: 'https' },
      ],
      default: 'ssh',
    },
    {
      type: 'checkbox',
      name: 'enabled_tools',
      message: 'Which tools to sync?',
      choices: [
        { name: 'OpenCode', value: 'opencode', checked: true },
        { name: 'Claude Code', value: 'claude-code', checked: true },
        { name: 'skill.sh', value: 'skill-sh', checked: true },
      ],
    },
  ]);

  const config = defaultConfig(uuidv4());
  config.provider.repo_url = answers.repo_url;
  config.provider.branch = answers.branch;
  config.provider.auth.type = answers.auth_type;

  // Set tool enabled states
  config.tools.opencode = {
    enabled: answers.enabled_tools.includes('opencode'),
    enable_mcp_sync: false,
  };
  config.tools['claude-code'] = {
    enabled: answers.enabled_tools.includes('claude-code'),
  };
  config.tools['skill-sh'] = {
    enabled: answers.enabled_tools.includes('skill-sh'),
  };

  saveConfig(config);

  logger.success('Configuration saved!');
  logger.info(`  Device: ${config.device_id}`);
  logger.info(`  Repo: ${config.provider.repo_url}`);
  logger.info(`  Branch: ${config.provider.branch}`);
  logger.info(`  Tools: ${answers.enabled_tools.join(', ')}`);
  logger.info('');
  logger.info('Run ' + chalk.bold('config-sync push') + ' to upload your configs.');
}
