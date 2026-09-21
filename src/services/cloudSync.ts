import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
  query,
  limit,
  runTransaction,
  increment,
  updateDoc,
  enableNetwork,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { 
  InventoryItem, 
  Invoice, 
  Customer, 
  ReturnedProduct, 
  DailyOrderQuery,
  ShopConfig,
  ActionLog
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export type SyncState = 'connected' | 'syncing' | 'offline' | 'error';

export interface CloudStatusInfo {
  state: SyncState;
  isNetworkOnline: boolean;
  lastSyncedAt: Date | null;
  pendingWritesCount: number;
  errorMessage?: string;
  isReconnecting?: boolean;
  counts: {
    inventory: number;
    invoices: number;
    customers: number;
    returns: number;
    dailyQueries: number;
    actionLogs: number;
    shopConfig: boolean;
  };
}

let syncStatusListeners: Array<(status: CloudStatusInfo) => void> = [];

const isInitialOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

let currentStatus: CloudStatusInfo = {
  state: isInitialOnline ? 'connected' : 'offline',
  isNetworkOnline: isInitialOnline,
  lastSyncedAt: null,
  pendingWritesCount: 0,
  isReconnecting: false,
  counts: {
    inventory: 0,
    invoices: 0,
    customers: 0,
    returns: 0,
    dailyQueries: 0,
    actionLogs: 0,
    shopConfig: false,
  },
};

function notifyStatus(update: Partial<CloudStatusInfo>) {
  currentStatus = {
    ...currentStatus,
    ...update,
    isNetworkOnline: typeof update.isNetworkOnline === 'boolean' 
      ? update.isNetworkOnline 
      : (typeof navigator !== 'undefined' ? navigator.onLine : true),
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

// Global active subscription callbacks
const inventorySubscribers = new Set<(items: InventoryItem[]) => void>();
const invoicesSubscribers = new Set<(invoices: Invoice[]) => void>();
const customersSubscribers = new Set<(customers: Customer[]) => void>();
const returnsSubscribers = new Set<(returns: ReturnedProduct[]) => void>();
const dailyQueriesSubscribers = new Set<(queries: DailyOrderQuery[]) => void>();
const shopConfigSubscribers = new Set<(config: ShopConfig) => void>();
const actionLogsSubscribers = new Set<(logs: ActionLog[]) => void>();

let activeUnsubInventory: (() => void) | null = null;
let activeUnsubInvoices: (() => void) | null = null;
let activeUnsubCustomers: (() => void) | null = null;
let activeUnsubReturns: (() => void) | null = null;
let activeUnsubDailyQueries: (() => void) | null = null;
let activeUnsubShopConfig: (() => void) | null = null;
let activeUnsubActionLogs: (() => void) | null = null;

let reconnectAttempts = 0;

function handleListenerError(channelName: string, err: any) {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const errMsg = err?.message || String(err);
  const isPermissionError = err?.code === 'permission-denied' || errMsg.includes('insufficient permissions');
  
  if (isPermissionError) {
    handleFirestoreError(err, OperationType.LIST, channelName);
  }

  const isOfflineOrTimeout = 
    !isOnline || 
    err?.code === 'unavailable' || 
    errMsg.includes('10 seconds') || 
    errMsg.includes('offline') ||
    errMsg.includes('Could not reach');

  if (isOfflineOrTimeout || !isOnline) {
    console.info(`[Firestore CloudSync] ${channelName}: local cache mode active.`);
    notifyStatus({ 
      state: 'offline', 
      isNetworkOnline: isOnline,
      errorMessage: 'Local storage active. Cloud sync will resume seamlessly.' 
    });
  } else {
    console.warn(`[Firestore CloudSync] ${channelName} listener notice:`, errMsg);
    notifyStatus({
      state: 'syncing',
      isNetworkOnline: true,
      errorMessage: errMsg || 'Refreshing cloud data stream...',
    });
  }
}

// Helper to start the inventory listener
function startInventoryListener() {
  if (activeUnsubInventory) {
    try { activeUnsubInventory(); } catch {}
    activeUnsubInventory = null;
  }
  if (inventorySubscribers.size === 0) return;

  const colRef = collection(db, 'inventory');
  activeUnsubInventory = onSnapshot(
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
        isNetworkOnline: true,
        lastSyncedAt: new Date(),
        pendingWritesCount: hasPending ? 1 : 0,
        errorMessage: undefined,
        counts: { ...currentStatus.counts, inventory: items.length },
      });
      reconnectAttempts = 0;
      inventorySubscribers.forEach((cb) => cb(items));
    },
    (err) => handleListenerError('inventory', err)
  );
}

