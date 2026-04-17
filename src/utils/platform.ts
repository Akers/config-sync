import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function getHomeDir(): string {
  return os.homedir();
}

export function getConfigDir(): string {
  if (isWindows()) {
    return path.join(process.env.APPDATA || path.join(getHomeDir(), 'AppData', 'Roaming'), 'config-sync');
  }
  return path.join(getHomeDir(), '.config', 'config-sync');
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}

export function isMac(): boolean {
  return process.platform === 'darwin';
}

export function isLinux(): boolean {
  return process.platform === 'linux';
}

export function toPlatformPath(p: string): string {
  if (isWindows()) {
    return p.replace(/\//g, '\\');
  }
  return p;
}

export async function createSymlink(target: string, linkPath: string): Promise<void> {
  const dir = path.dirname(linkPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(linkPath)) {
    fs.unlinkSync(linkPath);
  }

  if (isWindows()) {
    const stat = fs.statSync(target);
    const type = stat.isDirectory() ? 'junction' : 'file';
    fs.symlinkSync(target, linkPath, type);
  } else {
    fs.symlinkSync(target, linkPath);
  }
}

export function isSymlink(filePath: string): boolean {
  try {
    const stat = fs.lstatSync(filePath);
    return stat.isSymbolicLink();
  } catch {
    return false;
  }
}

export function readSymlinkTarget(filePath: string): string | null {
  try {
    return fs.readlinkSync(filePath);
  } catch {
    return null;
  }
}

export function getOpenCodeRoot(): string {
  // OpenCode CLI uses XDG-style path on all platforms
  return path.join(getHomeDir(), '.config', 'opencode');
}

export function getClaudeCodeRoot(): string {
  return path.join(getHomeDir(), '.claude');
}

export function getSkillShRoot(): string {
  return path.join(getHomeDir(), '.agents');
}