import React, { useState, useRef, useEffect } from 'react';
import { 
  initialInventory, 
  initialPastInvoices, 
  initialReturns, 
  initialShopConfig,
  initialCustomers,
  initialDailyQueries
} from './data/initialData';
import { Customer, InventoryItem, Invoice, ReturnedProduct, ShopConfig, DailyOrderQuery } from './types';
import { Header } from './components/Header';
import { LowStockAlertBanner } from './components/LowStockAlertBanner';
import { ExcelGridView } from './components/ExcelGridView';
import { InventoryManager } from './components/InventoryManager';
import { PosBillingView } from './components/PosBillingView';
import { CustomersManager } from './components/CustomersManager';
import { ReturnsManager } from './components/ReturnsManager';
import { MonthlyReportView } from './components/MonthlyReportView';
import { DailyRecordsManager } from './components/DailyRecordsManager';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { PaymentQrModal } from './components/PaymentQrModal';
import { InvoiceModal } from './components/InvoiceModal';
import { ScannedProductDashboardModal } from './components/ScannedProductDashboardModal';
import { exportToExcelWorkbook, parseExcelInventoryFileWithReport } from './utils/excelEngine';
import { cloudSync } from './services/cloudSync';
import { ToastProvider, useToast } from './components/Toast';

function RetailApp() {
  const toast = useToast();

  // Application Data States (persisted locally in browser localStorage as offline-first cache)
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('gadget_inventory_master');
    return saved ? JSON.parse(saved) : initialInventory;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem('gadget_invoices_master');
    if (saved) {
      try {
        const parsed: Invoice[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const savedIds = new Set(parsed.map((inv) => inv.id));
          const missing = initialPastInvoices.filter((inv) => !savedIds.has(inv.id));
          if (missing.length > 0) {
            return [...parsed, ...missing];
          }
          return parsed;
        }
      } catch {
        return initialPastInvoices;
      }
    }
    return initialPastInvoices;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem('gadget_customers_master');
    if (saved) {
      try {
        const parsed: Customer[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const savedIds = new Set(parsed.map((c) => c.id));
          const missing = initialCustomers.filter((c) => !savedIds.has(c.id));
          return missing.length > 0 ? [...parsed, ...missing] : parsed;
        }
      } catch {
        return initialCustomers;
      }
    }
    return initialCustomers;
  });

  const [returns, setReturns] = useState<ReturnedProduct[]>(() => {
    const saved = localStorage.getItem('gadget_returns_master');
    return saved ? JSON.parse(saved) : initialReturns;
  });

  const [shopConfig, setShopConfig] = useState<ShopConfig>(() => {
    const saved = localStorage.getItem('gadget_shop_config');
    return saved ? JSON.parse(saved) : initialShopConfig;
  });

  const [dailyQueries, setDailyQueries] = useState<DailyOrderQuery[]>(() => {
    const saved = localStorage.getItem('gadget_daily_queries_master');
    if (saved) {
      try {
        const parsed: DailyOrderQuery[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const savedIds = new Set(parsed.map((q) => q.id));
          const missing = initialDailyQueries.filter((q) => !savedIds.has(q.id));
          return missing.length > 0 ? [...parsed, ...missing] : parsed;
        }
      } catch {
        return initialDailyQueries;
      }
    }
    return initialDailyQueries;
  });

  // Real-time Cloud Synchronization & Initial Seeding
  useEffect(() => {
    // Seed cloud database if empty
    cloudSync.seedInitialDataIfEmpty(inventory, invoices, customers, returns);

    // Listen to real-time cloud updates
    const unsubInv = cloudSync.subscribeInventory((cloudItems) => {
      if (cloudItems && cloudItems.length > 0) {
        setInventory(cloudItems);
      }
    });

    const unsubInvcs = cloudSync.subscribeInvoices((cloudInvoices) => {
      if (cloudInvoices && cloudInvoices.length > 0) {
        setInvoices(cloudInvoices);
      }
    });

    const unsubCust = cloudSync.subscribeCustomers((cloudCust) => {
      if (cloudCust && cloudCust.length > 0) {
        setCustomers(cloudCust);
      }
    });

    const unsubRet = cloudSync.subscribeReturns((cloudReturns) => {
      if (cloudReturns && cloudReturns.length > 0) {
        setReturns(cloudReturns);
      }
    });

    return () => {
      unsubInv();
      unsubInvcs();
      unsubCust();
      unsubRet();
    };
  }, []);

  // Sync to localStorage as offline-safe cache
  useEffect(() => {
    localStorage.setItem('gadget_inventory_master', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('gadget_invoices_master', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('gadget_customers_master', JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem('gadget_returns_master', JSON.stringify(returns));
  }, [returns]);

  useEffect(() => {
    localStorage.setItem('gadget_daily_queries_master', JSON.stringify(dailyQueries));
  }, [dailyQueries]);

  // UI States
  const [activeTab, setActiveTab] = useState<'daily' | 'excel' | 'inventory' | 'pos' | 'customers' | 'returns' | 'monthly'>('daily');
  const [posPreselectedCustomerId, setPosPreselectedCustomerId] = useState<string | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);

  // Scanned Product Details / Status Dashboard state (post-scan)
  const [scannedDashboardData, setScannedDashboardData] = useState<{
    scannedCode: string;
    item: InventoryItem | null;
  } | null>(null);

  // Cross-view redirect helpers
  const [prefillBarcodeForInventory, setPrefillBarcodeForInventory] = useState<string | null>(null);
  const [targetEditItemId, setTargetEditItemId] = useState<string | null>(null);
  const [initialCartItemForPos, setInitialCartItemForPos] = useState<InventoryItem | null>(null);

  // Active Checkout & Payment QR state
  const [pendingCheckout, setPendingCheckout] = useState<{
    invoice: Invoice;
    customerUpdate?: {
      customerId?: string;
      pointsDelta: number;
      newCustomer?: Customer;
    };
  } | null>(null);

  // Active Printable Invoice View Modal
  const [activeInvoiceForModal, setActiveInvoiceForModal] = useState<Invoice | null>(null);

  // Hidden Excel upload input
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Calculate items with low stock (<= reorderLevel)
  const lowStockItems = inventory.filter((item) => item.stockQuantity <= item.reorderLevel);

  // Handlers for Inventory with Deduplication & Cloud Sync
  const handleAddItem = (newItem: InventoryItem) => {
    setInventory((prev) => {
      const isDuplicate = prev.some(
        (i) =>
          i.id === newItem.id ||
          (newItem.barcode && i.barcode.toLowerCase() === newItem.barcode.toLowerCase()) ||
          (newItem.sku && i.sku.toLowerCase() === newItem.sku.toLowerCase())
      );
      if (isDuplicate) {
        toast.warning(`Item "${newItem.name}" or barcode already exists in catalog.`);
        return prev;
      }
      return [newItem, ...prev];
    });
    cloudSync.saveInventoryItem(newItem);
  };

  const handleUpdateItem = (updated: InventoryItem) => {
    setInventory((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    cloudSync.saveInventoryItem(updated);
  };

  const handleDeleteItem = (itemId: string) => {
    setInventory((prev) => prev.filter((i) => i.id !== itemId));
    cloudSync.deleteInventoryItem(itemId);
  };

  const handleRestockQuantity = (itemId: string, addedQty: number) => {
    setInventory((prev) =>
      prev.map((i) => {
        if (i.id === itemId) {
          const updatedItem = {
            ...i,
            stockQuantity: i.stockQuantity + addedQty,
            lastRestockedDate: new Date().toISOString().split('T')[0],
          };
          cloudSync.saveInventoryItem(updatedItem);
          return updatedItem;
        }
        return i;
      })
    );
  };

  // Handlers for Customer CRM & Loyalty with Deduplication & Cloud Sync
  const handleAddCustomer = (newCustomer: Customer) => {
    const cleanPhone = newCustomer.phone.replace(/\D/g, '');
    setCustomers((prev) => {
      const isDuplicate = prev.some(
        (c) => c.id === newCustomer.id || (cleanPhone && c.phone.replace(/\D/g, '') === cleanPhone)
      );
      if (isDuplicate) {
        toast.warning(`Customer with phone "${newCustomer.phone}" is already registered.`);
        return prev;
      }
      return [newCustomer, ...prev];
    });
    cloudSync.saveCustomer(newCustomer);
  };

  const handleUpdateCustomer = (updated: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    cloudSync.saveCustomer(updated);
  };

  const handleDeleteCustomer = (customerId: string) => {
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    cloudSync.deleteCustomer(customerId);
  };

  const handleAdjustCustomerPoints = (customerId: string, delta: number, reason?: string) => {
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          const newPoints = Math.max(0, c.loyaltyPoints + delta);
          let tier = c.tier;
          if (newPoints >= 300) tier = 'Platinum';
          else if (newPoints >= 150) tier = 'Gold';
          else if (newPoints >= 50) tier = 'Silver';
          else tier = 'Bronze';

          const noteAddition = reason ? ` [${new Date().toLocaleDateString()}: ${delta > 0 ? '+' : ''}${delta} pts - ${reason}]` : '';
          const updated = {
            ...c,
            loyaltyPoints: newPoints,
            tier,
            notes: (c.notes || '') + noteAddition,
          };
          cloudSync.saveCustomer(updated);
          return updated;
        }
        return c;
      })
    );
  };

  const handleSelectCustomerForSale = (customer: Customer) => {
    setPosPreselectedCustomerId(customer.id);
    setActiveTab('pos');
  };

  // Handlers for POS Billing & Invoices with Deduplication & Stock Sync
  const handleCompleteSale = (
    newInvoice: Invoice,
    customerUpdate?: {
      customerId?: string;
      pointsDelta: number;
      newCustomer?: Customer;
    }
  ) => {
    // If payment method is QR code, launch dynamic QR modal first
    if (newInvoice.paymentMethod === 'UPI_QR') {
      setPendingCheckout({ invoice: newInvoice, customerUpdate });
    } else {
      finalizeInvoiceAndDeductStock(newInvoice, customerUpdate);
    }
  };

  const finalizeInvoiceAndDeductStock = (
    inv: Invoice,
    customerUpdate?: {
      customerId?: string;
      pointsDelta: number;
      newCustomer?: Customer;
    }
  ) => {
    // Record the invoice in sales register with strict deduplication
    setInvoices((prev) => {
      if (prev.some((existing) => existing.id === inv.id || existing.invoiceNumber === inv.invoiceNumber)) {
        return prev;
      }
      return [inv, ...prev];
    });
    cloudSync.saveInvoice(inv);

    // Automatically decrement inventory stock and push changes to cloud
    setInventory((prev) =>
      prev.map((item) => {
        const soldLine = inv.items.find((line) => line.itemId === item.id);
        if (soldLine) {
          const newQty = Math.max(0, item.stockQuantity - soldLine.quantity);
          const updatedItem = {
            ...item,
            stockQuantity: newQty,
          };
          cloudSync.saveInventoryItem(updatedItem);
          return updatedItem;
        }
        return item;
      })
    );

    // Apply customer update (points earned/redeemed or new customer enrollment)
    if (customerUpdate) {
      if (customerUpdate.newCustomer) {
        setCustomers((prev) => {
          if (prev.some((c) => c.id === customerUpdate.newCustomer!.id)) return prev;
          return [customerUpdate.newCustomer!, ...prev];
        });
        cloudSync.saveCustomer(customerUpdate.newCustomer);
      } else if (customerUpdate.customerId && customerUpdate.pointsDelta !== 0) {
        setCustomers((prev) =>
          prev.map((cust) => {
            if (cust.id === customerUpdate.customerId) {
              const newPoints = Math.max(0, cust.loyaltyPoints + customerUpdate.pointsDelta);
              let tier = cust.tier;
              if (newPoints >= 300) tier = 'Platinum';
              else if (newPoints >= 150) tier = 'Gold';
              else if (newPoints >= 50) tier = 'Silver';
              else tier = 'Bronze';

              const updatedCust = {
                ...cust,
                loyaltyPoints: newPoints,
                tier,
              };
              cloudSync.saveCustomer(updatedCust);
              return updatedCust;
            }
            return cust;
          })
        );
      }
    }

    // Open printable tax invoice
    setActiveInvoiceForModal(inv);
  };

  const handleQrPaymentConfirmed = (transactionRef: string) => {
    if (!pendingCheckout) return;

    const finalizedInvoice: Invoice = {
      ...pendingCheckout.invoice,
      paymentStatus: 'PAID',
      transactionRef,
    };

    const customerUpdate = pendingCheckout.customerUpdate;
    setPendingCheckout(null);
    finalizeInvoiceAndDeductStock(finalizedInvoice, customerUpdate);
  };

  // Handlers for Returns & RMA with Deduplication & Cloud Sync
  const handleAddReturn = (newReturn: ReturnedProduct, shouldRestock: boolean, itemId?: string) => {
    setReturns((prev) => {
      if (prev.some((r) => r.id === newReturn.id)) return prev;
      return [newReturn, ...prev];
    });
    cloudSync.saveReturn(newReturn);

    if (shouldRestock) {
      if (itemId && inventory.some((i) => i.id === itemId)) {
        handleRestockQuantity(itemId, 1);
      } else {
        const existingByBarcode = inventory.find((i) => i.barcode === newReturn.itemBarcode);
        if (existingByBarcode) {
          handleRestockQuantity(existingByBarcode.id, 1);
        } else {
          // Recreate returned item in inventory so restored unit is tracked
          const restoredItem: InventoryItem = {
            id: `restored-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sku: `RMA-${newReturn.itemBarcode.slice(-6)}`,
            barcode: newReturn.itemBarcode,
            name: `${newReturn.itemName} (Restocked RMA)`,
            brand: newReturn.itemBrand,
            category: 'Protection & Cases',
            costPrice: Math.round(newReturn.refundAmount * 0.6 * 100) / 100,
            sellingPrice: newReturn.refundAmount,
            stockQuantity: 1,
            reorderLevel: 1,
            imeiRequired: Boolean(newReturn.serialOrImei),
            supplier: 'Customer Return RMA',
            lastRestockedDate: new Date().toISOString().split('T')[0],
          };
          handleAddItem(restoredItem);
        }
      }
    }
  };

  // Barcode Detected handler: launches the requested Post-Scan Dashboard
  const handleBarcodeDetected = (barcode: string, foundItem?: InventoryItem) => {
    const resolvedItem =
      foundItem ||
      inventory.find(
        (i) => i.barcode === barcode || i.sku.toLowerCase() === barcode.toLowerCase()
      ) ||
      null;

    setScannedDashboardData({
      scannedCode: barcode,
      item: resolvedItem,
    });
  };

  // Redirect to add item (when user clicks 'ADD Item' on uncataloged product prompt)
  const handleRedirectToAddItem = (barcodeOrSku: string) => {
    setScannedDashboardData(null);
    setPrefillBarcodeForInventory(barcodeOrSku);
    setActiveTab('inventory');
  };

  // Sell scanned item in POS
  const handleSellScannedItemInPos = (item: InventoryItem) => {
    setScannedDashboardData(null);
    setInitialCartItemForPos(item);
    setActiveTab('pos');
  };

  // Edit item in inventory
  const handleEditScannedItemInInventory = (item: InventoryItem) => {
    setScannedDashboardData(null);
    setTargetEditItemId(item.id);
    setActiveTab('inventory');
  };

  // Scan another product
  const handleScanAnother = () => {
    setScannedDashboardData(null);
    setShowScannerModal(true);
  };

  // Excel file import handler with deduplication & batch synchronization
  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const report = await parseExcelInventoryFileWithReport(files[0]);
      if (report.items.length === 0) {
        toast.warning('No valid inventory product rows found in the spreadsheet.');
        return;
      }

      let newCount = 0;
      let updatedCount = 0;

      setInventory((prev) => {
        // Map existing inventory by normalized barcode or SKU
        const invMap = new Map<string, InventoryItem>();
        prev.forEach((item) => {
          const key = (item.barcode || item.sku).trim().toLowerCase();
          invMap.set(key, { ...item });
        });

        report.items.forEach((importedItem) => {
          const key = (importedItem.barcode || importedItem.sku).trim().toLowerCase();
          if (invMap.has(key)) {
            // Deduplicate: merge stock quantity & update latest pricing
            const existing = invMap.get(key)!;
            invMap.set(key, {
              ...existing,
              stockQuantity: existing.stockQuantity + importedItem.stockQuantity,
              costPrice: importedItem.costPrice || existing.costPrice,
              sellingPrice: importedItem.sellingPrice || existing.sellingPrice,
              lastRestockedDate: new Date().toISOString().split('T')[0],
            });
            updatedCount++;
          } else {
            invMap.set(key, importedItem);
            newCount++;
          }
        });

        const combined = Array.from(invMap.values());
        // Batch commit to cloud in safe 300-item chunks
        cloudSync.bulkSaveInventory(combined);
        return combined;
      });

      toast.success(
        `Import complete: ${newCount} new items added, ${updatedCount} existing stock updated.${
          report.skippedSummaryRows > 0 ? ` (Filtered ${report.skippedSummaryRows} summary row(s))` : ''
        }`,
        'Spreadsheet Ingestion'
      );
    } catch (err) {
      console.error(err);
      toast.error('Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv spreadsheet.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Daily queries and customer order notes handlers
  const handleAddDailyQuery = (newQuery: DailyOrderQuery) => {
    setDailyQueries((prev) => [newQuery, ...prev]);
    toast.success(`Logged note/query for ${newQuery.customerName}`, 'Daily Records');
  };

  const handleUpdateDailyQuery = (updated: DailyOrderQuery) => {
    setDailyQueries((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    toast.info(`Updated status for ${updated.customerName}`, 'Daily Records');
  };

  const handleDeleteDailyQuery = (queryId: string) => {
    setDailyQueries((prev) => prev.filter((q) => q.id !== queryId));
    toast.info('Deleted query record.', 'Daily Records');
  };

  const handleNavigateToPosWithCustomer = (customer: Customer, _note?: string) => {
    setPosPreselectedCustomerId(customer.id);
    setActiveTab('pos');
    toast.info(`Switched to POS cashier with customer ${customer.name}`, 'Quick Checkout');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Hidden Excel Import File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportExcelFile}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* Main Header with Navigation & Quick Actions */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        inventory={inventory}
        shopConfig={shopConfig}
        customersCount={customers.length}
        dailyQueriesCount={dailyQueries.length}
        onExportExcel={() => exportToExcelWorkbook(inventory, invoices, returns, shopConfig, undefined, customers)}
        onImportExcel={() => fileInputRef.current?.click()}
        onOpenScanner={() => setShowScannerModal(true)}
      />

      {/* Low Stock Alert Banner (Visible when any product reaches/falls below reorder threshold) */}
      <LowStockAlertBanner
        lowStockItems={lowStockItems}
        onRestock={handleRestockQuantity}
        onViewItem={() => setActiveTab('inventory')}
      />

      {/* Main View Router */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'daily' && (
          <DailyRecordsManager
            invoices={invoices}
            inventory={inventory}
            customers={customers}
            queries={dailyQueries}
            onAddQuery={handleAddDailyQuery}
            onUpdateQuery={handleUpdateDailyQuery}
            onDeleteQuery={handleDeleteDailyQuery}
            onViewInvoice={(inv) => setActiveInvoiceForModal(inv)}
            onNavigateToPosWithCustomer={handleNavigateToPosWithCustomer}
            onExportDailySheet={(date, dayInvoices) => {
              exportToExcelWorkbook(inventory, dayInvoices, returns, shopConfig, undefined, customers);
              toast.success(`Exported daily spreadsheet report for ${date}`, 'Spreadsheet Export');
            }}
          />
        )}

        {activeTab === 'excel' && (
          <ExcelGridView
            inventory={inventory}
            invoices={invoices}
            returns={returns}
            shopConfig={shopConfig}
            onUpdateItem={handleUpdateItem}
            onAddItem={() => setActiveTab('inventory')}
            onImportClick={() => fileInputRef.current?.click()}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryManager
            inventory={inventory}
            onAddItem={handleAddItem}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onOpenScanner={() => setShowScannerModal(true)}
            shopConfig={shopConfig}
            prefilledBarcodeForNewItem={prefillBarcodeForInventory}
            onClearPrefilledBarcode={() => setPrefillBarcodeForInventory(null)}
            targetEditItemId={targetEditItemId}
            onClearTargetEditItemId={() => setTargetEditItemId(null)}
          />
        )}

        {activeTab === 'pos' && (
          <PosBillingView
            inventory={inventory}
            customers={customers}
            shopConfig={shopConfig}
            preselectedCustomerId={posPreselectedCustomerId}
            onClearPreselectedCustomer={() => setPosPreselectedCustomerId(null)}
            onOpenScanner={() => setShowScannerModal(true)}
            onCompleteSale={handleCompleteSale}
            onOpenInvoice={(inv) => setActiveInvoiceForModal(inv)}
            onAddCustomer={handleAddCustomer}
            initialCartItemToAdd={initialCartItemForPos}
            onClearInitialCartItemToAdd={() => setInitialCartItemForPos(null)}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersManager
            customers={customers}
            invoices={invoices}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
            onAdjustPoints={handleAdjustCustomerPoints}
            onSelectForSale={handleSelectCustomerForSale}
            onViewInvoice={(inv) => setActiveInvoiceForModal(inv)}
          />
        )}

        {activeTab === 'returns' && (
          <ReturnsManager
            returns={returns}
            inventory={inventory}
            invoices={invoices}
            onAddReturn={handleAddReturn}
            onOpenScanner={() => setShowScannerModal(true)}
          />
        )}

        {activeTab === 'monthly' && (
          <MonthlyReportView
            inventory={inventory}
            invoices={invoices}
            returns={returns}
            shopConfig={shopConfig}
          />
        )}
      </main>

      {/* Modals */}
      {/* 1. Barcode Scanner & Reader (Camera + Laser Gun listener) */}
      <BarcodeScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        inventory={inventory}
        onBarcodeDetected={handleBarcodeDetected}
      />

      {/* 2. Dynamic Billing Amount QR Code Generator Modal */}
      {pendingCheckout && (
        <PaymentQrModal
          isOpen={Boolean(pendingCheckout)}
          onClose={() => setPendingCheckout(null)}
          grandTotal={pendingCheckout.invoice.grandTotal}
          invoiceNumber={pendingCheckout.invoice.invoiceNumber}
          customerName={pendingCheckout.invoice.customerName}
          customerPhone={pendingCheckout.invoice.customerPhone}
          shopConfig={shopConfig}
          onPaymentSuccess={handleQrPaymentConfirmed}
        />
      )}

      {/* 3. Official Printable Billing Invoice (Post-Payment) */}
      <InvoiceModal
        isOpen={Boolean(activeInvoiceForModal)}
        onClose={() => setActiveInvoiceForModal(null)}
        invoice={activeInvoiceForModal}
        shopConfig={shopConfig}
        onDownloadExcelReceipt={() => exportToExcelWorkbook(inventory, invoices, returns, shopConfig, undefined, customers)}
      />

      {/* 4. Scanned Product Details & Status Dashboard / Uncataloged Item Prompt Modal */}
      {scannedDashboardData && (
        <ScannedProductDashboardModal
          isOpen={Boolean(scannedDashboardData)}
          onClose={() => setScannedDashboardData(null)}
          scannedCode={scannedDashboardData.scannedCode}
          item={scannedDashboardData.item}
          invoices={invoices}
          onRedirectToAddItem={handleRedirectToAddItem}
          onSellInPos={handleSellScannedItemInPos}
          onRestockItem={handleRestockQuantity}
          onEditInInventory={handleEditScannedItemInInventory}
          onScanAnother={handleScanAnother}
          onViewInvoice={(inv) => {
            setScannedDashboardData(null);
            setActiveInvoiceForModal(inv);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <RetailApp />
    </ToastProvider>
  );
}
