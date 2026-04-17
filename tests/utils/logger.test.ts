import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger } from '../../src/utils/logger.js';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
  });

  it('should create instance with default level', () => {
    expect(logger).toBeDefined();
  });

  it('should have info, warn, error, success methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.success).toBe('function');
  });

  it('should format info messages with chalk', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('test message');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('test message');
    spy.mockRestore();
  });

  it('should format error messages', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('error message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should support verbose mode', () => {
    const verboseLogger = new Logger(true);
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    verboseLogger.debug('debug msg');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should suppress debug in non-verbose mode', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('debug msg');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});