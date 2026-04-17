import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { diffLines } from 'diff';
import { loadConfig } from '../utils/config.js';
import { Logger } from '../utils/logger.js';
import { getEnabledTools } from '../tools/index.js';
import { scanToolFiles, computeHash } from '../core/scanner.js';
import { sanitizeContent } from '../core/sanitizer.js';
import { createManifest, addFileEntry, findDiffEntries } from '../core/manifest.js';
import { createProvider } from '../providers/index.js';
import type { Manifest, SyncProvider, SyncFile } from '../types/index.js';

const logger = new Logger();

export async function diffCommand(
  filePath?: string,
  verbose: boolean = false
): Promise<void> {
  const vLogger = new Logger(verbose);
  const config = loadConfig();
  const provider = createProvider(config.provider.type);

  try {
    await provider.init(config.provider);

    // Build local manifest
    const localManifest = createManifest(config.device_id);
    const tools = getEnabledTools(config);

    for (const tool of tools) {
      const scannedFiles = await scanToolFiles(tool);
      for (const scanned of scannedFiles) {
        const sanitized = sanitizeContent(scanned.content, tool.sensitiveFields, config.sensitive_patterns);
        const hash = computeHash(sanitized.content);

        addFileEntry(localManifest, tool.name, {
          id: `${tool.name}.${scanned.relPath.replace(/[\/\\]/g, '.')}`,
          rel_path: scanned.relPath,
          hash,
          type: scanned.type,
          size: scanned.size,
          modified: scanned.modified,
          sensitive_fields: sanitized.sanitizedFields,
        });
      }
    }

    const remoteManifest = await provider.getRemoteManifest();
    if (!remoteManifest) {
      logger.warn('No remote manifest found.');
      return;
    }

    const diffs = findDiffEntries(localManifest, remoteManifest);

    if (filePath) {
      // Show diff for specific file
      const diff = diffs.find(d =>
        d.relPath === filePath ||
        `${d.tool}/${d.relPath}` === filePath
      );
      if (!diff) {
        logger.info('No differences found for ' + filePath);
        return;
      }
      // Pull once for specific file diff
      const remoteFiles = await provider.pull(remoteManifest);
      await showFileDiff(diff, localManifest, tools, provider, remoteFiles);
    } else {
      // Show all diffs — pull ONCE outside loop
      if (diffs.length === 0) {
        logger.success('No differences found.');
        return;
      }

      const remoteFiles = await provider.pull(remoteManifest);
      for (const diff of diffs) {
        await showFileDiff(diff, localManifest, tools, provider, remoteFiles);
      }
    }
  } finally {
    await provider.dispose();
  }
}

async function showFileDiff(
  diff: any,
  localManifest: Manifest,
  tools: any[],
  provider: SyncProvider,
  remoteFiles: SyncFile[]
): Promise<void> {
  logger.section(`${diff.tool}/${diff.relPath} (${diff.action})`);

  if (diff.action === 'added') {
    // Only in remote — read and display remote content
    const remoteFile = remoteFiles.find(f => f.id === diff.id);
    if (remoteFile) {
      logger.info('  File only exists in remote. Content preview:');
      const content = remoteFile.content.toString('utf-8');
      const preview = content.split('\n').slice(0, 20).join('\n');
      process.stdout.write(chalk.green(preview));
      if (content.split('\n').length > 20) {
        process.stdout.write(chalk.gray('\n  ... (truncated)'));
      }
    }
    return;
  }

  if (diff.action === 'deleted') {
    logger.info('  File only exists locally.');
    return;
  }

  // Modified — show actual diff between local (sanitized) and remote
  const toolConfig = tools.find((t: any) => t.name === diff.tool);
  if (!toolConfig) return;

  const localPath = path.join(toolConfig.configRoot, diff.relPath);
  if (!fs.existsSync(localPath)) return;

  // Sanitize local content to match remote format
  const localContent = fs.readFileSync(localPath, 'utf-8');
  const localSanitized = sanitizeContent(localContent, toolConfig.sensitiveFields, []).content;

  // Read remote content from already-pulled files
  const remoteFile = remoteFiles.find(f => f.id === diff.id);
  if (!remoteFile) {
    logger.warn('  Remote file content not available.');
    return;
  }
  const remoteContent = remoteFile.content.toString('utf-8');

  const changes = diffLines(localSanitized, remoteContent);
  for (const part of changes) {
    if (part.added) {
      process.stdout.write(chalk.green(part.value));
    } else if (part.removed) {
      process.stdout.write(chalk.red(part.value));
    }
  }
}
