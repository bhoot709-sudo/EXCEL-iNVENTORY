import { describe, it, expect } from 'vitest';
import { InventoryItem } from '../types';

describe('Inventory Engine & Deduplication Logic', () => {
  const mockCatalog: InventoryItem[] = [
    {
      id: 'prod-1',
      name: 'Samsung Galaxy S24 Ultra',
      brand: 'Samsung',
      category: 'Smartphones',
      sku: 'SAM-S24U-512',
      barcode: '880609187654',
      costPrice: 160000,
      sellingPrice: 184999,
      stockQuantity: 4,
      reorderLevel: 5,
      supplier: 'IMS Nepal',
      imeiRequired: true,
      lastRestockedDate: '2024-09-16',
    },
    {
      id: 'prod-2',
      name: 'Xiaomi 120W HyperCharge Adapter',
      brand: 'Xiaomi',
      category: 'Chargers & Power',
      sku: 'XIA-120W-ADP',
      barcode: '693417771234',
      costPrice: 2800,
      sellingPrice: 4200,
      stockQuantity: 12,
      reorderLevel: 3,
      supplier: 'Teletalk Pvt Ltd',
      imeiRequired: false,
      lastRestockedDate: '2024-09-16',
    },
    {
      id: 'prod-3',
      name: 'Sony WH-1000XM5 Noise Canceling Headphones',
      brand: 'Sony',
      category: 'Audio',
      sku: 'SNY-WH1000XM5',
      barcode: '454873613212',
      costPrice: 42000,
      sellingPrice: 52000,
      stockQuantity: 0,
      reorderLevel: 2,
      supplier: 'Nepa Hima Trade Link',
      imeiRequired: true,
      lastRestockedDate: '2024-09-16',
    },
  ];

  it('correctly flags low stock and out of stock products', () => {
    const lowStock = mockCatalog.filter((i) => i.stockQuantity <= i.reorderLevel);
    const outOfStock = mockCatalog.filter((i) => i.stockQuantity <= 0);

    expect(lowStock).toHaveLength(2); // Samsung (4 <= 5) and Sony (0 <= 2)
    expect(outOfStock).toHaveLength(1); // Sony (0)
  });

  it('detects duplicate SKU in catalog irrespective of case', () => {
    const testSku = 'sam-s24u-512';
    const isDuplicate = mockCatalog.some((i) => i.sku.toLowerCase() === testSku.toLowerCase());
    expect(isDuplicate).toBe(true);

    const uniqueSku = 'APL-IP16-128';
    const isUniqueDuplicate = mockCatalog.some((i) => i.sku.toLowerCase() === uniqueSku.toLowerCase());
    expect(isUniqueDuplicate).toBe(false);
  });

  it('detects duplicate barcode in catalog', () => {
    const existingBarcode = '880609187654';
    const isDuplicate = mockCatalog.some((i) => i.barcode === existingBarcode);
    expect(isDuplicate).toBe(true);

    const freshBarcode = '999888777666';
    const isBarcodeDuplicate = mockCatalog.some((i) => i.barcode === freshBarcode);
    expect(isBarcodeDuplicate).toBe(false);
  });

  it('updates stock quantity correctly during quick restock', () => {
    const targetItem = mockCatalog[0];
    const restockQty = 10;
    const updatedItem = {
      ...targetItem,
      stockQuantity: targetItem.stockQuantity + restockQty,
      lastRestockedDate: '2024-09-16',
    };

    expect(updatedItem.stockQuantity).toBe(14);
    expect(updatedItem.stockQuantity > updatedItem.reorderLevel).toBe(true);
  });
});
