#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { pushCommand } from './commands/push.js';
import { pullCommand } from './commands/pull.js';
import { statusCommand } from './commands/status.js';
import { diffCommand } from './commands/diff.js';
import { addCommand, removeCommand, providersCommand } from './commands/manage.js';

const program = new Command();

program
  .name('config-sync')
  .description('Sync vibe coding tool configs across devices via Git')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize config-sync with interactive setup')
  .action(async () => {
    await initCommand();
  });

program
  .command('push')
  .description('Push local configs to remote repository')
  .option('-v, --verbose', 'Show detailed output')
  .option('-f, --force', 'Force push even with conflicts')
  .action(async (options) => {
    await pushCommand(options.verbose || false, options.force || false);
  });

program
  .command('pull')
  .description('Pull remote configs to local machine')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    await pullCommand(options.verbose || false);
  });

program
  .command('status')
  .description('Show sync status (local vs remote)')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    await statusCommand(options.verbose || false);
  });

program
  .command('diff [file]')
  .description('Show detailed diff for files')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (file, options) => {
    await diffCommand(file, options.verbose || false);
  });

program
  .command('add <path>')
  .description('Add a custom file to sync tracking')
  .action(async (filePath) => {
    await addCommand(filePath);
  });

program
  .command('remove <path>')
  .description('Remove a custom file from sync tracking')
  .action(async (filePath) => {
    await removeCommand(filePath);
  });

program
  .command('providers')
  .description('List available sync providers')
  .action(async () => {
    await providersCommand();
  });

program.parse();
