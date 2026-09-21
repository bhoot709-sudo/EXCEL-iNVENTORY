import * as XLSX from 'xlsx';
import { Customer, InventoryItem, Invoice, ReturnedProduct, ShopConfig, DailyOrderQuery } from '../types';
import { formatNPR, toBikramSambat, formatNPTTime } from './nepalLocale';

/**
 * Export full shop state to a genuine Microsoft Excel (.xlsx) workbook
 * containing real Excel formulas for Profit, Margin %, Stock Alerts, and Totals
 * in Nepalese Standard (रु / NPR).
 */
export function exportToExcelWorkbook(
  inventory: InventoryItem[],
  invoices: Invoice[],
  returns: ReturnedProduct[],
  shopConfig: ShopConfig,
  fileName = 'Remix_Phones_Gadgets_Master_NPR.xlsx',
  customers?: Customer[],
  queries?: DailyOrderQuery[]
) {
  const wb = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // Sheet 1: Master Inventory with Excel Formulas (रु)
  // -------------------------------------------------------------
  const inventoryHeaders = [
    'SKU',
    'Barcode (EAN/UPC)',
    'Product Description',
    'Brand',
    'Category',
    'Cost Price (रु)',
    'Selling Price (रु)',
    'Stock Qty',
    'Reorder Level',
    'Profit / Unit (रु)',
    'Margin (%)',
    'Stock Value (रु)',
    'Stock Alert Status',
    'Supplier',
    'Last Restocked',
  ];

  const inventoryRows: any[][] = [inventoryHeaders];

  inventory.forEach((item, index) => {
    const rowNum = index + 2; // Row 1 is header, Excel is 1-indexed
    const profitFormula = `=G${rowNum}-F${rowNum}`;
    const marginFormula = `=IF(G${rowNum}>0,(G${rowNum}-F${rowNum})/G${rowNum}*100,0)`;
    const stockValFormula = `=F${rowNum}*H${rowNum}`;
    const alertFormula = `=IF(H${rowNum}<=0,"OUT OF STOCK",IF(H${rowNum}<=I${rowNum},"LOW STOCK ALERT","HEALTHY"))`;

    inventoryRows.push([
      item.sku,
      item.barcode,
      item.name,
      item.brand,
      item.category,
      item.costPrice,
      item.sellingPrice,
      item.stockQuantity,
      item.reorderLevel,
      { f: profitFormula, v: item.sellingPrice - item.costPrice },
      { f: marginFormula, v: Number((((item.sellingPrice - item.costPrice) / (item.sellingPrice || 1)) * 100).toFixed(1)) },
      { f: stockValFormula, v: item.costPrice * item.stockQuantity },
      { f: alertFormula, v: item.stockQuantity <= item.reorderLevel ? 'LOW STOCK ALERT' : 'HEALTHY' },
      item.supplier,
      item.lastRestockedDate,
    ]);
  });

  // Summary Row at the bottom of Inventory
  const totalRowIndex = inventory.length + 2;
  inventoryRows.push([
    'TOTALS / AVERAGES',
    '',
    '',
    '',
    '',
    '',
    '',
    { f: `=SUM(H2:H${totalRowIndex - 1})` },
    '',
    { f: `=AVERAGE(J2:J${totalRowIndex - 1})` },
    { f: `=AVERAGE(K2:K${totalRowIndex - 1})` },
    { f: `=SUM(L2:L${totalRowIndex - 1})` },
    { f: `=COUNTIF(M2:M${totalRowIndex - 1},"LOW STOCK ALERT")&" Items Low"` },
    '',
    '',
  ]);

  const wsInventory = XLSX.utils.aoa_to_sheet(inventoryRows);
  wsInventory['!cols'] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 42 },
    { wch: 14 },
    { wch: 20 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 26 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsInventory, 'Inventory_Master');

  // -------------------------------------------------------------
  // Sheet 2: POS Billing & Sales Transactions (रु)
  // -------------------------------------------------------------
  const salesHeaders = [
    'Invoice #',
    'Date & Time (NPT)',
    'Customer Name',
    'Phone',
    'Items Summary',
    'Units Sold',
    'Subtotal (रु)',
    '13% VAT (रु)',
    'Discount (रु)',
    'Grand Total (रु)',
    'Gross Profit (रु)',
    'Margin (%)',
    'Loyalty Points Earned',
    'Payment Mode',
    'Status',
    'Transaction Ref',
  ];

  const salesRows: any[][] = [salesHeaders];

  invoices.forEach((inv) => {
    const itemsSummary = inv.items.map(i => `${i.name} (Qty: ${i.quantity})`).join('; ');
    const totalUnits = inv.items.reduce((acc, i) => acc + i.quantity, 0);
    const marginPct = inv.grandTotal > 0 ? Number(((inv.totalProfit / inv.grandTotal) * 100).toFixed(1)) : 0;

    salesRows.push([
      inv.invoiceNumber,
      inv.date,
      inv.customerName,
      inv.customerPhone,
      itemsSummary,
      totalUnits,
      inv.subtotal,
      inv.taxAmount,
      inv.discountAmount,
      inv.grandTotal,
      inv.totalProfit,
      marginPct,
      inv.loyaltyPointsEarned || Math.floor(inv.grandTotal / 1000),
      inv.paymentMethod === 'UPI_QR' ? 'FonePay / QR' : inv.paymentMethod,
      inv.paymentStatus,
      inv.transactionRef || '',
    ]);
  });

  const wsSales = XLSX.utils.aoa_to_sheet(salesRows);
  wsSales['!cols'] = [
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 45 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
    { wch: 20 },
    { wch: 16 },
    { wch: 12 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSales, 'Sales_Transactions');

  // -------------------------------------------------------------
  // Sheet 3: Returns & Warranty Ledger (Nepalese Standard)
  // -------------------------------------------------------------
  const returnHeaders = [
    'RMA Ticket ID',
    'Date Returned',
    'Orig Sale Invoice #',
    'Purchase Date',
    'Days Elapsed Formula',
    'Product Description',
    'Brand',
    'Item Barcode',
    'Serial / IMEI',
    'Customer Name',
    'Customer Phone',
    'Customer Email',
    'Return Reason',
    'Warranty Status',
    'Warranty Check Formula',
    'Resolution (e.g. Refund/Exchange/Repair)',
    'Amount / Fee (रु)',
    'Restocked to Shelf?',
    'RMA Stage',
    'Resolution Notes',
  ];

  const returnRows: any[][] = [returnHeaders];

  returns.forEach((r, idx) => {
    const rowNum = idx + 2;
    const daysFormula = r.purchaseDate
      ? { f: `=IF(ISBLANK(D${rowNum}),"N/A",DATEDIF(D${rowNum},B${rowNum},"D")&" days")`, v: 'Checked' }
      : 'N/A';
    const warrantyFormula = r.purchaseDate
      ? { f: `=IF(ISBLANK(D${rowNum}),"UNKNOWN",IF(TODAY()-DATEVALUE(D${rowNum})<=365,"UNDER WARRANTY","EXPIRED"))`, v: r.warrantyStatus || 'UNDER_WARRANTY' }
      : r.warrantyStatus || 'UNDER_WARRANTY';

    const resolutionType = 
      r.resolution || 
      (r.actionTaken === 'REPLACED' ? 'EXCHANGE' : r.actionTaken === 'REPAIRED' ? 'REPAIR' : r.actionTaken === 'STORE_CREDIT' ? 'STORE_CREDIT' : 'REFUND');

    returnRows.push([
      r.id,
      r.returnDate,
      r.invoiceNumber,
      r.purchaseDate || 'N/A',
      daysFormula,
      r.itemName,
      r.itemBrand,
      r.itemBarcode,
      r.serialOrImei || 'N/A',
      r.customerName,
      r.customerPhone,
      r.customerEmail || '',
      r.returnReason,
      r.warrantyStatus || 'UNDER_WARRANTY',
      warrantyFormula,
      resolutionType,
      r.refundAmount > 0 ? r.refundAmount : (r.repairCost || 0),
      r.restockedToInventory ? 'YES' : 'NO',
      r.status || 'RESOLVED',
      r.notes || '',
    ]);
  });

  const wsReturns = XLSX.utils.aoa_to_sheet(returnRows);
  wsReturns['!cols'] = [
    { wch: 18 }, // RMA ID
    { wch: 16 }, // Return Date
    { wch: 20 }, // Orig Sale Invoice
    { wch: 16 }, // Purchase Date
    { wch: 20 }, // Days Formula
    { wch: 36 }, // Product Description
    { wch: 14 }, // Brand
    { wch: 18 }, // Barcode
    { wch: 20 }, // Serial / IMEI
    { wch: 20 }, // Customer Name
    { wch: 16 }, // Customer Phone
    { wch: 22 }, // Customer Email
    { wch: 22 }, // Return Reason
    { wch: 18 }, // Warranty Status
    { wch: 24 }, // Warranty Check Formula
    { wch: 20 }, // Resolution
    { wch: 16 }, // Amount
    { wch: 16 }, // Restocked
    { wch: 14 }, // RMA Stage
    { wch: 38 }, // Notes
  ];
  XLSX.utils.book_append_sheet(wb, wsReturns, 'Returns_and_Warranty');

  // -------------------------------------------------------------
  // Sheet 4: Performance Report (Nepalese Standard)
  // -------------------------------------------------------------
  const totalRevenue = invoices.reduce((acc, i) => acc + i.grandTotal, 0);
  const totalProfit = invoices.reduce((acc, i) => acc + i.totalProfit, 0);
  const totalCost = totalRevenue - totalProfit;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const totalUnitsSold = invoices.reduce((acc, inv) => acc + inv.items.reduce((s, i) => s + i.quantity, 0), 0);
  const lowStockCount = inventory.filter(i => i.stockQuantity <= i.reorderLevel).length;
  const totalInventoryVal = inventory.reduce((acc, i) => acc + i.costPrice * i.stockQuantity, 0);

  const reportRows = [
    ['NEPAL RETAILER PERFORMANCE REPORT', `${shopConfig.shopName}`],
    ['Address:', shopConfig.address],
    ['Tax ID / PAN / VAT:', shopConfig.taxId],
    ['Currency Standard:', `${shopConfig.currency} (${shopConfig.currencySymbol})`],
    ['Generated (NPT):', formatNPTTime(new Date())],
    [],
    ['KEY PERFORMANCE INDICATORS (KPIs)', 'Value in रु (NPR)', 'Notes / Formula'],
    ['Gross Revenue', formatNPR(totalRevenue), 'Sum of all paid invoice totals'],
    ['Cost of Goods Sold (COGS)', formatNPR(totalCost), 'Revenue minus realized gross profit'],
    ['Gross Profit', formatNPR(totalProfit), 'Actual markup profit earned'],
    ['Net Profit Margin %', `${avgMargin.toFixed(1)}%`, '(Gross Profit / Total Revenue) * 100'],
    ['Total Units Sold', totalUnitsSold, 'All phones & accessories sold'],
    ['Invoices Issued', invoices.length, 'Total customer billing transactions'],
    ['Returns / RMA Tickets', returns.length, 'Warranty, remorse & defect returns'],
    ['Inventory Value (Wholesale)', formatNPR(totalInventoryVal), 'Current capital tied up in stock'],
    ['Low Stock Alerts Currently Active', lowStockCount, 'Items requiring immediate supplier reorder'],
  ];

  const wsReport = XLSX.utils.aoa_to_sheet(reportRows);
  wsReport['!cols'] = [
    { wch: 36 },
    { wch: 28 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, wsReport, 'Retail_Performance');

  // -------------------------------------------------------------
  // Sheet 5: Customers & Loyalty CRM
  // -------------------------------------------------------------
  if (customers && customers.length > 0) {
    const customerHeaders = [
      'Customer ID',
      'Full Name',
      'Phone Number',
      'Email Address',
      'Tier',
      'Loyalty Points Balance',
      'Physical Address',
      'Notes & Preferences',
      'Member Since',
    ];

    const customerRows: any[][] = [customerHeaders];

    customers.forEach((c) => {
      customerRows.push([
        c.id,
        c.name,
        c.phone,
        c.email || 'N/A',
        c.tier,
        c.loyaltyPoints,
        c.address || '',
        c.notes || '',
        c.createdAt,
      ]);
    });

    const wsCustomers = XLSX.utils.aoa_to_sheet(customerRows);
    wsCustomers['!cols'] = [
      { wch: 14 },
      { wch: 22 },
      { wch: 18 },
      { wch: 24 },
      { wch: 16 },
      { wch: 22 },
      { wch: 30 },
      { wch: 35 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCustomers, 'Loyalty_Customers');
  }

  // Write and trigger browser download
  XLSX.writeFile(wb, fileName);
}

/**
 * Exports a dedicated Day-to-Day Register workbook for a specific selected date
 */
export function exportDailyRegisterToExcel(
  dateStr: string,
  dayInvoices: Invoice[],
  dayQueries: DailyOrderQuery[],
  inventory: InventoryItem[],
  shopConfig: ShopConfig
) {
  const wb = XLSX.utils.book_new();
  const bs = toBikramSambat(dateStr);

  // 1. Daily Sales & Billing Sheet
  const salesHeaders = [
    'Invoice #',
    'Time (NPT)',
    'Customer Name',
    'Phone',
    'Customer Type',
    'Items Sold',
    'Payment Method',
    'Subtotal (रु)',
    '13% VAT (रु)',
    'Discount (रु)',
    'Grand Total (रु)',
    'Gross Profit (रु)',
    'Prev Points',
    'Points Earned',
    'Redeemed',
    'Ending Balance',
  ];

  const salesRows: any[][] = [
    [`DAILY SALES REGISTER - ${dateStr} (${bs.formattedBS})`, shopConfig.shopName],
    [`PAN/VAT: ${shopConfig.taxId}`, `Phone: ${shopConfig.phone}`],
    [],
    salesHeaders,
  ];

  dayInvoices.forEach((inv) => {
    const itemsSummary = inv.items.map((it) => `${it.name} x${it.quantity}`).join('; ');
    salesRows.push([
      inv.invoiceNumber,
      formatNPTTime(inv.date),
      inv.customerName,
      inv.customerPhone,
      inv.customerId ? 'Existing Member' : 'Walk-in',
      itemsSummary,
      inv.paymentMethod === 'UPI_QR' ? 'FonePay / QR' : inv.paymentMethod,
      inv.subtotal,
      inv.taxAmount,
      inv.discountAmount,
      inv.grandTotal,
      inv.totalProfit,
      inv.customerPreviousPoints ?? 0,
      inv.loyaltyPointsEarned ?? Math.floor(inv.grandTotal / 1000),
      inv.loyaltyPointsRedeemed ?? 0,
      inv.customerNewPoints ?? (inv.loyaltyPointsEarned || 0),
    ]);
  });

  const wsSales = XLSX.utils.aoa_to_sheet(salesRows);
  wsSales['!cols'] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 16 },
    { wch: 18 },
    { wch: 40 },
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSales, 'Daily_Sales_Billing');

  // 2. Customer Orders & Queries Notes Sheet
  const queryHeaders = [
    'Query ID',
    'Time (NPT)',
    'Customer Name',
    'Phone',
    'Query Type',
    'Device / Product Model',
    'Est. Budget (रु)',
    'Priority',
    'Status',
    'Assigned Staff',
    'Customer Notes & Requirements',
  ];

  const queryRows: any[][] = [
    [`DAILY CUSTOMER ORDERS & QUERIES NOTES - ${dateStr} (${bs.formattedBS})`],
    [],
    queryHeaders,
  ];

  dayQueries.forEach((q) => {
    queryRows.push([
      q.id,
      q.time,
      q.customerName,
      q.customerPhone,
      q.queryType,
      q.deviceModel,
      q.estimatedBudget ? formatNPR(q.estimatedBudget) : 'N/A',
      q.priority,
      q.status,
      q.assignedStaff || 'Staff',
      q.notes,
    ]);
  });

  const wsQueries = XLSX.utils.aoa_to_sheet(queryRows);
  wsQueries['!cols'] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 20 },
    { wch: 16 },
    { wch: 20 },
    { wch: 30 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, wsQueries, 'Customer_Orders_Queries');

  // 3. Day's Stock Movement Sheet
  const movementMap = new Map<string, { name: string; brand: string; units: number; revenue: number; profit: number }>();
  dayInvoices.forEach((inv) => {
    inv.items.forEach((it) => {
      const existing = movementMap.get(it.itemId);
      if (existing) {
        existing.units += it.quantity;
        existing.revenue += it.total;
        existing.profit += it.profit;
      } else {
        movementMap.set(it.itemId, {
          name: it.name,
          brand: it.brand,
          units: it.quantity,
          revenue: it.total,
          profit: it.profit,
        });
      }
    });
  });

  const movementHeaders = ['Item Description', 'Brand', 'Units Sold Today', 'Revenue (रु)', 'Profit Earned (रु)', 'Remaining Shelf Stock'];
  const movementRows: any[][] = [
    [`DAILY INVENTORY MOVEMENT - ${dateStr} (${bs.formattedBS})`],
    [],
    movementHeaders,
  ];

  Array.from(movementMap.entries()).forEach(([itemId, data]) => {
    const invItem = inventory.find((i) => i.id === itemId);
    movementRows.push([
      data.name,
      data.brand,
      data.units,
      data.revenue,
      data.profit,
      invItem ? `${invItem.stockQuantity} units` : 'N/A',
    ]);
  });

  const wsMovement = XLSX.utils.aoa_to_sheet(movementRows);
  wsMovement['!cols'] = [
    { wch: 38 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMovement, 'Inventory_Movement');

  const safeDate = dateStr.replace(/[^0-9-]/g, '');
  XLSX.writeFile(wb, `Daily_Register_${safeDate}_BS_${bs.formattedNumeric}.xlsx`);
}

