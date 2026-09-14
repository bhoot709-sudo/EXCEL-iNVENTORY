import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { InventoryItem, Invoice, Customer, ReturnedProduct, DailyOrderQuery } from '../types';

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
  // Real-time Inventory listener
  subscribeInventory(callback: (items: InventoryItem[]) => void) {
    const colRef = collection(db, 'inventory');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const items: InventoryItem[] = [];
        snapshot.forEach((docSnap) => {
          items.push(docSnap.data() as InventoryItem);
        });
        callback(items);
      },
      (err) => {
        console.warn('Inventory cloud sync listener offline or unauthenticated:', err.message);
      }
    );
  },

  // Save / update single inventory item in Cloud
  async saveInventoryItem(item: InventoryItem) {
    try {
      const docRef = doc(db, 'inventory', item.id);
      await setDoc(docRef, item, { merge: true });
    } catch (err) {
      console.warn('Failed to save inventory item to cloud:', err);
    }
  },

  // Delete inventory item from Cloud
  async deleteInventoryItem(itemId: string) {
    try {
      await deleteDoc(doc(db, 'inventory', itemId));
    } catch (err) {
      console.warn('Failed to delete inventory item from cloud:', err);
    }
  },

  // Bulk save inventory with chunked batches
  async bulkSaveInventory(items: InventoryItem[]) {
    try {
      await commitInBatches(items, (batch, item) => {
        const docRef = doc(db, 'inventory', item.id);
        batch.set(docRef, item, { merge: true });
      });
    } catch (err) {
      console.warn('Failed to batch save inventory to cloud:', err);
    }
  },

  // Real-time Invoices listener
  subscribeInvoices(callback: (invoices: Invoice[]) => void) {
    const colRef = collection(db, 'invoices');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const invoices: Invoice[] = [];
        snapshot.forEach((docSnap) => {
          invoices.push(docSnap.data() as Invoice);
        });
        // Sort descending by date
        invoices.sort((a, b) => (b.date > a.date ? 1 : -1));
        callback(invoices);
      },
      (err) => {
        console.warn('Invoices cloud sync listener offline:', err.message);
      }
    );
  },

  // Save Invoice to Cloud
  async saveInvoice(invoice: Invoice) {
    try {
      const docRef = doc(db, 'invoices', invoice.id);
      await setDoc(docRef, invoice, { merge: true });
    } catch (err) {
      console.warn('Failed to save invoice to cloud:', err);
    }
  },

  // Bulk save invoices with chunked batches
  async bulkSaveInvoices(invoices: Invoice[]) {
    try {
      await commitInBatches(invoices, (batch, inv) => {
        const docRef = doc(db, 'invoices', inv.id);
        batch.set(docRef, inv, { merge: true });
      });
    } catch (err) {
      console.warn('Failed to batch save invoices to cloud:', err);
    }
  },

  // Real-time Customers listener
  subscribeCustomers(callback: (customers: Customer[]) => void) {
    const colRef = collection(db, 'customers');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const customers: Customer[] = [];
        snapshot.forEach((docSnap) => {
          customers.push(docSnap.data() as Customer);
        });
        callback(customers);
      },
      (err) => {
        console.warn('Customers cloud sync listener offline:', err.message);
      }
    );
  },

  // Save / update customer in Cloud
  async saveCustomer(customer: Customer) {
    try {
      const docRef = doc(db, 'customers', customer.id);
      await setDoc(docRef, customer, { merge: true });
    } catch (err) {
      console.warn('Failed to save customer to cloud:', err);
    }
  },

  // Delete customer
  async deleteCustomer(customerId: string) {
    try {
      await deleteDoc(doc(db, 'customers', customerId));
    } catch (err) {
      console.warn('Failed to delete customer from cloud:', err);
    }
  },

  // Bulk save customers with chunked batches
  async bulkSaveCustomers(customers: Customer[]) {
    try {
      await commitInBatches(customers, (batch, c) => {
        const docRef = doc(db, 'customers', c.id);
        batch.set(docRef, c, { merge: true });
      });
    } catch (err) {
      console.warn('Failed to batch save customers to cloud:', err);
    }
  },

  // Real-time Returns listener
  subscribeReturns(callback: (returns: ReturnedProduct[]) => void) {
    const colRef = collection(db, 'returns');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const returns: ReturnedProduct[] = [];
        snapshot.forEach((docSnap) => {
          returns.push(docSnap.data() as ReturnedProduct);
        });
        callback(returns);
      },
      (err) => {
        console.warn('Returns cloud sync listener offline:', err.message);
      }
    );
  },

  // Save / update return in Cloud
  async saveReturn(ret: ReturnedProduct) {
    try {
      const docRef = doc(db, 'returns', ret.id);
      await setDoc(docRef, ret, { merge: true });
    } catch (err) {
      console.warn('Failed to save return to cloud:', err);
    }
  },

  // Bulk save returns with chunked batches
  async bulkSaveReturns(returns: ReturnedProduct[]) {
    try {
      await commitInBatches(returns, (batch, r) => {
        const docRef = doc(db, 'returns', r.id);
        batch.set(docRef, r, { merge: true });
      });
    } catch (err) {
      console.warn('Failed to batch save returns to cloud:', err);
    }
  },

  // Real-time Daily Order Queries listener
  subscribeDailyQueries(callback: (queries: DailyOrderQuery[]) => void) {
    const colRef = collection(db, 'daily_queries');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const queries: DailyOrderQuery[] = [];
        snapshot.forEach((docSnap) => {
          queries.push(docSnap.data() as DailyOrderQuery);
        });
        // Sort descending by date, then time
        queries.sort((a, b) => (b.date + b.time > a.date + a.time ? 1 : -1));
        callback(queries);
      },
      (err) => {
        console.warn('Daily queries cloud sync listener offline:', err.message);
      }
    );
  },

  // Save / update daily query in Cloud
  async saveDailyQuery(query: DailyOrderQuery) {
    try {
      const docRef = doc(db, 'daily_queries', query.id);
      await setDoc(docRef, query, { merge: true });
    } catch (err) {
      console.warn('Failed to save daily query to cloud:', err);
    }
  },

  // Delete daily query from Cloud
  async deleteDailyQuery(queryId: string) {
    try {
      await deleteDoc(doc(db, 'daily_queries', queryId));
    } catch (err) {
      console.warn('Failed to delete daily query from cloud:', err);
    }
  },

  // Bulk save daily queries with chunked batches
  async bulkSaveDailyQueries(queries: DailyOrderQuery[]) {
    try {
      await commitInBatches(queries, (batch, q) => {
        const docRef = doc(db, 'daily_queries', q.id);
        batch.set(docRef, q, { merge: true });
      });
    } catch (err) {
      console.warn('Failed to batch save daily queries to cloud:', err);
    }
  },

  // Seed cloud database if collections are empty
  async seedInitialDataIfEmpty(
    initialInventory: InventoryItem[],
    initialInvoices: Invoice[],
    initialCustomers: Customer[],
    initialReturns: ReturnedProduct[],
    initialQueries: DailyOrderQuery[] = []
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
    } catch (err) {
      console.warn('Cloud database initial seeding skipped or offline:', err);
    }
  },
};
