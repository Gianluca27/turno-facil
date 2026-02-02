import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Storage wrapper compatible with Expo Go
 * Provides a synchronous-like API using an in-memory cache
 * that syncs with AsyncStorage
 */
class Storage {
  private cache: Map<string, string> = new Map();
  private id: string;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(options: { id: string }) {
    this.id = options.id;
    this.initPromise = this.initialize();
  }

  private getKey(key: string): string {
    return `${this.id}:${key}`;
  }

  private async initialize(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const relevantKeys = keys.filter(k => k.startsWith(`${this.id}:`));

      if (relevantKeys.length > 0) {
        const pairs = await AsyncStorage.multiGet(relevantKeys);
        pairs.forEach(([key, value]) => {
          if (value !== null) {
            // Remove the prefix when storing in cache
            const shortKey = key.replace(`${this.id}:`, '');
            this.cache.set(shortKey, value);
          }
        });
      }

      this.initialized = true;
    } catch (error) {
      console.error('Storage initialization error:', error);
      this.initialized = true;
    }
  }

  async waitForInit(): Promise<void> {
    if (this.initialized) return;
    await this.initPromise;
  }

  getString(key: string): string | undefined {
    return this.cache.get(key);
  }

  set(key: string, value: string): void {
    this.cache.set(key, value);
    // Fire and forget - save to AsyncStorage in background
    AsyncStorage.setItem(this.getKey(key), value).catch(err =>
      console.error('Storage set error:', err)
    );
  }

  delete(key: string): void {
    this.cache.delete(key);
    // Fire and forget - remove from AsyncStorage in background
    AsyncStorage.removeItem(this.getKey(key)).catch(err =>
      console.error('Storage delete error:', err)
    );
  }

  contains(key: string): boolean {
    return this.cache.has(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  clearAll(): void {
    const keys = this.getAllKeys().map(k => this.getKey(k));
    this.cache.clear();
    AsyncStorage.multiRemove(keys).catch(err =>
      console.error('Storage clearAll error:', err)
    );
  }
}

// Export singleton instance for auth storage
export const authStorage = new Storage({ id: 'auth-storage' });

// Export class for creating other storage instances
export { Storage };
