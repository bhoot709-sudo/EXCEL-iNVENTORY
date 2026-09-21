import React, { useState, useRef, useEffect } from 'react';
import { 
  initialInventory, 
  initialPastInvoices, 
  initialReturns, 
  initialShopConfig,
  initialCustomers,
  initialDailyQueries
} from './data/initialData';
import { Customer, InventoryItem, Invoice, ReturnedProduct, ShopConfig, DailyOrderQuery, ActionLog, ActionCategory, LabelPrintReminder, LabelReminderStatus } from './types';
import { getTodayNPTString, formatNPTTime, toBikramSambat } from './utils/nepalLocale';
import { Header } from './components/Header';
import { LowStockAlertBanner } from './components/LowStockAlertBanner';
import { ExcelGridView } from './components/ExcelGridView';
import { InventoryManager } from './components/InventoryManager';
import { PosBillingView } from './components/PosBillingView';
import { CustomersManager } from './components/CustomersManager';
import { ReturnsManager } from './components/ReturnsManager';
import { MonthlyReportView } from './components/MonthlyReportView';
import { DailyRecordsManager } from './components/DailyRecordsManager';
import { BarcodeScannerModal, ScannedBatchEntry } from './components/BarcodeScannerModal';
import { PaymentQrModal } from './components/PaymentQrModal';
import { InvoiceModal } from './components/InvoiceModal';
import { ScannedProductDashboardModal } from './components/ScannedProductDashboardModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { QuickRestockModal } from './components/QuickRestockModal';
import { AddProductCategoryModal } from './components/AddProductCategoryModal';
import { CustomerDuesModal } from './components/CustomerDuesModal';
import { OrderStatusUpdaterModal } from './components/OrderStatusUpdaterModal';
import { MarketScoutModal } from './components/MarketScoutModal';
import { LabelPrintReminderModal } from './components/LabelPrintReminderModal';
import { StockBarcodeLabelModal } from './components/StockBarcodeLabelModal';
import { GoogleCalendarManager } from './components/GoogleCalendarManager';
import { TabKey } from './types';
import { exportToExcelWorkbook, parseExcelInventoryFileWithReport } from './utils/excelEngine';
import { findItemByBarcodeOrSku } from './utils/barcodeUtils';
import { expandInventoryToIndividualUnits, generateBatchUniqueSkus, deduplicateAndSanitizeInventory } from './utils/skuGenerator';
import { cloudSync, CloudStatusInfo } from './services/cloudSync';
import { debounceSaveToStorage } from './utils/storageEngine';
import { ToastProvider, useToast } from './components/Toast';
import { ThemeProvider } from './context/ThemeContext';

