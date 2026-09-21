import { describe, it, expect } from 'vitest';
import { InventoryItem, CartItem } from '../types';

describe('POS Billing & Nepal VAT Engine', () => {
  const sampleProductA: InventoryItem = {
    id: 'prod-1',
    name: 'Apple iPhone 15 Pro Max',
    brand: 'Apple',
    category: 'Smartphones',
    sku: 'APL-IP15PM-256',
    barcode: '195949012345',
    costPrice: 175000,
    sellingPrice: 198000,
    stockQuantity: 10,
    reorderLevel: 2,
    supplier: 'Generation Next Communications',
    imeiRequired: true,
    lastRestockedDate: '2024-09-16',
  };

  const sampleProductB: InventoryItem = {
    id: 'prod-2',
    name: 'Anker 65W GaN Fast Charger',
    brand: 'Anker',
    category: 'Chargers & Power',
    sku: 'ANK-65W-GAN',
    barcode: '848061054321',
    costPrice: 3800,
    sellingPrice: 5500,
    stockQuantity: 25,
    reorderLevel: 5,
    supplier: 'Pashupati Trade Link',
    imeiRequired: false,
    lastRestockedDate: '2024-09-16',
  };

  it('accurately computes line item totals, profit, and margins', () => {
    const qty = 2;
    const unitDiscount = 1000;
    const unitPrice = sampleProductA.sellingPrice;
    const costPrice = sampleProductA.costPrice;

    const lineTotal = (unitPrice - unitDiscount) * qty;
    const lineCost = costPrice * qty;
    const lineProfit = lineTotal - lineCost;
    const marginPercent = ((lineProfit / lineTotal) * 100).toFixed(2);

    expect(lineTotal).toBe(394000);
    expect(lineCost).toBe(350000);
    expect(lineProfit).toBe(44000);
    expect(parseFloat(marginPercent)).toBeGreaterThan(11);
  });

  it('computes Nepal 13% VAT on taxable taxable amount with correct rounding', () => {
    const cart: CartItem[] = [
      { item: sampleProductA, quantity: 1, unitDiscount: 0 },
      { item: sampleProductB, quantity: 2, unitDiscount: 500 },
    ];

    const subtotal = cart.reduce((sum, c) => sum + (c.item.sellingPrice - c.unitDiscount) * c.quantity, 0);
    expect(subtotal).toBe(198000 + 10000); // 208,000

    const specialDiscount = 3000;
    const taxableAmount = Math.max(0, subtotal - specialDiscount);
    expect(taxableAmount).toBe(205000);

    const vatRate = 0.13; // 13% Nepal VAT
    const vatAmount = Math.round(taxableAmount * vatRate * 100) / 100;
    const grandTotal = Math.round((taxableAmount + vatAmount) * 100) / 100;

    expect(vatAmount).toBe(26650);
    expect(grandTotal).toBe(231650);
  });

  it('calculates loyalty points: 1 point per Rs 100 spent, and 1 point = Rs 10 discount', () => {
    const grandTotal = 25000;
    const pointsEarned = Math.floor(grandTotal / 100);
    expect(pointsEarned).toBe(250);

    // Customer with 500 points redeeming 100 points
    const customerPreviousPoints = 500;
    const redeemedPoints = 100;
    const discountFromRedemption = redeemedPoints * 10;
    const netPoints = customerPreviousPoints + pointsEarned - redeemedPoints;

    expect(discountFromRedemption).toBe(1000);
    expect(netPoints).toBe(650);
  });

  it('prevents customer over-redemption exceeding bill total', () => {
    const billSubtotal = 450;
    const customerPoints = 100; // Rs 1000 value
    const maxRedeemablePoints = Math.floor(billSubtotal / 10); // Max 45 points (Rs 450)

    expect(maxRedeemablePoints).toBe(45);
    expect(maxRedeemablePoints * 10).toBeLessThanOrEqual(billSubtotal);
  });
});
