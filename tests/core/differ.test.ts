import { describe, it, expect } from 'vitest';
import { formatDiff, formatFileDiff, DiffFormatter } from '../../src/core/differ.js';
import type { FileDiff } from '../../src/types/index.js';

describe('Differ', () => {
  const sampleDiff: FileDiff = {
    id: 'opencode.rules.obsidian',
    tool: 'opencode',
    relPath: 'rules/obsidian.md',
    action: 'modified',
    localHash: 'sha256:aaa',
    remoteHash: 'sha256:bbb',
    isConflict: true,
  };

  describe('formatFileDiff', () => {
    it('should format a single diff entry', () => {
      const output = formatFileDiff(sampleDiff);
      expect(output).toContain('rules/obsidian.md');
      expect(output).toContain('modified');
      expect(output).toContain('CONFLICT');
    });

    it('should show added action', () => {
      const added: FileDiff = { ...sampleDiff, action: 'added', isConflict: false };
      const output = formatFileDiff(added);
      expect(output).toContain('added');
      expect(output).toContain('+');
    });

    it('should show deleted action', () => {
      const deleted: FileDiff = { ...sampleDiff, action: 'deleted', isConflict: false };
      const output = formatFileDiff(deleted);
      expect(output).toContain('deleted');
      expect(output).toContain('-');
    });
  });

  describe('formatDiff', () => {
    it('should format multiple diffs with summary', () => {
      const diffs: FileDiff[] = [
        { ...sampleDiff, id: 'file1', relPath: 'file1.json', action: 'added', isConflict: false },
        { ...sampleDiff, id: 'file2', relPath: 'file2.json', action: 'modified', isConflict: true },
      ];
      const output = formatDiff(diffs);
      expect(output).toContain('file1.json');
      expect(output).toContain('file2.json');
      expect(output).toContain('Summary');
    });

    it('should handle empty diff list', () => {
      const output = formatDiff([]);
      expect(output).toContain('No differences');
    });
  });

  describe('DiffFormatter', () => {
    it('should compute diff summary counts', () => {
      const formatter = new DiffFormatter([
        { ...sampleDiff, action: 'added', isConflict: false },
        { ...sampleDiff, action: 'modified', isConflict: true },
        { ...sampleDiff, action: 'deleted', isConflict: false },
        { ...sampleDiff, action: 'modified', isConflict: false },
      ]);
      const summary = formatter.getSummary();
      expect(summary.added).toBe(1);
      expect(summary.modified).toBe(2);
      expect(summary.deleted).toBe(1);
      expect(summary.conflicts).toBe(1);
    });
  });
});