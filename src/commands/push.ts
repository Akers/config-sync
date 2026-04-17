import chalk from 'chalk';
import inquirer from 'inquirer';
import { loadConfig } from '../utils/config.js';
import { Logger } from '../utils/logger.js';
import { getEnabledTools } from '../tools/index.js';
import { scanToolFiles, computeHash, generateFileId } from '../core/scanner.js';
import { sanitizeContent } from '../core/sanitizer.js';
import { createManifest, addFileEntry, findDiffEntries } from '../core/manifest.js';
import { createProvider } from '../providers/index.js';
import type { SyncFile, FileEntry, UserConfig } from '../types/index.js';

const TOOL_REPO_URL = 'https://github.com/Akers/config-sync.git';

const logger = new Logger();

export async function pushCommand(verbose: boolean = false, force: boolean = false): Promise<void> {
  const vLogger = new Logger(verbose);
  vLogger.debug('Loading config...');

  const config = loadConfig();
  const provider = createProvider(config.provider.type);

  // Wire up progress logging
  provider.setProgressCallback?.((event) => {
    if (event.stage === 'compressing' || event.stage === 'counting' || event.stage === 'writing') {
      vLogger.debug(`git ${event.stage}: ${event.progress}%`);
    } else if (event.method) {
      vLogger.debug(`git ${event.method} ${event.stage}: ${event.progress}%`);
    }
  });

  try {
    logger.info('Initializing provider...');
    await provider.init(config.provider);
    vLogger.debug('Provider initialized');

    // Get remote manifest
    logger.info('Fetching remote manifest...');
    const remoteManifest = await provider.getRemoteManifest();
    vLogger.debug(`Remote manifest: ${remoteManifest ? 'found' : 'empty/none'}`);

    // Build local manifest
    const localManifest = createManifest(config.device_id);
    const syncFiles: SyncFile[] = [];
    const tools = getEnabledTools(config);

    for (const tool of tools) {
      logger.info(`Scanning ${tool.name} files...`);
      const scannedFiles = await scanToolFiles(tool);
      vLogger.debug(`${tool.name}: found ${scannedFiles.length} files`);

      for (const scanned of scannedFiles) {
        // Sanitize content
        const sanitizeResult = sanitizeContent(
          scanned.content,
          tool.sensitiveFields,
          config.sensitive_patterns
        );

        // Compute hash on SANITIZED content
        const hash = computeHash(sanitizeResult.content);

        const entry: FileEntry = {
          id: generateFileId(tool.name, scanned.relPath),
          rel_path: scanned.relPath,
          hash,
          type: scanned.type,
          link_target: scanned.linkTarget,
          platform_origin: scanned.platformOrigin,
          size: scanned.size,
          modified: scanned.modified,
          sensitive_fields: sanitizeResult.sanitizedFields,
        };

        addFileEntry(localManifest, tool.name, entry);

        syncFiles.push({
          id: entry.id,
          tool: tool.name,
          relPath: scanned.relPath,
          content: Buffer.from(sanitizeResult.content),
          meta: {
            type: scanned.type,
            linkTarget: scanned.linkTarget,
            platformOrigin: scanned.platformOrigin,
          },
        });
      }
    }

    // Handle custom files
    if (config.extra_files.length > 0) {
      vLogger.debug('Scanning custom files...');
      for (const filePath of config.extra_files) {
        const fs = await import('fs');
        if (!fs.existsSync(filePath)) {
          logger.warn(`Custom file not found: ${filePath}`);
          continue;
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        const relPath = filePath.replace(/\\/g, '/').split('/').pop() || 'unknown';
        const hash = computeHash(content);

        const entry: FileEntry = {
          id: `custom.${relPath.replace(/\./g, '_')}`,
          rel_path: relPath,
          hash,
          type: 'file',
          size: content.length,
          modified: new Date().toISOString(),
          sensitive_fields: [],
        };

        addFileEntry(localManifest, 'custom', entry);
        syncFiles.push({
          id: entry.id,
          tool: 'custom',
          relPath,
          content: Buffer.from(content),
          meta: { type: 'file' },
        });
      }
    }

    logger.info(`Found ${syncFiles.length} files to sync`);

    // Check for conflicts if remote manifest exists
    if (remoteManifest && !force) {
      const diffs = findDiffEntries(localManifest, remoteManifest);
      const conflicts = diffs.filter(d => d.isConflict);

      if (conflicts.length > 0) {
        logger.warn(`${conflicts.length} conflict(s) detected:`);
        for (const c of conflicts) {
          logger.warn(`  ${c.tool}/${c.relPath}`);
        }

        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'How to resolve conflicts?',
          choices: [
            { name: 'Keep local (overwrite remote)', value: 'local' },
            { name: 'Keep remote (skip push)', value: 'remote' },
            { name: 'Skip all conflicts', value: 'skip' },
            { name: 'Abort', value: 'abort' },
          ],
        }]);

        if (action === 'abort') {
          logger.info('Push cancelled.');
          return;
        }
        if (action === 'remote') {
          logger.info('Keeping remote versions. Push cancelled.');
          return;
        }
        if (action === 'skip') {
          // Remove conflicting files from sync
          for (const c of conflicts) {
            const fileIdx = syncFiles.findIndex(f => f.id === c.id);
            if (fileIdx >= 0) syncFiles.splice(fileIdx, 1);
          }
        }
        // 'local' continues to push everything
      }
    }

    // Generate README for the remote repo
    const readmeContent = generateRepoReadme(config, syncFiles.length);

    // Push to remote
    logger.info(`Pushing ${syncFiles.length} files...`);
    await provider.push(syncFiles, localManifest, false, readmeContent);

    logger.success(`Pushed ${syncFiles.length} files to remote.`);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error(`Push failed: ${errMsg}`);
    if (errMsg.includes('timeout') || errMsg.includes('timed out')) {
      logger.info('Hint: git operation timed out. Try running with -v for details, or check your network/SSH config.');
    }
    if (errMsg.includes('authentication') || errMsg.includes('credential') || errMsg.includes('403') || errMsg.includes('Permission denied')) {
      logger.info('Hint: authentication failed. Verify your SSH key or HTTPS token is configured correctly.');
    }
    process.exitCode = 1;
  } finally {
    await provider.dispose();
  }
}

