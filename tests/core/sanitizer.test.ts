import { describe, it, expect } from 'vitest';
import { sanitizeContent, restoreContent, detectSensitiveFields } from '../../src/core/sanitizer.js';
import type { SensitiveFieldRule } from '../../src/types/index.js';
import * as fs from 'fs';
import * as path from 'path';

const rules: SensitiveFieldRule[] = [
  { path: 'env.*', type: 'env_var' },
  { path: 'mcpServers.*.env.*', type: 'env_var' },
];

const sampleJson = fs.readFileSync(
  path.join(__dirname, '../fixtures/sample-opencode.json'),
  'utf-8'
);

const patterns = ['API_KEY', 'api_key', 'SECRET', 'secret', 'TOKEN', 'token'];

describe('Sanitizer', () => {
  describe('sanitizeContent', () => {
    it('should replace sensitive field values with placeholders', () => {
      const result = sanitizeContent(sampleJson, rules, patterns);
      expect(result.content).not.toContain('sk-abc123secret');
      expect(result.content).not.toContain('ds-xyz789secret');
      expect(result.content).toContain('{{SENSITIVE:env.OPENAI_API_KEY}}');
      expect(result.content).toContain('{{SENSITIVE:env.DEEPSEEK_API_KEY}}');
    });

    it('should track sanitized fields', () => {
      const result = sanitizeContent(sampleJson, rules, patterns);
      expect(result.sanitizedFields.length).toBeGreaterThanOrEqual(2);
    });

    it('should preserve non-sensitive fields', () => {
      const result = sanitizeContent(sampleJson, rules, patterns);
      const parsed = JSON.parse(result.content);
      expect(parsed.model).toBe('glm-4');
      expect(parsed.theme).toBe('dark');
    });

    it('should handle non-JSON files by keyword scanning', () => {
      const textContent = 'my api_key=supersecret123 and token=abc456';
      const result = sanitizeContent(textContent, [], patterns);
      expect(result.content).not.toContain('supersecret123');
      expect(result.content).not.toContain('abc456');
    });

    it('should return content unchanged when no sensitive fields', () => {
      const safeContent = '{"name": "test", "count": 42}';
      const result = sanitizeContent(safeContent, [], patterns);
      expect(result.content).toBe(safeContent);
      expect(result.sanitizedFields).toEqual([]);
    });
  });

  describe('restoreContent', () => {
    it('should restore sensitive values from local config', () => {
      const sanitized = '{"env":{"API_KEY":"{{SENSITIVE:env.API_KEY}}"}}';
      const localContent = '{"env":{"API_KEY":"real-value-123"}}';
      const result = restoreContent(sanitized, localContent);
      expect(result).toContain('real-value-123');
      expect(result).not.toContain('{{SENSITIVE:');
    });

    it('should leave placeholders when local has no matching field', () => {
      const sanitized = '{"env":{"API_KEY":"{{SENSITIVE:env.API_KEY}}"}}';
      const localContent = '{"other": "value"}';
      const result = restoreContent(sanitized, localContent);
      expect(result).toContain('{{SENSITIVE:env.API_KEY}}');
    });
  });

  describe('detectSensitiveFields', () => {
    it('should detect fields matching rules', () => {
      const matches = detectSensitiveFields(sampleJson, rules, patterns);
      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(matches.some(m => m.path.includes('OPENAI_API_KEY'))).toBe(true);
    });
  });
});
