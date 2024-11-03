import storage from 'node-persist';
import config from './config';
import * as path from 'path';
import * as fse from 'fs-extra';

export default class PersistClass {
  constructor() {
    this.init();
  }

  private async init() {
    const persistPath = path.join(config.outputPath, '.persist');
    await fse.ensureDir(persistPath);
    await storage.init({dir: persistPath});
  }

  /**
   * Attempts to update the value of the stored key if it exists.
   * If the key/value does not exist, it is created.
   * If the key/value exists and the provided value differs
   * from the stored value, the stored value is updated and the old
   * value returned (for matching).
   * @param storageKey Storage key to query
   * @param providedItem Value content to insert/update
   */
  public async upsertOnDiff<T>(storageKey: string, providedItem: T): Promise<T | undefined> {
    let storedItem = await storage.getItem(storageKey);
    // No item with that key exists, create it and return the item.
    if (!storedItem) {
      await storage.setItem(storageKey, providedItem);
      return;
    } else {
      // Provided item does not match stored item. Update stored item and return.
      if (JSON.stringify(storedItem) !== JSON.stringify(providedItem)) {
        await storage.setItem(storageKey, providedItem);
      }
      return storedItem;
    }
  }

  public async set<T>(key: string, item: T): Promise<void> {
    await storage.setItem(key, item);
    return;
  }

  public async get<T>(key: string): Promise<T | undefined> {
    const item = await storage.getItem(key);
    if (item) return item;
    return;
  }
}
