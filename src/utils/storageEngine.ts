/**
 * High-performance non-blocking local storage manager.
 * Batches and debounces JSON serialization off the critical render loop.
 */

type KeyType =
  | 'gadget_inventory_master'
  | 'gadget_invoices_master'
  | 'gadget_customers_master'
  | 'gadget_returns_master'
  | 'gadget_daily_queries_master'
  | 'gadget_shop_config'
  | 'gadget_action_logs_master'
  | 'gadget_label_reminders_master';

const pendingWrites = new Map<KeyType, { value: any; timer: ReturnType<typeof setTimeout> | null }>();

const DEBOUNCE_MS = 250;

export function debounceSaveToStorage<T>(key: KeyType, data: T, immediate = false): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  const existing = pendingWrites.get(key);
  if (existing?.timer) {
    clearTimeout(existing.timer);
  }

  if (immediate) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      pendingWrites.delete(key);
    } catch (e) {
      console.warn(`[StorageEngine] Failed to save key "${key}" immediately:`, e);
    }
    return;
  }

  const timer = setTimeout(() => {
    try {
      const entry = pendingWrites.get(key);
      if (entry) {
        localStorage.setItem(key, JSON.stringify(entry.value));
        pendingWrites.delete(key);
      }
    } catch (e) {
      console.warn(`[StorageEngine] Debounced write failed for "${key}":`, e);
    }
  }, DEBOUNCE_MS);

  pendingWrites.set(key, { value: data, timer });
}

export function flushAllPendingStorageWrites(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  pendingWrites.forEach((entry, key) => {
    if (entry.timer) clearTimeout(entry.timer);
    try {
      localStorage.setItem(key, JSON.stringify(entry.value));
    } catch (e) {
      console.warn(`[StorageEngine] Flush error for "${key}":`, e);
    }
  });
  pendingWrites.clear();
}

// Flush pending writes before window unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    flushAllPendingStorageWrites();
  });
}
