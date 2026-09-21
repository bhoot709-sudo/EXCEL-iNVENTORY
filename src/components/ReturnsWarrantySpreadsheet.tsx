import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  ShieldCheck, 
  ShieldAlert, 
  RotateCcw, 
  Link as LinkIcon, 
  Receipt, 
  Calendar, 
  User, 
  Phone, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  ExternalLink,
  Edit2,
  Trash2,
  Download,
  Filter,
  RefreshCw,
  Eye
} from 'lucide-react';
import { ReturnedProduct, InventoryItem, Invoice, ShopConfig, ReturnResolution, WarrantyStatus } from '../types';
import { formatNPR } from '../utils/nepalLocale';
import { AddReturnWarrantyModal } from './AddReturnWarrantyModal';
import { EditReturnWarrantyModal } from './EditReturnWarrantyModal';
import { useToast } from './Toast';

interface Props {
  returns: ReturnedProduct[];
  inventory: InventoryItem[];
  invoices: Invoice[];
  shopConfig: ShopConfig;
  onAddReturn: (newReturn: ReturnedProduct, shouldRestock: boolean, itemId?: string) => void;
  onUpdateReturn?: (updated: ReturnedProduct) => void;
  onDeleteReturn?: (returnId: string) => void;
  onOpenInvoice?: (inv: Invoice) => void;
}

