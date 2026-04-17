import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadConfig } from '../utils/config.js';
import { Logger } from '../utils/logger.js';
import { getEnabledTools } from '../tools/index.js';
import { scanToolFiles, computeHash } from '../core/scanner.js';
import { sanitizeContent, restoreContent } from '../core/sanitizer.js';
import { createManifest, addFileEntry, findDiffEntries, findFileEntry } from '../core/manifest.js';
import { createProvider } from '../providers/index.js';
import { restoreLinks } from '../core/linker.js';
import type { SyncFile, FileEntry, Manifest } from '../types/index.js';

const logger = new Logger();

export async function pullCommand(verbose: boolean = false): Promise<void> {
  const vLogger = new Logger(verbose);
  const config = loadConfig();
  const provider = createProvider(config.provider.type);

  try {
    await provider.init(config.provider);

    // Get remote manifest
    const remoteManifest = await provider.getRemoteManifest();
    if (!remoteManifest) {
      logger.warn('No remote manifest found. Push first.');
      return;
    }

    // Build local manifest (with sanitized hashes for comparison)
    const localManifest = createManifest(config.device_id);
    const tools = getEnabledTools(config);

    for (const tool of tools) {
      const scannedFiles = await scanToolFiles(tool);
      for (const scanned of scannedFiles) {
        // Sanitize local content before hashing to match remote
        const sanitized = sanitizeContent(scanned.content, tool.sensitiveFields, config.sensitive_patterns);
        const hash = computeHash(sanitized.content);

        addFileEntry(localManifest, tool.name, {
          id: `${tool.name}.${scanned.relPath.replace(/[\/\\]/g, '.')}`,
          rel_path: scanned.relPath,
          hash,
          type: scanned.type,
          link_target: scanned.linkTarget,
          platform_origin: scanned.platformOrigin,
          size: scanned.size,
          modified: scanned.modified,
          sensitive_fields: sanitized.sanitizedFields,
        });
      }
    }

    // Diff
    const diffs = findDiffEntries(localManifest, remoteManifest);
    if (diffs.length === 0) {
      logger.success('Already up to date.');
      return;
    }

    const addedOrModified = diffs.filter(d => d.action === 'added' || d.action === 'modified');
    const conflicts = diffs.filter(d => d.isConflict);
    logger.info(`${addedOrModified.length} file(s) to pull, ${diffs.filter(d => d.action === 'deleted').length} to remove.`);

    // Conflict resolution for pull
    const filesToSkip = new Set<string>();
    if (conflicts.length > 0) {
      logger.warn(`${conflicts.length} conflict(s) detected.`);
      for (const c of conflicts) {
        const { choice } = await inquirer.prompt([{
          type: 'list',
          name: 'choice',
          message: `Conflict: ${c.tool}/${c.relPath}`,
          choices: [
            { name: 'Keep local version', value: 'local' },
            { name: 'Use remote version', value: 'remote' },
            { name: 'Skip this file', value: 'skip' },
          ],
        }]);
        if (choice === 'local' || choice === 'skip') {
          filesToSkip.add(c.id);
        }
      }
    }

    // Pull files from remote
    const remoteFiles = await provider.pull(remoteManifest);

    // Restore links — use each tool's configRoot as base directory
    for (const file of remoteFiles) {
      if (file.meta.type === 'symlink' && file.meta.linkTarget) {
        const toolConfig = tools.find(t => t.name === file.tool);
        if (toolConfig) {
          restoreLinks([{
            relPath: file.relPath,
            type: 'symlink',
            linkTarget: file.meta.linkTarget,
            platformOrigin: file.meta.platformOrigin,
          }], toolConfig.configRoot);
        }
      }
    }

    // Write files to local filesystem
    for (const file of remoteFiles) {
      // Skip files the user chose to keep local
      if (filesToSkip.has(file.id)) {
        vLogger.debug(`  Skipped: ${file.tool}/${file.relPath}`);
        continue;
      }

      const toolConfig = tools.find(t => t.name === file.tool);
      const content = file.content.toString('utf-8');

      // Restore sensitive fields from local config
      let finalContent = content;
      if (toolConfig) {
        const localPath = path.join(toolConfig.configRoot, file.relPath);
        if (fs.existsSync(localPath)) {
          const localContent = fs.readFileSync(localPath, 'utf-8');
          finalContent = restoreContent(content, localContent);
        } else {
          // First sync — check for remaining placeholders
          if (content.includes('{{SENSITIVE:')) {
            logger.warn(`  ${file.tool}/${file.relPath} has unfilled sensitive fields. Please fill manually.`);
          }
        }
      }

      // Write to local filesystem
      if (toolConfig) {
        const targetPath = path.join(toolConfig.configRoot, file.relPath);
        const dir = path.dirname(targetPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(targetPath, finalContent, 'utf-8');
        vLogger.debug(`  Restored: ${file.tool}/${file.relPath}`);
      }
    }

    logger.success(`Pulled ${remoteFiles.length} file(s) successfully.`);
  } finally {
    await provider.dispose();
  }
}
