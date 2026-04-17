import chalk from 'chalk';
import inquirer from 'inquirer';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig, saveConfig, defaultConfig } from '../utils/config.js';
import { Logger } from '../utils/logger.js';
import { GhCliProvider } from '../providers/gh-cli-provider.js';
import type { UserConfig } from '../types/index.js';

const logger = new Logger();

/** Repository hosting platform */
type RepoHost = 'github' | 'gitlab' | 'gitea' | 'generic';

interface HostConfig {
  label: string;
  defaultUrl: string;
  supportsGhCli: boolean;
}

const HOSTS: Record<RepoHost, HostConfig> = {
  github: {
    label: 'GitHub',
    defaultUrl: 'https://github.com/',
    supportsGhCli: true,
  },
  gitlab: {
    label: 'GitLab',
    defaultUrl: 'https://gitlab.com/',
    supportsGhCli: false,
  },
  gitea: {
    label: 'Gitea / Forgejo',
    defaultUrl: '',
    supportsGhCli: false,
  },
  generic: {
    label: 'Generic Git',
    defaultUrl: '',
    supportsGhCli: false,
  },
};

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

  // Step 1: Select repository hosting type
  const repoHostAnswer = await inquirer.prompt([{
    type: 'list' as const,
    name: 'repo_host',
    message: 'Repository hosting type:',
    choices: [
      { name: 'GitHub', value: 'github' },
      { name: 'GitLab', value: 'gitlab' },
      { name: 'Gitea / Forgejo', value: 'gitea' },
      { name: 'Generic Git', value: 'generic' },
    ],
  }]);
  const repo_host = repoHostAnswer.repo_host as RepoHost;

  const host = HOSTS[repo_host as RepoHost];

  // Step 2: Determine authentication method based on host
  let authType: string;
  let ghCliChecked = false;

  const authChoices: { name: string; value: string }[] = [];

  if (host.supportsGhCli) {
    // Check if gh CLI is available upfront
    ghCliChecked = GhCliProvider.isAvailable();
    if (ghCliChecked) {
      authChoices.push({ name: 'GitHub CLI (gh)  — auto-authenticated', value: 'gh-cli' });
    } else {
      authChoices.push({ name: 'GitHub CLI (gh)  — not authenticated (run `gh auth login` first)', value: 'gh-cli' });
    }
  }

  authChoices.push(
    { name: 'SSH key', value: 'ssh' },
    { name: 'HTTPS + token', value: 'https' },
  );

  const authAnswer = await inquirer.prompt([{
    type: 'list' as const,
    name: 'selected_auth',
    message: 'Authentication method:',
    choices: authChoices,
    default: (ghCliChecked && host.supportsGhCli) ? 'gh-cli' : 'ssh',
  }]);
  authType = authAnswer.selected_auth;

  // Warn if gh-cli selected but not authenticated
  if (authType === 'gh-cli' && !ghCliChecked) {
    logger.warn('Warning: gh CLI is not authenticated. Run `gh auth login` before using push/pull.');
    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Continue anyway?',
      default: false,
    }]);
    if (!proceed) {
      logger.info('Initialization cancelled.');
      return;
    }
  }

  // Step 3: Repo URL and branch
  const isGhCli = authType === 'gh-cli';

  const repoUrlPrompt = isGhCli
    ? {
        type: 'input' as const,
        name: 'repo_id',
        message: 'GitHub repository (owner/repo):',
        validate: (input: string) => {
          const trimmed = input.trim();
          if (!trimmed) return 'Repository ID is required';
          if (!trimmed.includes('/')) return 'Format: owner/repo (e.g. Akers/my-config)';
          return true;
        },
      }
    : {
        type: 'input' as const,
        name: 'repo_url',
        message: 'Git repository URL:',
        default: host.defaultUrl ? `${host.defaultUrl}<owner>/<repo>.git` : undefined,
        validate: (input: string) => input.trim() ? true : 'Repository URL is required',
      };

  const repoAnswers = await inquirer.prompt([
    repoUrlPrompt,
    {
      type: 'input',
      name: 'branch',
      message: 'Branch name:',
      default: 'main',
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

  // Build provider config
  const providerType = authType === 'gh-cli' ? 'gh-cli' : 'git';
  const repoUrl = isGhCli
    ? `https://github.com/${(repoAnswers as any).repo_id.trim()}.git`
    : (repoAnswers as any).repo_url.trim();

  const config = defaultConfig(uuidv4());
  config.provider.type = providerType;
  config.provider.repo_url = repoUrl;
  config.provider.branch = repoAnswers.branch;
  config.provider.auth.type = authType as 'ssh' | 'https' | 'gh-cli';

  // HTTPS token prompt (only for HTTPS auth)
  if (authType === 'https') {
    const { token } = await inquirer.prompt([{
      type: 'password',
      name: 'token',
      message: 'Personal access token:',
      mask: '*',
    }]);
    config.provider.auth.token = token;
  }

  // Set tool enabled states
  config.tools.opencode = {
    enabled: repoAnswers.enabled_tools.includes('opencode'),
    enable_mcp_sync: false,
  };
  config.tools['claude-code'] = {
    enabled: repoAnswers.enabled_tools.includes('claude-code'),
  };
  config.tools['skill-sh'] = {
    enabled: repoAnswers.enabled_tools.includes('skill-sh'),
  };

  saveConfig(config);

  logger.success('Configuration saved!');
  logger.info(`  Device:    ${config.device_id}`);
  logger.info(`  Host:      ${host.label}`);
  logger.info(`  Provider:  ${providerType}`);
  logger.info(`  Repo:      ${config.provider.repo_url}`);
  logger.info(`  Branch:    ${config.provider.branch}`);
  logger.info(`  Auth:      ${authType}`);
  logger.info(`  Tools:     ${repoAnswers.enabled_tools.join(', ')}`);
  logger.info('');
  logger.info('Run ' + chalk.bold('config-sync push') + ' to upload your configs.');
}
