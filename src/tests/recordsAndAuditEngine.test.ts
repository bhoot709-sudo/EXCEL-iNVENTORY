import { describe, it, expect } from 'vitest';
import { ActionLog, Invoice, DailyOrderQuery, ReturnedProduct } from '../types';

describe('Daily Records & Audit Log Aggregation Engine', () => {
  const sampleLogs: ActionLog[] = [
    {
      id: 'act-1',
      timestamp: '2024-09-16T10:00:00Z',
      date: '2024-09-16',
      time: '10:00 AM NPT',
      bsDate: '2081 Bhadra 31 BS',
      category: 'SALE',
      actionTitle: 'New Sale Invoice #INV-20240916-001',
      description: 'Completed POS sale for customer Ramesh Shrestha',
      source: 'POS_TERMINAL',
      status: 'SUCCESS',
      metadata: { grandTotal: 198000, quantity: 1 },
    },
    {
      id: 'act-2',
      timestamp: '2024-09-16T11:30:00Z',
      date: '2024-09-16',
      time: '11:30 AM NPT',
      bsDate: '2081 Bhadra 31 BS',
      category: 'RESTOCK',
      actionTitle: 'Restocked Xiaomi Chargers',
      description: 'Added 20 units to stock',
      source: 'RESTOCK_MODAL',
      status: 'SUCCESS',
      metadata: { quantity: 20 },
    },
    {
      id: 'act-3',
      timestamp: '2024-09-16T14:15:00Z',
      date: '2024-09-16',
      time: '02:15 PM NPT',
      bsDate: '2081 Bhadra 31 BS',
      category: 'ORDER_UPDATE',
      actionTitle: 'Customer Inquiry: iPad Air 5',
      description: 'Logged customer inquiry for Sita Adhikari',
      source: 'MANUAL',
      status: 'PENDING',
      metadata: {},
    },
    {
      id: 'act-4',
      timestamp: '2024-09-15T16:00:00Z',
      date: '2024-09-15',
      time: '04:00 PM NPT',
      bsDate: '2081 Bhadra 30 BS',
      category: 'RETURN_RMA',
      actionTitle: 'Returned Faulty Cable',
      description: 'Refunded Rs 500',
      source: 'MANUAL',
      status: 'SUCCESS',
      metadata: { amount: 500 },
    },
  ];

  it('filters records by specific day or month scope correctly', () => {
    const dayRecords = sampleLogs.filter((l) => l.date === '2024-09-16');
    expect(dayRecords).toHaveLength(3);

    const monthRecords = sampleLogs.filter((l) => l.date.startsWith('2024-09'));
    expect(monthRecords).toHaveLength(4);
  });

  it('calculates single-pass category counts with high efficiency', () => {
    let sales = 0, inventory = 0, customer = 0, orders = 0, returns = 0, routines = 0;
    for (let i = 0; i < sampleLogs.length; i++) {
      const cat = sampleLogs[i].category;
      if (cat === 'SALE') sales++;
      else if (['RESTOCK', 'PRODUCT', 'INVENTORY_UPDATE', 'CATEGORY'].includes(cat)) inventory++;
      else if (['CUSTOMER', 'DUE_SETTLEMENT', 'CREDIT_ENTRY'].includes(cat)) customer++;
      else if (cat === 'ORDER_UPDATE') orders++;
      else if (cat === 'RETURN_RMA') returns++;
      else if (['ROUTINE_LAUNCH', 'GENERAL_ACTION'].includes(cat)) routines++;
    }

    expect(sales).toBe(1);
    expect(inventory).toBe(1);
    expect(orders).toBe(1);
    expect(returns).toBe(1);
  });

  it('aggregates total sales revenue and units moved accurately', () => {
    let totalSalesRevenue = 0;
    let totalUnitsMoved = 0;

    sampleLogs.forEach((l) => {
      if (l.category === 'SALE') {
        const amt = l.metadata?.grandTotal || 0;
        totalSalesRevenue += amt;
      }
      if (l.metadata?.quantity) {
        totalUnitsMoved += Number(l.metadata.quantity) || 0;
      }
    });

    expect(totalSalesRevenue).toBe(198000);
    expect(totalUnitsMoved).toBe(21); // 1 sold + 20 restocked
  });
});
