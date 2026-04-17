import * as fs from 'fs';
import * as path from 'path';
import { simpleGit, SimpleGitProgressEvent } from 'simple-git';
import type { SimpleGit } from 'simple-git';
import type { SyncProvider, ProviderConfig, SyncFile, Manifest } from '../types/index.js';
import { manifestToJson, manifestFromJson } from '../core/manifest.js';
import { getConfigDir } from '../utils/platform.js';

const GIT_TIMEOUT_MS = 60_000; // 60 seconds per git operation

export class GitProvider implements SyncProvider {
  name = 'git';
  private git: SimpleGit | null = null;
  private workDir = '';
  private config: ProviderConfig | null = null;
  private onProgress?: (event: SimpleGitProgressEvent) => void;

  /** Set an optional progress callback for git operations */
  setProgressCallback(cb: (event: SimpleGitProgressEvent) => void): void {
    this.onProgress = cb;
  }

  async init(config: ProviderConfig): Promise<void> {
    this.config = config;
    this.workDir = path.join(getConfigDir(), 'repo');

    if (!fs.existsSync(this.workDir)) {
      fs.mkdirSync(this.workDir, { recursive: true });
    }

    this.git = simpleGit(this.workDir, {
      timeout: {
        block: GIT_TIMEOUT_MS,
      },
      progress: this.onProgress
        ? (event: SimpleGitProgressEvent) => this.onProgress!(event)
        : undefined,
    });

    if (!fs.existsSync(path.join(this.workDir, '.git'))) {
      const branch = config.branch || 'main';
      // Use --initial-branch to ensure the default branch matches config
      // (Git default may be 'master' depending on init.defaultBranch setting)
      await this.git.raw(['init', '--initial-branch', branch]);
      await this.git.addConfig('user.email', 'config-sync@local');
      await this.git.addConfig('user.name', 'config-sync');
      // Unset global proxy for this repo — socks5/http proxies can interfere
      // with credential helpers and cause push/pull to hang
      await this.git.addConfig('http.proxy', '');
      await this.git.addConfig('https.proxy', '');

      const remoteUrl = this.buildRemoteUrl(config);
      await this.git.addRemote('origin', remoteUrl);
    } else {
      // Update remote URL if token was added/changed after initial setup
      const remoteUrl = this.buildRemoteUrl(config);
      await this.git.raw(['remote', 'set-url', 'origin', remoteUrl]);
      // Ensure proxy is unset on existing repos too
      await this.git.addConfig('http.proxy', '');
      await this.git.addConfig('https.proxy', '');
    }
  }

  private buildRemoteUrl(config: ProviderConfig): string {
    return config.auth.type === 'https' && config.auth.token
      ? config.repo_url.replace('https://', `https://${config.auth.token}@`)
      : config.repo_url;
  }

  async push(files: SyncFile[], manifest: Manifest, force = false, readmeContent?: string): Promise<void> {
    this.ensureInitialized();

    // Write manifest
    fs.writeFileSync(
      path.join(this.workDir, 'manifest.json'),
      manifestToJson(manifest),
      'utf-8'
    );

    // Write README for the remote repo
    if (readmeContent) {
      fs.writeFileSync(
        path.join(this.workDir, 'README.md'),
        readmeContent,
        'utf-8'
      );
    }

    // Write files organized by tool
    for (const file of files) {
      const filePath = path.join(this.workDir, file.tool, file.relPath);
      const dir = path.dirname(filePath);
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err: any) {
        if (err?.code === 'EEXIST') {
          // A file exists where we need a directory (e.g. a symlink was written here earlier).
          // Remove it and create the directory instead.
          fs.rmSync(dir, { force: true });
          fs.mkdirSync(dir, { recursive: true });
        } else {
          throw err;
        }
      }
      fs.writeFileSync(filePath, file.content);
    }

    // Stage and commit
    await this.git!.add('.');
    const status = await this.git!.status();
    if (status.files.length > 0) {
      await this.git!.commit(
        `[config-sync] push from ${manifest.device_id} at ${new Date().toISOString()}`
      );
    }

    // Push to remote
    const branch = this.config!.branch || 'main';
    try {
      if (force) {
        await this.git!.push('origin', branch, { '--force': null });
      } else {
        await this.git!.push(['-u', 'origin', branch]);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to push to remote: ${errMsg}`);
    }
  }

  async pull(manifest: Manifest): Promise<SyncFile[]> {
    this.ensureInitialized();

    const branch = this.config!.branch || 'main';
    await this.git!.fetch('origin', branch);
    await this.git!.checkout(branch);

    try {
      await this.git!.pull('origin', branch);
    } catch {
      // Might be empty repo
    }

    // Read files from workDir
    const files: SyncFile[] = [];
    for (const [tool, toolManifest] of Object.entries(manifest.tools)) {
      for (const entry of toolManifest.files) {
        const filePath = path.join(this.workDir, tool, entry.rel_path);
        if (fs.existsSync(filePath)) {
          files.push({
            id: entry.id,
            tool,
            relPath: entry.rel_path,
            content: Buffer.from(fs.readFileSync(filePath, 'utf-8')),
            meta: {
              type: entry.type,
              linkTarget: entry.link_target,
              platformOrigin: entry.platform_origin,
            },
          });
        }
      }
    }

    return files;
  }

  async getRemoteManifest(): Promise<Manifest | null> {
    this.ensureInitialized();

    const branch = this.config!.branch || 'main';
    try {
      // Fetch might fail on empty remote or auth issues — handle gracefully
      await this.git!.fetch('origin', branch);
    } catch {
      // Remote branch might not exist yet
    }

    try {
      // Try to checkout the remote tracking branch
      await this.git!.checkout(branch);
    } catch {
      // Branch doesn't exist locally yet — try to create from remote
      try {
        await this.git!.checkoutBranch(branch, `origin/${branch}`);
      } catch {
        // Remote branch doesn't exist either — empty repo
        return null;
      }
    }

    try {
      await this.git!.pull('origin', branch);
    } catch {
      // Might be up-to-date or empty
    }

    const manifestPath = path.join(this.workDir, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      return manifestFromJson(fs.readFileSync(manifestPath, 'utf-8'));
    }

    return null;
  }

  async dispose(): Promise<void> {
    this.git = null;
  }

  private ensureInitialized(): void {
    if (!this.git || !this.config) {
      throw new Error('GitProvider not initialized. Call init() first.');
    }
  }
}
