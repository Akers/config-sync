import type { SyncProvider } from '../types/index.js';

export type { SyncProvider } from '../types/index.js';

export interface ProviderConstructor {
  new (): SyncProvider;
}
