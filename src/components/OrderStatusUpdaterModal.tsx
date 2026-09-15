import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Phone, 
  MessageSquare, 
  Filter, 
  Plus, 
  X, 
  Smartphone, 
  Edit3, 
  Sparkles, 
  User, 
  Calendar,
  Check,
  Ban,
  ShoppingBag
} from 'lucide-react';
import { DailyOrderQuery, QueryStatus, Customer } from '../types';
import { formatNPR } from '../utils/nepalLocale';
import { useToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  queries: DailyOrderQuery[];
  customers: Customer[];
  onUpdateQuery: (query: DailyOrderQuery) => void;
  onAddNewQuery: (query: DailyOrderQuery) => void;
  onConvertToSale?: (query: DailyOrderQuery) => void;
}

export function OrderStatusUpdaterModal({
  isOpen,
  onClose,
  queries,
  customers,
  onUpdateQuery,
  onAddNewQuery,
  onConvertToSale,
}: Props) {
  const toast = useToast();
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Note editing state
  const [editingQueryId, setEditingQueryId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState<string>('');

  // Quick New Query state
  const [showNewQueryForm, setShowNewQueryForm] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [queryType, setQueryType] = useState<DailyOrderQuery['queryType']>('PREORDER');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');

  // Metrics
  const pendingCount = useMemo(() => queries.filter((q) => q.status === 'PENDING').length, [queries]);
  const followedUpCount = useMemo(() => queries.filter((q) => q.status === 'FOLLOWED_UP').length, [queries]);
  const fulfilledCount = useMemo(() => queries.filter((q) => q.status === 'FULFILLED').length, [queries]);

  const filteredQueries = useMemo(() => {
    let list = queries;
    if (selectedStatusFilter !== 'ALL') {
      list = list.filter((q) => q.status === selectedStatusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.customerName.toLowerCase().includes(q) ||
          item.customerPhone.includes(q) ||
          item.deviceModel.toLowerCase().includes(q) ||
          item.notes.toLowerCase().includes(q)
      );
    }
    return list;
  }, [queries, selectedStatusFilter, searchQuery]);

  // Handle Quick Status Change
  const handleStatusChange = (item: DailyOrderQuery, nextStatus: QueryStatus) => {
    const updated: DailyOrderQuery = {
      ...item,
      status: nextStatus,
      followedUpAt: nextStatus !== 'PENDING' ? new Date().toISOString().replace('T', ' ').slice(0, 16) : item.followedUpAt,
    };
    onUpdateQuery(updated);
    toast.success(`Updated status of ${item.customerName}'s order to ${nextStatus}`, 'Order Status Updated');
  };

  // Save Resolution Note
  const handleSaveResolution = (item: DailyOrderQuery) => {
    const updated: DailyOrderQuery = {
      ...item,
      resolutionNotes: resolutionText.trim(),
    };
    onUpdateQuery(updated);
    toast.info('Saved follow-up resolution notes.');
    setEditingQueryId(null);
    setResolutionText('');
  };

  // Submit New Query
  const handleCreateNewQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custPhone.trim() || !deviceModel.trim()) {
      toast.warning('Please enter customer name, phone, and device details.');
      return;
    }

    const newQ: DailyOrderQuery = {
      id: `qry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customerName: custName.trim(),
      customerPhone: custPhone.trim(),
      deviceModel: deviceModel.trim(),
      queryType,
      estimatedBudget: budget ? parseFloat(budget) : undefined,
      notes: notes.trim(),
      priority: 'HIGH',
      status: 'PENDING',
      assignedStaff: 'Counter Staff',
    };

    onAddNewQuery(newQ);
    toast.success(`Registered new order query for ${custName}`, 'Order Registered');
    setShowNewQueryForm(false);
    setCustName('');
    setCustPhone('');
    setDeviceModel('');
    setBudget('');
    setNotes('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Order & Pre-Order Status Updater</h3>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-200">
                  Daily Routine Task
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Update customer order queries, follow-up on pre-orders, and convert fulfilled orders to counter sales.
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

        {/* Status Counter Bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('ALL')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                selectedStatusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              All Orders ({queries.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('PENDING')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedStatusFilter === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-amber-700 hover:bg-amber-50'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Pending ({pendingCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('FOLLOWED_UP')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                selectedStatusFilter === 'FOLLOWED_UP'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-blue-700 hover:bg-blue-50'
              }`}
            >
              Followed Up ({followedUpCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedStatusFilter('FULFILLED')}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                selectedStatusFilter === 'FULFILLED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              Fulfilled ({fulfilledCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowNewQueryForm(!showNewQueryForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Order Note</span>
            </button>
          </div>
        </div>

        {/* Quick New Query Form */}
        {showNewQueryForm && (
          <form onSubmit={handleCreateNewQuery} className="p-4 bg-indigo-50/50 border-b border-indigo-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950">Record New Customer Order / Request</span>
              <button
                type="button"
                onClick={() => setShowNewQueryForm(false)}
                className="text-xs text-indigo-700 hover:underline"
              >
                Close form
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                required
                placeholder="Customer Name *"
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                required
                placeholder="Phone Number *"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                required
                placeholder="Device / Product Requested *"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                value={queryType}
                onChange={(e) => setQueryType(e.target.value as any)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="PREORDER">Pre-Order</option>
                <option value="STOCK_RESERVATION">Stock Reservation</option>
                <option value="REPAIR_SERVICE">Repair Service</option>
                <option value="PRICE_ENQUIRY">Price Enquiry</option>
                <option value="SPECIAL_REQUEST">Special Request</option>
              </select>
              <input
                type="number"
                placeholder="Budget (रु)"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                placeholder="Special notes / customer specs"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors"
              >
                Save Order Query
              </button>
            </div>
          </form>
        )}

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by customer name, phone, device model, or notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Orders List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredQueries.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
              <p className="text-sm font-bold text-slate-700">No Orders in this category</p>
              <p className="text-xs text-slate-400 mt-1">
                All customer inquiries and pre-orders have been responded to and updated.
              </p>
            </div>
          ) : (
            filteredQueries.map((item) => {
              const isEditing = editingQueryId === item.id;

              return (
                <div
                  key={item.id}
                  className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3 hover:border-slate-300 transition-all"
                >
                  {/* Top Details */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{item.customerName}</span>
                      <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {item.customerPhone}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {item.queryType.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {item.date} {item.time}
                      </span>
                    </div>
                  </div>

                  {/* Device & Budget */}
                  <div className="p-3 bg-slate-50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-indigo-600" />
                        <span className="font-bold text-xs text-slate-900">{item.deviceModel}</span>
                      </div>
                      {item.notes && (
                        <p className="text-xs text-slate-600 mt-1 italic pl-6">
                          &ldquo;{item.notes}&rdquo;
                        </p>
                      )}
                      {item.resolutionNotes && (
                        <p className="text-xs text-emerald-700 font-medium mt-1 pl-6">
                          ✓ Note: {item.resolutionNotes}
                        </p>
                      )}
                    </div>

                    {item.estimatedBudget && (
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">Budget</span>
                        <span className="font-mono font-bold text-xs text-slate-800">
                          {formatNPR(item.estimatedBudget)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status Updaters & Actions Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    {/* 1-Click Status Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500 mr-1">Status:</span>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(item, 'PENDING')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          item.status === 'PENDING'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Pending
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(item, 'FOLLOWED_UP')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          item.status === 'FOLLOWED_UP'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Followed Up
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(item, 'FULFILLED')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          item.status === 'FULFILLED'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Fulfilled
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(item, 'CANCELLED')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          item.status === 'CANCELLED'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Cancelled
                      </button>
                    </div>

                    {/* Follow-up Note & Convert to Sale */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQueryId(isEditing ? null : item.id);
                          setResolutionText(item.resolutionNotes || '');
                        }}
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{item.resolutionNotes ? 'Edit Note' : 'Add Note'}</span>
                      </button>

                      {onConvertToSale && (
                        <button
                          type="button"
                          onClick={() => {
                            onConvertToSale(item);
                            onClose();
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Convert to Sale</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Follow-up Note Editor */}
                  {isEditing && (
                    <div className="pt-2 border-t border-slate-100 flex gap-2">
                      <input
                        type="text"
                        placeholder="Type follow-up note (e.g. Called customer, advised ETA Tuesday)..."
                        value={resolutionText}
                        onChange={(e) => setResolutionText(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveResolution(item)}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
                      >
                        Save Note
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Pending customer actions: <strong className="text-amber-700">{pendingCount}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
