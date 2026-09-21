import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  Plus, 
  Check, 
  AlertTriangle, 
  Calculator,
  RefreshCw,
  RotateCcw,
  Receipt,
  TrendingUp,
  Package,
  Link as LinkIcon
} from 'lucide-react';
import { InventoryItem, Invoice, ReturnedProduct, ShopConfig } from '../types';
import { exportToExcelWorkbook } from '../utils/excelEngine';
import { formatNPR } from '../utils/nepalLocale';
import { ReturnsWarrantySpreadsheet } from './ReturnsWarrantySpreadsheet';

interface Props {
  inventory: InventoryItem[];
  invoices: Invoice[];
  returns: ReturnedProduct[];
  shopConfig: ShopConfig;
  onUpdateItem: (updated: InventoryItem) => void;
  onAddItem: () => void;
  onImportClick: () => void;
  onOpenInvoice?: (inv: Invoice) => void;
  onAddReturn?: (newReturn: ReturnedProduct, shouldRestock: boolean, itemId?: string) => void;
  onUpdateReturn?: (updated: ReturnedProduct) => void;
  onDeleteReturn?: (returnId: string) => void;
  initialSheet?: 'inventory' | 'sales' | 'returns' | 'monthly';
}

export function ExcelGridView({
  inventory,
  invoices,
  returns,
  shopConfig,
  onUpdateItem,
  onAddItem,
  onImportClick,
  onOpenInvoice,
  onAddReturn,
  onUpdateReturn,
  onDeleteReturn,
  initialSheet = 'inventory',
}: Props) {
  const [activeSheet, setActiveSheet] = useState<'inventory' | 'sales' | 'returns' | 'monthly'>(initialSheet);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: string; field: string; itemId: string } | null>({
    row: 2,
    col: 'J',
    field: 'profit',
    itemId: inventory[0]?.id || '',
  });
  const [editingCell, setEditingCell] = useState<{ itemId: string; field: string; value: string } | null>(null);

  // Derive active formula bar text
  const getFormulaBarText = () => {
    if (!selectedCell) return 'Click any cell to inspect value & formula';
    const item = inventory.find(i => i.id === selectedCell.itemId);
    if (!item) return '';

    const rowNum = selectedCell.row;
    switch (selectedCell.field) {
      case 'profit':
        return `=G${rowNum}-F${rowNum}  (Result: $${(item.sellingPrice - item.costPrice).toFixed(2)})`;
      case 'margin':
        return `=IF(G${rowNum}>0, (G${rowNum}-F${rowNum})/G${rowNum}*100, 0)  (Result: ${(((item.sellingPrice - item.costPrice) / (item.sellingPrice || 1)) * 100).toFixed(1)}%)`;
      case 'stockValue':
        return `=F${rowNum}*H${rowNum}  (Result: $${(item.costPrice * item.stockQuantity).toFixed(2)})`;
      case 'status':
        return `=IF(H${rowNum}<=0,"OUT OF STOCK",IF(H${rowNum}<=I${rowNum},"LOW STOCK ALERT","HEALTHY"))`;
      case 'sellingPrice':
        return `${item.sellingPrice}`;
      case 'costPrice':
        return `${item.costPrice}`;
      case 'stockQuantity':
        return `${item.stockQuantity}`;
      default:
        return (item as any)[selectedCell.field] || '';
    }
  };

  const handleCellClick = (row: number, col: string, field: string, itemId: string) => {
    setSelectedCell({ row, col, field, itemId });
  };

  const handleCellDoubleClick = (itemId: string, field: string, currentValue: any) => {
    // Only allow editing user-input columns (Cost, Selling, Stock, Reorder, Name, Barcode)
    if (['costPrice', 'sellingPrice', 'stockQuantity', 'reorderLevel', 'name', 'barcode'].includes(field)) {
      setEditingCell({ itemId, field, value: String(currentValue) });
    }
  };

  const handleSaveEdit = () => {
    if (!editingCell) return;
    const item = inventory.find(i => i.id === editingCell.itemId);
    if (!item) return;

    let updatedValue: any = editingCell.value;
    if (['costPrice', 'sellingPrice'].includes(editingCell.field)) {
      updatedValue = parseFloat(editingCell.value) || 0;
    } else if (['stockQuantity', 'reorderLevel'].includes(editingCell.field)) {
      updatedValue = parseInt(editingCell.value, 10) || 0;
    }

    onUpdateItem({
      ...item,
      [editingCell.field]: updatedValue,
    });
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  // Totals for the Excel footer
  const totalCostVal = inventory.reduce((acc, i) => acc + i.costPrice * i.stockQuantity, 0);
  const totalRetailVal = inventory.reduce((acc, i) => acc + i.sellingPrice * i.stockQuantity, 0);
  const totalPotentialProfit = totalRetailVal - totalCostVal;
  const avgMargin = totalRetailVal > 0 ? (totalPotentialProfit / totalRetailVal) * 100 : 0;
  const lowStockCount = inventory.filter(i => i.stockQuantity <= i.reorderLevel).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Excel Ribbon Toolbar */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-xs">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel Workbook Engine</span>
          </div>
          <span className="text-xs text-slate-300 hidden sm:inline">
            Phone & Gadget Inventory Spreadsheet (Live Multi-Sheet Workbook)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToExcelWorkbook(inventory, invoices, returns, shopConfig)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            title="Download genuine .xlsx spreadsheet with formulas"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export to Excel (.xlsx)</span>
          </button>

          {activeSheet === 'inventory' && (
            <>
              <button
                onClick={onImportClick}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                title="Upload existing Excel or CSV file"
              >
                <Upload className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Import .xlsx</span>
              </button>

              <button
                onClick={onAddItem}
                className="flex items-center gap-1 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Top Sheet Switcher Bar */}
      <div className="bg-slate-100 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSheet('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeSheet === 'inventory'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-emerald-600" />
            <span>Sheet 1: Master Inventory ({inventory.length})</span>
          </button>

          <button
            onClick={() => setActiveSheet('sales')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeSheet === 'sales'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5 text-blue-600" />
            <span>Sheet 2: Sales Transactions ({invoices.length})</span>
          </button>

          <button
            onClick={() => setActiveSheet('returns')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeSheet === 'returns'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Sheet 3: Returns & Warranty ({returns.length})</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeSheet === 'returns' ? 'bg-white text-rose-800' : 'bg-rose-200 text-rose-900'
            }`}>
              Active Module
            </span>
          </button>

          <button
            onClick={() => setActiveSheet('monthly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeSheet === 'monthly'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
            <span>Sheet 4: Monthly Analysis</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-medium hidden lg:flex items-center gap-2">
          <span>Active Sheet: <strong className="text-slate-800">{activeSheet.toUpperCase()}</strong></span>
          <span>•</span>
          <span className="text-emerald-700 font-semibold">Live Formulas Active</span>
        </div>
      </div>

      {/* SHEET 1: MASTER INVENTORY */}
      {activeSheet === 'inventory' && (
        <>
          {/* Formula Bar */}
          <div className="bg-white border-b border-slate-200 px-3 py-1.5 flex items-center gap-2 text-xs">
            <div className="w-16 px-2 py-1 bg-slate-100 border border-slate-300 rounded font-mono-num font-bold text-center text-slate-700">
              {selectedCell ? `${selectedCell.col}${selectedCell.row}` : 'A1'}
            </div>
            <div className="flex items-center gap-1 text-slate-400 font-bold px-1 select-none">
              <Calculator className="w-3.5 h-3.5 text-emerald-600" />
              <span>fx</span>
            </div>
            <div className="flex-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono-num text-slate-800 truncate">
              {getFormulaBarText()}
            </div>
            <span className="text-[11px] text-slate-400 hidden lg:inline">
              💡 Double-click any Price or Stock cell to edit directly in spreadsheet
            </span>
          </div>

          {/* Spreadsheet Grid Content */}
          <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
            <table className="w-full text-left border-collapse select-none">
              {/* Column Letters Header (Excel style: A, B, C, D...) */}
              <thead>
                <tr className="bg-slate-100 text-slate-500 text-[11px] font-semibold border-b border-slate-300">
              <th className="w-10 p-1.5 text-center border-r border-slate-300 bg-slate-200/70">#</th>
              <th className="p-2 border-r border-slate-200 min-w-[140px]">A • SKU</th>
              <th className="p-2 border-r border-slate-200 min-w-[130px]">B • Barcode</th>
              <th className="p-2 border-r border-slate-200 min-w-[240px]">C • Product Description</th>
              <th className="p-2 border-r border-slate-200 min-w-[100px]">D • Brand</th>
              <th className="p-2 border-r border-slate-200 min-w-[130px]">E • Category</th>
              <th className="p-2 border-r border-slate-200 text-right min-w-[110px] bg-slate-50">F • Cost ($)</th>
              <th className="p-2 border-r border-slate-200 text-right min-w-[110px] bg-emerald-50/40">G • Selling ($)</th>
              <th className="p-2 border-r border-slate-200 text-center min-w-[90px]">H • Stock</th>
              <th className="p-2 border-r border-slate-200 text-center min-w-[90px]">I • Reorder</th>
              <th className="p-2 border-r border-slate-200 text-right min-w-[120px] bg-blue-50/40">
                J • Profit (=G-F)
              </th>
              <th className="p-2 border-r border-slate-200 text-right min-w-[105px] bg-blue-50/40">
                K • Margin %
              </th>
              <th className="p-2 border-r border-slate-200 text-right min-w-[120px]">L • Value (=F*H)</th>
              <th className="p-2 border-r border-slate-200 min-w-[140px]">M • Stock Status</th>
              <th className="p-2 border-r border-slate-200 min-w-[140px]">N • Supplier</th>
            </tr>
          </thead>

          <tbody className="text-xs divide-y divide-slate-200">
            {inventory.map((item, index) => {
              const rowNum = index + 2;
              const profit = item.sellingPrice - item.costPrice;
              const margin = item.sellingPrice > 0 ? (profit / item.sellingPrice) * 100 : 0;
              const stockVal = item.costPrice * item.stockQuantity;
              const isLowStock = item.stockQuantity <= item.reorderLevel;
              const isOutOfStock = item.stockQuantity <= 0;

              return (
                <tr
                  key={`${item.id}-${item.sku || 'sku'}-${index}`}
                  className={`hover:bg-slate-50 transition-colors ${
                    isOutOfStock
                      ? 'bg-rose-50/50'
                      : isLowStock
                      ? 'bg-amber-50/40'
                      : ''
                  }`}
                >
                  {/* Row Number (1-indexed, starting at 2) */}
                  <td className="p-1.5 text-center font-mono-num text-[11px] text-slate-500 bg-slate-100 border-r border-slate-300 font-semibold">
                    {rowNum}
                  </td>

                  {/* Col A: SKU */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'A', 'sku', item.id)}
                    className={`p-2 font-mono-num text-slate-700 border-r border-slate-200 ${
                      selectedCell?.row === rowNum && selectedCell?.col === 'A' ? 'ring-2 ring-emerald-600 z-10' : ''
                    }`}
                  >
                    {item.sku}
                  </td>

                  {/* Col B: Barcode */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'B', 'barcode', item.id)}
                    className={`p-2 font-mono-num text-slate-600 border-r border-slate-200 ${
                      selectedCell?.row === rowNum && selectedCell?.col === 'B' ? 'ring-2 ring-emerald-600 z-10' : ''
                    }`}
                  >
                    {item.barcode}
                  </td>

                  {/* Col C: Product Name */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'C', 'name', item.id)}
                    onDoubleClick={() => handleCellDoubleClick(item.id, 'name', item.name)}
                    className={`p-2 font-medium text-slate-900 border-r border-slate-200 truncate max-w-[280px] ${
                      selectedCell?.row === rowNum && selectedCell?.col === 'C' ? 'ring-2 ring-emerald-600 z-10' : ''
                    }`}
                  >
                    {editingCell?.itemId === item.id && editingCell.field === 'name' ? (
                      <input
                        type="text"
                        autoFocus
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={handleSaveEdit}
                        onKeyDown={handleKeyDown}
                        className="w-full px-1.5 py-0.5 border border-emerald-500 rounded text-xs bg-white"
                      />
                    ) : (
                      item.name
                    )}
                  </td>

                  {/* Col D: Brand */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'D', 'brand', item.id)}
                    className="p-2 text-slate-600 border-r border-slate-200"
                  >
                    {item.brand}
                  </td>

                  {/* Col E: Category */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'E', 'category', item.id)}
                    className="p-2 text-slate-600 border-r border-slate-200"
                  >
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                      {item.category}
                    </span>
                  </td>

                  {/* Col F: Cost Price ($) (Editable) */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'F', 'costPrice', item.id)}
                    onDoubleClick={() => handleCellDoubleClick(item.id, 'costPrice', item.costPrice)}
                    className={`p-2 text-right font-mono-num text-slate-800 border-r border-slate-200 bg-slate-50/50 cursor-pointer ${
                      selectedCell?.row === rowNum && selectedCell?.col === 'F' ? 'ring-2 ring-emerald-600 z-10' : ''
                    }`}
                  >
                    {editingCell?.itemId === item.id && editingCell.field === 'costPrice' ? (
                      <input
                        type="number"
                        step="0.01"
                        autoFocus
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={handleSaveEdit}
                        onKeyDown={handleKeyDown}
                        className="w-20 px-1.5 py-0.5 border border-emerald-500 rounded text-xs text-right bg-white"
                      />
                    ) : (
                      `$${item.costPrice.toFixed(2)}`
                    )}
                  </td>

                  {/* Col G: Selling Price ($) (Editable) */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'G', 'sellingPrice', item.id)}
                    onDoubleClick={() => handleCellDoubleClick(item.id, 'sellingPrice', item.sellingPrice)}
                    className={`p-2 text-right font-mono-num font-semibold text-emerald-900 border-r border-slate-200 bg-emerald-50/20 cursor-pointer ${
                      selectedCell?.row === rowNum && selectedCell?.col === 'G' ? 'ring-2 ring-emerald-600 z-10' : ''
                    }`}
                  >
                    {editingCell?.itemId === item.id && editingCell.field === 'sellingPrice' ? (
                      <input
                        type="number"
                        step="0.01"
                        autoFocus
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={handleSaveEdit}
                        onKeyDown={handleKeyDown}
                        className="w-20 px-1.5 py-0.5 border border-emerald-500 rounded text-xs text-right bg-white"
                      />
                    ) : (
                      `$${item.sellingPrice.toFixed(2)}`
                    )}
                  </td>

                  {/* Col H: Stock Qty (Editable) */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'H', 'stockQuantity', item.id)}
                    onDoubleClick={() => handleCellDoubleClick(item.id, 'stockQuantity', item.stockQuantity)}
                    className={`p-2 text-center font-mono-num font-bold border-r border-slate-200 cursor-pointer ${
                      isOutOfStock
                        ? 'text-rose-600'
                        : isLowStock
                        ? 'text-amber-600'
                        : 'text-slate-800'
                    } ${selectedCell?.row === rowNum && selectedCell?.col === 'H' ? 'ring-2 ring-emerald-600 z-10' : ''}`}
                  >
                    {editingCell?.itemId === item.id && editingCell.field === 'stockQuantity' ? (
                      <input
                        type="number"
                        autoFocus
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={handleSaveEdit}
                        onKeyDown={handleKeyDown}
                        className="w-16 px-1.5 py-0.5 border border-emerald-500 rounded text-xs text-center bg-white"
                      />
                    ) : (
                      item.stockQuantity
                    )}
                  </td>

                  {/* Col I: Reorder Threshold */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'I', 'reorderLevel', item.id)}
                    onDoubleClick={() => handleCellDoubleClick(item.id, 'reorderLevel', item.reorderLevel)}
                    className={`p-2 text-center font-mono-num text-slate-500 border-r border-slate-200 cursor-pointer ${
                      selectedCell?.row === rowNum && selectedCell?.col === 'I' ? 'ring-2 ring-emerald-600 z-10' : ''
                    }`}
                  >
                    {editingCell?.itemId === item.id && editingCell.field === 'reorderLevel' ? (
                      <input
                        type="number"
                        autoFocus
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={handleSaveEdit}
                        onKeyDown={handleKeyDown}
                        className="w-14 px-1.5 py-0.5 border border-emerald-500 rounded text-xs text-center bg-white"
                      />
                    ) : (
                      item.reorderLevel
                    )}
                  </td>

                  {/* Col J: Profit Formula (=G-F) */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'J', 'profit', item.id)}
                    className={`p-2 text-right font-mono-num font-semibold border-r border-slate-200 bg-blue-50/20 ${
                      profit >= 50 ? 'text-emerald-700' : 'text-slate-700'
                    } ${selectedCell?.row === rowNum && selectedCell?.col === 'J' ? 'ring-2 ring-emerald-600 z-10' : ''}`}
                    title={`Formula: =G${rowNum}-F${rowNum}`}
                  >
                    +${profit.toFixed(2)}
                  </td>

                  {/* Col K: Margin % Formula */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'K', 'margin', item.id)}
                    className={`p-2 text-right font-mono-num font-semibold border-r border-slate-200 bg-blue-50/20 ${
                      margin >= 40
                        ? 'text-emerald-700'
                        : margin >= 20
                        ? 'text-blue-700'
                        : 'text-amber-700'
                    } ${selectedCell?.row === rowNum && selectedCell?.col === 'K' ? 'ring-2 ring-emerald-600 z-10' : ''}`}
                    title={`Formula: =(G${rowNum}-F${rowNum})/G${rowNum}*100`}
                  >
                    {margin.toFixed(1)}%
                  </td>

                  {/* Col L: Stock Value Formula (=F*H) */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'L', 'stockValue', item.id)}
                    className={`p-2 text-right font-mono-num text-slate-700 border-r border-slate-200 ${
                      selectedCell?.row === rowNum && selectedCell?.col === 'L' ? 'ring-2 ring-emerald-600 z-10' : ''
                    }`}
                    title={`Formula: =F${rowNum}*H${rowNum}`}
                  >
                    ${stockVal.toFixed(2)}
                  </td>

                  {/* Col M: Stock Status Formula */}
                  <td
                    onClick={() => handleCellClick(rowNum, 'M', 'status', item.id)}
                    className="p-2 border-r border-slate-200"
                  >
                    {isOutOfStock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                        <AlertTriangle className="w-3 h-3" />
                        OUT OF STOCK
                      </span>
                    ) : isLowStock ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        LOW STOCK ALERT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800">
                        <Check className="w-3 h-3" />
                        HEALTHY
                      </span>
                    )}
                  </td>

                  {/* Col N: Supplier */}
                  <td className="p-2 text-slate-500 border-r border-slate-200 truncate max-w-[150px]">
                    {item.supplier}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Excel Total Row */}
          <tfoot>
            <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300 text-xs">
              <td className="p-2 text-center bg-slate-200">Σ</td>
              <td colSpan={6} className="p-2 text-slate-700">
                TOTALS / SUMMARY (Real Excel Formulas)
              </td>
              <td className="p-2 text-center font-mono-num">
                {inventory.reduce((acc, i) => acc + i.stockQuantity, 0)} units
              </td>
              <td className="p-2 text-center text-slate-400">-</td>
              <td className="p-2 text-right font-mono-num text-emerald-700">
                +${totalPotentialProfit.toFixed(2)}
              </td>
              <td className="p-2 text-right font-mono-num text-blue-700">
                {avgMargin.toFixed(1)}% avg
              </td>
              <td className="p-2 text-right font-mono-num">
                ${totalCostVal.toFixed(2)}
              </td>
              <td colSpan={2} className="p-2">
                {lowStockCount > 0 ? (
                  <span className="text-amber-700 font-semibold text-[11px]">
                    ⚠️ {lowStockCount} items need reorder
                  </span>
                ) : (
                  <span className="text-emerald-700 text-[11px]">All stock levels optimal</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      </>
      )}

      {/* SHEET 2: SALES TRANSACTIONS */}
      {activeSheet === 'sales' && (
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs select-none">
            <thead>
              <tr className="bg-slate-100 text-slate-500 text-[11px] font-semibold border-b border-slate-300">
                <th className="w-10 p-1.5 text-center border-r border-slate-300 bg-slate-200/70">#</th>
                <th className="p-2 border-r border-slate-200 min-w-[150px]">A • Invoice #</th>
                <th className="p-2 border-r border-slate-200 min-w-[120px]">B • Date</th>
                <th className="p-2 border-r border-slate-200 min-w-[160px]">C • Customer</th>
                <th className="p-2 border-r border-slate-200 min-w-[120px]">D • Phone</th>
                <th className="p-2 border-r border-slate-200 min-w-[220px]">E • Items Sold</th>
                <th className="p-2 border-r border-slate-200 text-right min-w-[110px]">F • Subtotal</th>
                <th className="p-2 border-r border-slate-200 text-right min-w-[110px]">G • VAT / Tax</th>
                <th className="p-2 border-r border-slate-200 text-right min-w-[120px] font-bold text-slate-900">H • Grand Total</th>
                <th className="p-2 border-r border-slate-200 text-right min-w-[110px] text-blue-900 font-bold">I • Profit</th>
                <th className="p-2 border-r border-slate-200 min-w-[110px]">J • Payment</th>
                <th className="p-2 min-w-[100px] text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-slate-400">
                    No sales invoices recorded yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv, idx) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2 text-center text-slate-400 bg-slate-50 font-mono text-[11px]">{idx + 2}</td>
                    <td className="p-2 border-r border-slate-200 font-bold text-slate-900 font-mono">{inv.invoiceNumber}</td>
                    <td className="p-2 border-r border-slate-200 text-slate-600">{inv.date}</td>
                    <td className="p-2 border-r border-slate-200 font-medium text-slate-900">{inv.customerName}</td>
                    <td className="p-2 border-r border-slate-200 font-mono text-slate-600">{inv.customerPhone}</td>
                    <td className="p-2 border-r border-slate-200 text-slate-700 truncate max-w-[240px]" title={inv.items.map(i => i.name).join(', ')}>
                      {inv.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono">{formatNPR(inv.subtotal)}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono">{formatNPR(inv.taxAmount)}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-emerald-800">{formatNPR(inv.grandTotal)}</td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-blue-800">{formatNPR(inv.totalProfit)}</td>
                    <td className="p-2 border-r border-slate-200">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                        {inv.paymentMethod}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      {onOpenInvoice && (
                        <button
                          onClick={() => onOpenInvoice(inv)}
                          className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-2xs mx-auto"
                        >
                          <LinkIcon className="w-3 h-3" /> View
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SHEET 3: RETURNS & WARRANTY MODULE */}
      {activeSheet === 'returns' && (
        <ReturnsWarrantySpreadsheet
          returns={returns}
          inventory={inventory}
          invoices={invoices}
          shopConfig={shopConfig}
          onAddReturn={onAddReturn || (() => {})}
          onUpdateReturn={onUpdateReturn}
          onDeleteReturn={onDeleteReturn}
          onOpenInvoice={onOpenInvoice}
        />
      )}

      {/* SHEET 4: MONTHLY ANALYSIS */}
      {activeSheet === 'monthly' && (
        <div className="p-6 bg-slate-50 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block uppercase font-semibold">Total Gross Sales</span>
              <span className="text-xl font-extrabold text-slate-900 mt-1 block">
                {formatNPR(invoices.reduce((a, b) => a + b.grandTotal, 0))}
              </span>
              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">=SUM(Sales!H2:H{invoices.length + 1})</span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block uppercase font-semibold">Total Net Profit</span>
              <span className="text-xl font-extrabold text-emerald-700 mt-1 block">
                {formatNPR(invoices.reduce((a, b) => a + b.totalProfit, 0))}
              </span>
              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">=SUM(Sales!I2:I{invoices.length + 1})</span>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 block uppercase font-semibold">Returns & Warranty Claims</span>
              <span className="text-xl font-extrabold text-rose-700 mt-1 block">
                {returns.length} claims tracked
              </span>
              <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">=COUNTA(Returns!A2:A{returns.length + 1})</span>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Export to Excel (.xlsx) generates all four workbook sheets with native Microsoft Excel formulas.
          </p>
        </div>
      )}

      {/* Excel Sheet Tabs at bottom */}
      <div className="bg-slate-100 border-t border-slate-200 px-3 py-1 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSheet('inventory')}
            className={`px-3 py-1.5 rounded-t font-semibold border-t-2 text-xs transition-colors ${
              activeSheet === 'inventory'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:bg-slate-200 border-transparent'
            }`}
          >
            Sheet 1: Master_Inventory
          </button>
          <button
            onClick={() => setActiveSheet('sales')}
            className={`px-3 py-1.5 rounded-t font-semibold border-t-2 text-xs transition-colors ${
              activeSheet === 'sales'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:bg-slate-200 border-transparent'
            }`}
          >
            Sheet 2: Sales_Transactions ({invoices.length})
          </button>
          <button
            onClick={() => setActiveSheet('returns')}
            className={`px-3 py-1.5 rounded-t font-bold border-t-2 text-xs transition-colors ${
              activeSheet === 'returns'
                ? 'bg-white text-rose-700 border-rose-600 shadow-xs'
                : 'text-rose-700 hover:bg-slate-200 border-transparent'
            }`}
          >
            Sheet 3: Returns_and_Warranty ({returns.length})
          </button>
          <button
            onClick={() => setActiveSheet('monthly')}
            className={`px-3 py-1.5 rounded-t font-semibold border-t-2 text-xs transition-colors ${
              activeSheet === 'monthly'
                ? 'bg-white text-emerald-800 border-emerald-600 shadow-xs'
                : 'text-slate-600 hover:bg-slate-200 border-transparent'
            }`}
          >
            Sheet 4: Monthly_Analysis
          </button>
        </div>

        <div className="flex items-center gap-3 text-slate-500 text-[11px] hidden sm:flex">
          <span>Active: {activeSheet.toUpperCase()}</span>
          <span>•</span>
          <span>Formulas: Active</span>
          <span>•</span>
          <span>Ready for .xlsx export</span>
        </div>
      </div>
    </div>
  );
}
