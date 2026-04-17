import type { SyncProvider } from '../types/index.js';
import { GitProvider } from './git-provider.js';

export type { SyncProvider } from '../types/index.js';

const PROVIDERS: Record<string, () => SyncProvider> = {
  git: () => new GitProvider(),
};

export function createProvider(type: string): SyncProvider {
  const factory = PROVIDERS[type];
  if (!factory) {
    throw new Error(`Unknown provider: ${type}. Available: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  return factory();
}

export function listProviders(): string[] {
  return Object.keys(PROVIDERS);
}
