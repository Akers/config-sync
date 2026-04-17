import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../utils/config.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();

export async function addCommand(filePath: string): Promise<void> {
  // Resolve to absolute path
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    logger.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const stat = fs.lstatSync(absPath);
  if (stat.isDirectory()) {
    logger.error('Only files can be added, not directories. Add individual files instead.');
    process.exit(1);
  }

  const config = loadConfig();

  if (config.extra_files.includes(absPath)) {
    logger.warn(`File already tracked: ${absPath}`);
    return;
  }

  config.extra_files.push(absPath);
  saveConfig(config);

  logger.success(`Added: ${absPath}`);
  logger.info('Run ' + chalk.bold('config-sync push') + ' to sync.');
}

export async function removeCommand(filePath: string): Promise<void> {
  const absPath = path.resolve(filePath);
  const config = loadConfig();

  const idx = config.extra_files.indexOf(absPath);
  if (idx < 0) {
    logger.warn(`File not tracked: ${absPath}`);
    return;
  }

  config.extra_files.splice(idx, 1);
  saveConfig(config);

  logger.success(`Removed: ${absPath}`);
}

export async function providersCommand(): Promise<void> {
  const { listProviders } = await import('../providers/index.js');
  const providers = listProviders();

  logger.section('Available Providers');
  for (const p of providers) {
    logger.info(`  • ${p}`);
  }
}