function RetailApp() {
  const toast = useToast();

  // Real-time Cloud Sync State & Diagnostics Modal
  const [cloudStatus, setCloudStatus] = useState<CloudStatusInfo>(() => cloudSync.getCurrentStatus());
  const [showCloudSyncModal, setShowCloudSyncModal] = useState(false);

  // Application Data States (persisted locally in browser localStorage as offline-first cache)
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('gadget_inventory_master');
    if (saved) {
      try {
        const parsed: InventoryItem[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If any inventory item has grouped stock or duplicate IDs/SKUs, unpack and sanitize
          return deduplicateAndSanitizeInventory(parsed);
        }
      } catch {
        return deduplicateAndSanitizeInventory(initialInventory);
      }
    }
    return deduplicateAndSanitizeInventory(initialInventory);
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
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.shopName === 'Remix Phone & Gadgets Hub' || !parsed.shopName) {
          parsed.shopName = 'Welcome Mobile Zone';
        }
        return parsed;
      } catch {
        return initialShopConfig;
      }
    }
    return initialShopConfig;
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

  // Action Logs State (persistent in localStorage & real-time Firestore)
  const [actionLogs, setActionLogs] = useState<ActionLog[]>(() => {
    const saved = localStorage.getItem('gadget_action_logs_master');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  });

  // Real-time Cloud Synchronization & Initial Seeding
  useEffect(() => {
    // Listen to cloud status for UI badge & diagnostics
    const unsubStatus = cloudSync.subscribeStatus((newStatus) => {
      setCloudStatus(newStatus);
    });

    // Seed cloud database if empty
    cloudSync.seedInitialDataIfEmpty(inventory, invoices, customers, returns, dailyQueries, shopConfig);

    // Listen to real-time cloud updates across all collections
    const unsubInv = cloudSync.subscribeInventory((cloudItems) => {
      if (cloudItems && cloudItems.length > 0) {
        const cleaned = deduplicateAndSanitizeInventory(cloudItems);
        setInventory(cleaned);
        const hasGroupedOrDuplicates =
          cloudItems.some((i) => i.stockQuantity > 1) ||
          cloudItems.length !== cleaned.length;
        if (hasGroupedOrDuplicates) {
          cloudSync.bulkSaveInventory(cleaned);
        }
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

    const unsubQueries = cloudSync.subscribeDailyQueries((cloudQueries) => {
      if (cloudQueries && cloudQueries.length > 0) {
        setDailyQueries(cloudQueries);
      }
    });

    const unsubConfig = cloudSync.subscribeShopConfig((cloudConfig) => {
      if (cloudConfig) {
        setShopConfig(cloudConfig);
      }
    });

    const unsubActionLogs = cloudSync.subscribeActionLogs((cloudLogs) => {
      if (cloudLogs && cloudLogs.length > 0) {
        setActionLogs(cloudLogs);
      }
    });

    return () => {
      unsubStatus();
      unsubInv();
      unsubInvcs();
      unsubCust();
      unsubRet();
      unsubQueries();
      unsubConfig();
      unsubActionLogs();
    };
  }, []);

  // Auto-guarantee 1:1 physical unit SKU parity & unique IDs: every in-stock unit has its own unique SKU and ID
  useEffect(() => {
    const hasGrouped = inventory.some((i) => i.stockQuantity > 1);
    const seenIds = new Set<string>();
    let hasDuplicateId = false;
    for (const item of inventory) {
      if (seenIds.has(item.id)) {
        hasDuplicateId = true;
        break;
      }
      seenIds.add(item.id);
    }

    if (hasGrouped || hasDuplicateId) {
      const sanitized = deduplicateAndSanitizeInventory(inventory);
      setInventory(sanitized);
      cloudSync.bulkSaveInventory(sanitized);
      try {
        localStorage.setItem('gadget_inventory_master', JSON.stringify(sanitized));
      } catch {}
    }
  }, [inventory]);

  // Sync to localStorage as offline-safe cache with non-blocking debounce
  useEffect(() => {
    debounceSaveToStorage('gadget_inventory_master', inventory);
  }, [inventory]);

  useEffect(() => {
    debounceSaveToStorage('gadget_invoices_master', invoices);
  }, [invoices]);

  useEffect(() => {
    debounceSaveToStorage('gadget_customers_master', customers);
  }, [customers]);

  useEffect(() => {
    debounceSaveToStorage('gadget_returns_master', returns);
  }, [returns]);

  useEffect(() => {
    debounceSaveToStorage('gadget_daily_queries_master', dailyQueries);
  }, [dailyQueries]);

  useEffect(() => {
    debounceSaveToStorage('gadget_shop_config', shopConfig);
  }, [shopConfig]);

  useEffect(() => {
    debounceSaveToStorage('gadget_action_logs_master', actionLogs);
  }, [actionLogs]);

  // UI States
  const [activeTab, setActiveTab] = useState<TabKey>('daily');
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
  const [initialCartItemsForPos, setInitialCartItemsForPos] = useState<Array<{ item: InventoryItem; quantity?: number }> | null>(null);
  const [initialReturnItem, setInitialReturnItem] = useState<InventoryItem | null>(null);

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

  // Daily Routine Tasks Modals State
  const [showQuickRestockModal, setShowQuickRestockModal] = useState(false);
  const [showAddProductCategoryModal, setShowAddProductCategoryModal] = useState(false);
  const [showCustomerDuesModal, setShowCustomerDuesModal] = useState(false);
  const [showOrderStatusUpdaterModal, setShowOrderStatusUpdaterModal] = useState(false);
  const [showMarketScoutModal, setShowMarketScoutModal] = useState(false);
  const [showLabelRemindersModal, setShowLabelRemindersModal] = useState(false);

  // Barcode Label Studio Print Modal State
  const [barcodeLabelStudioData, setBarcodeLabelStudioData] = useState<{
    isOpen: boolean;
    initialItem?: InventoryItem | null;
    initialBatchItems?: InventoryItem[];
    initialQuantity?: number;
  } | null>(null);

  // Print & Stickering Label Reminders Queue
  const [labelReminders, setLabelReminders] = useState<LabelPrintReminder[]>(() => {
    const saved = localStorage.getItem('gadget_label_reminders_master');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  });

  useEffect(() => {
    debounceSaveToStorage('gadget_label_reminders_master', labelReminders);
  }, [labelReminders]);

  const handleAddLabelReminder = (reminder: Partial<LabelPrintReminder>) => {
    const now = new Date();
    const newReminder: LabelPrintReminder = {
      id: `lbl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: reminder.itemId || '',
      itemName: reminder.itemName || 'Product',
      brand: reminder.brand || '',
      category: reminder.category || 'Smartphones',
      sku: reminder.sku || '',
      barcode: reminder.barcode || '',
      sellingPrice: reminder.sellingPrice || 0,
      costPrice: reminder.costPrice,
      quantityNeeded: reminder.quantityNeeded || 1,
      createdAt: now.toISOString(),
      createdTime: formatNPTTime(now),
      source: reminder.source || 'NEW_PRODUCT',
      status: reminder.status || 'PENDING',
      notes: reminder.notes,
    };

    setLabelReminders((prev) => [newReminder, ...prev]);

    logAction({
      category: 'PRODUCT',
      actionTitle: `Queued Label: ${newReminder.itemName}`,
      description: `Added ${newReminder.quantityNeeded} label(s) for ${newReminder.itemName} (SKU: ${newReminder.sku}, Price: रु ${newReminder.sellingPrice}) to printing and stickering queue.`,
      source: 'PRODUCT_MODAL',
      metadata: { reminderId: newReminder.id, sku: newReminder.sku, qty: newReminder.quantityNeeded },
    });
  };

  const handleUpdateLabelStatus = (id: string, status: LabelReminderStatus, staffName?: string) => {
    const now = new Date().toISOString();
    setLabelReminders((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              ...(status === 'STICKERED'
                ? { stickeredAt: now, stickeredBy: staffName || 'Counter Staff' }
                : {}),
            }
          : r
      )
    );
    if (status === 'STICKERED') {
      toast.success('Marked label as stickered on physical inventory!', 'Stickering Done');
    } else {
      toast.info(`Updated label status to ${status}.`);
    }
  };

  const handleBatchUpdateLabelStatus = (ids: string[], status: LabelReminderStatus, staffName?: string) => {
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    setLabelReminders((prev) =>
      prev.map((r) =>
        idSet.has(r.id)
          ? {
              ...r,
              status,
              ...(status === 'STICKERED'
                ? { stickeredAt: now, stickeredBy: staffName || 'Counter Staff' }
                : {}),
            }
          : r
      )
    );
    if (status === 'STICKERED') {
      toast.success(`Marked ${ids.length} items as printed & stickered!`, 'Stickering Done');
    } else {
      toast.info(`Updated ${ids.length} items to ${status}.`);
    }
  };

  const handleDeleteLabelReminder = (reminderId: string) => {
    setLabelReminders((prev) => prev.filter((r) => r.id !== reminderId));
    toast.info('Removed label reminder.');
  };

  const handleClearStickeredLabels = () => {
    setLabelReminders((prev) => prev.filter((r) => r.status !== 'STICKERED'));
    toast.info('Cleared stickered labels history.');
  };

  const handleOpenLabelStudioFromReminders = (itemOrItems: {
    singleItem?: InventoryItem;
    batchItems?: InventoryItem[];
    presetQty?: number;
  }) => {
    setBarcodeLabelStudioData({
      isOpen: true,
      initialItem: itemOrItems.singleItem || null,
      initialBatchItems: itemOrItems.batchItems,
      initialQuantity: itemOrItems.presetQty,
    });
  };

  const pendingLabelRemindersCount = labelReminders.filter((r) => r.status === 'PENDING').length;

  // Hidden Excel upload input
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Master Action Logging Engine for All UI and Routine Actions
  const logAction = (entry: {
    category: ActionCategory;
    actionTitle: string;
    description: string;
    staffName?: string;
    source: ActionLog['source'];
    status?: 'SUCCESS' | 'PENDING' | 'CANCELLED';
    metadata?: Record<string, any>;
  }) => {
    const now = new Date();
    const todayStr = getTodayNPTString();
    const timeStr = formatNPTTime(now);
    const bsInfo = toBikramSambat(todayStr);

    const newLog: ActionLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now.toISOString(),
      date: todayStr,
      time: timeStr,
      bsDate: `${bsInfo.formattedNp} (${bsInfo.formattedBS})`,
      category: entry.category,
      actionTitle: entry.actionTitle,
      description: entry.description,
      staffName: entry.staffName || 'Counter Staff',
      source: entry.source,
      status: entry.status || 'SUCCESS',
      metadata: entry.metadata || {},
    };

    setActionLogs((prev) => [newLog, ...prev]);
    cloudSync.saveActionLog(newLog);
    return newLog;
  };

  const handleClearActionLogs = () => {
    setActionLogs([]);
    localStorage.removeItem('gadget_action_logs_master');
    cloudSync.clearAllActionLogs();
    toast.info('Cleared all saved action logs.', 'Action Logs');
  };

  const handleDeleteActionLog = (logId: string) => {
    setActionLogs((prev) => prev.filter((l) => l.id !== logId));
    cloudSync.deleteActionLog(logId);
    toast.info('Removed action log record.', 'Action Logs');
  };

  // Calculate items with low stock (<= reorderLevel)
  const lowStockItems = inventory.filter((item) => item.stockQuantity <= item.reorderLevel);

  // Handlers for Inventory with SKU Uniqueness & Shared Barcode Support & Cloud Sync
  const handleAddItem = (newItem: InventoryItem) => {
    // If newItem has stockQuantity > 1, unpack into exact individual unit items each with unique SKU
    if (newItem.stockQuantity > 1) {
      const expanded = expandInventoryToIndividualUnits([newItem]);
      handleAddBatchItems(expanded);
      return;
    }

    let duplicateSkuDetected = false;
    setInventory((prev) => {
      // Check SKU Uniqueness (Strict rule: each item must have a unique SKU)
      const existingWithSameSku = prev.find(
        (i) => i.sku && newItem.sku && i.sku.trim().toLowerCase() === newItem.sku.trim().toLowerCase()
      );
      if (existingWithSameSku) {
        duplicateSkuDetected = true;
        toast.error(`Duplicate SKU: "${newItem.sku}" already belongs to "${existingWithSameSku.name}". Each item must have a unique SKU!`, 'Duplicate SKU');
        return prev;
      }
      return [newItem, ...prev];
    });

    if (duplicateSkuDetected) return;

    cloudSync.saveInventoryItem(newItem);

    // Auto-queue sticker label printing reminder
    handleAddLabelReminder({
      itemId: newItem.id,
      itemName: newItem.name,
      brand: newItem.brand,
      category: newItem.category,
      sku: newItem.sku,
      barcode: newItem.barcode,
      sellingPrice: newItem.sellingPrice,
      costPrice: newItem.costPrice,
      quantityNeeded: newItem.stockQuantity > 0 ? newItem.stockQuantity : 1,
      source: 'NEW_PRODUCT',
      status: 'PENDING',
    });

    // Save audit log for future reference
    logAction({
      category: 'PRODUCT',
      actionTitle: `Added Product: ${newItem.name}`,
      description: `Created catalog product ${newItem.name} (SKU: ${newItem.sku}, Price: रु ${newItem.sellingPrice}, Barcode: ${newItem.barcode || 'N/A'}).`,
      source: 'PRODUCT_MODAL',
      metadata: {
        itemId: newItem.id,
        sku: newItem.sku,
        barcode: newItem.barcode,
        price: newItem.sellingPrice,
        category: newItem.category,
      },
    });
  };

  const handleAddBatchItems = (newItems: InventoryItem[]) => {
    if (!newItems || newItems.length === 0) return;
    const addedItems: InventoryItem[] = [];

    setInventory((prev) => {
      const existingSkuSet = new Set(prev.map((i) => i.sku.trim().toLowerCase()));
      for (const item of newItems) {
        const itemSkuLower = item.sku.trim().toLowerCase();
        if (!existingSkuSet.has(itemSkuLower)) {
          addedItems.push(item);
          existingSkuSet.add(itemSkuLower);
        }
      }

      if (addedItems.length === 0) {
        toast.warning('All items in batch were skipped due to duplicate SKUs.');
        return prev;
      }

      return [...addedItems, ...prev];
    });

    if (addedItems.length === 0) return;

    // Save added items to cloud and queue label reminders
    addedItems.forEach((item) => {
      cloudSync.saveInventoryItem(item);
      handleAddLabelReminder({
        itemId: item.id,
        itemName: item.name,
        brand: item.brand,
        category: item.category,
        sku: item.sku,
        barcode: item.barcode,
        sellingPrice: item.sellingPrice,
        costPrice: item.costPrice,
        quantityNeeded: 1,
        source: 'NEW_PRODUCT',
        status: 'PENDING',
      });
    });

    logAction({
      category: 'PRODUCT',
      actionTitle: `Added Batch of ${addedItems.length} Units: ${addedItems[0]?.name}`,
      description: `Added ${addedItems.length} individual units sharing barcode "${addedItems[0]?.barcode}" with unique SKUs.`,
      source: 'PRODUCT_MODAL',
      metadata: {
        itemCount: addedItems.length,
        sharedBarcode: addedItems[0]?.barcode,
        firstSku: addedItems[0]?.sku,
        lastSku: addedItems[addedItems.length - 1]?.sku,
      },
    });

    toast.success(
      `Successfully added batch of ${addedItems.length} items of "${addedItems[0]?.name}" with unique SKUs and shared barcode!`,
      'Batch Items Registered'
    );
  };

  const handleConvertAllToIndividualItems = () => {
    setInventory((prev) => {
      const expanded = deduplicateAndSanitizeInventory(prev);
      cloudSync.bulkSaveInventory(expanded);
      logAction({
        category: 'PRODUCT',
        actionTitle: 'Converted Stock to Individual Unit Registry',
        description: `Expanded all inventory into ${expanded.length} individual items, each with a unique SKU and shared barcode.`,
        source: 'PRODUCT_MODAL',
      });
      toast.success(
        `All ${expanded.length} stock items are now registered as individual units with unique SKUs!`,
        'Individual Units Active'
      );
      return expanded;
    });
  };

  const handleUpdateItem = (updated: InventoryItem) => {
    setInventory((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    cloudSync.saveInventoryItem(updated);
    logAction({
      category: 'INVENTORY_UPDATE',
      actionTitle: `Updated Catalog: ${updated.name}`,
      description: `Updated SKU ${updated.sku} (Selling: रु ${updated.sellingPrice}, Cost: रु ${updated.costPrice}, Stock: ${updated.stockQuantity} units, Reorder Level: ${updated.reorderLevel}).`,
      source: 'PRODUCT_MODAL',
      metadata: {
        itemId: updated.id,
        sku: updated.sku,
        stockQuantity: updated.stockQuantity,
        sellingPrice: updated.sellingPrice,
        category: updated.category,
      },
    });
  };

  const handleDeleteItem = (itemId: string) => {
    const target = inventory.find((i) => i.id === itemId);
    setInventory((prev) => prev.filter((i) => i.id !== itemId));
    cloudSync.deleteInventoryItem(itemId);
    logAction({
      category: 'INVENTORY_UPDATE',
      actionTitle: `Removed Item: ${target?.name || itemId}`,
      description: `Permanently removed ${target?.name || 'product'} (SKU: ${target?.sku || itemId}) from inventory database.`,
      source: 'PRODUCT_MODAL',
      metadata: { itemId, itemName: target?.name, sku: target?.sku },
    });
  };

  const handleRestockQuantity = (
    itemId: string, 
    addedQty: number, 
    newCostPrice?: number, 
    supplier?: string
  ) => {
    let targetItemName = 'Inventory Item';
    let targetItem: InventoryItem | undefined;

    setInventory((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (!existing) return prev;
      targetItemName = existing.name;

      const baseUpdated: InventoryItem = {
        ...existing,
        stockQuantity: 1,
        costPrice: newCostPrice !== undefined && newCostPrice > 0 ? newCostPrice : existing.costPrice,
        supplier: supplier && supplier.trim() ? supplier.trim() : existing.supplier,
        lastRestockedDate: new Date().toISOString().split('T')[0],
      };
      targetItem = baseUpdated;
      cloudSync.saveInventoryItem(baseUpdated);

      // If existing item was sold (stockQuantity === 0), it now has 1 unit in stock, and we create (addedQty - 1) additional units
      // If existing item already was in stock (stockQuantity >= 1), create all addedQty as new individual unit items
      const unitsToCreate = existing.stockQuantity === 0 ? Math.max(0, addedQty - 1) : addedQty;
      let newUnits: InventoryItem[] = [];

      if (unitsToCreate > 0) {
        const extraSkus = generateBatchUniqueSkus(
          unitsToCreate,
          existing.brand,
          existing.category,
          existing.name,
          prev,
          { isRestock: true, batchTag: 'RESTOCK' }
        );
        newUnits = extraSkus.map((sku, idx) => ({
          ...baseUpdated,
          id: `prod-restock-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          sku,
          stockQuantity: 1,
        }));
        newUnits.forEach((u) => cloudSync.saveInventoryItem(u));
      }

      return [...newUnits, ...prev.map((i) => (i.id === itemId ? baseUpdated : i))];
    });

    // Auto-queue sticker label printing reminder for restocked units
    if (targetItem) {
      handleAddLabelReminder({
        itemId: (targetItem as InventoryItem).id,
        itemName: (targetItem as InventoryItem).name,
        brand: (targetItem as InventoryItem).brand,
        category: (targetItem as InventoryItem).category,
        sku: (targetItem as InventoryItem).sku,
        barcode: (targetItem as InventoryItem).barcode,
        sellingPrice: (targetItem as InventoryItem).sellingPrice,
        costPrice: (targetItem as InventoryItem).costPrice,
        quantityNeeded: addedQty,
        source: 'RESTOCK',
        status: 'PENDING',
      });
    }

    // Record action log for restock
    logAction({
      category: 'RESTOCK',
      actionTitle: `Restocked ${targetItemName}`,
      description: `Added +${addedQty} units to inventory stock. Supplier: ${supplier || 'Standard Distributor'}. Queued ${addedQty} labels for stickering.`,
      source: 'RESTOCK_MODAL',
      metadata: {
        itemId,
        itemName: targetItemName,
        quantity: addedQty,
        supplier,
      },
    });
  };

  const handleImportFromMarketScout = (itemsToImport: Partial<InventoryItem>[], sourceNotes: string) => {
    let addedCount = 0;
    let restockedCount = 0;

    setInventory((prev) => {
      const updated = [...prev];
      itemsToImport.forEach((imported) => {
        const matchIndex = updated.findIndex(
          (i) =>
            (imported.name && i.name.toLowerCase().trim() === imported.name.toLowerCase().trim()) ||
            (imported.barcode && i.barcode && i.barcode.trim() === imported.barcode.trim())
        );

        if (matchIndex >= 0) {
          const existing = updated[matchIndex];
          const newQty = (existing.stockQuantity || 0) + (imported.stockQuantity || 5);
          const updatedItem: InventoryItem = {
            ...existing,
            stockQuantity: newQty,
            sellingPrice: imported.sellingPrice || existing.sellingPrice,
            costPrice: imported.costPrice || existing.costPrice,
            lastRestockedDate: new Date().toISOString().split('T')[0],
          };
          updated[matchIndex] = updatedItem;
          cloudSync.saveInventoryItem(updatedItem);
          restockedCount++;
        } else {
          const newItem: InventoryItem = {
            id: `prod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: imported.name || 'Trending Tech Item',
            brand: imported.brand || 'Generic',
            category: (imported.category as any) || 'Accessories',
            sku: imported.sku || `SKU-${Date.now().toString().slice(-4)}`,
            barcode: imported.barcode || `${Date.now()}`,
            costPrice: imported.costPrice || 100,
            sellingPrice: imported.sellingPrice || 150,
            stockQuantity: imported.stockQuantity || 5,
            reorderLevel: imported.reorderLevel || 3,
            supplier: imported.supplier || 'Market Scout Wholesale',
            imeiRequired: Boolean(imported.imeiRequired),
            lastRestockedDate: new Date().toISOString().split('T')[0],
          };
          updated.unshift(newItem);
          cloudSync.saveInventoryItem(newItem);
          addedCount++;
        }
      });

      return updated;
    });

    logAction({
      category: 'MARKET_SCOUT',
      actionTitle: `Market Scout Import (${itemsToImport.length} Items)`,
      description: `${sourceNotes}. Added ${addedCount} new catalog items, restocked ${restockedCount} existing products.`,
      source: 'MARKET_SCOUT',
      metadata: {
        totalImported: itemsToImport.length,
        newItemsAdded: addedCount,
        existingRestocked: restockedCount,
      },
    });

    toast.success(
      `Synchronized ${itemsToImport.length} products (${addedCount} new added, ${restockedCount} restocked)!`,
      'Market Scout Sync'
    );
  };

  // Handlers for Customer Dues (उधारो) & Credit Settlement
  const handleSettleCustomerDue = (
    customerId: string, 
    amountSettled: number, 
    paymentMethod: string, 
    notes?: string
  ) => {
    let customerName = 'Customer';
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          customerName = c.name;
          const currentDue = c.dueAmount || 0;
          const newDue = Math.max(0, currentDue - amountSettled);
          const logNote = `Settled रु ${amountSettled} via ${paymentMethod}${notes ? ` (${notes})` : ''}`;
          const updatedCustomer: Customer = {
            ...c,
            dueAmount: newDue,
            notes: c.notes ? `${c.notes} • ${logNote}` : logNote,
          };
          cloudSync.saveCustomer(updatedCustomer);
          return updatedCustomer;
        }
        return c;
      })
    );

    // Record action log for credit settlement
    logAction({
      category: 'DUE_SETTLEMENT',
      actionTitle: `Settled Customer Due: ${customerName}`,
      description: `Received payment of रु ${amountSettled} via ${paymentMethod} to clear due balance. ${notes || ''}`,
      source: 'DUES_MODAL',
      metadata: {
        customerId,
        customerName,
        amount: amountSettled,
        paymentMethod,
        notes,
      },
    });
  };

  const handleAddCustomerCredit = (
    customerId: string, 
    creditAmount: number, 
    reason?: string
  ) => {
    let customerName = 'Customer';
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          customerName = c.name;
          const currentDue = (c.dueAmount || 0) + creditAmount;
          const logNote = `Credit +रु ${creditAmount}${reason ? `: ${reason}` : ''}`;
          const updatedCustomer: Customer = {
            ...c,
            dueAmount: currentDue,
            notes: c.notes ? `${c.notes} • ${logNote}` : logNote,
          };
          cloudSync.saveCustomer(updatedCustomer);
          return updatedCustomer;
        }
        return c;
      })
    );

    // Record action log for credit addition
    logAction({
      category: 'CREDIT_ENTRY',
      actionTitle: `Added Credit (उधारो): ${customerName}`,
      description: `Extended store credit of रु ${creditAmount} to ${customerName}. Reason: ${reason || 'Store credit purchase'}.`,
      source: 'DUES_MODAL',
      metadata: {
        customerId,
        customerName,
        amount: creditAmount,
        reason,
      },
    });
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
    logAction({
      category: 'CUSTOMER',
      actionTitle: `Enrolled Customer: ${newCustomer.name}`,
      description: `Registered new CRM account for ${newCustomer.name} (Phone: ${newCustomer.phone}, Tier: ${newCustomer.tier}, Loyalty: ${newCustomer.loyaltyPoints} pts).`,
      source: 'POS_TERMINAL',
      metadata: {
        customerId: newCustomer.id,
        customerName: newCustomer.name,
        phone: newCustomer.phone,
        tier: newCustomer.tier,
      },
    });
  };

  const handleUpdateCustomer = (updated: Customer) => {
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    cloudSync.saveCustomer(updated);
    logAction({
      category: 'CUSTOMER',
      actionTitle: `Updated Customer: ${updated.name}`,
      description: `Updated profile details for ${updated.name} (Phone: ${updated.phone}, Due Balance: रु ${updated.dueAmount || 0}, Tier: ${updated.tier}).`,
      source: 'MANUAL',
      metadata: {
        customerId: updated.id,
        customerName: updated.name,
        dueAmount: updated.dueAmount,
        loyaltyPoints: updated.loyaltyPoints,
      },
    });
  };

  const handleDeleteCustomer = (customerId: string) => {
    const target = customers.find((c) => c.id === customerId);
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    cloudSync.deleteCustomer(customerId);
    logAction({
      category: 'CUSTOMER',
      actionTitle: `Deleted Customer: ${target?.name || customerId}`,
      description: `Permanently removed customer profile ${target?.name || ''} from database.`,
      source: 'MANUAL',
      metadata: { customerId, customerName: target?.name },
    });
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

          logAction({
            category: 'CUSTOMER',
            actionTitle: `Adjusted Loyalty Points: ${c.name}`,
            description: `${delta > 0 ? 'Awarded +' : 'Deducted '}${delta} loyalty points to ${c.name}. Reason: ${reason || 'Manual Adjustment'}. New balance: ${newPoints} pts (${tier} Tier).`,
            source: 'MANUAL',
            metadata: {
              customerId: c.id,
              customerName: c.name,
              delta,
              newPoints,
              tier,
              reason,
            },
          });

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

    // Automatically decrement inventory stock locally
    setInventory((prev) =>
      prev.map((item) => {
        const soldLine = inv.items.find((line) => line.itemId === item.id);
        if (soldLine) {
          const newQty = Math.max(0, item.stockQuantity - soldLine.quantity);
          return {
            ...item,
            stockQuantity: newQty,
          };
        }
        return item;
      })
    );

    // Atomically decrement stock in Firestore across multi-device checkouts
    const lineItemsToDeduct = inv.items.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
    }));
    cloudSync.atomicDeductStock(lineItemsToDeduct);

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

    // Save action log for new retail sale
    logAction({
      category: 'SALE',
      actionTitle: `New Retail Sale: #${inv.invoiceNumber}`,
      description: `Completed sale of रु ${inv.grandTotal} (${inv.items.length} items) for ${inv.customerName} via ${inv.paymentMethod}.`,
      source: 'POS_TERMINAL',
      metadata: {
        invoiceNumber: inv.invoiceNumber,
        amount: inv.grandTotal,
        customerName: inv.customerName,
        paymentMethod: inv.paymentMethod,
        itemsCount: inv.items.length,
      },
    });
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

    // Record action log for customer return
    logAction({
      category: 'RETURN_RMA',
      actionTitle: `Processed Return: ${newReturn.itemName}`,
      description: `Customer ${newReturn.customerName} returned ${newReturn.itemName}. Refund: रु ${newReturn.refundAmount}. Reason: ${newReturn.returnReason}. Restocked: ${shouldRestock ? 'Yes' : 'No'}.`,
      source: 'MANUAL',
      metadata: {
        returnId: newReturn.id,
        itemName: newReturn.itemName,
        refundAmount: newReturn.refundAmount,
        customerName: newReturn.customerName,
      },
    });

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

  const handleUpdateReturn = (updated: ReturnedProduct) => {
    setReturns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    cloudSync.saveReturn(updated);
    toast.success(`Updated Return & Warranty record #${updated.id}`);

    logAction({
      category: 'RETURN_RMA',
      actionTitle: `Updated Warranty / RMA #${updated.id}`,
      description: `Claim for ${updated.itemName} resolution set to ${updated.resolution || updated.actionTaken}, status: ${updated.status || 'UPDATED'}. Warranty: ${updated.warrantyStatus}.`,
      source: 'MANUAL',
      metadata: {
        returnId: updated.id,
        resolution: updated.resolution,
        warrantyStatus: updated.warrantyStatus,
      },
    });
  };

  const handleDeleteReturn = (returnId: string) => {
    setReturns((prev) => prev.filter((r) => r.id !== returnId));
    cloudSync.deleteReturn(returnId);
    toast.info(`Deleted Return / RMA ticket #${returnId}`);

    logAction({
      category: 'RETURN_RMA',
      actionTitle: `Deleted Return Ticket #${returnId}`,
      description: `RMA record #${returnId} was permanently removed.`,
      source: 'MANUAL',
      metadata: { returnId },
    });
  };

  // Barcode Detected handler: launches the requested Post-Scan Dashboard
  const handleBarcodeDetected = (barcode: string, foundItem?: InventoryItem) => {
    setShowScannerModal(false);
    const resolvedItem =
      foundItem ||
      findItemByBarcodeOrSku(inventory, barcode);

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

  // Add multiple scanned batch items directly into Current Sales & Bills
  const handleAddBatchToBill = (batch: ScannedBatchEntry[]) => {
    if (!batch || batch.length === 0) return;
    setInitialCartItemsForPos(batch.map((b) => ({ item: b.item, quantity: b.quantity })));
    toast.success(`Added ${batch.reduce((s, b) => s + b.quantity, 0)} scanned items to Current Sales & Bills.`);
  };

  // Sell entire multi-scanned batch in POS Billing View
  const handleSellBatchInPos = (batch: ScannedBatchEntry[]) => {
    if (!batch || batch.length === 0) return;
    setInitialCartItemsForPos(batch.map((b) => ({ item: b.item, quantity: b.quantity })));
    setActiveTab('pos');
    toast.success(`Loaded ${batch.reduce((s, b) => s + b.quantity, 0)} scanned items into POS Cart.`);
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

  // Daily queries and customer order notes handlers with Cloud Sync
  const handleAddDailyQuery = (newQuery: DailyOrderQuery) => {
    setDailyQueries((prev) => [newQuery, ...prev]);
    cloudSync.saveDailyQuery(newQuery);
    toast.success(`Logged note/query for ${newQuery.customerName}`, 'Daily Records');

    // Record action log
    logAction({
      category: 'ORDER_UPDATE',
      actionTitle: `Logged Inquiry: ${newQuery.customerName}`,
      description: `Inquiry registered for ${newQuery.deviceModel} (${newQuery.queryType}, Priority: ${newQuery.priority}).`,
      source: 'ORDER_MODAL',
      metadata: {
        queryId: newQuery.id,
        customerName: newQuery.customerName,
        deviceModel: newQuery.deviceModel,
        queryType: newQuery.queryType,
        priority: newQuery.priority,
      },
    });
  };

  const handleUpdateDailyQuery = (updated: DailyOrderQuery) => {
    setDailyQueries((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    cloudSync.saveDailyQuery(updated);
    toast.info(`Updated status for ${updated.customerName}`, 'Daily Records');

    // Record action log
    logAction({
      category: 'ORDER_UPDATE',
      actionTitle: `Updated Order Status: ${updated.customerName}`,
      description: `Status marked as "${updated.status}" for ${updated.deviceModel}. ${updated.resolutionNotes || updated.notes}`,
      source: 'ORDER_MODAL',
      metadata: {
        queryId: updated.id,
        customerName: updated.customerName,
        deviceModel: updated.deviceModel,
        status: updated.status,
      },
    });
  };

  const handleDeleteDailyQuery = (queryId: string) => {
    setDailyQueries((prev) => prev.filter((q) => q.id !== queryId));
    cloudSync.deleteDailyQuery(queryId);
    toast.info('Deleted query record.', 'Daily Records');
  };

  const handleNavigateToPosWithCustomer = (customer: Customer, _note?: string) => {
    setPosPreselectedCustomerId(customer.id);
    setActiveTab('pos');
    toast.info(`Switched to POS cashier with customer ${customer.name}`, 'Quick Checkout');
  };

  const handleConvertOrderQueryToSale = (query: DailyOrderQuery) => {
    const cleanPhone = query.customerPhone.replace(/\D/g, '');
    let matchedCustomer = customers.find(
      (c) => c.phone.replace(/\D/g, '') === cleanPhone
    );

    if (!matchedCustomer) {
      matchedCustomer = {
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: query.customerName,
        phone: query.customerPhone,
        email: '',
        tier: 'Bronze',
        loyaltyPoints: 0,
        totalPurchases: 0,
        dueAmount: 0,
        notes: `Converted from customer inquiry (${query.deviceModel})`,
        createdAt: new Date().toISOString().split('T')[0],
      };
      handleAddCustomer(matchedCustomer);
    }

    const matchedItem = inventory.find(
      (i) =>
        i.name.toLowerCase().includes(query.deviceModel.toLowerCase()) ||
        query.deviceModel.toLowerCase().includes(i.name.toLowerCase())
    );

    if (matchedItem) {
      setInitialCartItemForPos(matchedItem);
    }

    handleUpdateDailyQuery({
      ...query,
      status: 'FULFILLED',
      resolutionNotes: `Fulfilled at POS on ${new Date().toLocaleDateString('en-GB')}`,
    });

    setPosPreselectedCustomerId(matchedCustomer.id);
    setActiveTab('pos');
    toast.success(`Converted ${query.customerName}'s order to active POS sale!`, 'POS Terminal Ready');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-150">
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
        cloudStatus={cloudStatus}
        onOpenCloudSyncModal={() => setShowCloudSyncModal(true)}
        onExportExcel={() => exportToExcelWorkbook(inventory, invoices, returns, shopConfig, undefined, customers)}
        onImportExcel={() => fileInputRef.current?.click()}
        onOpenScanner={() => setShowScannerModal(true)}
        onOpenMarketScout={() => setShowMarketScoutModal(true)}
        onOpenLabelReminders={() => setShowLabelRemindersModal(true)}
        pendingLabelRemindersCount={pendingLabelRemindersCount}
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
            returns={returns}
            shopConfig={shopConfig}
            actionLogs={actionLogs}
            onLogAction={logAction}
            onClearActionLogs={handleClearActionLogs}
            onDeleteActionLog={handleDeleteActionLog}
            onAddQuery={handleAddDailyQuery}
            onUpdateQuery={handleUpdateDailyQuery}
            onDeleteQuery={handleDeleteDailyQuery}
            onViewInvoice={(inv) => setActiveInvoiceForModal(inv)}
            onNavigateToPosWithCustomer={handleNavigateToPosWithCustomer}
            onOpenNewSale={() => {
              logAction({
                category: 'ROUTINE_LAUNCH',
                actionTitle: 'Launched New Sale (POS Terminal)',
                description: 'Opened POS terminal cashier for retail bill checkout & QR payments.',
                source: 'DAILY_ROUTINE_BAR',
                metadata: { view: 'pos' },
              });
              setActiveTab('pos');
            }}
            onOpenRestock={() => {
              logAction({
                category: 'ROUTINE_LAUNCH',
                actionTitle: 'Opened Quick Restock Console',
                description: `Accessed restock console (${lowStockItems.length} low stock items).`,
                source: 'DAILY_ROUTINE_BAR',
                metadata: { lowStockCount: lowStockItems.length },
              });
              setShowQuickRestockModal(true);
            }}
            onOpenAddProductCategory={() => {
              logAction({
                category: 'ROUTINE_LAUNCH',
                actionTitle: 'Opened Product & Category Creator',
                description: 'Accessed catalog creation tool for new SKU/barcode products and categories.',
                source: 'DAILY_ROUTINE_BAR',
              });
              setShowAddProductCategoryModal(true);
            }}
            onOpenCustomerDues={() => {
              const duesCount = customers.filter((c) => (c.dueAmount || 0) > 0).length;
              logAction({
                category: 'ROUTINE_LAUNCH',
                actionTitle: 'Opened Customer Dues Ledger (उधारो)',
                description: `Accessed customer credit tracking (${duesCount} customers with active dues).`,
                source: 'DAILY_ROUTINE_BAR',
              });
              setShowCustomerDuesModal(true);
            }}
            onOpenOrderStatusUpdater={() => {
              const pendingCount = dailyQueries.filter((q) => q.status === 'PENDING').length;
              logAction({
                category: 'ROUTINE_LAUNCH',
                actionTitle: 'Opened Order Status & Customer Inquiries',
                description: `Accessed order inquiries manager (${pendingCount} pending customer requests).`,
                source: 'DAILY_ROUTINE_BAR',
              });
              setShowOrderStatusUpdaterModal(true);
            }}
            onOpenLabelReminders={() => setShowLabelRemindersModal(true)}
            onOpenGoogleCalendar={() => setActiveTab('calendar')}
            pendingLabelRemindersCount={pendingLabelRemindersCount}
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
            onOpenInvoice={(inv) => setActiveInvoiceForModal(inv)}
            onAddReturn={handleAddReturn}
            onUpdateReturn={handleUpdateReturn}
            onDeleteReturn={handleDeleteReturn}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryManager
            inventory={inventory}
            invoices={invoices}
            onConvertAllToIndividualItems={handleConvertAllToIndividualItems}
            onAddItem={handleAddItem}
            onAddBatchItems={handleAddBatchItems}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onOpenScanner={() => setShowScannerModal(true)}
            onOpenMarketScout={() => setShowMarketScoutModal(true)}
            onOpenLabelReminders={() => setShowLabelRemindersModal(true)}
            pendingLabelRemindersCount={pendingLabelRemindersCount}
            onAddLabelReminder={handleAddLabelReminder}
            shopConfig={shopConfig}
            prefilledBarcodeForNewItem={prefillBarcodeForInventory}
            onClearPrefilledBarcode={() => setPrefillBarcodeForInventory(null)}
            targetEditItemId={targetEditItemId}
            onClearTargetEditItemId={() => setTargetEditItemId(null)}
            onOpenRestock={(item) => {
              if (item) {
                setScannedDashboardData({
                  scannedCode: item.barcode || item.sku,
                  item,
                });
              }
            }}
            onOpenReturn={(item) => {
              if (item) {
                setInitialReturnItem(item);
                setActiveTab('returns');
              }
            }}
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
            initialCartItemsToAdd={initialCartItemsForPos}
            onClearInitialCartItemToAdd={() => {
              setInitialCartItemForPos(null);
              setInitialCartItemsForPos(null);
            }}
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
            onOpenCustomerDuesModal={() => setShowCustomerDuesModal(true)}
          />
        )}

        {activeTab === 'returns' && (
          <ReturnsManager
            returns={returns}
            inventory={inventory}
            invoices={invoices}
            onAddReturn={handleAddReturn}
            onOpenScanner={() => setShowScannerModal(true)}
            initialReturnItem={initialReturnItem}
            onClearInitialReturnItem={() => setInitialReturnItem(null)}
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

        {activeTab === 'calendar' && (
          <GoogleCalendarManager
            inventory={inventory}
            customers={customers}
            dailyQueries={dailyQueries}
          />
        )}
      </main>

      {/* Modals */}
      {/* 1. Barcode Scanner & Reader (Continuous Multi-Scan Camera + Laser Gun listener) */}
      <BarcodeScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        inventory={inventory}
        onBarcodeDetected={handleBarcodeDetected}
        onAddItemsToBill={handleAddBatchToBill}
        onSellInPos={handleSellBatchInPos}
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
          onProcessReturn={(item) => {
            setScannedDashboardData(null);
            setInitialReturnItem(item);
            setActiveTab('returns');
          }}
          onScanAnother={handleScanAnother}
          onOpenLabelStudio={(item) => {
            setScannedDashboardData(null);
            setBarcodeLabelStudioData({
              isOpen: true,
              initialItem: item,
              initialQuantity: item.stockQuantity || 1,
            });
          }}
          onViewInvoice={(inv) => {
            setScannedDashboardData(null);
            setActiveInvoiceForModal(inv);
          }}
        />
      )}

      {/* 5. Cloud Sync Health & Multi-Device Status Modal */}
      <CloudSyncModal
        isOpen={showCloudSyncModal}
        status={cloudStatus}
        onClose={() => setShowCloudSyncModal(false)}
        onForceRefresh={async () => {
          const res = await cloudSync.reconnect();
          if (res.success) {
            toast.success(res.message, 'Cloud Firestore Live');
          } else {
            toast.info('Cloud synchronizer is re-establishing stream in background.', 'Cloud Sync');
          }
        }}
      />

      {/* 6. Daily Routine: Quick Stock Inflow / Restock Modal */}
      <QuickRestockModal
        isOpen={showQuickRestockModal}
        onClose={() => setShowQuickRestockModal(false)}
        inventory={inventory}
        onRestockItem={handleRestockQuantity}
      />

      {/* 7. Daily Routine: Add Product & Create Custom Category Modal */}
      <AddProductCategoryModal
        isOpen={showAddProductCategoryModal}
        onClose={() => setShowAddProductCategoryModal(false)}
        inventory={inventory}
        onAddProduct={handleAddItem}
        onAddBatchProducts={handleAddBatchItems}
        onUpdateProduct={handleUpdateItem}
        onAddLabelReminder={handleAddLabelReminder}
        onOpenRestock={(item) => {
          setScannedDashboardData({
            scannedCode: item.barcode || item.sku,
            item,
          });
        }}
        onOpenReturn={(item) => {
          setInitialReturnItem(item);
          setActiveTab('returns');
        }}
        onOpenScanner={() => setShowScannerModal(true)}
        onLogAction={logAction}
      />

      {/* 8. Daily Routine: Customer Dues & Credit Management Ledger Modal */}
      <CustomerDuesModal
        isOpen={showCustomerDuesModal}
        onClose={() => setShowCustomerDuesModal(false)}
        customers={customers}
        onSettleCustomerDue={handleSettleCustomerDue}
        onAddCustomerCredit={handleAddCustomerCredit}
        onSelectCustomerForSale={handleSelectCustomerForSale}
      />

      {/* 9. Daily Routine: Customer Orders & Inquiries Status Updater Modal */}
      <OrderStatusUpdaterModal
        isOpen={showOrderStatusUpdaterModal}
        onClose={() => setShowOrderStatusUpdaterModal(false)}
        queries={dailyQueries}
        customers={customers}
        onUpdateQuery={handleUpdateDailyQuery}
        onAddNewQuery={handleAddDailyQuery}
        onConvertToSale={handleConvertOrderQueryToSale}
      />

      {/* 10. AI Market Trends & Sourcing Scout Modal */}
      <MarketScoutModal
        isOpen={showMarketScoutModal}
        onClose={() => setShowMarketScoutModal(false)}
        existingInventory={inventory}
        onImportItems={handleImportFromMarketScout}
      />

      {/* 11. Barcode Label Generation, Print Preview & Stickering Reminder Queue Modal */}
      <LabelPrintReminderModal
        isOpen={showLabelRemindersModal}
        onClose={() => setShowLabelRemindersModal(false)}
        reminders={labelReminders}
        inventory={inventory}
        shopConfig={shopConfig}
        onUpdateStatus={handleUpdateLabelStatus}
        onBatchUpdateStatus={handleBatchUpdateLabelStatus}
        onDeleteReminder={handleDeleteLabelReminder}
        onClearStickered={handleClearStickeredLabels}
        onOpenLabelStudio={handleOpenLabelStudioFromReminders}
      />

      {/* 12. Stock Barcode Label Generator, Print Preview & Studio Modal */}
      {barcodeLabelStudioData && (
        <StockBarcodeLabelModal
          isOpen={barcodeLabelStudioData.isOpen}
          onClose={() => setBarcodeLabelStudioData(null)}
          initialItem={barcodeLabelStudioData.initialItem}
          initialBatchItems={barcodeLabelStudioData.initialBatchItems}
          initialQuantity={barcodeLabelStudioData.initialQuantity}
          inventory={inventory}
          shopConfig={shopConfig}
          onMarkStickered={(itemIds) => {
            const matchingReminderIds = labelReminders
              .filter((r) => itemIds.includes(r.itemId) || itemIds.includes(r.sku))
              .map((r) => r.id);
            if (matchingReminderIds.length > 0) {
              handleBatchUpdateLabelStatus(matchingReminderIds, 'STICKERED', 'Counter Staff');
            }
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <RetailApp />
      </ToastProvider>
    </ThemeProvider>
  );
}
