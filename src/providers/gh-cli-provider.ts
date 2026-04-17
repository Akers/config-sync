import { execSync } from 'child_process';
import type { SyncProvider, ProviderConfig, SyncFile, Manifest } from '../types/index.js';
import { GitProvider } from './git-provider.js';

/**
 * GitHub CLI based provider.
 *
 * Uses `gh auth token` to obtain credentials automatically,
 * then delegates all git operations to GitProvider.
 *
 * Benefits:
 * - No manual SSH key or token setup required
 * - Uses GitHub OAuth / device flow managed by `gh auth login`
 * - Automatic token refresh
 */
export class GhCliProvider implements SyncProvider {
  name = 'gh-cli';
  private gitProvider: GitProvider | null = null;

  /** Check if `gh` CLI is installed and authenticated */
  static isAvailable(): boolean {
    try {
      execSync('gh auth status', { stdio: 'pipe', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }

  /** Get the current auth token from `gh` */
  private static getToken(): string {
    return execSync('gh auth token', { encoding: 'utf-8', timeout: 10_000 }).trim();
  }

  async init(config: ProviderConfig): Promise<void> {
    // Verify gh CLI is available and authenticated
    if (!GhCliProvider.isAvailable()) {
      throw new Error(
        'GitHub CLI (gh) is not authenticated.\n' +
        'Please run `gh auth login` first, or choose a different authentication method.'
      );
    }

    // Get token from gh and build a git-compatible config
    const token = GhCliProvider.getToken();
    const gitConfig: ProviderConfig = {
      ...config,
      type: 'git',
      auth: {
        type: 'https',
        token,
      },
    };

    this.gitProvider = new GitProvider();
    await this.gitProvider.init(gitConfig);
  }

  async push(files: SyncFile[], manifest: Manifest, force = false, readmeContent?: string): Promise<void> {
    this.ensureInitialized();
    return this.gitProvider!.push(files, manifest, force, readmeContent);
  }

  async pull(manifest: Manifest): Promise<SyncFile[]> {
    this.ensureInitialized();
    return this.gitProvider!.pull(manifest);
  }

  async getRemoteManifest(): Promise<Manifest | null> {
    this.ensureInitialized();
    return this.gitProvider!.getRemoteManifest();
  }

  setProgressCallback(cb: (event: { method: string; stage: string; progress: number }) => void): void {
    if (this.gitProvider) {
      this.gitProvider.setProgressCallback(cb);
    }
  }

  async dispose(): Promise<void> {
    if (this.gitProvider) {
      await this.gitProvider.dispose();
      this.gitProvider = null;
    }
  }

  private ensureInitialized(): void {
    if (!this.gitProvider) {
      throw new Error('GhCliProvider not initialized. Call init() first.');
    }
  }
}
