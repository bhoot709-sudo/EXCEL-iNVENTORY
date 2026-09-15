import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
  runTransaction,
  increment,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  InventoryItem, 
  Invoice, 
  Customer, 
  ReturnedProduct, 
  DailyOrderQuery,
  ShopConfig 
} from '../types';

export type SyncState = 'connected' | 'syncing' | 'offline' | 'error';

export interface CloudStatusInfo {
  state: SyncState;
  lastSyncedAt: Date | null;
  pendingWritesCount: number;
  errorMessage?: string;
  counts: {
    inventory: number;
    invoices: number;
    customers: number;
    returns: number;
    dailyQueries: number;
    shopConfig: boolean;
  };
}

let syncStatusListeners: Array<(status: CloudStatusInfo) => void> = [];

let currentStatus: CloudStatusInfo = {
  state: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connected',
  lastSyncedAt: null,
  pendingWritesCount: 0,
  counts: {
    inventory: 0,
    invoices: 0,
    customers: 0,
    returns: 0,
    dailyQueries: 0,
    shopConfig: false,
  },
};

function notifyStatus(update: Partial<CloudStatusInfo>) {
  currentStatus = {
    ...currentStatus,
    ...update,
    counts: {
      ...currentStatus.counts,
      ...(update.counts || {}),
    },
  };
  syncStatusListeners.forEach((fn) => {
    try {
      fn(currentStatus);
    } catch (e) {
      console.warn('Sync status callback error', e);
    }
  });
}

// Window online/offline event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifyStatus({ state: 'connected', errorMessage: undefined });
  });
  window.addEventListener('offline', () => {
    notifyStatus({ state: 'offline' });
  });
}

/**
 * Executes batch writes in safe chunks of 300 operations to never exceed Firestore's 500 hard-limit
 */
async function commitInBatches<T>(
  items: T[],
  batchHandler: (batch: ReturnType<typeof writeBatch>, item: T) => void,
  chunkSize = 300
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const item of chunk) {
      batchHandler(batch, item);
    }
    await batch.commit();
  }
}

