import chalk from 'chalk';
import type { FileDiff } from '../types/index.js';

const ACTION_ICONS: Record<string, string> = {
  added: chalk.green('+'),
  modified: chalk.yellow('~'),
  deleted: chalk.red('-'),
  unchanged: chalk.gray('='),
};

export function formatFileDiff(diff: FileDiff): string {
  const icon = ACTION_ICONS[diff.action] || '?';
  const conflict = diff.isConflict ? chalk.bgRed.white(' CONFLICT ') : '';
  return `${icon} ${diff.tool}/${diff.relPath} (${diff.action}) ${conflict}`;
}

export function formatDiff(diffs: FileDiff[]): string {
  if (diffs.length === 0) {
    return chalk.green('✔ No differences found. Everything is in sync.');
  }

  const lines: string[] = [chalk.bold('File Differences:\n')];

  for (const diff of diffs) {
    lines.push(formatFileDiff(diff));
  }

  const formatter = new DiffFormatter(diffs);
  const summary = formatter.getSummary();

  lines.push('');
  lines.push(chalk.bold('Summary:'));
  if (summary.added > 0) lines.push(`  ${chalk.green('+')} ${summary.added} added`);
  if (summary.modified > 0) lines.push(`  ${chalk.yellow('~')} ${summary.modified} modified`);
  if (summary.deleted > 0) lines.push(`  ${chalk.red('-')} ${summary.deleted} deleted`);
  if (summary.conflicts > 0) lines.push(`  ${chalk.bgRed.white(` ${summary.conflicts} conflicts `)}`);

  return lines.join('\n');
}

export class DiffFormatter {
  constructor(private diffs: FileDiff[]) {}

  getSummary(): { added: number; modified: number; deleted: number; conflicts: number } {
    return {
      added: this.diffs.filter(d => d.action === 'added').length,
      modified: this.diffs.filter(d => d.action === 'modified').length,
      deleted: this.diffs.filter(d => d.action === 'deleted').length,
      conflicts: this.diffs.filter(d => d.isConflict).length,
    };
  }

  getConflicts(): FileDiff[] {
    return this.diffs.filter(d => d.isConflict);
  }

  getNonConflicts(): FileDiff[] {
    return this.diffs.filter(d => !d.isConflict);
  }
}