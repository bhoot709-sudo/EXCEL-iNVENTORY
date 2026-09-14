import { useState } from 'react';
import { AlertTriangle, ChevronRight, PackagePlus, CheckCircle2, X } from 'lucide-react';
import { InventoryItem } from '../types';

interface Props {
  lowStockItems: InventoryItem[];
  onRestock: (itemId: string, addedQty: number) => void;
  onViewItem: (itemId: string) => void;
}

export function LowStockAlertBanner({ lowStockItems, onRestock, onViewItem }: Props) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [restockedMap, setRestockedMap] = useState<Record<string, boolean>>({});

  if (lowStockItems.length === 0 || isDismissed) {
    return null;
  }

  const handleQuickRestock = (item: InventoryItem) => {
    onRestock(item.id, 10);
    setRestockedMap(prev => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setRestockedMap(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    }, 2500);
  };

  return (
    <div id="low-stock-alert-banner" className="bg-amber-50 border-y border-amber-200 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-800 shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-amber-900">
                Low Stock Alert ({lowStockItems.length} {lowStockItems.length === 1 ? 'item' : 'items'} need reordering)
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-semibold">
                Action Required
              </span>
            </div>
            <p className="text-xs text-amber-700 mt-0.5">
              Items have reached or fallen below your critical reorder threshold. Replenish now to avoid lost sales on flagship devices and high-turnover gadgets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            id="dismiss-alert-btn"
            onClick={() => setIsDismissed(true)}
            className="text-xs text-amber-700 hover:text-amber-900 p-1.5 rounded-md hover:bg-amber-100 transition-colors"
            title="Dismiss temporarily"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal scrolling list of low-stock items */}
      <div className="max-w-7xl mx-auto mt-2 flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
        {lowStockItems.map((item) => {
          const isRestocked = restockedMap[item.id];
          return (
            <div
              key={item.id}
              className="flex items-center gap-2.5 bg-white border border-amber-300 rounded-lg px-3 py-1.5 shrink-0 shadow-xs hover:border-amber-400 transition-all"
            >
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-900 truncate max-w-[180px]">
                  {item.name}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="font-mono-num font-bold text-rose-600">
                    Stock: {item.stockQuantity}
                  </span>
                  <span>•</span>
                  <span>Reorder at: {item.reorderLevel}</span>
                  <span>•</span>
                  <span className="text-slate-400">{item.supplier}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  id={`quick-restock-${item.id}`}
                  onClick={() => handleQuickRestock(item)}
                  disabled={isRestocked}
                  className={`text-xs px-2 py-1 rounded-md font-medium flex items-center gap-1 transition-all ${
                    isRestocked
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                  title="Add 10 units to inventory"
                >
                  {isRestocked ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      +10 Added
                    </>
                  ) : (
                    <>
                      <PackagePlus className="w-3 h-3" />
                      +10
                    </>
                  )}
                </button>
                <button
                  id={`view-item-${item.id}`}
                  onClick={() => onViewItem(item.id)}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                  title="View item details"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
