import type { SensitiveFieldRule } from '../types/index.js';

export interface SensitiveMatch {
  path: string;
  originalValue: string;
  placeholder: string;
}

export interface SanitizeResult {
  content: string;
  sanitizedFields: string[];
}

export function sanitizeContent(
  content: string,
  rules: SensitiveFieldRule[],
  patterns: string[]
): SanitizeResult {
  // Try JSON-based sanitization first
  try {
    const parsed = JSON.parse(content);
    const matches = detectSensitiveFields(content, rules, patterns);
    if (matches.length === 0) {
      return { content, sanitizedFields: [] };
    }

    const obj = JSON.parse(content) as Record<string, unknown>;
    const sanitizedFields: string[] = [];

    for (const match of matches) {
      setNestedValue(obj, match.path, match.placeholder);
      sanitizedFields.push(match.path);
    }

    return {
      content: JSON.stringify(obj, null, 2),
      sanitizedFields,
    };
  } catch {
    // Not JSON — do keyword-based text replacement
    return sanitizeTextContent(content, patterns);
  }
}

export function restoreContent(sanitizedContent: string, localContent: string): string {
  const placeholderRegex = /\{\{SENSITIVE:([^}]+)\}\}/g;

  try {
    const localObj = JSON.parse(localContent) as Record<string, unknown>;
    return sanitizedContent.replace(placeholderRegex, (_match, fieldPath: string) => {
      const value = getNestedValue(localObj, fieldPath);
      return value !== undefined ? String(value) : `{{SENSITIVE:${fieldPath}}}`;
    });
  } catch {
    return sanitizedContent;
  }
}

export function detectSensitiveFields(
  content: string,
  rules: SensitiveFieldRule[],
  patterns: string[]
): SensitiveMatch[] {
  const matches: SensitiveMatch[] = [];

  try {
    const obj = JSON.parse(content) as Record<string, unknown>;

    // Rule-based detection
    for (const rule of rules) {
      const paths = expandGlobPath(obj, rule.path);
      for (const p of paths) {
        const value = getNestedValue(obj, p);
        if (value !== undefined && value !== null) {
          matches.push({
            path: p,
            originalValue: String(value),
            placeholder: `{{SENSITIVE:${p}}}`,
          });
        }
      }
    }

    // Keyword-based detection for any remaining fields
    findAllSensitivePaths(obj, '', patterns, matches);
  } catch {
    // Not JSON — return empty
  }

  // Deduplicate by path
  const seen = new Set<string>();
  return matches.filter(m => {
    if (seen.has(m.path)) return false;
    seen.add(m.path);
    return true;
  });
}

function sanitizeTextContent(content: string, patterns: string[]): SanitizeResult {
  let result = content;
  const sanitizedFields: string[] = [];
  const valuePattern = /[=:]\s*["']?([^\s"']+)["']?/g;

  let match;
  while ((match = valuePattern.exec(content)) !== null) {
    const value = match[1];
    const line = content.substring(0, match.index);
    const keywordMatch = patterns.some(p => line.toLowerCase().includes(p.toLowerCase()));
    if (keywordMatch || value.length >= 8) {
      const placeholder = `{{SENSITIVE:text.${sanitizedFields.length}}}`;
      result = result.replace(value, placeholder);
      sanitizedFields.push(`text.${sanitizedFields.length}`);
    }
  }

  return { content: result, sanitizedFields };
}

function expandGlobPath(obj: Record<string, unknown>, globPath: string): string[] {
  const parts = globPath.split('.');
  return expandGlobParts(obj, parts, '');
}

function expandGlobParts(obj: unknown, parts: string[], prefix: string): string[] {
  if (parts.length === 0) return prefix ? [prefix] : [];
  if (obj === null || obj === undefined || typeof obj !== 'object') return [];

  const [head, ...tail] = parts;
  const current = obj as Record<string, unknown>;
  const results: string[] = [];

  if (head === '*') {
    for (const key of Object.keys(current)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      results.push(...expandGlobParts(current[key], tail, newPrefix));
    }
  } else {
    if (head in current) {
      const newPrefix = prefix ? `${prefix}.${head}` : head;
      results.push(...expandGlobParts(current[head], tail, newPrefix));
    }
  }

  return results;
}

function findAllSensitivePaths(
  obj: unknown,
  prefix: string,
  patterns: string[],
  matches: SensitiveMatch[]
): void {
  if (obj === null || obj === undefined || typeof obj !== 'object') return;

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      const keyMatches = patterns.some(p =>
        key.toLowerCase().includes(p.toLowerCase())
      );
      if (keyMatches) {
        matches.push({
          path: fullPath,
          originalValue: value,
          placeholder: `{{SENSITIVE:${fullPath}}}`,
        });
      }
    } else if (typeof value === 'object') {
      findAllSensitivePaths(value, fullPath, patterns, matches);
    }
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current) || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}