// Helper to start the invoices listener
function startInvoicesListener() {
  if (activeUnsubInvoices) {
    try { activeUnsubInvoices(); } catch {}
    activeUnsubInvoices = null;
  }
  if (invoicesSubscribers.size === 0) return;

  const colRef = collection(db, 'invoices');
  activeUnsubInvoices = onSnapshot(
    colRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      const invoices: Invoice[] = [];
      snapshot.forEach((docSnap) => {
        invoices.push(docSnap.data() as Invoice);
      });
      invoices.sort((a, b) => (b.date > a.date ? 1 : -1));
      const hasPending = snapshot.metadata.hasPendingWrites;
      notifyStatus({
        state: hasPending ? 'syncing' : 'connected',
        isNetworkOnline: true,
        lastSyncedAt: new Date(),
        errorMessage: undefined,
        counts: { ...currentStatus.counts, invoices: invoices.length },
      });
      reconnectAttempts = 0;
      invoicesSubscribers.forEach((cb) => cb(invoices));
    },
    (err) => handleListenerError('invoices', err)
  );
}

// Helper to start the customers listener
function startCustomersListener() {
  if (activeUnsubCustomers) {
    try { activeUnsubCustomers(); } catch {}
    activeUnsubCustomers = null;
  }
  if (customersSubscribers.size === 0) return;

  const colRef = collection(db, 'customers');
  activeUnsubCustomers = onSnapshot(
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
        isNetworkOnline: true,
        lastSyncedAt: new Date(),
        errorMessage: undefined,
        counts: { ...currentStatus.counts, customers: customers.length },
      });
      reconnectAttempts = 0;
      customersSubscribers.forEach((cb) => cb(customers));
    },
    (err) => handleListenerError('customers', err)
  );
}

// Helper to start the returns listener
function startReturnsListener() {
  if (activeUnsubReturns) {
    try { activeUnsubReturns(); } catch {}
    activeUnsubReturns = null;
  }
  if (returnsSubscribers.size === 0) return;

  const colRef = collection(db, 'returns');
  activeUnsubReturns = onSnapshot(
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
        isNetworkOnline: true,
        lastSyncedAt: new Date(),
        errorMessage: undefined,
        counts: { ...currentStatus.counts, returns: returns.length },
      });
      reconnectAttempts = 0;
      returnsSubscribers.forEach((cb) => cb(returns));
    },
    (err) => handleListenerError('returns', err)
  );
}

// Helper to start daily queries listener
function startDailyQueriesListener() {
  if (activeUnsubDailyQueries) {
    try { activeUnsubDailyQueries(); } catch {}
    activeUnsubDailyQueries = null;
  }
  if (dailyQueriesSubscribers.size === 0) return;

  const colRef = collection(db, 'daily_queries');
  activeUnsubDailyQueries = onSnapshot(
    colRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      const queries: DailyOrderQuery[] = [];
      snapshot.forEach((docSnap) => {
        queries.push(docSnap.data() as DailyOrderQuery);
      });
      queries.sort((a, b) => (b.date + b.time > a.date + a.time ? 1 : -1));
      const hasPending = snapshot.metadata.hasPendingWrites;
      notifyStatus({
        state: hasPending ? 'syncing' : 'connected',
        isNetworkOnline: true,
        lastSyncedAt: new Date(),
        errorMessage: undefined,
        counts: { ...currentStatus.counts, dailyQueries: queries.length },
      });
      reconnectAttempts = 0;
      dailyQueriesSubscribers.forEach((cb) => cb(queries));
    },
    (err) => handleListenerError('daily_queries', err)
  );
}

