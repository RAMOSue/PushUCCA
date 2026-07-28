import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../../context/userContext';
import { BorrowingContext } from '../../../context/borrowingContext';
import PageLayout from '../../components/layout/PageLayout';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  Clock,
  ShoppingCart,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Package,
  LayoutGrid,
  List as ListIcon,
} from 'lucide-react';

dayjs.extend(utc);
dayjs.extend(timezone);

export default function BorrowerPerformances() {
  const { user } = useContext(UserContext);
  const { addToCart, setCart, requestId, setRequestId } = useContext(BorrowingContext);
  const navigate = useNavigate();
  const [performances, setPerformances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPerformance, setExpandedPerformance] = useState(null);
  const [groupedPerformances, setGroupedPerformances] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addedItemIds, setAddedItemIds] = useState(new Set());
  
  // ✅ NEW: State for item selection modal
  const [selectedItemForCart, setSelectedItemForCart] = useState(null);
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const [activeSizeFilter, setActiveSizeFilter] = useState(null);
  
  // ✅ NEW: Calendar view state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  
  // ✅ NEW: Performance detail modal state
  const [selectedPerformanceForDetail, setSelectedPerformanceForDetail] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchBorrowerPerformances();
    }
  }, [user]);

  // Group performances by date whenever performances change
  useEffect(() => {
    let filtered = performances;
    
    // Filter by calendar month - only show performances in currently displayed month
    filtered = filtered.filter((p) => {
      const perfDate = new Date(p.start_time);
      return (
        perfDate.getMonth() === calendarDate.getMonth() &&
        perfDate.getFullYear() === calendarDate.getFullYear()
      );
    });
    
    // Filter by search query
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((p) =>
        (p.title || '').toLowerCase().includes(searchLower) ||
        (p.location || '').toLowerCase().includes(searchLower)
      );
    }
    
    // Group by date
    const groups = {};
    for (const p of filtered) {
      const day = new Date(p.start_time).toDateString();
      if (!groups[day]) groups[day] = [];
      groups[day].push(p);
    }
    
    // ✅ UPDATED: Sort performances within each date group - assigned first
    Object.keys(groups).forEach(day => {
      groups[day].sort((a, b) => {
        if (a.isAssigned !== b.isAssigned) {
          return a.isAssigned ? -1 : 1; // Assigned first
        }
        return new Date(a.start_time) - new Date(b.start_time);
      });
    });
    
    // ✅ UPDATED: Sort date groups - those with assigned performances first, then by date
    const arr = Object.entries(groups)
      .map(([day, perfs]) => ({ 
        day, 
        performances: perfs,
        hasAssigned: perfs.some(p => p.isAssigned) // Track if group has assigned
      }))
      .sort((a, b) => {
        // Groups with assigned performances first
        if (a.hasAssigned !== b.hasAssigned) {
          return a.hasAssigned ? -1 : 1;
        }
        // Then sort by date descending
        return new Date(b.day) - new Date(a.day);
      });
    
    setGroupedPerformances(arr);
  }, [performances, searchQuery, calendarDate]);

  async function fetchBorrowerPerformances() {
    try {
      setLoading(true);
      // ✅ NEW: Fetch ALL performances with isAssigned flag
      const res = await axios.get(`/api/performances/borrower/${user.id}/all`);
      const data = Array.isArray(res.data) ? res.data : [];
      
      // Sort: assigned first (by start_time asc), then unassigned
      data.sort((a, b) => {
        if (a.isAssigned !== b.isAssigned) {
          return a.isAssigned ? -1 : 1; // Assigned first
        }
        return new Date(a.start_time) - new Date(b.start_time);
      });
      
      setPerformances(data);
    } catch (err) {
      console.error('Failed to load performances:', err.message);
      toast.error('Failed to load performances');
    } finally {
      setLoading(false);
    }
  }

  const addItemsToCart = async (perf) => {
    if (!perf.items || perf.items.length === 0) {
      toast.error('No items suggested for this performance');
      return;
    }

    try {
      // Prepare items for cart endpoint
      const itemsToAdd = perf.items.map(item => ({
        item_id: item.inventory_item_id,
        quantity: item.quantity || 1
      }));

      // Call backend API to add all items
      const res = await axios.post('/api/borrow/cart', {
        borrower_id: String(user.id),
        request_id: requestId || null,
        items: itemsToAdd
      });

      if (res.data.success) {
        // Track added items
        const newAddedIds = new Set(addedItemIds);
        perf.items.forEach(item => newAddedIds.add(`${perf.id}-${item.inventory_item_id}`));
        setAddedItemIds(newAddedIds);

        // Update requestId if new
        if (res.data.request_id && !requestId) {
          setRequestId(res.data.request_id);
        }

        // Update cart
        if (Array.isArray(res.data.items)) {
          const mappedItems = res.data.items.map(item => ({
            unitId: item.unit_id,
            itemId: item.item_id,
            name: item.name,
            size: item.size || 'nosize',
            image_url: item.image_url,
            category: item.garment_type || item.category || 'costume',
            quantity: 1,
            status: item.status || 'reserved',
            unit_number: item.unit_number
          }));
          setCart(mappedItems);
        }

        toast.success(`Added ${itemsToAdd.length} item(s) to cart`);
        navigate('/borrow-cart');
      } else {
        toast.error(res.data.error || 'Failed to add items to cart');
      }
    } catch (err) {
      console.error('Add to cart failed:', err);
      toast.error(err.response?.data?.error || 'Failed to add items to cart');
    }
  };

  // ✅ NEW: Open item detail modal for unit selection
  const openItemModal = async (item) => {
    try {
      // Fetch full item details with units from inventory
      const res = await axios.get(`/api/inventory/`);
      const allItems = Array.isArray(res.data) ? res.data : [];
      const fullItem = allItems.find(i => i.id === item.inventory_item_id);
      
      if (fullItem) {
        setSelectedItemForCart(fullItem);
      } else {
        // Fallback if full item not found
        setSelectedItemForCart({
          ...item,
          units: []
        });
      }
      setSelectedUnits([]);
      setUnitSearchQuery('');
      setActiveSizeFilter(null);
    } catch (err) {
      console.error('Failed to fetch item details:', err);
      toast.error('Failed to load item details');
    }
  };

  // ✅ NEW: Close item detail modal
  const closeItemModal = () => {
    setSelectedItemForCart(null);
    setSelectedUnits([]);
    setUnitSearchQuery('');
    setActiveSizeFilter(null);
  };

  // ✅ NEW: Add selected units to cart (borrowed from AvailableItems.jsx)
  const handleAddSelectedToCart = async (item) => {
    if (selectedUnits.length === 0) {
      toast.error('Please select at least one unit');
      return;
    }

    try {
      let successCount = 0;
      let failureCount = 0;
      const addedUnitNumbers = [];
      const failedUnits = [];

      // ✅ Add units sequentially with server-side deduplication
      for (const unit of selectedUnits) {
        try {
          const res = await axios.post('/api/borrow/cart', {
            borrower_id: String(user.id),
            request_id: requestId || null,
            items: [{
              item_id: item.inventory_item_id,
              unit_id: unit.id,
              quantity: 1
            }]
          });

          if (res.data.success) {
            successCount++;
            addedUnitNumbers.push(unit.unit_number || `Unit ${unit.id.substring(0, 6)}`);
            
            if (res.data.request_id && !requestId) {
              setRequestId(res.data.request_id);
            }

            if (Array.isArray(res.data.items)) {
              const mappedItems = res.data.items.map(i => ({
                unitId: i.unit_id,
                itemId: i.item_id,
                name: i.name,
                size: i.size || 'nosize',
                image_url: i.image_url,
                category: i.garment_type || i.category || 'costume',
                quantity: 1,
                status: i.status || 'reserved',
                unit_number: i.unit_number
              }));
              setCart(prev => [...(Array.isArray(prev) ? prev : []), ...mappedItems]);
            }
          } else {
            failureCount++;
            failedUnits.push(unit.unit_number || unit.id.substring(0, 6));
          }
        } catch (err) {
          failureCount++;
          failedUnits.push(unit.unit_number || unit.id.substring(0, 6));
        }
      }

      // Show consolidated notification
      if (successCount > 0) {
        const displayName = selectedUnits.length > 1 
          ? `${item.name} (${successCount} unit${successCount !== 1 ? 's' : ''})`
          : item.name;
        toast.success(`Added ${displayName} to cart`);
        closeItemModal();
        
        // Redirect after a delay
        setTimeout(() => navigate('/borrow-cart'), 800);
      } else {
        toast.error('Failed to add items to cart');
      }
    } catch (err) {
      console.error('Error adding to cart:', err);
      toast.error('Failed to add items to cart');
    }
  };

  if (!user || user.role !== 'borrower') {
    return <div className="text-center mt-10 text-red-500">❌ Access Denied</div>;
  }

  // ✅ NEW: Calendar utility functions (read-only view)
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getPerformancesForDay = (day) => {
    if (!day) return [];
    const dayString = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day).toDateString();
    return performances.filter(p => new Date(p.start_time).toDateString() === dayString);
  };

  const getCategoryColor = (performance) => {
    // Color code based on performance content
    if (!performance.items || performance.items.length === 0) {
      return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-300 dark:border-gray-600' };
    }
    
    // Check item categories
    const hasCosmetics = performance.items.some(pi => pi.category?.toLowerCase().includes('costume'));
    const hasInstrument = performance.items.some(pi => pi.category?.toLowerCase().includes('instrument'));
    
    if (hasCosmetics && hasInstrument) {
      return { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-600' };
    }
    if (hasCosmetics) {
      return { bg: 'bg-pink-100 dark:bg-pink-900/40', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-300 dark:border-pink-600' };
    }
    if (hasInstrument) {
      return { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-600' };
    }
    
    return { bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-600' };
  };

  const previousMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCalendarDate(new Date());
  };

  const isToday = (day) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      calendarDate.getMonth() === today.getMonth() &&
      calendarDate.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day) => {
    return (
      selectedCalendarDay === day &&
      calendarDate.getMonth() === new Date().getMonth() &&
      calendarDate.getFullYear() === new Date().getFullYear()
    );
  };

  // ✅ NEW: Open performance detail modal
  const openPerformanceDetail = (performance) => {
    setSelectedPerformanceForDetail(performance);
    setShowDetailModal(true);
  };

  const upcomingPerformances = performances.filter((p) => new Date(p.start_time) > new Date()).length;
  const pastPerformances = performances.filter((p) => new Date(p.start_time) < new Date()).length;

  return (
    <PageLayout>
      <div className="dark:bg-[#171717]">
        {/* ========== Header Section ========== */}
        <div className="px-6 md:px-8 lg:px-12 pt-8 pb-6 dark:bg-[#171717]">
          <div className="flex items-start justify-between gap-6">
            {/* Left Side - Title */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-2">Upcoming Performances</h1>
            </div>

            {/* Right Side - Summary Pills */}
            <div className="flex gap-3 flex-wrap items-center justify-end">
              <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Total: <span className="font-bold text-primary dark:text-blue-400">{performances.length}</span>
              </div>
              <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Upcoming: <span className="font-bold text-primary dark:text-blue-400">{upcomingPerformances}</span>
              </div>
              <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Past: <span className="font-bold text-warning dark:text-orange-400">{pastPerformances}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========== Main Content Area ========== */}
        <div className="px-6 md:px-8 lg:px-12 space-y-6 dark:bg-[#171717]">
          {/* ✅ CALENDAR VIEW - ALWAYS VISIBLE */}
            <div className="bg-surface-container-low dark:bg-[#222] rounded-lg border border-outline-variant/10 dark:border-gray-700 p-4 md:p-6 shadow-sm dark:shadow-black/20">
              {/* Calendar Header - Month Navigation */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant/20 dark:border-gray-700">
                <h2 className="text-xl font-bold text-on-surface dark:text-white">
                  {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={previousMonth}
                    className="p-2 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a] rounded-lg transition text-on-surface-variant dark:text-gray-400"
                    title="Previous month"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={goToToday}
                    className="px-4 py-2 bg-primary/20 dark:bg-blue-900/40 text-primary dark:text-blue-300 rounded-lg hover:bg-primary/30 dark:hover:bg-blue-900/60 transition font-medium text-sm"
                  >
                    Today
                  </button>
                  <button
                    onClick={nextMonth}
                    className="p-2 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a] rounded-lg transition text-on-surface-variant dark:text-gray-400"
                    title="Next month"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 mb-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase tracking-wider py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 auto-rows-max">
                {/* Empty cells for days before month starts */}
                {Array.from({ length: getFirstDayOfMonth(calendarDate) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="aspect-square bg-surface-container-lowest dark:bg-[#1a1a1a]/50 rounded-lg border border-outline-variant/10 dark:border-gray-700/30"
                  />
                ))}

                {/* Day cells */}
                {Array.from({ length: getDaysInMonth(calendarDate) }).map((_, i) => {
                  const day = i + 1;
                  const dayPerformances = getPerformancesForDay(day);
                  const isCurrentDay = isToday(day);
                  const isSelectedDay = isSelected(day);

                  return (
                    <div
                      key={day}
                      className={`min-h-24 md:min-h-28 rounded-lg border-2 p-2 transition-all overflow-hidden ${
                        isCurrentDay
                          ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-900/20'
                          : 'border-outline-variant/10 dark:border-gray-700/30 bg-surface-container-lowest dark:bg-[#1a1a1a]/50'
                      }`}
                    >
                      {/* Day number */}
                      <div className={`text-xs font-bold mb-1 ${isCurrentDay ? 'text-primary dark:text-blue-400' : 'text-on-surface-variant dark:text-gray-400'}`}>
                        {day}
                      </div>

                     {/* Performance badges */}
<div className="space-y-0.5">
  {dayPerformances.slice(0, 3).map((perf, idx) => {
    let colors;
    if (perf.isAssigned) {
      colors = { 
        bg: 'bg-orange-100 dark:bg-orange-900/40', 
        text: 'text-orange-700 dark:text-orange-300', 
        border: 'border-orange-300 dark:border-orange-600' 
      };
    } else {
      colors = getCategoryColor(perf);
    }

    return (
      <div
        key={perf.id || idx}
        onClick={() => openPerformanceDetail(perf)}
        className={`text-[10px] md:text-xs px-1.5 py-0.5 rounded border truncate ${colors.bg} ${colors.text} ${colors.border} border hover:shadow-md hover:scale-105 transition cursor-pointer font-medium`}
        title={`${perf.title} (${dayjs(perf.start_time).format('h:mm A')} - ${dayjs(perf.end_time).format('h:mm A')})${perf.location ? ` @ ${perf.location}` : ''}`}
      >
        {perf.title} {dayjs(perf.start_time).format('h:mm A')}
      </div>
    );
  })}

  {dayPerformances.length > 3 && (
    <div
      className="text-[9px] text-on-surface-variant dark:text-gray-500 px-1.5 py-0.5 font-medium cursor-help"
      title={`${dayPerformances.length - 3} more performance(s) not shown`}
    >
      +{dayPerformances.length - 3} more
    </div>
  )}
</div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-6 pt-4 border-t border-outline-variant/20 dark:border-gray-700">
                <p className="text-xs font-semibold text-on-surface-variant dark:text-gray-400 uppercase tracking-wider mb-3">Legend</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-pink-100 dark:bg-pink-900/40 border border-pink-300 dark:border-pink-600"></div>
                    <span className="text-xs text-on-surface-variant dark:text-gray-400">Costume</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-600"></div>
                    <span className="text-xs text-on-surface-variant dark:text-gray-400">Instrument</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-purple-100 dark:bg-purple-900/40 border border-purple-300 dark:border-purple-600"></div>
                    <span className="text-xs text-on-surface-variant dark:text-gray-400">Both</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"></div>
                    <span className="text-xs text-on-surface-variant dark:text-gray-400">Empty</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-orange-100 dark:bg-orange-900/40 border border-orange-300 dark:border-orange-600"></div>
                    <span className="text-xs text-on-surface-variant dark:text-gray-400">Assigned</span>
                  </div>
                </div>
              </div>
            </div>

          {/* ✅ LIST VIEW - ALWAYS VISIBLE BELOW CALENDAR */}
          <div className="flex items-center gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-4 py-3 border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-gray-600 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition shadow-sm dark:shadow-black/40">
            <Search className="w-5 text-on-surface-variant dark:text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by title or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none text-sm text-on-surface dark:text-white dark:placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-2 text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white transition"
              >
                ✕
              </button>
            )}
          </div>

          {/* Performances List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-on-surface-variant dark:text-gray-400">Loading performances...</div>
            </div>
          ) : groupedPerformances.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarIcon className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">No performances available</p>
              <p className="text-on-surface-variant dark:text-gray-500 text-xs mt-2">Staff will add and assign you to performances</p>
            </div>
          ) : (
            <div className="">
              {groupedPerformances.map((group) => (
                <div key={group.day} className="space-y-4">
                  {/* Sticky Date Header */}
                 

                  {/* Performance Cards */}
                  <div className="space-y-3">
                    {group.performances.map((perf) => {
                      const isExpanded = expandedPerformance === perf.id;

                      return (
                        <div
                          key={perf.id}
                          className={`bg-surface-container-low dark:bg-[#222] rounded-xl border transition-all shadow-sm dark:shadow-black/40 hover:shadow-md dark:hover:shadow-black/60 overflow-hidden ${
                            perf.isAssigned
                              ? 'border-primary/40 dark:border-blue-600/40 hover:border-primary/60 dark:hover:border-blue-500/60'
                              : 'border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-gray-600'
                          }`}
                        >
                          {/* Collapsed Header - Redesigned Inline Layout */}
                          <button
                            onClick={() => setExpandedPerformance(isExpanded ? null : perf.id)}
                            className="w-full px-4 py-2 flex items-center gap-4 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a] transition-colors text-left"
                          >
                            {/* Date */}
                            <div className="flex-shrink-0 text-xs font-semibold text-on-surface dark:text-white w-14">
                              {new Date(perf.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>

                            {/* Title */}
                            <p className="text-sm font-semibold truncate text-on-surface dark:text-white min-w-[120px]">{perf.title}</p>

                            {/* Time */}
                            <div className="flex-shrink-0 text-xs text-on-surface-variant dark:text-gray-400 w-20">
                              {dayjs(perf.start_time).format('h:mm A')} — {dayjs(perf.end_time).format('h:mm A')}
                            </div>

                            {/* Location */}
                            {perf.location && (
                              <div className="flex-shrink-0 text-xs text-on-surface-variant dark:text-gray-400 truncate max-w-[120px]">
                                {perf.location}
                              </div>
                            )}

                            {/* Status & Item Badges */}
                            <div className="flex items-center gap-2 ml-auto">
                              {/* Assignment Status Badge */}
                              <span className={`px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap flex-shrink-0 ${
                                perf.isAssigned
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                              }`}>
                                {perf.isAssigned ? '✓ Assigned' : 'Not Assigned'}
                              </span>

                              {/* Item Count */}
                              {perf.items && perf.items.length > 0 && (
                                <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-primary/15 dark:bg-blue-900/30 text-primary dark:text-blue-400 flex-shrink-0">
                                  {perf.items.length}
                                </span>
                              )}

                              {/* Chevron */}
                              <ChevronRight
                                className={`w-4 h-4 text-on-surface-variant dark:text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              />
                            </div>
                          </button>

                          {/* Expanded Details - Items Only */}
                          <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${
                              isExpanded ? 'max-h-full' : 'max-h-0'
                            }`}
                          >
                            <div className="border-t dark:border-gray-700 border-outline-variant/20 p-4 bg-surface-container-lowest/50 dark:bg-[#1a1a1a]/80 space-y-4">
                              {/* Suggested Items */}
                              {perf.items && perf.items.length > 0 ? (
                                <div className="bg-purple-50 dark:bg-[#2a2a2a] rounded-lg p-3 border border-purple-200 dark:border-gray-700">
                                  <p className="text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase tracking-wide mb-2">📦 Items ({perf.items.length})</p>
                                  <div className="space-y-2">
                                    {perf.items.map((item, idx) => (
                                      // ✅ UPDATED: Make item rows clickable with circular images
                                      <button
                                        key={item.id || idx}
                                        onClick={() => openItemModal(item)}
                                        className="w-full flex items-center justify-between p-2 rounded bg-white dark:bg-[#1a1a1a] hover:bg-purple-50 dark:hover:bg-[#252525] border border-transparent hover:border-purple-300 dark:hover:border-gray-600 transition-all text-left cursor-pointer gap-2"
                                      >
                                        {/* Circular Item Image */}
                                        <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                                          {item.image_url ? (
                                            <img
                                              src={item.image_url?.startsWith('http') ? item.image_url : `${import.meta.env.VITE_API_URL || window.location.origin}${item.image_url}`}
                                              alt={item.name}
                                              className="w-full h-full object-cover"
                                            />
                                          ) : (
                                            <Package className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                                          )}
                                        </div>

                                        {/* Item Info */}
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium text-on-surface dark:text-white">{item.name || 'Unknown Item'}</p>
                                          {item.category && <p className="text-xs text-on-surface-variant dark:text-gray-400">{item.category}</p>}
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-on-surface-variant dark:text-gray-400 italic">No items suggested for this performance</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ✅ NEW: Performance Detail Modal */}
      {showDetailModal && selectedPerformanceForDetail && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl dark:shadow-black/40 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-primary to-primary-light dark:from-blue-600 dark:to-blue-700 p-6 sticky top-0 z-10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-on-primary dark:text-white mb-2">{selectedPerformanceForDetail.title}</h2>
                  <p className="text-on-primary/80 dark:text-gray-300 text-sm">{dayjs(selectedPerformanceForDetail.start_time).format('MMM D, YYYY')}</p>
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-2 hover:bg-on-primary/10 dark:hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-6 h-6 text-on-primary dark:text-white" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Time Section */}
              <div className="flex items-center gap-4 pb-4 border-b border-outline-variant/20 dark:border-gray-700">
                <div className="w-12 h-12 rounded-lg bg-primary/15 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-primary dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase tracking-wide">TIME</p>
                  <p className="text-sm font-medium text-on-surface dark:text-white">
                    {dayjs(selectedPerformanceForDetail.start_time).format('h:mm A')} — {dayjs(selectedPerformanceForDetail.end_time).format('h:mm A')}
                  </p>
                  <p className="text-xs text-on-surface-variant dark:text-gray-400">
                    Duration: {dayjs(selectedPerformanceForDetail.end_time).diff(dayjs(selectedPerformanceForDetail.start_time), 'minute')} minutes
                  </p>
                </div>
              </div>

              {/* Location */}
              {selectedPerformanceForDetail.location && (
                <div className="flex items-start gap-4 pb-4 border-b border-outline-variant/20 dark:border-gray-700">
                  <div className="text-2xl">📍</div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase tracking-wide">LOCATION</p>
                    <p className="text-sm font-medium text-on-surface dark:text-white">{selectedPerformanceForDetail.location}</p>
                  </div>
                </div>
              )}

              {/* Assignment Status */}
              <div className="flex items-center gap-4 pb-4 border-b border-outline-variant/20 dark:border-gray-700">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  selectedPerformanceForDetail.isAssigned
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}>
                  <span className={`text-lg ${selectedPerformanceForDetail.isAssigned ? '✓' : '○'}`}></span>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase tracking-wide">STATUS</p>
                  <p className={`text-sm font-medium ${
                    selectedPerformanceForDetail.isAssigned
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {selectedPerformanceForDetail.isAssigned ? 'You are assigned' : 'Not assigned'}
                  </p>
                </div>
              </div>

              {/* Suggested Items */}
              {selectedPerformanceForDetail.items && selectedPerformanceForDetail.items.length > 0 && (
                <div className="pb-4 border-b border-outline-variant/20 dark:border-gray-700">
                  <p className="text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase tracking-wide mb-3">📦 SUGGESTED ITEMS ({selectedPerformanceForDetail.items.length})</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedPerformanceForDetail.items.map((item, idx) => (
                      <div key={item.id || idx} className="p-3 bg-purple-50 dark:bg-[#2a2a2a] rounded-lg border border-purple-200 dark:border-gray-700">
                        <p className="text-sm font-medium text-on-surface dark:text-white">{item.name}</p>
                        {item.category && <p className="text-xs text-on-surface-variant dark:text-gray-400">{item.category}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add to Cart Button - Only if assigned */}
              {selectedPerformanceForDetail.isAssigned && (
                <div className="pt-4 border-t border-outline-variant/20 dark:border-gray-700">
                  <button
                    onClick={() => {
                      addItemsToCart(selectedPerformanceForDetail);
                      setShowDetailModal(false);
                    }}
                    className="w-full px-4 py-3 bg-primary text-on-primary dark:bg-blue-600 dark:text-white rounded-lg font-bold hover:bg-primary-container dark:hover:bg-blue-700 transition flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Add Items to Cart
                  </button>
                </div>
              )}
            </div>

            {/* Close Button */}
            <div className="px-6 py-4 border-t border-outline-variant/20 dark:border-gray-700 bg-surface-container-lowest dark:bg-[#111]">
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full px-4 py-2 bg-surface-container-high dark:bg-gray-800 text-on-surface dark:text-white rounded-lg font-medium hover:bg-surface-container dark:hover:bg-gray-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NEW: Item Selection Modal for Adding to Cart */}
      <AnimatePresence>
        {selectedItemForCart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            onClick={closeItemModal}
          >
            <motion.div
              initial={{ x: 400 }}
              animate={{ x: 0 }}
              exit={{ x: 600 }}
              transition={{
                duration: 0.4,
                ease: [0.25, 0.46, 0.45, 0.94],
                exit: { duration: 0.15, ease: "easeIn" }
              }}
              className="fixed top-0 right-0 h-full w-full md:w-[500px] bg-white dark:bg-[#171717] shadow-2xl dark:shadow-black/40 flex flex-col z-50 rounded-l-3xl md:rounded-l-3xl rounded-r-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="border-b border-gray-200 dark:border-gray-800 p-4 md:p-6 max-h-[20%]" style={{ overflow: 'hidden' }}>
                <div className="flex">
                  <div className="flex gap-4 flex-1">
                    {/* Image */}
                    <div className="w-24 h-24 flex-shrink-0">
                      {selectedItemForCart.image_url ? (
                        <img
                          src={selectedItemForCart.image_url?.startsWith('http') ? selectedItemForCart.image_url : `${import.meta.env.VITE_API_URL || window.location.origin}${selectedItemForCart.image_url}`}
                          alt={selectedItemForCart.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400 dark:text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant dark:text-gray-400 font-bold mb-1">
                        {selectedItemForCart.category || 'Item'}
                      </p>
                      <h2 className="text-sm font-bold text-on-surface dark:text-white mb-2 line-clamp-2">
                        {selectedItemForCart.name}
                      </h2>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          (selectedItemForCart.units?.filter(u => u.status === 'available').length || 0) > 0
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}></div>
                        <p className={`text-[10px] font-medium ${
                          (selectedItemForCart.units?.filter(u => u.status === 'available').length || 0) > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {selectedItemForCart.units?.filter(u => u.status === 'available').length || 0} units available
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={closeItemModal}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] rounded-lg transition"
                  >
                    <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Unit Count Summary */}
              <div className="sticky top-0 bg-white dark:bg-[#171717] px-4 md:px-6 pt-2 pb-0.5 flex">
                <div className="flex-1" />
                <div className="w-40 flex-shrink-0 flex justify-between font-bold text-[9px] text-on-surface dark:text-white uppercase tracking-widest">
                  <span>TOTAL</span>
                  <span className="text-primary dark:text-blue-400">{selectedUnits.length}</span>
                </div>
              </div>

              {/* Search & Filters */}
              <div className="bg-white dark:bg-[#171717] border-b border-gray-200 dark:border-gray-800 px-4 pt-0 pb-2 md:px-6 md:pt-1 md:pb-0 space-y-1.5 overflow-y-auto max-h-80">
                <input
                  type="text"
                  placeholder="Search by unit number..."
                  value={unitSearchQuery}
                  onChange={(e) => setUnitSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                />

                {/* Size Filters */}
                {selectedItemForCart.units && selectedItemForCart.units.length > 0 && (
                  <div className="flex gap-6 text-[10px] font-medium uppercase tracking-widest">
                    {['small', 'medium', 'large'].map(size => {
                      const sizeCount = selectedItemForCart.units.filter(u => 
                        u.status === 'available' && (u.size?.toLowerCase() === size || (size === 'small' && !u.size))
                      ).length;
                      return (
                        <button
                          key={size}
                          onClick={() => setActiveSizeFilter(activeSizeFilter === size ? null : size)}
                          className={`pb-1 border-b-2 transition ${
                            activeSizeFilter === size
                              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                          }`}
                        >
                          {size} ({sizeCount})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Units List */}
              {selectedItemForCart.units && selectedItemForCart.units.length > 0 && (
                <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
                  <div className="space-y-3">
                    {selectedItemForCart.units
                      .filter(u => u.status === 'available')
                      .filter(u => {
                        if (activeSizeFilter) {
                          return u.size?.toLowerCase() === activeSizeFilter || (activeSizeFilter === 'small' && !u.size);
                        }
                        return true;
                      })
                      .filter(u => !unitSearchQuery || (u.unit_number || '').toLowerCase().includes(unitSearchQuery.toLowerCase()))
                      .map(unit => {
                        const isSelected = selectedUnits.some(u => u.id === unit.id);
                        return (
                          <button
                            key={unit.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedUnits(selectedUnits.filter(u => u.id !== unit.id));
                              } else {
                                setSelectedUnits([...selectedUnits, unit]);
                              }
                            }}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600'
                                : 'bg-gray-50 dark:bg-[#2a2a2a] border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            {/* Checkbox */}
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                              isSelected
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {isSelected && <X className="w-3 h-3 text-white rotate-45" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {unit.unit_number || `Unit ${unit.id.substring(0, 6)}`}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {unit.size ? `Size: ${unit.size.charAt(0).toUpperCase()}` : 'No size'}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                  </div>

                  {/* No Results */}
                  {selectedItemForCart.units.filter(u => u.status === 'available').filter(u => {
                    if (activeSizeFilter) {
                      return u.size?.toLowerCase() === activeSizeFilter || (activeSizeFilter === 'small' && !u.size);
                    }
                    return true;
                  }).filter(u => !unitSearchQuery || (u.unit_number || '').toLowerCase().includes(unitSearchQuery.toLowerCase())).length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-[10px] text-on-surface-variant dark:text-gray-400">
                        👉 No units match your search
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Footer - Add to Cart Button */}
              <div className="sticky bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#171717] p-4 md:p-6 space-y-3">
                {selectedUnits.length === 0 && (
                  <p className="text-[10px] text-on-surface-variant dark:text-gray-400">
                    👉 Select one or more units
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={closeItemModal}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-on-surface dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition text-[10px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAddSelectedToCart(selectedItemForCart)}
                    disabled={selectedUnits.length === 0}
                    className={`px-3 py-1.5 rounded-lg font-bold text-white transition-all text-[10px] ${
                      selectedUnits.length === 0
                        ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60'
                        : 'bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 active:scale-95'
                    }`}
                  >
                    {selectedUnits.length > 0 ? `Add (${selectedUnits.length})` : 'Select'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}
