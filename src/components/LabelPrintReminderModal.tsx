import React, { useState, useMemo } from 'react';
import { 
  Printer, 
  Tag, 
  CheckCircle2, 
  Clock, 
  X, 
  Sparkles, 
  AlertCircle, 
  CheckCheck, 
  PackageCheck, 
  Layers, 
  RotateCcw, 
  Trash2, 
  Plus,
  Barcode,
  Search,
  Filter,
  Eye,
  ShoppingBag
} from 'lucide-react';
import { LabelPrintReminder, LabelReminderStatus, InventoryItem, ShopConfig } from '../types';
import { formatNPR } from '../utils/nepalLocale';
import { Code128Barcode } from './Code128Barcode';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  reminders: LabelPrintReminder[];
  onUpdateStatus: (id: string, status: LabelReminderStatus, staffName?: string) => void;
  onBatchUpdateStatus: (ids: string[], status: LabelReminderStatus, staffName?: string) => void;
  onDeleteReminder: (id: string) => void;
  onClearStickered: () => void;
  onOpenLabelStudio: (itemOrItems: { singleItem?: InventoryItem; batchItems?: InventoryItem[]; presetQty?: number }) => void;
  inventory: InventoryItem[];
  shopConfig?: ShopConfig;
}

export function LabelPrintReminderModal({
  isOpen,
  onClose,
  reminders,
  onUpdateStatus,
  onBatchUpdateStatus,
  onDeleteReminder,
  onClearStickered,
  onOpenLabelStudio,
  inventory,
  shopConfig,
}: Props) {
  const [filterTab, setFilterTab] = useState<'pending' | 'printed' | 'stickered' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const pendingList = useMemo(() => reminders.filter((r) => r.status === 'PENDING'), [reminders]);
  const printedList = useMemo(() => reminders.filter((r) => r.status === 'PRINTED'), [reminders]);
  const stickeredList = useMemo(() => reminders.filter((r) => r.status === 'STICKERED'), [reminders]);

  const totalPendingStickersCount = useMemo(() => {
    return pendingList.reduce((acc, r) => acc + (r.quantityNeeded || 1), 0);
  }, [pendingList]);

  const filteredReminders = useMemo(() => {
    let list = reminders;
    if (filterTab === 'pending') list = pendingList;
    else if (filterTab === 'printed') list = printedList;
    else if (filterTab === 'stickered') list = stickeredList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (r) =>
          r.itemName.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.barcode.includes(q) ||
          r.brand.toLowerCase().includes(q)
      );
    }
    return list;
  }, [reminders, filterTab, pendingList, printedList, stickeredList, searchQuery]);

  if (!isOpen) return null;

  // Handler to print all pending items
  const handlePrintAllPending = () => {
    const itemsToPrint: InventoryItem[] = [];
    pendingList.forEach((reminder) => {
      const found = inventory.find((i) => i.id === reminder.itemId || i.sku === reminder.sku);
      if (found) {
        itemsToPrint.push({
          ...found,
          stockQuantity: reminder.quantityNeeded || found.stockQuantity,
        });
      } else {
        itemsToPrint.push({
          id: reminder.itemId || `item-${Date.now()}`,
          name: reminder.itemName,
          brand: reminder.brand,
          category: reminder.category as any,
          sku: reminder.sku,
          barcode: reminder.barcode,
          sellingPrice: reminder.sellingPrice,
          costPrice: reminder.costPrice || 0,
          stockQuantity: reminder.quantityNeeded,
          reorderLevel: 3,
          imeiRequired: false,
          supplier: 'Standard Supplier',
          lastRestockedDate: new Date().toISOString().split('T')[0],
        });
      }
    });

    if (itemsToPrint.length === 0) return;

    onOpenLabelStudio({
      batchItems: itemsToPrint,
    });
  };

  // Handler to print single reminder item
  const handlePrintSingle = (reminder: LabelPrintReminder) => {
    const found = inventory.find((i) => i.id === reminder.itemId || i.sku === reminder.sku);
    const itemToPrint: InventoryItem = found
      ? { ...found, sellingPrice: reminder.sellingPrice }
      : {
          id: reminder.itemId || `item-${Date.now()}`,
          name: reminder.itemName,
          brand: reminder.brand,
          category: reminder.category as any,
          sku: reminder.sku,
          barcode: reminder.barcode,
          sellingPrice: reminder.sellingPrice,
          costPrice: reminder.costPrice || 0,
          stockQuantity: reminder.quantityNeeded,
          reorderLevel: 3,
          imeiRequired: false,
          supplier: 'Standard Supplier',
          lastRestockedDate: new Date().toISOString().split('T')[0],
        };

    onOpenLabelStudio({
      singleItem: itemToPrint,
      presetQty: reminder.quantityNeeded || 1,
    });
  };

  // Select all visible
  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredReminders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredReminders.map((r) => r.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBatchMarkStickered = () => {
    if (selectedIds.length === 0) return;
    onBatchUpdateStatus(selectedIds, 'STICKERED', 'Counter Staff');
    setSelectedIds([]);
  };

  const getSourceBadge = (source: LabelPrintReminder['source']) => {
    switch (source) {
      case 'NEW_PRODUCT':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">New Product Added</span>;
      case 'RESTOCK':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Restock Batch</span>;
      case 'MARKET_SCOUT':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">Market Scout Import</span>;
      case 'EXCEL_IMPORT':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Excel Import</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">Stock Label</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-2xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                  Label Printing & Stickering Queue
                </h3>
                {pendingList.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-black border border-amber-300 animate-pulse">
                    {totalPendingStickersCount} Stickers Needed ({pendingList.length} Batches)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Track newly added and restocked items that require barcode & selling price labels printed and stickered.
                <span className="text-emerald-700 font-medium ml-1 hidden sm:inline">
                  (नयाँ स्टकमा बारकोड र मूल्य स्टिकर टाँस्ने कार्यतालिका)
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Action Bar & Quick Print CTA */}
        <div className="px-5 sm:px-6 py-3 bg-gradient-to-r from-amber-50/80 via-emerald-50/40 to-white border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Tabs */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilterTab('pending')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  filterTab === 'pending'
                    ? 'bg-amber-500 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Pending</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/30 text-current">
                  {pendingList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('printed')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  filterTab === 'printed'
                    ? 'bg-blue-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Printed</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
                  {printedList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('stickered')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  filterTab === 'stickered'
                    ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Stickered ✅</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700">
                  {stickeredList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterTab === 'all'
                    ? 'bg-slate-900 text-white font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All ({reminders.length})
              </button>
            </div>

            {/* Clear Done Records */}
            {stickeredList.length > 0 && filterTab === 'stickered' && (
              <button
                type="button"
                onClick={onClearStickered}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Clear completed history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {/* Master 1-Click Print All Button */}
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleBatchMarkStickered}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark {selectedIds.length} Stickered ✅</span>
              </button>
            )}

            {pendingList.length > 0 && (
              <button
                type="button"
                onClick={handlePrintAllPending}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all active:scale-95 shrink-0"
                title="Open Studio to print all pending labels with barcodes and selling prices"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Print All {totalPendingStickersCount} Pending Labels</span>
              </button>
            )}
          </div>
        </div>

        {/* Search & Quick Filter Bar */}
        <div className="px-5 sm:px-6 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between gap-3 text-xs">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search reminders by product name, unique SKU, or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {filteredReminders.length > 0 && (
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="text-slate-600 hover:text-slate-900 font-semibold px-2 py-1 hover:bg-slate-100 rounded text-[11px]"
            >
              {selectedIds.length === filteredReminders.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>

        {/* Reminders List Table / Card View */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-slate-50/50">
          {filteredReminders.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-slate-200 p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">
                {filterTab === 'pending'
                  ? 'All Set! No Pending Labels to Print & Sticker'
                  : 'No Records Found'}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Whenever you add a new phone/gadget or restock inventory items, they will automatically appear here with their unique SKU, scannable barcode, selling price, and stickers count reminder.
              </p>
            </div>
          ) : (
            filteredReminders.map((reminder) => {
              const isSelected = selectedIds.includes(reminder.id);
              const isPending = reminder.status === 'PENDING';
              const isPrinted = reminder.status === 'PRINTED';
              const isStickered = reminder.status === 'STICKERED';

              return (
                <div
                  key={reminder.id}
                  className={`bg-white rounded-xl border transition-all p-3.5 sm:p-4 shadow-2xs hover:shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 ${
                    isPending
                      ? 'border-amber-200 bg-gradient-to-r from-amber-50/30 via-white to-white'
                      : isPrinted
                      ? 'border-blue-200 bg-blue-50/20'
                      : 'border-slate-200 opacity-80'
                  }`}
                >
                  {/* Left: Checkbox + Product Meta */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(reminder.id)}
                      className="mt-1 w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                    />

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm hover:text-emerald-700 transition-colors">
                          {reminder.itemName}
                        </span>
                        {getSourceBadge(reminder.source)}
                        {reminder.batchTag && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                            Batch: {reminder.batchTag}
                          </span>
                        )}
                      </div>

                      {/* Barcode, SKU & Price Row */}
                      <div className="flex items-center gap-3 flex-wrap text-xs">
                        <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded font-mono font-bold text-slate-800">
                          <span className="text-[10px] text-slate-400 font-sans uppercase">SKU:</span>
                          <span>{reminder.sku}</span>
                        </div>

                        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-mono font-black text-emerald-800">
                          <span className="text-[10px] text-emerald-600 font-sans uppercase">Selling Price:</span>
                          <span>{formatNPR(reminder.sellingPrice)}</span>
                        </div>

                        <div className="text-slate-500 text-[11px] font-mono">
                          Barcode: {reminder.barcode}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>Added: {reminder.createdTime || reminder.createdAt.split('T')[0]}</span>
                        {reminder.stickeredAt && (
                          <span className="text-emerald-700 font-medium">
                            • Stickered: {reminder.stickeredAt}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Quantity Pill & Visual Barcode Preview */}
                  <div className="flex items-center gap-3 shrink-0 self-center">
                    <div className="text-center px-3 py-1.5 bg-slate-100 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">
                        Labels
                      </span>
                      <span className="text-sm font-black font-mono text-slate-900">
                        {reminder.quantityNeeded || 1} pcs
                      </span>
                    </div>

                    <div className="hidden sm:block bg-white p-1 rounded border border-slate-200 shadow-2xs">
                      <Code128Barcode
                        value={reminder.sku}
                        height={22}
                        width={1.05}
                        displayValue={false}
                        className="h-5 max-w-[100px]"
                      />
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => handlePrintSingle(reminder)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                      title="Open label printer for this item"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Print Label</span>
                    </button>

                    {isPending ? (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(reminder.id, 'STICKERED', 'Counter Staff')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                        title="Mark as printed and physically stickered on gadget box/shelf"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Stickered ✅</span>
                      </button>
                    ) : isPrinted ? (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(reminder.id, 'STICKERED', 'Counter Staff')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                        title="Mark stickered"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Stickered ✅</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(reminder.id, 'PENDING')}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="Reopen reminder"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reopen</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onDeleteReminder(reminder.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete reminder record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Total in Queue:</span>
            <span>{reminders.length} items</span>
            <span>•</span>
            <span className="text-amber-800 font-bold">{pendingList.length} Pending Stickering</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