// Helper to start shop config listener
function startShopConfigListener() {
  if (activeUnsubShopConfig) {
    try { activeUnsubShopConfig(); } catch {}
    activeUnsubShopConfig = null;
  }
  if (shopConfigSubscribers.size === 0) return;

  const docRef = doc(db, 'shop_config', 'default');
  activeUnsubShopConfig = onSnapshot(
    docRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      if (snapshot.exists()) {
        const config = snapshot.data() as ShopConfig;
        notifyStatus({
          state: snapshot.metadata.hasPendingWrites ? 'syncing' : 'connected',
          isNetworkOnline: true,
          lastSyncedAt: new Date(),
          errorMessage: undefined,
          counts: { ...currentStatus.counts, shopConfig: true },
        });
        reconnectAttempts = 0;
        shopConfigSubscribers.forEach((cb) => cb(config));
      }
    },
    (err) => handleListenerError('shop_config', err)
  );
}

// Helper to start action logs listener
function startActionLogsListener() {
  if (activeUnsubActionLogs) {
    try { activeUnsubActionLogs(); } catch {}
    activeUnsubActionLogs = null;
  }
  if (actionLogsSubscribers.size === 0) return;

  const colRef = collection(db, 'action_logs');
  activeUnsubActionLogs = onSnapshot(
    colRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      const logs: ActionLog[] = [];
      snapshot.forEach((docSnap) => {
        logs.push(docSnap.data() as ActionLog);
      });
      // Sort newest first by timestamp or date+time
      logs.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
      const hasPending = snapshot.metadata.hasPendingWrites;
      notifyStatus({
        state: hasPending ? 'syncing' : 'connected',
        isNetworkOnline: true,
        lastSyncedAt: new Date(),
        errorMessage: undefined,
        counts: { ...currentStatus.counts, actionLogs: logs.length },
      });
      reconnectAttempts = 0;
      actionLogsSubscribers.forEach((cb) => cb(logs));
    },
    (err) => handleListenerError('action_logs', err)
  );
}

function restartAllActiveListeners() {
  startInventoryListener();
  startInvoicesListener();
  startCustomersListener();
  startReturnsListener();
  startDailyQueriesListener();
  startShopConfigListener();
  startActionLogsListener();
}