/**
 * Normalizes barcode strings to valid standard lengths, preventing 11-digit UPC-A
 * or 7-digit EAN-8 truncation issues.
 */
function normalizeBarcode(val: any, fallbackIndex: number): string {
  if (!val) return `BAR-${Math.floor(100000000000 + Math.random() * 900000000000)}`;
  const str = String(val).trim();
  if (/^\d{11}$/.test(str)) {
    return '0' + str;
  } else if (/^\d{7}$/.test(str)) {
    return '0' + str;
  }
  return str;
}

/**
 * Checks if a parsed row contains only empty, whitespace, or null values.
 */
function isMeaninglessRow(row: Record<string, any>): boolean {
  const values = Object.values(row);
  return values.every((v) => v === null || v === undefined || String(v).trim() === '');
}

/**
 * Robust parsing for decimal numbers from dirty spreadsheet cells.
 * Strips currency symbols, thousands-separators, and whitespace.
 */
function parseCleanNumber(val: any, fallback = 0): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (!val) return fallback;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Robust parsing for integers (stock quantities, reorder levels).
 */
function parseCleanInt(val: any, fallback = 0): number {
  if (typeof val === 'number') return isNaN(val) ? fallback : Math.floor(val);
  if (!val) return fallback;
  const cleaned = String(val).replace(/[^0-9-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * Parses an uploaded Excel (.xlsx, .xls) workbook and converts it into validated InventoryItem[] records.
 * Hardened to automatically filter out spreadsheet summary/totals rows and trailing empty rows.
 */
export function importExcelToInventory(fileBuffer: ArrayBuffer): {
  items: InventoryItem[];
  skippedSummaryRows: number;
  skippedEmptyRows: number;
  totalParsed: number;
} {
  const wb = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

  const items: InventoryItem[] = [];
  let skippedSummaryRows = 0;
  let skippedEmptyRows = 0;

  jsonData.forEach((row, index) => {
    // 1. Guard against totals / summary formula rows from previously exported files
    const firstCell = String(Object.values(row)[0] || '').toLowerCase();
    if (
      firstCell.includes('total') ||
      firstCell.includes('average') ||
      firstCell.includes('summary') ||
      firstCell.includes('retailer performance')
    ) {
      skippedSummaryRows++;
      return;
    }

    // 2. Guard against trailing empty rows or blank cells
    if (isMeaninglessRow(row)) {
      skippedEmptyRows++;
      return;
    }

    // 3. Flexible column mapping for common variations
    const rawSku = String(row['SKU'] || row['sku'] || '').trim();
    const rawBarcode = row['Barcode (EAN/UPC)'] || row['Barcode'] || row['barcode'];
    const name = String(row['Product Description'] || row['Product Name'] || row['Name'] || row['name'] || `Product ${index + 1}`).trim();
    const brand = String(row['Brand'] || row['brand'] || 'Generic').trim();
    const category = (String(row['Category'] || row['category'] || 'Smartphones').trim()) as any;

    const sku = rawSku || `GEN-${1000 + items.length + 1}`;
    const barcode = normalizeBarcode(rawBarcode, items.length);

    // Support both Nepalese (रु) and generic / ($) columns
    const costPrice = parseCleanNumber(
      row['Cost Price (रु)'] || row['Cost Price (NPR)'] || row['Cost Price ($)'] || row['Cost Price'] || row['costPrice'] || row['Cost'] || '0',
      0
    );
    const sellingPrice = parseCleanNumber(
      row['Selling Price (रु)'] || row['Selling Price (NPR)'] || row['Selling Price ($)'] || row['Selling Price'] || row['sellingPrice'] || row['Price'] || '0',
      0
    );
    const stockQuantity = parseCleanInt(row['Stock Qty'] || row['Stock'] || row['stockQuantity'] || row['Qty'] || '0', 0);
    const reorderLevel = parseCleanInt(row['Reorder Level'] || row['reorderLevel'] || row['Alert Level'] || '3', 3);
    const supplier = String(row['Supplier'] || row['supplier'] || 'Standard Distributor').trim();

    items.push({
      id: `imported-${Date.now()}-${items.length}-${Math.random().toString(36).slice(2, 6)}`,
      sku,
      barcode,
      name,
      brand,
      category,
      costPrice,
      sellingPrice,
      stockQuantity,
      reorderLevel,
      imeiRequired: category === 'Smartphones' || category === 'Tablets',
      supplier,
      lastRestockedDate: new Date().toISOString().split('T')[0],
    });
  });

  return {
    items,
    skippedSummaryRows,
    skippedEmptyRows,
    totalParsed: jsonData.length,
  };
}

/**
 * Export all day and monthly action & transaction logs to a dedicated Excel workbook (.xlsx)
 */
export function exportActionLogsToExcelWorkbook(
  logs: any[],
  shopConfig: ShopConfig,
  scopeLabel = 'All_Day_Records'
) {
  const wb = XLSX.utils.book_new();

  const headers = [
    'Log ID',
    'Date (AD)',
    'Date (BS Bikram Sambat)',
    'Time (NPT)',
    'Category',
    'Action Title',
    'Full Description',
    'Staff / Operator',
    'Status',
    'Source Channel',
    'Invoice Number',
    'Customer Name',
    'Customer Phone',
    'Amount (रु)',
    'Payment Method',
    'Item / SKU',
    'Quantity',
  ];

  const rows: any[][] = [headers];

  logs.forEach((log) => {
    rows.push([
      log.id || '',
      log.date || '',
      log.bsDate || '',
      log.time || '',
      log.category || '',
      log.actionTitle || '',
      log.description || '',
      log.staffName || '',
      log.status || 'SUCCESS',
      log.source || '',
      log.metadata?.invoiceNumber || '',
      log.metadata?.customerName || '',
      log.metadata?.phone || log.metadata?.customerPhone || '',
      log.metadata?.amount || log.metadata?.grandTotal || '',
      log.metadata?.paymentMethod || '',
      log.metadata?.itemName || log.metadata?.sku || '',
      log.metadata?.quantity || '',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 18 },
    { wch: 32 },
    { wch: 48 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 24 },
    { wch: 10 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'All Day Records Log');
  XLSX.writeFile(wb, `${shopConfig.shopName.replace(/\s+/g, '_')}_${scopeLabel}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Convenience wrapper to parse a browser File object directly and return items and report
 */
export async function parseExcelInventoryFileWithReport(file: File): Promise<{
  items: InventoryItem[];
  skippedSummaryRows: number;
  skippedEmptyRows: number;
  totalParsed: number;
}> {
  const buffer = await file.arrayBuffer();
  return importExcelToInventory(buffer);
}
