import stringify from 'fast-json-stable-stringify';
import type { Manifest, FileEntry, FileDiff } from '../types/index.js';

export function createManifest(deviceId: string): Manifest {
  return {
    version: '1.0',
    last_sync: new Date().toISOString(),
    device_id: deviceId,
    tools: {
      opencode: { files: [] },
      'claude-code': { files: [] },
      'skill-sh': { files: [] },
      custom: { files: [] },
    },
  };
}

export function addFileEntry(manifest: Manifest, tool: string, entry: FileEntry): void {
  const toolSection = manifest.tools[tool as keyof typeof manifest.tools];
  if (!toolSection) return;

  const idx = toolSection.files.findIndex(f => f.id === entry.id);
  if (idx >= 0) {
    toolSection.files[idx] = entry;
  } else {
    toolSection.files.push(entry);
  }
}

export function removeFileEntry(manifest: Manifest, tool: string, fileId: string): boolean {
  const toolSection = manifest.tools[tool as keyof typeof manifest.tools];
  if (!toolSection) return false;

  const idx = toolSection.files.findIndex(f => f.id === fileId);
  if (idx >= 0) {
    toolSection.files.splice(idx, 1);
    return true;
  }
  return false;
}

export function manifestToJson(manifest: Manifest): string {
  return JSON.stringify(manifest, null, 2);
}

export function manifestFromJson(json: string): Manifest {
  return JSON.parse(json) as Manifest;
}

export function findDiffEntries(local: Manifest, remote: Manifest): FileDiff[] {
  const diffs: FileDiff[] = [];
  const allTools = Object.keys(local.tools) as (keyof typeof local.tools)[];

  for (const tool of allTools) {
    const localFiles = new Map(local.tools[tool].files.map(f => [f.id, f]));
    const remoteFiles = new Map(remote.tools[tool].files.map(f => [f.id, f]));

    // Added: in remote but not local
    for (const [id, remoteEntry] of remoteFiles) {
      if (!localFiles.has(id)) {
        diffs.push({
          id,
          tool,
          relPath: remoteEntry.rel_path,
          action: 'added',
          remoteHash: remoteEntry.hash,
          isConflict: false,
        });
      }
    }

    // Deleted: in local but not remote
    for (const [id, localEntry] of localFiles) {
      if (!remoteFiles.has(id)) {
        diffs.push({
          id,
          tool,
          relPath: localEntry.rel_path,
          action: 'deleted',
          localHash: localEntry.hash,
          isConflict: false,
        });
      }
    }

    // Modified: in both but different hash
    for (const [id, localEntry] of localFiles) {
      const remoteEntry = remoteFiles.get(id);
      if (remoteEntry && localEntry.hash !== remoteEntry.hash) {
        diffs.push({
          id,
          tool,
          relPath: localEntry.rel_path,
          action: 'modified',
          localHash: localEntry.hash,
          remoteHash: remoteEntry.hash,
          isConflict: true,
        });
      }
    }
  }

  return diffs;
}

export function findFileEntry(manifest: Manifest, fileId: string): FileEntry | undefined {
  for (const tool of Object.values(manifest.tools)) {
    const found = tool.files.find(f => f.id === fileId);
    if (found) return found;
  }
  return undefined;
}
