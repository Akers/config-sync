import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GitProvider } from '../../src/providers/git-provider.js';

const TEST_DIR = path.join(os.tmpdir(), 'config-sync-git-test-' + Date.now());
const REMOTE_DIR = path.join(os.tmpdir(), 'config-sync-git-remote-' + Date.now());

describe('GitProvider', () => {
  let provider: GitProvider;

  beforeEach(async () => {
    provider = new GitProvider();
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(REMOTE_DIR, { recursive: true });
  });

  afterEach(async () => {
    await provider.dispose().catch(() => {});
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
    fs.rmSync(REMOTE_DIR, { recursive: true, force: true });
  });

  it('should create instance', () => {
    expect(provider.name).toBe('git');
  });

  it('should init a local git repo for testing', async () => {
    // Init a bare remote repo
    const { simpleGit } = await import('simple-git');
    const remoteGit = simpleGit(REMOTE_DIR);
    await remoteGit.init(true);

    // Init provider with local path as remote (testing only)
    const workDir = path.join(TEST_DIR, 'work');
    fs.mkdirSync(workDir, { recursive: true });

    const initGit = simpleGit(workDir);
    await initGit.init();
    await initGit.addConfig('user.email', 'test@test.com');
    await initGit.addConfig('user.name', 'Test');
    await initGit.addRemote('origin', REMOTE_DIR);

    // Create initial commit
    fs.writeFileSync(path.join(workDir, 'manifest.json'), '{}');
    await initGit.add('.');
    await initGit.commit('initial');

    expect(fs.existsSync(path.join(workDir, '.git'))).toBe(true);
  });
});
