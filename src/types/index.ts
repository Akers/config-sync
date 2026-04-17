// === Manifest Types ===

export interface Manifest {
  version: string;
  last_sync: string;
  device_id: string;
  tools: {
    opencode: ToolManifest;
    'claude-code': ToolManifest;
    'skill-sh': ToolManifest;
    custom: ToolManifest;
  };
}

export interface ToolManifest {
  files: FileEntry[];
}

export interface FileEntry {
  id: string;
  rel_path: string;
  hash: string;
  type: 'file' | 'symlink';
  link_target?: string;
  platform_origin?: string;
  size: number;
  modified: string;
  sensitive_fields: string[];
}

// === Config Types ===

export interface UserConfig {
  version: string;
  device_id: string;
  provider: ProviderConfig;
  tools: {
    opencode?: ToolUserConfig;
    'claude-code'?: ToolUserConfig;
    'skill-sh'?: ToolUserConfig;
  };
  sensitive_patterns: string[];
  extra_files: string[];
  exclude_patterns: string[];
}

export interface ToolUserConfig {
  enabled: boolean;
  enable_mcp_sync?: boolean;
}

export interface ProviderConfig {
  type: string;
  repo_url: string;
  branch: string;
  auth: {
    type: 'ssh' | 'https';
    token?: string;
  };
}

// === Provider Types ===

export interface SyncProvider {
  name: string;
  init(config: ProviderConfig): Promise<void>;
  push(files: SyncFile[], manifest: Manifest, force?: boolean, readmeContent?: string): Promise<void>;
  pull(manifest: Manifest): Promise<SyncFile[]>;
  getRemoteManifest(): Promise<Manifest | null>;
  setProgressCallback?(cb: (event: { method: string; stage: string; progress: number }) => void): void;
  dispose(): Promise<void>;
}

export interface SyncFile {
  id: string;
  tool: string;
  relPath: string;
  content: Buffer;
  meta: FileMeta;
}

export interface FileMeta {
  type: 'file' | 'symlink';
  linkTarget?: string;
  platformOrigin?: string;
}

// === Tool Config Types ===

export interface ToolConfig {
  name: string;
  configRoot: string;
  includePatterns: string[];
  excludePatterns: string[];
  sensitiveFields: SensitiveFieldRule[];
  enableMcpSync: boolean;
}

export interface SensitiveFieldRule {
  path: string;
  type: 'api_key' | 'env_var' | 'token' | 'password';
}

// === Diff Types ===

export type DiffAction = 'added' | 'modified' | 'deleted' | 'unchanged';

export interface FileDiff {
  id: string;
  tool: string;
  relPath: string;
  action: DiffAction;
  localHash?: string;
  remoteHash?: string;
  isConflict: boolean;
}

// === Sanitizer Types ===

export interface SanitizeResult {
  content: string;
  sanitizedFields: string[];
}

export interface SensitiveMatch {
  path: string;
  originalValue: string;
  placeholder: string;
}