export const cloudSync = {
  // Subscribe to status changes for UI badges
  subscribeStatus(listener: (status: CloudStatusInfo) => void) {
    syncStatusListeners.push(listener);
    listener(currentStatus);
    return () => {
      syncStatusListeners = syncStatusListeners.filter((fn) => fn !== listener);
    };
  },

  getCurrentStatus(): CloudStatusInfo {
    return currentStatus;
  },

  // Real-time Inventory listener
  subscribeInventory(callback: (items: InventoryItem[]) => void) {
    const colRef = collection(db, 'inventory');
    return onSnapshot(
      colRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        const items: InventoryItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as InventoryItem);
        });
        const hasPending = snapshot.metadata.hasPendingWrites;
        notifyStatus({
          state: hasPending ? 'syncing' : 'connected',
          lastSyncedAt: new Date(),
          pendingWritesCount: hasPending ? 1 : 0,
          counts: { ...currentStatus.counts, inventory: items.length },
        });
        callback(items);
      },
      (err) => {
        console.warn('Inventory cloud sync listener offline or unauthenticated:', err.message);
        notifyStatus({ state: 'offline', errorMessage: err.message });
      }
    );
  },

  // Save / update single inventory item in Cloud
  async saveInventoryItem(item: InventoryItem) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'inventory', item.id);
      await setDoc(docRef, item, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to save inventory item to cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Atomic stock decrement for multi-device checkout to prevent race conditions
  async atomicDeductStock(lineItems: Array<{ itemId: string; quantity: number }>) {
    notifyStatus({ state: 'syncing' });
    try {
      await runTransaction(db, async (transaction) => {
        for (const line of lineItems) {
          const itemRef = doc(db, 'inventory', line.itemId);
          const itemSnap = await transaction.get(itemRef);
          if (itemSnap.exists()) {
            const currentStock = Number(itemSnap.data().stockQuantity) || 0;
            const newStock = Math.max(0, currentStock - line.quantity);
            transaction.update(itemRef, { stockQuantity: newStock });
          }
        }
      });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Atomic stock deduction error, attempting fallback update:', err);
      // Fallback in case of document locks or offline cache
      for (const line of lineItems) {
        try {
          const itemRef = doc(db, 'inventory', line.itemId);
          await updateDoc(itemRef, {
            stockQuantity: increment(-line.quantity),
          });
        } catch {
          // handled by local state
        }
      }
    }
  },

  // Delete inventory item from Cloud
  async deleteInventoryItem(itemId: string) {
    notifyStatus({ state: 'syncing' });
    try {
      await deleteDoc(doc(db, 'inventory', itemId));
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to delete inventory item from cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Bulk save inventory with chunked batches
  async bulkSaveInventory(items: InventoryItem[]) {
    notifyStatus({ state: 'syncing' });
    try {
      await commitInBatches(items, (batch, item) => {
        const docRef = doc(db, 'inventory', item.id);
        batch.set(docRef, item, { merge: true });
      });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to batch save inventory to cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Real-time Invoices listener
  subscribeInvoices(callback: (invoices: Invoice[]) => void) {
    const colRef = collection(db, 'invoices');
    return onSnapshot(
      colRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        const invoices: Invoice[] = [];
        snapshot.forEach((docSnap) => {
          invoices.push(docSnap.data() as Invoice);
        });
        // Sort descending by date
        invoices.sort((a, b) => (b.date > a.date ? 1 : -1));
        const hasPending = snapshot.metadata.hasPendingWrites;
        notifyStatus({
          state: hasPending ? 'syncing' : 'connected',
          lastSyncedAt: new Date(),
          counts: { ...currentStatus.counts, invoices: invoices.length },
        });
        callback(invoices);
      },
      (err) => {
        console.warn('Invoices cloud sync listener offline:', err.message);
        notifyStatus({ state: 'offline', errorMessage: err.message });
      }
    );
  },

  // Save Invoice to Cloud
  async saveInvoice(invoice: Invoice) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'invoices', invoice.id);
      await setDoc(docRef, invoice, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to save invoice to cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Bulk save invoices with chunked batches
  async bulkSaveInvoices(invoices: Invoice[]) {
    notifyStatus({ state: 'syncing' });
    try {
      await commitInBatches(invoices, (batch, inv) => {
        const docRef = doc(db, 'invoices', inv.id);
        batch.set(docRef, inv, { merge: true });
      });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to batch save invoices to cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Real-time Customers listener
  subscribeCustomers(callback: (customers: Customer[]) => void) {
    const colRef = collection(db, 'customers');
    return onSnapshot(
      colRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        const customers: Customer[] = [];
        snapshot.forEach((docSnap) => {
          customers.push(docSnap.data() as Customer);
        });
        const hasPending = snapshot.metadata.hasPendingWrites;
        notifyStatus({
          state: hasPending ? 'syncing' : 'connected',
          lastSyncedAt: new Date(),
          counts: { ...currentStatus.counts, customers: customers.length },
        });
        callback(customers);
      },
      (err) => {
        console.warn('Customers cloud sync listener offline:', err.message);
        notifyStatus({ state: 'offline', errorMessage: err.message });
      }
    );
  },

  // Save / update customer in Cloud
  async saveCustomer(customer: Customer) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'customers', customer.id);
      await setDoc(docRef, customer, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to save customer to cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Delete customer
  async deleteCustomer(customerId: string) {
    notifyStatus({ state: 'syncing' });
    try {
      await deleteDoc(doc(db, 'customers', customerId));
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to delete customer from cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Bulk save customers with chunked batches
  async bulkSaveCustomers(customers: Customer[]) {
    notifyStatus({ state: 'syncing' });
    try {
      await commitInBatches(customers, (batch, c) => {
        const docRef = doc(db, 'customers', c.id);
        batch.set(docRef, c, { merge: true });
      });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to batch save customers to cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Real-time Returns listener
  subscribeReturns(callback: (returns: ReturnedProduct[]) => void) {
    const colRef = collection(db, 'returns');
    return onSnapshot(
      colRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        const returns: ReturnedProduct[] = [];
        snapshot.forEach((docSnap) => {
          returns.push(docSnap.data() as ReturnedProduct);
        });
        const hasPending = snapshot.metadata.hasPendingWrites;
        notifyStatus({
          state: hasPending ? 'syncing' : 'connected',
          lastSyncedAt: new Date(),
          counts: { ...currentStatus.counts, returns: returns.length },
        });
        callback(returns);
      },
      (err) => {
        console.warn('Returns cloud sync listener offline:', err.message);
        notifyStatus({ state: 'offline', errorMessage: err.message });
      }
    );
  },

  // Save / update return in Cloud
  async saveReturn(ret: ReturnedProduct) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'returns', ret.id);
      await setDoc(docRef, ret, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to save return to cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Bulk save returns with chunked batches
  async bulkSaveReturns(returns: ReturnedProduct[]) {
    notifyStatus({ state: 'syncing' });
    try {
      await commitInBatches(returns, (batch, r) => {
        const docRef = doc(db, 'returns', r.id);
        batch.set(docRef, r, { merge: true });
      });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to batch save returns to cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Real-time Daily Order Queries listener
  subscribeDailyQueries(callback: (queries: DailyOrderQuery[]) => void) {
    const colRef = collection(db, 'daily_queries');
    return onSnapshot(
      colRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        const queries: DailyOrderQuery[] = [];
        snapshot.forEach((docSnap) => {
          queries.push(docSnap.data() as DailyOrderQuery);
        });
        // Sort descending by date, then time
        queries.sort((a, b) => (b.date + b.time > a.date + a.time ? 1 : -1));
        const hasPending = snapshot.metadata.hasPendingWrites;
        notifyStatus({
          state: hasPending ? 'syncing' : 'connected',
          lastSyncedAt: new Date(),
          counts: { ...currentStatus.counts, dailyQueries: queries.length },
        });
        callback(queries);
      },
      (err) => {
        console.warn('Daily queries cloud sync listener offline:', err.message);
        notifyStatus({ state: 'offline', errorMessage: err.message });
      }
    );
  },

  // Save / update daily query in Cloud
  async saveDailyQuery(query: DailyOrderQuery) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'daily_queries', query.id);
      await setDoc(docRef, query, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to save daily query to cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Delete daily query from Cloud
  async deleteDailyQuery(queryId: string) {
    notifyStatus({ state: 'syncing' });
    try {
      await deleteDoc(doc(db, 'daily_queries', queryId));
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to delete daily query from cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Bulk save daily queries with chunked batches
  async bulkSaveDailyQueries(queries: DailyOrderQuery[]) {
    notifyStatus({ state: 'syncing' });
    try {
      await commitInBatches(queries, (batch, q) => {
        const docRef = doc(db, 'daily_queries', q.id);
        batch.set(docRef, q, { merge: true });
      });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to batch save daily queries to cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Real-time Shop Configuration listener
  subscribeShopConfig(callback: (config: ShopConfig) => void) {
    const docRef = doc(db, 'shop_config', 'default');
    return onSnapshot(
      docRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        if (snapshot.exists()) {
          const config = snapshot.data() as ShopConfig;
          notifyStatus({
            state: snapshot.metadata.hasPendingWrites ? 'syncing' : 'connected',
            lastSyncedAt: new Date(),
            counts: { ...currentStatus.counts, shopConfig: true },
          });
          callback(config);
        }
      },
      (err) => {
        console.warn('ShopConfig cloud sync listener offline:', err.message);
      }
    );
  },

  // Save Shop Configuration in Cloud
  async saveShopConfig(config: ShopConfig) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'shop_config', 'default');
      await setDoc(docRef, config, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date() });
    } catch (err: any) {
      console.warn('Failed to save shop config to cloud:', err);
      notifyStatus({ state: 'offline', errorMessage: err?.message });
    }
  },

  // Seed cloud database if collections are empty
  async seedInitialDataIfEmpty(
    initialInventory: InventoryItem[],
    initialInvoices: Invoice[],
    initialCustomers: Customer[],
    initialReturns: ReturnedProduct[],
    initialQueries: DailyOrderQuery[] = [],
    initialConfig?: ShopConfig
  ) {
    try {
      const invSnap = await getDocs(collection(db, 'inventory'));
      if (invSnap.empty && initialInventory.length > 0) {
        await this.bulkSaveInventory(initialInventory);
      }

      const invoiceSnap = await getDocs(collection(db, 'invoices'));
      if (invoiceSnap.empty && initialInvoices.length > 0) {
        await this.bulkSaveInvoices(initialInvoices);
      }

      const custSnap = await getDocs(collection(db, 'customers'));
      if (custSnap.empty && initialCustomers.length > 0) {
        await this.bulkSaveCustomers(initialCustomers);
      }

      const retSnap = await getDocs(collection(db, 'returns'));
      if (retSnap.empty && initialReturns.length > 0) {
        await this.bulkSaveReturns(initialReturns);
      }

      const querySnap = await getDocs(collection(db, 'daily_queries'));
      if (querySnap.empty && initialQueries.length > 0) {
        await this.bulkSaveDailyQueries(initialQueries);
      }

      if (initialConfig) {
        const configSnap = await getDocs(collection(db, 'shop_config'));
        if (configSnap.empty) {
          await this.saveShopConfig(initialConfig);
        }
      }
    } catch (err) {
      console.warn('Cloud database initial seeding skipped or offline:', err);
    }
  },
};