export function ReturnsWarrantySpreadsheet({
  returns,
  inventory,
  invoices,
  shopConfig,
  onAddReturn,
  onUpdateReturn,
  onDeleteReturn,
  onOpenInvoice,
}: Props) {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [resolutionFilter, setResolutionFilter] = useState<'ALL' | ReturnResolution>('ALL');
  const [warrantyFilter, setWarrantyFilter] = useState<'ALL' | WarrantyStatus>('ALL');

  // Active cell selection for Excel formula bar
  const [selectedCell, setSelectedCell] = useState<{
    row: number;
    col: string;
    field: string;
    returnId: string;
  }>({
    row: 2,
    col: 'I',
    field: 'warrantyStatus',
    returnId: returns[0]?.id || '',
  });

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ReturnedProduct | null>(null);

  // Filtered returns
  const filteredReturns = returns.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = 
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.itemName.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      r.customerPhone.includes(q) ||
      r.invoiceNumber.toLowerCase().includes(q) ||
      (r.serialOrImei && r.serialOrImei.toLowerCase().includes(q)) ||
      r.returnReason.toLowerCase().includes(q);

    const actualResolution: ReturnResolution = 
      r.resolution || 
      (r.actionTaken === 'REPLACED' ? 'EXCHANGE' : r.actionTaken === 'REPAIRED' ? 'REPAIR' : r.actionTaken === 'STORE_CREDIT' ? 'STORE_CREDIT' : 'REFUND');

    const matchesResolution = resolutionFilter === 'ALL' || actualResolution === resolutionFilter;

    const actualWarranty: WarrantyStatus = r.warrantyStatus || 'UNDER_WARRANTY';
    const matchesWarranty = warrantyFilter === 'ALL' || actualWarranty === warrantyFilter;

    return matchesQuery && matchesResolution && matchesWarranty;
  });

  // Active cell formula computation
  const getFormulaBarText = () => {
    const activeItem = returns.find((r) => r.id === selectedCell.returnId);
    if (!activeItem) return 'Click any spreadsheet cell to inspect live formula & data';

    const rowNum = selectedCell.row;
    switch (selectedCell.field) {
      case 'warrantyStatus': {
        return `=IF(ISBLANK(D${rowNum}), "UNKNOWN", IF(TODAY()-DATEVALUE(D${rowNum})<=365, "UNDER WARRANTY (VALID)", "WARRANTY EXPIRED"))`;
      }
      case 'daysElapsed': {
        return `=IF(ISBLANK(D${rowNum}), "N/A", DATEDIF(D${rowNum}, B${rowNum}, "D") & " days elapsed post-purchase")`;
      }
      case 'invoiceNumber': {
        return `=HYPERLINK("Invoice://" & C${rowNum}, "Original Sale #${activeItem.invoiceNumber}")`;
      }
      case 'resolution': {
        return `=IF(J${rowNum}="REFUND", "Cash/QR Refund: रु " & K${rowNum}, IF(J${rowNum}="EXCHANGE", "Product Replacement", IF(J${rowNum}="REPAIR", "Hardware Service", "Store Credit")))`;
      }
      case 'refundAmount': {
        return `=IF(J${rowNum}="REFUND", ${activeItem.refundAmount}, 0)`;
      }
      case 'restockedToInventory': {
        return `=IF(L${rowNum}="YES", "Restocked to Shelf", "Vendor Defective Batch")`;
      }
      default:
        return (activeItem as any)[selectedCell.field] || '';
    }
  };

  // Helper to find linked invoice
  const getLinkedInvoice = (invoiceNum: string): Invoice | undefined => {
    return invoices.find((i) => i.invoiceNumber.toLowerCase() === invoiceNum.toLowerCase());
  };

  const handleCellClick = (row: number, col: string, field: string, returnId: string) => {
    setSelectedCell({ row, col, field, returnId });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Remove RMA return ticket #${id} (${name})?`)) {
      if (onDeleteReturn) {
        onDeleteReturn(id);
      }
      toast.success(`Removed RMA ticket #${id}`);
    }
  };

  // Calculations for spreadsheet footer
  const totalRmaCount = returns.length;
  const underWarrantyCount = returns.filter((r) => (r.warrantyStatus || 'UNDER_WARRANTY') === 'UNDER_WARRANTY').length;
  const inRepairCount = returns.filter((r) => r.resolution === 'REPAIR' || r.actionTaken === 'REPAIRED').length;
  const totalRefunded = returns.reduce((acc, r) => acc + (r.refundAmount || 0), 0);
  const restockedCount = returns.filter((r) => r.restockedToInventory).length;

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* 1. Spreadsheet Module Control Bar */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-xs">
            <RotateCcw className="w-4 h-4" />
            <span>Returns & Warranty Ledger</span>
          </div>
          <span className="text-xs text-slate-500 hidden md:inline">
            Live spreadsheet grid • Track returns, customer details, warranty status & resolution
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>+ Log Return / Warranty Claim</span>
          </button>
        </div>
      </div>

      {/* 2. Interactive Excel Formula Bar (fx) */}
      <div className="bg-slate-100/80 border-b border-slate-200 px-4 py-2 flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-slate-300 font-mono font-bold text-slate-800 shadow-2xs">
          <span className="text-emerald-700">{selectedCell.col}</span>
          <span>{selectedCell.row}</span>
        </div>
        <div className="flex items-center gap-2 flex-1 overflow-hidden">
          <span className="text-slate-400 font-serif italic text-xs font-bold">fx</span>
          <div className="w-full bg-white px-3 py-1 rounded-md border border-slate-200 text-slate-700 font-mono text-[11px] truncate shadow-2xs">
            {getFormulaBarText()}
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Ribbon */}
      <div className="bg-white border-b border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer, invoice #, IMEI, product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-500 text-[11px] font-semibold flex items-center gap-1">
            <Filter className="w-3 h-3" /> Resolution:
          </span>
          {(['ALL', 'REFUND', 'EXCHANGE', 'REPAIR', 'STORE_CREDIT'] as const).map((res) => (
            <button
              key={res}
              onClick={() => setResolutionFilter(res)}
              className={`px-2.5 py-1 rounded-lg font-medium text-[11px] transition-colors ${
                resolutionFilter === res
                  ? 'bg-slate-900 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {res === 'ALL' ? 'All Resolutions' : res}
            </button>
          ))}

          <span className="text-slate-300 mx-1">|</span>

          <span className="text-slate-500 text-[11px] font-semibold">Warranty:</span>
          {(['ALL', 'UNDER_WARRANTY', 'OUT_OF_WARRANTY'] as const).map((war) => (
            <button
              key={war}
              onClick={() => setWarrantyFilter(war)}
              className={`px-2 py-1 rounded-lg font-medium text-[11px] transition-colors ${
                warrantyFilter === war
                  ? 'bg-emerald-700 text-white font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {war === 'ALL' ? 'All' : war === 'UNDER_WARRANTY' ? '🛡️ In Warranty' : '⏳ Expired'}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Live Spreadsheet Grid Table */}
      <div className="overflow-x-auto min-h-[360px] max-h-[600px] overflow-y-auto">
        <table className="w-full border-collapse text-left text-xs font-sans">
          {/* Excel Column Letters Header */}
          <thead>
            <tr className="bg-slate-100/90 text-slate-500 border-b border-slate-200 text-[11px] font-mono select-none sticky top-0 z-10">
              <th className="w-12 text-center p-2 border-r border-slate-200 font-normal bg-slate-100">#</th>
              <th className="p-2 border-r border-slate-200 min-w-[140px]">A • RMA Ticket ID</th>
              <th className="p-2 border-r border-slate-200 min-w-[110px]">B • Return Date</th>
              <th className="p-2 border-r border-slate-200 min-w-[160px] text-emerald-800 font-semibold">C • Original Sale (Invoice #)</th>
              <th className="p-2 border-r border-slate-200 min-w-[130px]">D • Purchase Date</th>
              <th className="p-2 border-r border-slate-200 min-w-[220px]">E • Product Description</th>
              <th className="p-2 border-r border-slate-200 min-w-[140px]">F • Serial / IMEI</th>
              <th className="p-2 border-r border-slate-200 min-w-[180px]">G • Customer Details</th>
              <th className="p-2 border-r border-slate-200 min-w-[150px]">H • Reason for Return</th>
              <th className="p-2 border-r border-slate-200 min-w-[140px]">I • Warranty Status</th>
              <th className="p-2 border-r border-slate-200 min-w-[120px]">J • Resolution</th>
              <th className="p-2 border-r border-slate-200 min-w-[120px] text-right">K • Amount (रु)</th>
              <th className="p-2 border-r border-slate-200 min-w-[90px] text-center">L • Restocked</th>
              <th className="p-2 border-r border-slate-200 min-w-[110px]">M • RMA Stage</th>
              <th className="p-2 border-r border-slate-200 min-w-[200px]">N • Resolution Notes</th>
              <th className="p-2 min-w-[120px] text-center sticky right-0 bg-slate-100 z-10 border-l border-slate-200">O • Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 font-mono text-xs">
            {filteredReturns.length === 0 ? (
              <tr>
                <td colSpan={16} className="text-center py-16 text-slate-500 font-sans">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RotateCcw className="w-8 h-8 text-slate-300 animate-spin-reverse" />
                    <p className="font-semibold text-slate-700">No Return or Warranty records found</p>
                    <p className="text-xs text-slate-400">
                      Click "+ Log Return / Warranty Claim" above to record a customer return with original sale link.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredReturns.map((ret, index) => {
                const rowNum = index + 2;
                const isRowSelected = selectedCell.returnId === ret.id;
                const linkedInv = getLinkedInvoice(ret.invoiceNumber);

                // Resolution evaluation
                const resolutionType: ReturnResolution = 
                  ret.resolution || 
                  (ret.actionTaken === 'REPLACED' ? 'EXCHANGE' : ret.actionTaken === 'REPAIRED' ? 'REPAIR' : ret.actionTaken === 'STORE_CREDIT' ? 'STORE_CREDIT' : 'REFUND');

                // Warranty evaluation
                const warrantyStatus: WarrantyStatus = ret.warrantyStatus || 'UNDER_WARRANTY';

                // Days calculation if purchase date is present
                let daysText = '';
                if (ret.purchaseDate) {
                  const pDate = new Date(ret.purchaseDate);
                  const rDate = new Date(ret.returnDate);
                  if (!isNaN(pDate.getTime()) && !isNaN(rDate.getTime())) {
                    const diffDays = Math.ceil(Math.abs(rDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));
                    daysText = `${diffDays}d elapsed`;
                  }
                }

                return (
                  <tr
                    key={ret.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isRowSelected ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    {/* Row Index */}
                    <td className="text-center p-2 font-mono text-slate-400 bg-slate-50/60 border-r border-slate-200 select-none">
                      {rowNum}
                    </td>

                    {/* Col A: RMA ID */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'A', 'id', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer truncate font-semibold ${
                        selectedCell.row === rowNum && selectedCell.col === 'A'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : 'text-slate-900'
                      }`}
                    >
                      {ret.id}
                    </td>

                    {/* Col B: Return Date */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'B', 'returnDate', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer text-slate-600 ${
                        selectedCell.row === rowNum && selectedCell.col === 'B'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                    >
                      {ret.returnDate.split(' ')[0]}
                    </td>

                    {/* Col C: Original Sale (Linked Invoice) */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'C', 'invoiceNumber', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer ${
                        selectedCell.row === rowNum && selectedCell.col === 'C'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-slate-800">{ret.invoiceNumber}</span>
                        {linkedInv && onOpenInvoice ? (
                          <button
                            type="button"
                            title="Inspect Original Sale Invoice Details"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenInvoice(linkedInv);
                            }}
                            className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded text-[10px] font-bold flex items-center gap-1 transition-colors shrink-0 shadow-2xs font-sans"
                          >
                            <LinkIcon className="w-2.5 h-2.5" />
                            <span>View Sale</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-sans">Counter Sale</span>
                        )}
                      </div>
                    </td>

                    {/* Col D: Purchase Date */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'D', 'purchaseDate', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer text-slate-700 ${
                        selectedCell.row === rowNum && selectedCell.col === 'D'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{ret.purchaseDate || 'N/A'}</span>
                        {daysText && (
                          <span className="text-[10px] text-slate-500 font-sans">
                            ⏱️ {daysText}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Col E: Product Description */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'E', 'itemName', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer font-sans ${
                        selectedCell.row === rowNum && selectedCell.col === 'E'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                    >
                      <div className="font-semibold text-slate-900 truncate max-w-[200px]" title={ret.itemName}>
                        {ret.itemName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Brand: {ret.itemBrand} • {ret.itemBarcode}
                      </div>
                    </td>

                    {/* Col F: Serial / IMEI */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'F', 'serialOrImei', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer font-mono text-slate-700 ${
                        selectedCell.row === rowNum && selectedCell.col === 'F'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                    >
                      {ret.serialOrImei || <span className="text-slate-400">N/A</span>}
                    </td>

                    {/* Col G: Customer Details */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'G', 'customerName', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer font-sans ${
                        selectedCell.row === rowNum && selectedCell.col === 'G'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                    >
                      <div className="font-medium text-slate-900">{ret.customerName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">📞 {ret.customerPhone}</div>
                    </td>

                    {/* Col H: Reason for Return */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'H', 'returnReason', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer font-sans ${
                        selectedCell.row === rowNum && selectedCell.col === 'H'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                    >
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800">
                        {ret.returnReason.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Col I: Warranty Status */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'I', 'warrantyStatus', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer font-sans ${
                        selectedCell.row === rowNum && selectedCell.col === 'I'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                    >
                      {warrantyStatus === 'UNDER_WARRANTY' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <ShieldCheck className="w-3 h-3" /> Under Warranty
                        </span>
                      )}
                      {warrantyStatus === 'OUT_OF_WARRANTY' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-200 text-slate-700">
                          <Clock className="w-3 h-3" /> Expired
                        </span>
                      )}
                      {warrantyStatus === 'EXTENDED_WARRANTY' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                          <ShieldCheck className="w-3 h-3" /> Extended
                        </span>
                      )}
                      {warrantyStatus === 'VOID_DAMAGE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                          <ShieldAlert className="w-3 h-3" /> Void (Damage)
                        </span>
                      )}
                      {warrantyStatus === 'VENDOR_RMA' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
                          🏢 Vendor RMA
                        </span>
                      )}
                    </td>

                    {/* Col J: Resolution (Refund, Exchange, Repair, Store Credit) */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'J', 'resolution', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer font-sans ${
                        selectedCell.row === rowNum && selectedCell.col === 'J'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                    >
                      {resolutionType === 'REFUND' && (
                        <span className="inline-block px-2 py-0.5 rounded font-bold text-[11px] bg-emerald-100 text-emerald-900 border border-emerald-300">
                          💵 Refund
                        </span>
                      )}
                      {resolutionType === 'EXCHANGE' && (
                        <span className="inline-block px-2 py-0.5 rounded font-bold text-[11px] bg-blue-100 text-blue-900 border border-blue-300">
                          🔄 Exchange
                        </span>
                      )}
                      {resolutionType === 'REPAIR' && (
                        <span className="inline-block px-2 py-0.5 rounded font-bold text-[11px] bg-amber-100 text-amber-900 border border-amber-300">
                          🔧 Repair
                        </span>
                      )}
                      {resolutionType === 'STORE_CREDIT' && (
                        <span className="inline-block px-2 py-0.5 rounded font-bold text-[11px] bg-purple-100 text-purple-900 border border-purple-300">
                          💳 Credit
                        </span>
                      )}
                      {resolutionType === 'REJECTED' && (
                        <span className="inline-block px-2 py-0.5 rounded font-bold text-[11px] bg-rose-100 text-rose-900 border border-rose-300">
                          ❌ Rejected
                        </span>
                      )}
                    </td>

                    {/* Col K: Amount (रु) */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'K', 'refundAmount', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer text-right font-bold text-slate-900 ${
                        selectedCell.row === rowNum && selectedCell.col === 'K'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                    >
                      {ret.refundAmount > 0 ? formatNPR(ret.refundAmount) : ret.repairCost ? formatNPR(ret.repairCost) : 'रु 0'}
                    </td>

                    {/* Col L: Restocked to Shelf */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'L', 'restockedToInventory', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer text-center font-bold ${
                        ret.restockedToInventory ? 'text-emerald-700 bg-emerald-50/50' : 'text-slate-400'
                      } ${
                        selectedCell.row === rowNum && selectedCell.col === 'L'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                    >
                      {ret.restockedToInventory ? 'YES' : 'NO'}
                    </td>

                    {/* Col M: RMA Stage */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'M', 'status', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer font-sans text-[11px] font-semibold text-slate-700 ${
                        selectedCell.row === rowNum && selectedCell.col === 'M'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                    >
                      {ret.status || 'RESOLVED'}
                    </td>

                    {/* Col N: Resolution Notes */}
                    <td
                      onClick={() => handleCellClick(rowNum, 'N', 'notes', ret.id)}
                      className={`p-2 border-r border-slate-200 cursor-pointer text-slate-600 font-sans truncate max-w-[220px] ${
                        selectedCell.row === rowNum && selectedCell.col === 'N'
                          ? 'outline-2 outline-emerald-600 bg-emerald-50/60'
                          : ''
                      }`}
                      title={ret.notes}
                    >
                      {ret.notes || <span className="text-slate-300 italic">No notes recorded</span>}
                    </td>

                    {/* Col O: Row Actions */}
                    <td className="p-2 text-center sticky right-0 bg-white shadow-2xs border-l border-slate-200">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          title="Edit Resolution / Status"
                          onClick={() => setEditingRecord(ret)}
                          className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteReturn && (
                          <button
                            type="button"
                            title="Delete RMA Record"
                            onClick={() => handleDelete(ret.id, ret.itemName)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Excel Totals Footer Row */}
          <tfoot>
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800 select-none">
              <td className="p-2 text-center text-slate-400 font-mono text-[11px]">Σ</td>
              <td colSpan={8} className="p-2 font-mono">
                TOTALS: {totalRmaCount} RMA Claims • {underWarrantyCount} Under Warranty • {inRepairCount} In Repair / Exchange
              </td>
              <td className="p-2 text-slate-600 text-[11px]">
                {underWarrantyCount} Valid Claims
              </td>
              <td className="p-2 text-slate-600 text-[11px]">
                {totalRmaCount} Processed
              </td>
              <td className="p-2 text-right font-mono text-emerald-800">
                {formatNPR(totalRefunded)}
              </td>
              <td className="p-2 text-center text-emerald-700 font-mono text-[11px]">
                {restockedCount} Restocked
              </td>
              <td colSpan={3} className="p-2 text-slate-500 font-sans text-[11px]">
                Spreadsheet synced with store database
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Modals */}
      <AddReturnWarrantyModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        inventory={inventory}
        invoices={invoices}
        onAddReturn={onAddReturn}
      />

      {editingRecord && onUpdateReturn && (
        <EditReturnWarrantyModal
          isOpen={Boolean(editingRecord)}
          onClose={() => setEditingRecord(null)}
          returnRecord={editingRecord}
          invoices={invoices}
          onUpdateReturn={onUpdateReturn}
          onOpenInvoice={onOpenInvoice}
        />
      )}
    </div>
  );
}
