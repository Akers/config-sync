import chalk from 'chalk';
import { loadConfig } from '../utils/config.js';
import { Logger } from '../utils/logger.js';
import { getEnabledTools } from '../tools/index.js';
import { scanToolFiles, computeHash } from '../core/scanner.js';
import { sanitizeContent } from '../core/sanitizer.js';
import { createManifest, addFileEntry, findDiffEntries } from '../core/manifest.js';
import { formatDiff, DiffFormatter } from '../core/differ.js';
import { createProvider } from '../providers/index.js';

const logger = new Logger();

export async function statusCommand(verbose: boolean = false): Promise<void> {
  const vLogger = new Logger(verbose);
  const config = loadConfig();
  const provider = createProvider(config.provider.type);

  try {
    await provider.init(config.provider);

    // Build local manifest with sanitized hashes
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
          link_target: scanned.linkTarget,
          platform_origin: scanned.platformOrigin,
          size: scanned.size,
          modified: scanned.modified,
          sensitive_fields: sanitized.sanitizedFields,
        });
      }
    }

    // Get remote manifest
    const remoteManifest = await provider.getRemoteManifest();
    if (!remoteManifest) {
      logger.warn('No remote manifest found. Nothing to compare against.');
      logger.info('Run ' + chalk.bold('config-sync push') + ' to create the initial sync.');
      return;
    }

    // Diff
    const diffs = findDiffEntries(localManifest, remoteManifest);

    logger.section('Sync Status');
    logger.info(`Local files: ${Object.values(localManifest.tools).reduce((sum, t) => sum + t.files.length, 0)}`);
    logger.info(`Remote files: ${Object.values(remoteManifest.tools).reduce((sum, t) => sum + t.files.length, 0)}`);
    logger.info('');
    logger.info(formatDiff(diffs));
  } finally {
    await provider.dispose();
  }
}
