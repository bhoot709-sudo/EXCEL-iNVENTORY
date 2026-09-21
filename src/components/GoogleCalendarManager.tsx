import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  RefreshCw, 
  Trash2, 
  ExternalLink, 
  Clock, 
  MapPin, 
  AlertCircle, 
  CheckCircle2, 
  CalendarDays,
  Sparkles,
  LogOut,
  CalendarCheck,
  PackageCheck,
  PhoneCall,
  X,
  ChevronLeft,
  ChevronRight,
  List,
  Grid,
  AlertTriangle,
  PackageX
} from 'lucide-react';
import { 
  signInWithGoogleCalendar, 
  signOutGoogleCalendar, 
  getCalendarAccessToken, 
  listGoogleCalendarEvents, 
  createGoogleCalendarEvent, 
  deleteGoogleCalendarEvent, 
  GoogleCalendarEvent, 
  CreateEventInput,
  initGoogleAuth
} from '../services/googleCalendarService';
import { InventoryItem, Customer, DailyOrderQuery } from '../types';

interface Props {
  inventory: InventoryItem[];
  customers: Customer[];
  dailyQueries: DailyOrderQuery[];
}

interface RestockDeadlineItem {
  id: string;
  name: string;
  brand?: string;
  stockQuantity: number;
  reorderLevel: number;
  deadlineDateKey: string;
  urgency: 'HIGH' | 'MEDIUM';
}

interface CustomerAppointmentItem {
  id: string;
  customerName: string;
  customerPhone?: string;
  deviceModel: string;
  status: string;
  dateKey: string;
  notes?: string;
}

interface CalendarDay {
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
  isToday: boolean;
}

const formatDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function GoogleCalendarManager({ inventory, customers, dailyQueries }: Props) {
  const [token, setToken] = useState<string | null>(() => getCalendarAccessToken());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // View Controls
  const [viewMode, setViewMode] = useState<'GRID' | 'AGENDA'>('GRID');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'GOOGLE' | 'RESTOCK' | 'APPOINTMENTS'>('ALL');

  // Month navigation state
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => formatDateKey(new Date()));

  // New Event Form Modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('Welcome Mobile Zone, Kathmandu');
  const [startDate, setStartDate] = useState(() => formatDateKey(new Date()));
  const [startTime, setStartTime] = useState('11:00');
  const [endDate, setEndDate] = useState(() => formatDateKey(new Date()));
  const [endTime, setEndTime] = useState('12:00');

  // Confirmation modal for deleting events
  const [eventToDelete, setEventToDelete] = useState<GoogleCalendarEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Initialize auth listener
  useEffect(() => {
    const unsub = initGoogleAuth(
      (user, activeToken) => {
        setToken(activeToken);
        setUserEmail(user.email || null);
        setUserName(user.displayName || null);
      },
      () => {
        // If logged out
      }
    );
    return () => {
      unsub();
    };
  }, []);

  // Fetch events when token is available
  useEffect(() => {
    if (token) {
      loadEvents(token);
    }
  }, [token]);

  const loadEvents = async (authToken: string) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch 60 days of events around current date
      const minDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString();
      const maxDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString();
      const items = await listGoogleCalendarEvents(authToken, minDate, maxDate);
      setEvents(items);
    } catch (err: any) {
      console.error('Failed to load Google Calendar events:', err);
      setError(err.message || 'Failed to retrieve calendar events');
      if (err.message?.includes('sign in again') || err.message?.includes('401')) {
        setToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await signInWithGoogleCalendar();
      setToken(res.accessToken);
      setUserEmail(res.user.email || null);
      setUserName(res.user.displayName || null);
      setSuccessMessage('Successfully connected to Google Calendar!');
      setTimeout(() => setSuccessMessage(null), 4000);
      await loadEvents(res.accessToken);
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Google Calendar sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutGoogleCalendar();
      setToken(null);
      setUserEmail(null);
      setUserName(null);
      setEvents([]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Compute Restock Deadlines based on inventory
  const restockDeadlines = useMemo<RestockDeadlineItem[]>(() => {
    const today = new Date();
    const todayKey = formatDateKey(today);

    // Filter low stock items
    return inventory
      .filter((item) => item.stockQuantity <= item.reorderLevel)
      .map((item, idx) => {
        // Critical out of stock items are assigned today's deadline
        // Low stock items are staggered across today + 1 to today + 3
        const dayOffset = item.stockQuantity === 0 ? 0 : (idx % 3) + 1;
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + dayOffset);

        return {
          id: `restock-${item.id}`,
          name: item.name,
          brand: item.brand,
          stockQuantity: item.stockQuantity,
          reorderLevel: item.reorderLevel,
          deadlineDateKey: formatDateKey(targetDate),
          urgency: item.stockQuantity === 0 ? 'HIGH' : 'MEDIUM',
        };
      });
  }, [inventory]);

  // Compute Customer Appointments & Query Follow-ups
  const customerAppointments = useMemo<CustomerAppointmentItem[]>(() => {
    const todayKey = formatDateKey(new Date());

    return dailyQueries.map((query) => {
      let targetDateKey = todayKey;
      if (query.date && typeof query.date === 'string') {
        const clean = query.date.split('T')[0];
        if (clean.length === 10) {
          targetDateKey = clean;
        }
      }

      return {
        id: `appointment-${query.id}`,
        customerName: query.customerName || 'Inquiry Customer',
        customerPhone: query.customerPhone,
        deviceModel: query.deviceModel || 'Phone/Gadget Model',
        status: query.status,
        dateKey: targetDateKey,
        notes: query.notes,
      };
    });
  }, [dailyQueries]);

  // Map Google Calendar events by dateKey (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, GoogleCalendarEvent[]>();
    events.forEach((evt) => {
      const raw = evt.start.dateTime || evt.start.date;
      if (!raw) return;
      const key = raw.split('T')[0];
      const list = map.get(key) || [];
      list.push(evt);
      map.set(key, list);
    });
    return map;
  }, [events]);

  // Map Restock Deadlines by dateKey
  const restocksByDate = useMemo(() => {
    const map = new Map<string, RestockDeadlineItem[]>();
    restockDeadlines.forEach((item) => {
      const list = map.get(item.deadlineDateKey) || [];
      list.push(item);
      map.set(item.deadlineDateKey, list);
    });
    return map;
  }, [restockDeadlines]);

  // Map Appointments by dateKey
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, CustomerAppointmentItem[]>();
    customerAppointments.forEach((item) => {
      const list = map.get(item.dateKey) || [];
      list.push(item);
      map.set(item.dateKey, list);
    });
    return map;
  }, [customerAppointments]);

  // Generate calendar days for current month view
  const calendarDays = useMemo<CalendarDay[]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const days: CalendarDay[] = [];
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const todayKey = formatDateKey(new Date());

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sun

    // Prev month days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({
        date: d,
        dateKey: formatDateKey(d),
        isCurrentMonth: false,
        isToday: formatDateKey(d) === todayKey,
      });
    }

    // Current month days
    for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
      const d = new Date(year, month, day);
      days.push({
        date: d,
        dateKey: formatDateKey(d),
        isCurrentMonth: true,
        isToday: formatDateKey(d) === todayKey,
      });
    }

    // Next month filler to align grid
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({
        date: d,
        dateKey: formatDateKey(d),
        isCurrentMonth: false,
        isToday: formatDateKey(d) === todayKey,
      });
    }

    return days;
  }, [currentDate]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleTodayMonth = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateKey(formatDateKey(now));
  };

  // Open modal with pre-configured date and template
  const openNewEventModal = (targetDateKey?: string, presetTitle?: string, presetDesc?: string) => {
    const target = targetDateKey || selectedDateKey || formatDateKey(new Date());
    setStartDate(target);
    setEndDate(target);
    setTitle(presetTitle || '');
    setDescription(presetDesc || '');
    setShowCreateModal(true);
  };

  // Handle Quick Template population
  const applyTemplate = (type: 'RESTOCK' | 'QUERY' | 'MAINTENANCE') => {
    const target = selectedDateKey || formatDateKey(new Date());
    setStartDate(target);
    setEndDate(target);

    if (type === 'RESTOCK') {
      const lowStock = inventory.filter((i) => i.stockQuantity <= i.reorderLevel);
      const sampleNames = lowStock.slice(0, 3).map((i) => i.name).join(', ');
      setTitle(`Inventory Delivery & Restock: ${sampleNames || 'Supplier Batch'}`);
      setDescription(`Supplier dispatch check and IMEI barcode stickering.\nExpected items: ${sampleNames || 'Stock replenishment'}`);
      setStartTime('14:00');
      setEndTime('15:00');
    } else if (type === 'QUERY') {
      const pendingQ = dailyQueries.find((q) => q.status === 'PENDING');
      setTitle(`Customer Device Follow-up: ${pendingQ?.customerName || 'Phone Customer'}`);
      setDescription(`Follow up regarding ${pendingQ?.deviceModel || 'device request'}.\nPhone: ${pendingQ?.customerPhone || 'N/A'}\nNotes: ${pendingQ?.notes || 'Customer enquiry'}`);
      setStartTime('16:00');
      setEndTime('16:30');
    } else if (type === 'MAINTENANCE') {
      setTitle('Shop Register Audit & Cash Balance Closing');
      setDescription('Daily cash tally, QR settlements reconciliation, and stock audit.');
      setStartTime('19:30');
      setEndTime('20:00');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Please connect your Google Calendar first.');
      return;
    }
    if (!title.trim()) {
      setError('Event title is required');
      return;
    }

    setLoading(true);
    setError(null);

    const startISO = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endISO = new Date(`${endDate}T${endTime}:00`).toISOString();

    const input: CreateEventInput = {
      summary: title.trim(),
      description: description.trim(),
      location: location.trim(),
      startDateTime: startISO,
      endDateTime: endISO,
    };

    try {
      await createGoogleCalendarEvent(token, input);
      setSuccessMessage('Event scheduled successfully on your Google Calendar!');
      setTimeout(() => setSuccessMessage(null), 4000);
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      await loadEvents(token);
    } catch (err: any) {
      console.error('Create event error:', err);
      setError(err.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!token || !eventToDelete) return;
    setDeleting(true);
    try {
      await deleteGoogleCalendarEvent(token, eventToDelete.id);
      setSuccessMessage('Event removed from your Google Calendar.');
      setTimeout(() => setSuccessMessage(null), 3000);
      setEventToDelete(null);
      await loadEvents(token);
    } catch (err: any) {
      setError(err.message || 'Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  // Selected date schedule summary data
  const selectedDateEvents = eventsByDate.get(selectedDateKey) || [];
  const selectedDateRestocks = restocksByDate.get(selectedDateKey) || [];
  const selectedDateAppointments = appointmentsByDate.get(selectedDateKey) || [];

  const selectedDateObj = new Date(selectedDateKey + 'T00:00:00');
  const selectedDateFormatted = selectedDateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const monthYearTitle = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6" id="google-calendar-manager-root">
      {/* Top Banner Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-900/20 shrink-0">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  Google Calendar & Schedule Hub
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  गुगल क्यालेन्डर
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Visual interactive calendar tracking upcoming Google events, supplier restock deadlines, and customer service appointments.
              </p>
            </div>
          </div>

          {/* Connection State & Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {token ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-900 dark:text-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold truncate max-w-[160px]">{userEmail || userName || 'Connected'}</span>
                </div>

                <button
                  onClick={() => loadEvents(token)}
                  disabled={loading}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Refresh calendar events"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span>Sync</span>
                </button>

                <button
                  onClick={() => openNewEventModal()}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Schedule Event</span>
                </button>

                <button
                  onClick={handleSignOut}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                  title="Disconnect Google Account"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSignIn}
                  disabled={loading}
                  className="flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 rounded-xl shadow-xs transition-all cursor-pointer text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                  <span>{loading ? 'Connecting...' : 'Connect Google Calendar'}</span>
                </button>

                <button
                  onClick={() => openNewEventModal()}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Schedule</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
      </div>

      {/* Calendar Controls & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleTodayMonth}
              className="px-3 py-1 text-xs font-bold hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            {monthYearTitle}
          </h3>
        </div>

        {/* View Switcher & Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <button
              onClick={() => setFilterCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                filterCategory === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setFilterCategory('GOOGLE')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterCategory === 'GOOGLE'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Events ({events.length})</span>
            </button>
            <button
              onClick={() => setFilterCategory('RESTOCK')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterCategory === 'RESTOCK'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-amber-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Restock ({restockDeadlines.length})</span>
            </button>
            <button
              onClick={() => setFilterCategory('APPOINTMENTS')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterCategory === 'APPOINTMENTS'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-sky-600'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>Queries ({customerAppointments.length})</span>
            </button>
          </div>

          {/* Grid vs Agenda toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'GRID'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Month Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('AGENDA')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'AGENDA'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Agenda List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Visual Calendar View or Agenda Mode */}
      {viewMode === 'GRID' ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main Visual Month Calendar Grid (3 Columns) */}
          <div className="xl:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm overflow-hidden">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-400">
              <span className="text-rose-500">Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span className="text-emerald-600">Sat</span>
            </div>

            {/* 7-Column Day Cells Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {calendarDays.map((day) => {
                const isSelected = day.dateKey === selectedDateKey;
                const dayGoogleEvents = eventsByDate.get(day.dateKey) || [];
                const dayRestocks = restocksByDate.get(day.dateKey) || [];
                const dayAppointments = appointmentsByDate.get(day.dateKey) || [];

                const showGoogle = filterCategory === 'ALL' || filterCategory === 'GOOGLE';
                const showRestock = filterCategory === 'ALL' || filterCategory === 'RESTOCK';
                const showAppointments = filterCategory === 'ALL' || filterCategory === 'APPOINTMENTS';

                const totalItemsCount = 
                  (showGoogle ? dayGoogleEvents.length : 0) +
                  (showRestock ? dayRestocks.length : 0) +
                  (showAppointments ? dayAppointments.length : 0);

                return (
                  <div
                    key={day.dateKey}
                    onClick={() => setSelectedDateKey(day.dateKey)}
                    className={`min-h-[85px] sm:min-h-[110px] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/25 ring-2 ring-emerald-500/20 shadow-xs'
                        : day.isToday
                        ? 'border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 font-semibold'
                        : day.isCurrentMonth
                        ? 'border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
                        : 'border-transparent bg-slate-50/30 dark:bg-slate-900/20 opacity-40 hover:opacity-80'
                    }`}
                  >
                    {/* Day Number and Badges header */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs sm:text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                          day.isToday
                            ? 'bg-emerald-600 text-white font-black'
                            : isSelected
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold'
                            : day.isCurrentMonth
                            ? 'text-slate-700 dark:text-slate-200'
                            : 'text-slate-400 dark:text-slate-600'
                        }`}
                      >
                        {day.date.getDate()}
                      </span>

                      {totalItemsCount > 0 && (
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          {totalItemsCount}
                        </span>
                      )}
                    </div>

                    {/* Event indicators / pills */}
                    <div className="space-y-1 my-1 overflow-hidden">
                      {/* Google Calendar Events */}
                      {showGoogle &&
                        dayGoogleEvents.slice(0, 2).map((evt) => (
                          <div
                            key={evt.id}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 truncate border border-emerald-200 dark:border-emerald-800"
                            title={evt.summary}
                          >
                            📅 {evt.summary || 'Event'}
                          </div>
                        ))}

                      {/* Restock Deadlines */}
                      {showRestock &&
                        dayRestocks.slice(0, 2).map((r) => (
                          <div
                            key={r.id}
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md truncate border ${
                              r.urgency === 'HIGH'
                                ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                                : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            }`}
                            title={`Restock ${r.name} (Stock: ${r.stockQuantity})`}
                          >
                            📦 Restock: {r.name}
                          </div>
                        ))}

                      {/* Appointments */}
                      {showAppointments &&
                        dayAppointments.slice(0, 1).map((apt) => (
                          <div
                            key={apt.id}
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 truncate border border-sky-200 dark:border-sky-800"
                            title={`Inquiry: ${apt.customerName} - ${apt.deviceModel}`}
                          >
                            📞 {apt.customerName}
                          </div>
                        ))}

                      {/* Overflow indicator */}
                      {totalItemsCount > 3 && (
                        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 pl-1">
                          +{totalItemsCount - 3} more
                        </div>
                      )}
                    </div>

                    {/* Mini dot strip on bottom */}
                    <div className="flex items-center gap-1 pt-0.5">
                      {dayGoogleEvents.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      {dayRestocks.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                      {dayAppointments.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Day Schedule & Action Drawer (1 Column) */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Day Schedule
                  </div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white">
                    {selectedDateFormatted}
                  </h4>
                </div>

                <button
                  onClick={() => openNewEventModal(selectedDateKey)}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                  title="Schedule event on this date"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>

              {/* Items for the selected day */}
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {selectedDateEvents.length === 0 &&
                selectedDateRestocks.length === 0 &&
                selectedDateAppointments.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 space-y-2">
                    <CalendarIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                    <p className="text-xs">No events, restocks, or appointments scheduled for this day.</p>
                    <button
                      onClick={() => openNewEventModal(selectedDateKey)}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                    >
                      + Schedule an event for {selectedDateKey}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Google Calendar Events */}
                    {selectedDateEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white truncate">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="truncate">{evt.summary || '(No Title)'}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {evt.htmlLink && (
                              <a
                                href={evt.htmlLink}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-slate-400 hover:text-emerald-600 rounded-md"
                                title="Open in Google Calendar"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => setEventToDelete(evt)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                              title="Delete event"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                          <Clock className="w-3 h-3 text-emerald-600" />
                          <span>
                            {evt.start.dateTime
                              ? new Date(evt.start.dateTime).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'All Day'}
                          </span>
                        </div>

                        {evt.description && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                            {evt.description}
                          </p>
                        )}
                      </div>
                    ))}

                    {/* Restock Deadlines */}
                    {selectedDateRestocks.map((restock) => (
                      <div
                        key={restock.id}
                        className="p-3 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">{restock.name}</span>
                          </div>

                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 shrink-0">
                            Stock: {restock.stockQuantity}/{restock.reorderLevel}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-400">
                          Low stock restock deadline for {restock.brand || 'inventory'}.
                        </p>

                        <button
                          onClick={() =>
                            openNewEventModal(
                              selectedDateKey,
                              `Restock Delivery: ${restock.name}`,
                              `Restock deadline: Current stock is ${restock.stockQuantity} (Minimum: ${restock.reorderLevel}). Contact supplier for fast dispatch.`
                            )
                          }
                          className="w-full mt-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <PackageCheck className="w-3.5 h-3.5" />
                          <span>Add Restock to Google Calendar</span>
                        </button>
                      </div>
                    ))}

                    {/* Customer Follow-ups */}
                    {selectedDateAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="p-3 rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/50 dark:bg-sky-950/20 space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                            <PhoneCall className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                            <span className="truncate">{apt.customerName}</span>
                          </div>

                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-200 dark:bg-sky-900 text-sky-900 dark:text-sky-200 shrink-0">
                            {apt.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          Device: <span className="font-semibold text-slate-800 dark:text-slate-200">{apt.deviceModel}</span>
                          {apt.customerPhone && ` • Tel: ${apt.customerPhone}`}
                        </div>

                        <button
                          onClick={() =>
                            openNewEventModal(
                              selectedDateKey,
                              `Customer Follow-up: ${apt.customerName} (${apt.deviceModel})`,
                              `Follow-up on device query.\nPhone: ${apt.customerPhone || 'N/A'}\nNotes: ${apt.notes || 'Customer waiting for update.'}`
                            )
                          }
                          className="w-full mt-1 px-2.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CalendarCheck className="w-3.5 h-3.5" />
                          <span>Add Call to Google Calendar</span>
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Quick Presets for Selected Date */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-2.5">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Quick Actions for {selectedDateKey}</span>
              </h5>

              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => {
                    applyTemplate('RESTOCK');
                    setShowCreateModal(true);
                  }}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <PackageCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Supplier Restock Batch
                    </div>
                    <div className="text-[10px] text-slate-500">Schedule low stock phone delivery</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    applyTemplate('MAINTENANCE');
                    setShowCreateModal(true);
                  }}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <CalendarCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Daily Register Audit & Cash
                    </div>
                    <div className="text-[10px] text-slate-500">Closing balance reconciliation</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Agenda / Chronological Schedule List View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Schedule Shortcuts & Low Stock Suggestions */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Quick Calendar Presets</span>
              </h3>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    applyTemplate('RESTOCK');
                    setShowCreateModal(true);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <PackageCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Schedule Supplier Restock
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Add delivery date for low stock phones/accessories
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    applyTemplate('QUERY');
                    setShowCreateModal(true);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <PhoneCall className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Customer Inquiry Follow-up
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Set reminder to call customer on preorder or repair
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    applyTemplate('MAINTENANCE');
                    setShowCreateModal(true);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <CalendarCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Daily Cash & Register Audit
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Evening register closing & balance reconciliation
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Restock Watchlist Widget */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <PackageX className="w-3.5 h-3.5 text-amber-600" />
                  <span>Restock Deadlines ({restockDeadlines.length})</span>
                </h4>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {restockDeadlines.length === 0 ? (
                  <p className="text-xs text-slate-400">All inventory items are currently above reorder level.</p>
                ) : (
                  restockDeadlines.slice(0, 5).map((r) => (
                    <div
                      key={r.id}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {r.name}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Due: {r.deadlineDateKey} • Stock: {r.stockQuantity}/{r.reorderLevel}
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          openNewEventModal(
                            r.deadlineDateKey,
                            `Supplier Restock: ${r.name}`,
                            `Stock replenishment required for ${r.name}. Current stock: ${r.stockQuantity}.`
                          )
                        }
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shrink-0 cursor-pointer"
                        title="Add to Google Calendar"
                      >
                        Schedule
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Events Agenda List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Upcoming Google Calendar Events</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {events.length}
                  </span>
                </h3>
              </div>

              {loading && events.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                  <p className="text-xs">Fetching your calendar events...</p>
                </div>
              ) : events.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <CalendarDays className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                  <p className="text-xs">No upcoming events found in your primary calendar.</p>
                  <button
                    onClick={() => openNewEventModal()}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                  >
                    + Schedule your first event
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {events.map((evt) => {
                    const startRaw = evt.start.dateTime || evt.start.date;
                    const startDateObj = startRaw ? new Date(startRaw) : null;
                    const formattedDate = startDateObj
                      ? startDateObj.toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Date N/A';
                    const formattedTime = evt.start.dateTime
                      ? startDateObj?.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'All Day';

                    return (
                      <div
                        key={evt.id}
                        className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 bg-slate-50/50 dark:bg-slate-800/40 transition-colors flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {evt.summary || '(No Title)'}
                            </h4>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                              <Clock className="w-3.5 h-3.5" />
                              {formattedDate} • {formattedTime}
                            </span>
                            {evt.location && (
                              <span className="flex items-center gap-1 truncate max-w-xs">
                                <MapPin className="w-3.5 h-3.5" />
                                {evt.location}
                              </span>
                            )}
                          </div>

                          {evt.description && (
                            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 pt-0.5 whitespace-pre-line">
                              {evt.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 pt-0.5">
                          {evt.htmlLink && (
                            <a
                              href={evt.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              title="Open in Google Calendar"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <button
                            onClick={() => setEventToDelete(evt)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete Event"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Add Event to Google Calendar
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samsung Galaxy A55 Restock Delivery"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setEndDate(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Additional details, supplier contact, or customer phone..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {loading ? 'Saving...' : 'Save to Google Calendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Events (Mandatory for destructive operations) */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Delete Calendar Event?
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">"{eventToDelete.summary}"</span> from your Google Calendar? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Delete Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