// Window online/offline event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    notifyStatus({ 
      state: 'syncing', 
      isNetworkOnline: true, 
      errorMessage: undefined 
    });
    reconnectAttempts = 0;
    try {
      enableNetwork(db).catch(() => {});
    } catch {}
    restartAllActiveListeners();
  });

  window.addEventListener('offline', () => {
    notifyStatus({ 
      state: 'offline', 
      isNetworkOnline: false,
      errorMessage: 'Device has no active internet connection' 
    });
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

  // Manual reconnect and test method with health check
  async reconnect(): Promise<{ success: boolean; message: string }> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      notifyStatus({
        state: 'offline',
        isNetworkOnline: false,
        errorMessage: 'Device has no internet connection',
      });
      return { success: false, message: 'Your device is disconnected from the internet.' };
    }

    notifyStatus({ state: 'syncing', isReconnecting: true, errorMessage: undefined });

    try {
      try {
        await enableNetwork(db);
      } catch (e) {
        // Network may already be enabled
      }

      // Test active read from Firestore with lightweight limit
      const testSnap = await getDocs(query(collection(db, 'inventory'), limit(1)));
      reconnectAttempts = 0;
      restartAllActiveListeners();

      notifyStatus({
        state: 'connected',
        isNetworkOnline: true,
        isReconnecting: false,
        lastSyncedAt: new Date(),
        errorMessage: undefined,
      });

      return {
        success: true,
        message: 'Cloud connection active and verified. Real-time sync stream is operational.',
      };
    } catch (err: any) {
      console.warn('Manual reconnect warning:', err);
      notifyStatus({
        state: 'syncing',
        isReconnecting: false,
        isNetworkOnline: true,
        errorMessage: err?.message || 'Sync channel reconnecting in background...',
      });
      return {
        success: false,
        message: err?.message || 'Cloud sync is reconnecting in background.',
      };
    }
  },

  // Real-time Inventory listener
  subscribeInventory(callback: (items: InventoryItem[]) => void) {
    inventorySubscribers.add(callback);
    startInventoryListener();
    return () => {
      inventorySubscribers.delete(callback);
      if (inventorySubscribers.size === 0 && activeUnsubInventory) {
        try { activeUnsubInventory(); } catch {}
        activeUnsubInventory = null;
      }
    };
  },

  // Save / update single inventory item in Cloud
  async saveInventoryItem(item: InventoryItem) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'inventory', item.id);
      await setDoc(docRef, item, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to save inventory item to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message || 'Saved in local cache. Will sync automatically.' 
      });
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
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Atomic stock deduction error, attempting fallback update:', err);
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
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to delete inventory item from cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
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
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to batch save inventory to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
    }
  },

  // Real-time Invoices listener
  subscribeInvoices(callback: (invoices: Invoice[]) => void) {
    invoicesSubscribers.add(callback);
    startInvoicesListener();
    return () => {
      invoicesSubscribers.delete(callback);
      if (invoicesSubscribers.size === 0 && activeUnsubInvoices) {
        try { activeUnsubInvoices(); } catch {}
        activeUnsubInvoices = null;
      }
    };
  },

  // Save Invoice to Cloud
  async saveInvoice(invoice: Invoice) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'invoices', invoice.id);
      await setDoc(docRef, invoice, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to save invoice to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
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
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to batch save invoices to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
    }
  },

  // Real-time Customers listener
  subscribeCustomers(callback: (customers: Customer[]) => void) {
    customersSubscribers.add(callback);
    startCustomersListener();
    return () => {
      customersSubscribers.delete(callback);
      if (customersSubscribers.size === 0 && activeUnsubCustomers) {
        try { activeUnsubCustomers(); } catch {}
        activeUnsubCustomers = null;
      }
    };
  },

  // Save / update customer in Cloud
  async saveCustomer(customer: Customer) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'customers', customer.id);
      await setDoc(docRef, customer, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to save customer to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
    }
  },

  // Delete customer
  async deleteCustomer(customerId: string) {
    notifyStatus({ state: 'syncing' });
    try {
      await deleteDoc(doc(db, 'customers', customerId));
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to delete customer from cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
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
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to batch save customers to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
    }
  },

  // Real-time Returns listener
  subscribeReturns(callback: (returns: ReturnedProduct[]) => void) {
    returnsSubscribers.add(callback);
    startReturnsListener();
    return () => {
      returnsSubscribers.delete(callback);
      if (returnsSubscribers.size === 0 && activeUnsubReturns) {
        try { activeUnsubReturns(); } catch {}
        activeUnsubReturns = null;
      }
    };
  },

  // Save / update return in Cloud
  async saveReturn(ret: ReturnedProduct) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'returns', ret.id);
      await setDoc(docRef, ret, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to save return to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
    }
  },

  // Delete return from Cloud
  async deleteReturn(returnId: string) {
    notifyStatus({ state: 'syncing' });
    try {
      await deleteDoc(doc(db, 'returns', returnId));
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to delete return from cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
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
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to batch save returns to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
    }
  },

  // Real-time Daily Order Queries listener
  subscribeDailyQueries(callback: (queries: DailyOrderQuery[]) => void) {
    dailyQueriesSubscribers.add(callback);
    startDailyQueriesListener();
    return () => {
      dailyQueriesSubscribers.delete(callback);
      if (dailyQueriesSubscribers.size === 0 && activeUnsubDailyQueries) {
        try { activeUnsubDailyQueries(); } catch {}
        activeUnsubDailyQueries = null;
      }
    };
  },

  // Save / update daily query in Cloud
  async saveDailyQuery(query: DailyOrderQuery) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'daily_queries', query.id);
      await setDoc(docRef, query, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to save daily query to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
    }
  },

  // Delete daily query from Cloud
  async deleteDailyQuery(queryId: string) {
    notifyStatus({ state: 'syncing' });
    try {
      await deleteDoc(doc(db, 'daily_queries', queryId));
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to delete daily query from cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
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
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to batch save daily queries to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
    }
  },

  // Real-time Shop Configuration listener
  subscribeShopConfig(callback: (config: ShopConfig) => void) {
    shopConfigSubscribers.add(callback);
    startShopConfigListener();
    return () => {
      shopConfigSubscribers.delete(callback);
      if (shopConfigSubscribers.size === 0 && activeUnsubShopConfig) {
        try { activeUnsubShopConfig(); } catch {}
        activeUnsubShopConfig = null;
      }
    };
  },

  // Real-time Action Logs listener
  subscribeActionLogs(callback: (logs: ActionLog[]) => void) {
    actionLogsSubscribers.add(callback);
    startActionLogsListener();
    return () => {
      actionLogsSubscribers.delete(callback);
      if (actionLogsSubscribers.size === 0 && activeUnsubActionLogs) {
        try { activeUnsubActionLogs(); } catch {}
        activeUnsubActionLogs = null;
      }
    };
  },

  // Save / log action to cloud for future reference
  async saveActionLog(log: ActionLog) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'action_logs', log.id);
      await setDoc(docRef, log, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to save action log to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
    }
  },

  // Delete a specific action log
  async deleteActionLog(logId: string) {
    notifyStatus({ state: 'syncing' });
    try {
      await deleteDoc(doc(db, 'action_logs', logId));
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to delete action log from cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
    }
  },

  // Bulk save action logs with chunked batches
  async bulkSaveActionLogs(logs: ActionLog[]) {
    notifyStatus({ state: 'syncing' });
    try {
      await commitInBatches(logs, (batch, log) => {
        const docRef = doc(db, 'action_logs', log.id);
        batch.set(docRef, log, { merge: true });
      });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to batch save action logs to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
    }
  },

  // Clear all action logs
  async clearAllActionLogs() {
    notifyStatus({ state: 'syncing' });
    try {
      const snap = await getDocs(collection(db, 'action_logs'));
      const batch = writeBatch(db);
      snap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to clear action logs in cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
    }
  },

  // Save Shop Configuration in Cloud
  async saveShopConfig(config: ShopConfig) {
    notifyStatus({ state: 'syncing' });
    try {
      const docRef = doc(db, 'shop_config', 'default');
      await setDoc(docRef, config, { merge: true });
      notifyStatus({ state: 'connected', lastSyncedAt: new Date(), errorMessage: undefined });
    } catch (err: any) {
      console.warn('Failed to save shop config to cloud:', err);
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      notifyStatus({ 
        state: isOnline ? 'syncing' : 'offline', 
        errorMessage: err?.message 
      });
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
      // Use lightweight query(..., limit(1)) so we don't block connection or download entire database
      const invSnap = await getDocs(query(collection(db, 'inventory'), limit(1)));
      if (invSnap.empty && initialInventory.length > 0) {
        await this.bulkSaveInventory(initialInventory);
      }

      const invoiceSnap = await getDocs(query(collection(db, 'invoices'), limit(1)));
      if (invoiceSnap.empty && initialInvoices.length > 0) {
        await this.bulkSaveInvoices(initialInvoices);
      }

      const custSnap = await getDocs(query(collection(db, 'customers'), limit(1)));
      if (custSnap.empty && initialCustomers.length > 0) {
        await this.bulkSaveCustomers(initialCustomers);
      }

      const retSnap = await getDocs(query(collection(db, 'returns'), limit(1)));
      if (retSnap.empty && initialReturns.length > 0) {
        await this.bulkSaveReturns(initialReturns);
      }

      const querySnap = await getDocs(query(collection(db, 'daily_queries'), limit(1)));
      if (querySnap.empty && initialQueries.length > 0) {
        await this.bulkSaveDailyQueries(initialQueries);
      }

      if (initialConfig) {
        const configSnap = await getDocs(query(collection(db, 'shop_config'), limit(1)));
        if (configSnap.empty) {
          await this.saveShopConfig(initialConfig);
        }
      }
    } catch (err) {
      console.info('Initial cloud sync check completed (local cache fallback active):', err);
    }
  },
};
