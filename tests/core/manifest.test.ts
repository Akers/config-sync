import { describe, it, expect } from 'vitest';
import {
  createManifest,
  addFileEntry,
  manifestToJson,
  manifestFromJson,
  findDiffEntries,
} from '../../src/core/manifest.js';
import type { Manifest, FileEntry } from '../../src/types/index.js';

describe('Manifest', () => {
  const baseEntry: FileEntry = {
    id: 'opencode.rules.obsidian',
    rel_path: 'rules/obsidian.md',
    hash: 'sha256:abc123',
    type: 'file',
    size: 100,
    modified: '2026-04-16T10:00:00Z',
    sensitive_fields: [],
  };

  describe('createManifest', () => {
    it('should create a manifest with empty tools', () => {
      const m = createManifest('device-1');
      expect(m.version).toBe('1.0');
      expect(m.device_id).toBe('device-1');
      expect(m.tools.opencode.files).toEqual([]);
      expect(m.tools['claude-code'].files).toEqual([]);
      expect(m.tools['skill-sh'].files).toEqual([]);
      expect(m.tools.custom.files).toEqual([]);
    });
  });

  describe('addFileEntry', () => {
    it('should add entry to correct tool section', () => {
      const m = createManifest('device-1');
      addFileEntry(m, 'opencode', baseEntry);
      expect(m.tools.opencode.files).toHaveLength(1);
      expect(m.tools.opencode.files[0].id).toBe('opencode.rules.obsidian');
    });

    it('should update existing entry with same id', () => {
      const m = createManifest('device-1');
      addFileEntry(m, 'opencode', baseEntry);
      const updated = { ...baseEntry, hash: 'sha256:def456' };
      addFileEntry(m, 'opencode', updated);
      expect(m.tools.opencode.files).toHaveLength(1);
      expect(m.tools.opencode.files[0].hash).toBe('sha256:def456');
    });
  });

  describe('manifestToJson / manifestFromJson', () => {
    it('should round-trip manifest through JSON', () => {
      const m = createManifest('device-1');
      addFileEntry(m, 'opencode', baseEntry);
      const json = manifestToJson(m);
      const restored = manifestFromJson(json);
      expect(restored.device_id).toBe('device-1');
      expect(restored.tools.opencode.files).toHaveLength(1);
    });
  });

  describe('findDiffEntries', () => {
    it('should detect added files', () => {
      const local = createManifest('device-1');
      const remote = createManifest('device-2');
      addFileEntry(remote, 'opencode', baseEntry);

      const diffs = findDiffEntries(local, remote);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].action).toBe('added');
    });

    it('should detect modified files', () => {
      const local = createManifest('device-1');
      const remote = createManifest('device-2');
      addFileEntry(local, 'opencode', baseEntry);
      addFileEntry(remote, 'opencode', { ...baseEntry, hash: 'sha256:changed' });

      const diffs = findDiffEntries(local, remote);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].action).toBe('modified');
      expect(diffs[0].isConflict).toBe(true);
    });

    it('should detect deleted files', () => {
      const local = createManifest('device-1');
      const remote = createManifest('device-2');
      addFileEntry(local, 'opencode', baseEntry);

      const diffs = findDiffEntries(local, remote);
      expect(diffs).toHaveLength(1);
      expect(diffs[0].action).toBe('deleted');
    });

    it('should return empty for identical manifests', () => {
      const local = createManifest('device-1');
      const remote = createManifest('device-2');
      addFileEntry(local, 'opencode', baseEntry);
      addFileEntry(remote, 'opencode', baseEntry);

      const diffs = findDiffEntries(local, remote);
      expect(diffs).toHaveLength(0);
    });
  });
});