function generateRepoReadme(config: UserConfig, fileCount: number): string {
  const branch = config.provider.branch || 'main';
  const repoUrl = config.provider.repo_url;
  const toolRepoUrl = TOOL_REPO_URL;

  // Count files per tool
  const toolNames = new Set<string>();
  for (const key of Object.keys(config.tools)) {
    const tc = config.tools[key as keyof typeof config.tools];
    if (tc?.enabled) toolNames.add(key);
  }

  const toolList = [...toolNames].map(t => `- \`${t}\``).join('\n');

  return `# Config Sync Repository

> Auto-generated by [config-sync](https://github.com/Akers/config-sync) — last updated ${new Date().toISOString()}

This repository stores synchronized configuration files for vibe coding tools.

## Synced Tools

${toolList}

- \`${fileCount}\` files total

## For Humans 👤

To restore these configurations on a new machine, give your AI agent the following instructions:

---

> Clone the config-sync tool from \`${toolRepoUrl}\`, install dependencies, build it, then run \`config-sync pull\` pointing to this repository (\`${repoUrl}\`, branch \`${branch}\`) to restore all tool configurations to this machine.

---

## For AI Agents 🤖

Follow these exact steps to restore configurations on the current machine:

### Step 1: Clone and build config-sync

\`\`\`bash
# Clone the tool repository
git clone ${toolRepoUrl} /tmp/config-sync-tool
cd /tmp/config-sync-tool/scripts/config-sync

# Install dependencies
npm install

# Build
npm run build
\`\`\`

### Step 2: Create configuration

Create the config file. On Windows the path is \`%APPDATA%\\\\config-sync\\\\config.json\`, on macOS/Linux it is \`~/.config/config-sync/config.json\`.

Write the following content:

\`\`\`json
{
  "version": "1.0",
  "device_id": "device-restore",
  "provider": {
    "type": "git",
    "repo_url": "${repoUrl}",
    "branch": "${branch}",
    "auth": { "type": "ssh" }
  },
  "tools": {
    "opencode": { "enabled": true, "enable_mcp_sync": false },
    "claude-code": { "enabled": true },
    "skill-sh": { "enabled": true }
  },
  "sensitive_patterns": ["API_KEY", "api_key", "SECRET", "secret", "TOKEN", "token", "PASSWORD", "password"],
  "extra_files": [],
  "exclude_patterns": []
}
\`\`\`

> Adjust \`auth\` to \`{"type": "https", "token": "ghp_xxx"}\` if SSH is not available.

### Step 3: Pull configurations

\`\`\`bash
# Run from the tool directory
cd /tmp/config-sync-tool/scripts/config-sync

# Pull all configurations
node dist/cli.js pull

# Or link globally first
npm link
config-sync pull
\`\`\`

### Step 4: Verify

\`\`\`bash
config-sync status
\`\`\`

This shows the sync status of each tool. All files should show as \`unchanged\`.

### Notes

- **Sensitive fields**: Configs containing API keys or tokens are sanitized as \`{{SENSITIVE:path}}\` placeholders. On first pull, these values need to be filled in manually in the local config files.
- **OpenCode config path**: \`~/.config/opencode/\` on all platforms (including Windows).
- **Claude Code config path**: \`~/.claude/\`
- **skill.sh config path**: \`~/.agents/\`
- **Conflict handling**: If local configs differ from remote, \`config-sync pull\` will prompt interactively to resolve conflicts.
`;
}
