import React, { useEffect, useState, useContext, useMemo } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserContext } from '../../../context/userContext';
import { BorrowingContext } from '../../../context/borrowingContext';
import PageLayout from '../../components/layout/PageLayout';
import toast from 'react-hot-toast';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Filter,
  Search,
  X,
  Trash2,
  ShoppingCart,
  ChevronRight,
  ChevronDown,
  Edit,
  ChevronLeft,
} from 'lucide-react';

dayjs.extend(utc);
dayjs.extend(timezone);

export default function StaffSchedule() {
  const { user } = useContext(UserContext);
  const { cart, setCart, addToCart, requestId, setRequestId } = useContext(BorrowingContext);
  const navigate = useNavigate();
  const [performances, setPerformances] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [borrowers, setBorrowers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [formStep, setFormStep] = useState(0); // 0=details, 1=performers, 2=items, 3=review
  const [expandedPerformance, setExpandedPerformance] = useState(null);
  // ✅ SIMPLIFIED: Form state now matches guided self-service model
  const [form, setForm] = useState({
    title: '',
    location: '',
    date: null,
    start_time: '09:00',
    end_time: '10:00',
    selectedBorrowerIds: [], // ✅ SIMPLIFIED: Just user IDs, no dancer counts in form
    selectedItemIds: [], // ✅ SIMPLIFIED: Just inventory item IDs, no specific units
    selectedDivisionIds: []
  });
  const [itemSearch, setItemSearch] = useState('');
  const [timeOptions, setTimeOptions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  // ✅ UPDATED: Initialize from localStorage
  const [addedPerformanceIds, setAddedPerformanceIdsState] = useState(() => {
    try {
      const stored = localStorage.getItem('addedPerformanceIds');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch (e) {
      return new Set();
    }
  });
  const setAddedPerformanceIds = (value) => {
    const newSet = value instanceof Function ? value(addedPerformanceIds) : value;
    setAddedPerformanceIdsState(newSet);
    // ✅ NEW: Persist to localStorage
    localStorage.setItem('addedPerformanceIds', JSON.stringify([...newSet]));
  };
  const [filteredPerformances, setFilteredPerformances] = useState([]);
  const [inventoryRefreshCount, setInventoryRefreshCount] = useState(0);
  const [itemUnitCounter, setItemUnitCounter] = useState({}); // Track unit numbers per item type
  const [expandedItemGroups, setExpandedItemGroups] = useState({}); // Track expanded item groups {itemId: bool}
  const [itemsSearchQuery, setItemsSearchQuery] = useState(''); // Search items by name or unit_number
  const [searchQuery, setSearchQuery] = useState(''); // Search performances by title
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [selectedPerformerDivision, setSelectedPerformerDivision] = useState('All'); // ✅ NEW: Division filter for performers
  const [selectedPerformanceView, setSelectedPerformanceView] = useState('All');
  const [transitionDirection, setTransitionDirection] = useState('left');
  const [divisions, setDivisions] = useState([]);
  const [calendarViewState, setCalendarViewState] = useState(() => ({
    All: new Date(),
    Dulimbay: new Date(),
    Budjong: new Date(),
    Kayam: new Date(),
  }));
  const [selectedCalendarDayByView, setSelectedCalendarDayByView] = useState(() => ({
    All: null,
    Dulimbay: null,
    Budjong: null,
    Kayam: null,
  }));
  const [selectedDayFilterByView, setSelectedDayFilterByView] = useState(() => ({
    All: null,
    Dulimbay: null,
    Budjong: null,
    Kayam: null,
  }));
  const [selectedPerformanceIdByView, setSelectedPerformanceIdByView] = useState(() => ({
    All: null,
    Dulimbay: null,
    Budjong: null,
    Kayam: null,
  }));
  
  // ✅ NEW: Performance detail modal state
  const [selectedPerformanceForDetail, setSelectedPerformanceForDetail] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    fetchPerformances();
    fetchInventoryItems();
    fetchBorrowers();
    fetchDivisions();
  }, []);

  // Refresh inventory periodically to sync available items
  useEffect(() => {
    const inventoryRefreshInterval = setInterval(() => {
      fetchInventoryItems();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(inventoryRefreshInterval);
  }, []);

  // Refresh inventory when needed
  useEffect(() => {
    if (inventoryRefreshCount > 0) {
      fetchInventoryItems();
    }
  }, [inventoryRefreshCount]);

  const fetchDivisions = async () => {
    try {
      const res = await axios.get('/api/inventory/divisions');
      const divisionList = Array.isArray(res.data)
        ? res.data.filter((division) => (division.status || 'Active').toLowerCase() !== 'inactive')
        : [];
      setDivisions(divisionList);
    } catch (error) {
      console.error('Failed to load divisions:', error.message);
    }
  };

  const currentCalendarDate = calendarViewState[selectedPerformanceView] || new Date();
  const selectedCalendarDay = selectedCalendarDayByView[selectedPerformanceView] ?? null;

  const getViewPerformances = () => {
    if (selectedPerformanceView === 'All') {
      return performances;
    }

    const selectedDivisionName = selectedPerformanceView.toLowerCase();
    return performances.filter((performance) => {
      const assignedDivisions = Array.isArray(performance.performance_divisions)
        ? performance.performance_divisions.map((division) => (division?.name || '').toLowerCase())
        : [];
      return assignedDivisions.includes(selectedDivisionName);
    });
  };

  const currentDayFilter = selectedDayFilterByView[selectedPerformanceView] ?? null;

  const visiblePerformances = useMemo(() => {
    let filtered = getViewPerformances();

    filtered = filtered.filter((p) => {
      const perfDate = new Date(p.start_time);
      return (
        perfDate.getMonth() === currentCalendarDate.getMonth() &&
        perfDate.getFullYear() === currentCalendarDate.getFullYear()
      );
    });

    if (currentDayFilter) {
      filtered = filtered.filter((p) => new Date(p.start_time).getDate() === currentDayFilter);
    }

    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((p) =>
        (p.title || '').toLowerCase().includes(searchLower) ||
        (p.description || '').toLowerCase().includes(searchLower) ||
        (p.location || '').toLowerCase().includes(searchLower)
      );
    }

    return filtered.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [performances, searchQuery, currentCalendarDate, currentDayFilter, selectedPerformanceView]);

  useEffect(() => {
    if (!visiblePerformances.length) {
      setSelectedPerformanceIdByView((prev) => ({ ...prev, [selectedPerformanceView]: null }));
      return;
    }

    const currentSelection = selectedPerformanceIdByView[selectedPerformanceView];
    const isSelectionVisible = currentSelection && visiblePerformances.some((performance) => performance.id === currentSelection);

    if (!isSelectionVisible) {
      setSelectedPerformanceIdByView((prev) => ({ ...prev, [selectedPerformanceView]: visiblePerformances[0].id }));
    }
  }, [selectedPerformanceView, visiblePerformances]);

  async function fetchPerformances() {
    try {
      setLoading(true);
      const res = await axios.get('/api/performances');
      const data = Array.isArray(res.data) ? res.data : [];
      data.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      setPerformances(data);
    } catch (err) {
      console.error('Failed to load performances:', err.message);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }

  async function fetchInventoryItems() {
    try {
      const res = await axios.get('/api/inventory/available');
      if (Array.isArray(res.data)) {
        // ✅ UPDATED: Keep full unit data for individual unit selection
        // Each item now includes: units array with individual unit details
        const itemsWithUnits = res.data.map(item => ({
          ...item,
          quantity: item.total_available || item.quantity || 0,
          // ✅ NEW: Keep units array for individual unit display
          units: item.units || [],
          // ✅ NEW: Size breakdown from SQL query
          qty_small: item.qty_small || 0,
          qty_medium: item.qty_medium || 0,
          qty_large: item.qty_large || 0
        }));
        setInventoryItems(itemsWithUnits.sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (err) {
      console.error('Failed to load inventory:', err.message);
      // Fallback to basic inventory if available endpoint fails
      try {
        const res = await axios.get('/api/inventory');
        if (Array.isArray(res.data)) {
          setInventoryItems(res.data.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (err2) {
        console.error('Fallback inventory load also failed:', err2.message);
      }
    }
  }

  async function fetchBorrowers() {
    try {
      const res = await axios.get('/api/auth/borrowers');
      const allUsers = Array.isArray(res.data) ? res.data : [];
      // Filter ONLY for borrowers (role === 'borrower')
      const borrowersList = allUsers.filter(u => u.role === 'borrower');
      setBorrowers(borrowersList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error('Failed to load borrowers:', err.message);
      toast.error('Failed to load borrowers list');
    }
  }

  // ✅ NEW: Get unique divisions from borrowers
  const getUniqueDivisions = () => {
    const divisions = new Set(
      borrowers
        .map(b => b.department_name)
        .filter(d => d) // Remove null/undefined
    );
    return ['All', ...Array.from(divisions).sort()];
  };

  // ✅ NEW: Filter borrowers by selected division
  const getFilteredBorrowers = () => {
    if (selectedPerformerDivision === 'All') {
      return borrowers;
    }
    return borrowers.filter(b => b.department_name === selectedPerformerDivision);
  };

  function toLocalInput(datetime) {
    if (!datetime) return '';
    return dayjs(datetime).local().format('YYYY-MM-DDTHH:mm');
  }

  function fromLocalInput(val) {
    if (!val) return null;
    return dayjs(val).toISOString();
  }

  // Convert date + time strings into full ISO datetime
  function combineDateAndTime(date, startTimeStr, endTimeStr) {
    if (!date || !startTimeStr || !endTimeStr) return { start: null, end: null };
    
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const startISO = dayjs(`${dateStr}T${startTimeStr}`).toISOString();
    const endISO = dayjs(`${dateStr}T${endTimeStr}`).toISOString();
    
    return { start: startISO, end: endISO };
  }

  // Generate time options in 30-minute intervals with AM/PM format
  function generateTimeOptions() {
    const times = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const hour24 = h;
        const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
        const period = hour24 >= 12 ? 'PM' : 'AM';
        const displayTime = `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
        times.push({ value: timeStr, display: displayTime });
      }
    }
    return times;
  }

  // Initialize time options
  useEffect(() => {
    setTimeOptions(generateTimeOptions());
  }, []);

  const openNewForm = () => {
    setEditing(null);
    setFormStep(0);
    const defaultDivisionIds = selectedPerformanceView === 'All'
      ? []
      : divisions.filter((division) => division.name === selectedPerformanceView).map((division) => division.id);

    setForm({
      title: '',
      location: '',
      date: null,
      start_time: '09:00',
      end_time: '10:00',
      selectedBorrowerIds: [],
      selectedItemIds: [],
      selectedDivisionIds: defaultDivisionIds
    });
    setItemSearch('');
    setSelectedPerformerDivision('All'); // ✅ NEW: Reset division filter
    setIsFormModalOpen(true);
  };

  const openEditForm = (p) => {
    setEditing(p.id);
    setFormStep(0);
    const startDayjs = dayjs(p.start_time);
    const endDayjs = dayjs(p.end_time);
    
    // ✅ SIMPLIFIED: Extract just user IDs from performance_borrowers
    const borrowerIds = p.performance_borrowers?.map(pb => pb.borrower_user_id) || [];
    
    // ✅ SIMPLIFIED: Extract just inventory item IDs from performance_items
    const itemIds = p.performance_items?.map(pi => pi.inventory_item_id) || [];
    
    const divisionIds = (p.performance_divisions || []).map((division) => division.division_id || division.id).filter(Boolean);

    setForm({
      title: p.title || '',
      location: p.location || '',
      date: new Date(p.start_time),
      start_time: startDayjs.format('HH:mm'),
      end_time: endDayjs.format('HH:mm'),
      selectedBorrowerIds: borrowerIds,
      selectedItemIds: itemIds,
      selectedDivisionIds: divisionIds
    });
    setItemSearch('');
    setSelectedPerformerDivision('All'); // ✅ NEW: Reset division filter
    setIsFormModalOpen(true);
  };



  // ✅ NEW: Group items by inventory_item_id with unit count
  const groupItemsByType = (itemsArray) => {
    if (!itemsArray || !Array.isArray(itemsArray)) return [];
    
    const grouped = {};
    itemsArray.forEach((item, index) => {
      const key = item.inventory_item_id;
      if (!grouped[key]) {
        grouped[key] = {
          inventory_item_id: item.inventory_item_id,
          name: item.name || 'Unknown Item',
          category: item.category,
          units: []
        };
      }
      grouped[key].units.push({ ...item, index });
    });
    
    return Object.values(grouped);
  };

  // ✅ NEW: Toggle item group expansion
  const toggleItemGroup = (itemId) => {
    setExpandedItemGroups(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // ✅ NEW: Filter items by search query (name or unit_number)
  const filterItemsBySearch = (itemsArray) => {
    if (!itemsSearchQuery.trim()) return itemsArray;
    
    const query = itemsSearchQuery.toLowerCase();
    return itemsArray.filter(itemGroup => {
      const nameMatch = itemGroup.name?.toLowerCase().includes(query);
      const unitMatch = itemGroup.units?.some(u => 
        u.unit_label?.toLowerCase().includes(query) ||
        u.unit_number?.toLowerCase().includes(query)
      );
      return nameMatch || unitMatch;
    });
  };

  const addItem = () => {
    if (!newItem.inventory_item_id) {
      toast.error('Please select an item');
      return;
    }
    
    const itemDetails = inventoryItems.find(i => i.id == newItem.inventory_item_id);
    if (!itemDetails) {
      toast.error('Item not found');
      return;
    }
    
    // ✅ NEW: Get actual units from inventory matching the selected size
    const availableUnits = itemDetails.units ? 
      itemDetails.units.filter(u => {
        if (newItem.size && newItem.size !== 'nosize') {
          return u.size?.toLowerCase() === newItem.size.toLowerCase();
        }
        return !u.size || u.size === 'nosize';
      }) : [];
    
    if (availableUnits.length === 0) {
      toast.error(`No units available for ${itemDetails.name} in size ${newItem.size || 'no-size'}`);
      return;
    }
    
    // ✅ NEW: Get the quantity to add (limited by available units)
    const quantityToAdd = Math.min(newItem.quantity, availableUnits.length);
    
    // ✅ NEW: Add each unit individually with actual unit_number
    const newItems = [];
    for (let i = 0; i < quantityToAdd; i++) {
      const unit = availableUnits[i];
      const uniqueItemId = `${unit.id}_${Date.now()}_${Math.random()}`;
      
      // Create label like "Violin-S-1" where 1 is from unit_number
      const sizeLabel = (newItem.size || unit.size)?.charAt(0).toUpperCase() || '';
      const unitNumberPart = unit.unit_number ? unit.unit_number.split('-').pop() : `${i + 1}`;
      const itemLabel = `${itemDetails.name}${sizeLabel ? '-' + sizeLabel : ''}-${unitNumberPart}`;
      
      newItems.push({
        id: uniqueItemId,
        inventory_item_id: newItem.inventory_item_id,
        unit_id: unit.id,              // ✅ NEW: Store actual unit ID
        unit_number: unit.unit_number, // ✅ NEW: Store actual unit_number
        name: itemDetails.name,        // ✅ NEW: Store item name for grouping
        size: newItem.size || unit.size,
        quantity: 1, // Always 1 per entry (represents 1 unit)
        unit_label: itemLabel,         // ✅ Updated label format
        unit_status: unit.status       // ✅ NEW: Track unit status
      });
    }
    
    setForm(prev => ({
      ...prev,
      items: [...prev.items, ...newItems]
    }));
    
    setNewItem({ inventory_item_id: '', size: null, quantity: 1 });
    toast.success(`Added ${quantityToAdd} unit(s) to performance`);
  };

  const removeItem = (itemId) => {
    // ✅ UPDATED: Remove by item ID (not index) to work with individual units
    setForm(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { start, end } = combineDateAndTime(form.date, form.start_time, form.end_time);
      if (!start || !end) {
        toast.error('Please select date and times');
        return;
      }

      // ✅ SIMPLIFIED: Just send simple arrays
      const payload = {
        title: form.title,
        location: form.location,
        start_time: start,
        end_time: end,
        selectedBorrowerIds: form.selectedBorrowerIds,
        selectedItemIds: form.selectedItemIds,
        selectedDivisionIds: form.selectedDivisionIds
      };

      if (editing) {
        await axios.put(`/api/performances/${editing}`, payload);
        toast.success('Performance updated');
      } else {
        await axios.post('/api/performances', payload);
        toast.success('Performance created');
      }

      fetchPerformances();
      setInventoryRefreshCount(prev => prev + 1);
      setIsFormModalOpen(false);
      openNewForm();
    } catch (err) {
      console.error('Save failed:', err.response?.data || err.message);
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this performance?')) return;
    try {
      await axios.delete(`/api/performances/${id}`);
      toast.success('Deleted');
      fetchPerformances();
      // Refresh inventory to sync available items
      setInventoryRefreshCount(prev => prev + 1);
    } catch (err) {
      console.error('Delete failed:', err.response?.data || err.message);
      toast.error('Delete failed');
    }
  };

  const addItemToCart = async (item) => {
    if (!item.inventory_item_id) return;
    
    try {
      // Get item details from inventory
      const itemRes = await axios.get(`/api/inventory`);
      const inventoryItem = itemRes.data.find(i => i.id == item.inventory_item_id);
      
      if (!inventoryItem) {
        console.error('Item not found in inventory');
        return;
      }
      
      // Add item to cart using the correct endpoint
      await axios.post('/api/borrow/cart', {
        borrower_id: String(user.id),
        request_id: requestId || null,
        items: [{
          item_id: inventoryItem.id,
          quantity: item.quantity || 1
        }]
      });
    } catch (err) {
      console.error('Failed to add item to cart:', err);
    }
  };

  const addPerformanceToCart = async () => {
    if (!selectedPerformance || !selectedPerformance.items || selectedPerformance.items.length === 0) {
      toast.error('No items in this performance');
      return;
    }

    try {
      // ✅ NEW: Use backend API to persist items (like Available Items)
      // Prepare items for backend - send item_id (inventory_item_id) only, not unit_id
      // This allows the backend to pick available units
      const itemsToAdd = selectedPerformance.items.map(item => ({
        item_id: item.inventory_item_id,  // INTEGER from inventory_items
        quantity: 1
      }));
      
      // Call backend API to add all items in batch
      const res = await axios.post('/api/borrow/cart', {
        borrower_id: String(user.id),
        request_id: requestId || null,
        items: itemsToAdd
      });
      
      if (res.data.success) {
        // ✅ NEW: Track this performance as added (persist across modal reopens)
        setAddedPerformanceIds(prev => new Set([...prev, selectedPerformance.id]));
        
        // ✅ Update requestId if this is a new request
        if (res.data.request_id && !requestId) {
          setRequestId(res.data.request_id);
        }
        
        // ✅ Update cart with server response (canonical state)
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
          
          // ✅ Update cart state with all items from server
          setCart(mappedItems);
        }
        
        toast.success(`Added ${itemsToAdd.length} unit(s) to cart and reserved in database`);
        
        // ✅ UPDATED: Keep modal open to show read-only state instead of navigating away
      } else {
        toast.error(res.data.error || 'Failed to add items to cart');
      }
    } catch (err) {
      console.error('Add to cart failed:', err);
      toast.error(err.response?.data?.error || 'Failed to add items to cart');
    }
  };

  if (!user || user.role !== 'staff') {
    return <div className="text-center mt-10 text-red-500">❌ Access Denied</div>;
  }

  // ✅ NEW: Calendar utility functions
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getPerformancesForDay = (day) => {
    if (!day) return [];
    const dayString = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day).toDateString();
    return getViewPerformances().filter((p) => new Date(p.start_time).toDateString() === dayString);
  };

  const getCategoryColor = (performance) => {
    // Color code based on performance content
    if (!performance.performance_items || performance.performance_items.length === 0) {
      return { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-300 dark:border-gray-600' };
    }
    
    // Check item categories
    const hasCosmetics = performance.performance_items.some(pi => pi.category?.toLowerCase().includes('costume'));
    const hasInstrument = performance.performance_items.some(pi => pi.category?.toLowerCase().includes('instrument'));
    
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
    setCalendarViewState((prev) => ({
      ...prev,
      [selectedPerformanceView]: new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() - 1),
    }));
  };

  const nextMonth = () => {
    setCalendarViewState((prev) => ({
      ...prev,
      [selectedPerformanceView]: new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1),
    }));
  };

  const goToToday = () => {
    setCalendarViewState((prev) => ({
      ...prev,
      [selectedPerformanceView]: new Date(),
    }));
  };

  const isToday = (day) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentCalendarDate.getMonth() === today.getMonth() &&
      currentCalendarDate.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day) => {
    return selectedCalendarDay === day;
  };

  // ✅ NEW: Open create form with pre-filled date from calendar
  const openCreateFormWithDate = (day) => {
    const selectedDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day);
    const defaultDivisionIds = selectedPerformanceView === 'All'
      ? []
      : divisions.filter((division) => division.name === selectedPerformanceView).map((division) => division.id);
    setEditing(null);
    setFormStep(0);
    setForm({
      title: '',
      location: '',
      date: selectedDate,
      start_time: '09:00',
      end_time: '10:00',
      selectedBorrowerIds: [],
      selectedItemIds: [],
      selectedDivisionIds: defaultDivisionIds
    });
    setItemSearch('');
    setSelectedPerformerDivision('All');
    setIsFormModalOpen(true);
  };

  // ✅ NEW: Open detailed performance view modal
  const openPerformanceDetail = (performance) => {
    setSelectedPerformanceForDetail(performance);
    setShowDetailModal(true);
  };

  const totalSchedules = performances.length;
  const upcomingSchedules = performances.filter((p) => new Date(p.start_time) > new Date()).length;
  const todaySchedules = performances.filter((p) => new Date(p.start_time).toDateString() === new Date().toDateString()).length;
  const pastSchedules = performances.filter((p) => new Date(p.start_time) < new Date()).length;

  const divisionTabs = useMemo(() => [
    { label: 'All', value: 'All' },
    { label: 'Dulimbay', value: 'Dulimbay' },
    { label: 'Budjong', value: 'Budjong' },
    { label: 'Kayam', value: 'Kayam' },
  ], []);

  const handleDivisionTabChange = (nextView) => {
    const currentIndex = divisionTabs.findIndex((tab) => tab.value === selectedPerformanceView);
    const nextIndex = divisionTabs.findIndex((tab) => tab.value === nextView);
    const nextDirection = currentIndex === -1 || nextIndex === -1 || currentIndex < nextIndex ? 'right' : 'left';
    setTransitionDirection(nextDirection);
    setSelectedPerformanceView(nextView);
  };

  const getDivisionBadgeStyles = (divisionName) => {
    switch ((divisionName || '').toLowerCase()) {
      case 'dulimbay':
        return 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800';
      case 'budjong':
        return 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800';
      case 'kayam':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
    }
  };

  const getPerformanceDivisionLabels = (performance) => {
    const fromPerformance = Array.isArray(performance.performance_divisions)
      ? performance.performance_divisions.map((division) => division?.name).filter(Boolean)
      : [];

    if (fromPerformance.length > 0) {
      return fromPerformance;
    }

    return ['All'];
  };

  const filteredPerformanceCount = visiblePerformances.length;
  const selectedPerformance = useMemo(() => {
    if (!visiblePerformances.length) return null;
    const currentSelection = selectedPerformanceIdByView[selectedPerformanceView];
    return visiblePerformances.find((performance) => performance.id === currentSelection) || visiblePerformances[0];
  }, [visiblePerformances, selectedPerformanceIdByView, selectedPerformanceView]);

  return (
    <PageLayout>
      <div className="dark:bg-[#171717]">
        <div className="px-6 md:px-8 lg:px-12 pt-6 pb-6 dark:bg-[#171717]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low dark:border-gray-700 dark:bg-[#222] p-1 shadow-sm">
              {divisionTabs.map((tab) => {
                const isActive = selectedPerformanceView === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => handleDivisionTabChange(tab.value)}
                    className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ${isActive ? 'bg-primary text-white shadow-sm dark:bg-blue-600' : 'text-on-surface-variant hover:bg-surface-container-high dark:text-gray-300 dark:hover:bg-[#2a2a2a]'}`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

           
          </div>
        </div>

        <div className="px-6 md:px-8 lg:px-12 space-y-4 dark:bg-[#171717]">
          <motion.div
            key={`${selectedPerformanceView}-${currentCalendarDate.getMonth()}-${currentCalendarDate.getFullYear()}`}
            initial={{ opacity: 0, x: transitionDirection === 'right' ? 24 : -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="space-y-4"
          >
            <div className="bg-surface-container-low dark:bg-[#222] rounded-lg border border-outline-variant/10 dark:border-gray-700 p-4 md:p-6 shadow-sm dark:shadow-black/20">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant/20 dark:border-gray-700">
                <h2 className="text-xl font-bold text-on-surface dark:text-white">
                  {currentCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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

              <div className="grid grid-cols-7 gap-1 mb-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase tracking-wider py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 auto-rows-max">
                {Array.from({ length: getFirstDayOfMonth(currentCalendarDate) }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="aspect-square bg-surface-container-lowest dark:bg-[#1a1a1a]/50 rounded-lg border border-outline-variant/10 dark:border-gray-700/30"
                  />
                ))}

                {Array.from({ length: getDaysInMonth(currentCalendarDate) }).map((_, i) => {
                  const day = i + 1;
                  const dayPerformances = getPerformancesForDay(day);
                  const isCurrentDay = isToday(day);

                  return (
                    <div
                      key={day}
                      onClick={() => {
                        setSelectedCalendarDayByView((prev) => ({ ...prev, [selectedPerformanceView]: day }));
                        setSelectedDayFilterByView((prev) => ({ ...prev, [selectedPerformanceView]: day }));
                        setSelectedPerformanceIdByView((prev) => ({ ...prev, [selectedPerformanceView]: null }));
                        if (dayPerformances.length === 0) {
                          openCreateFormWithDate(day);
                        }
                      }}
                      className={`min-h-24 md:min-h-28 rounded-lg border-2 p-2 transition-all overflow-hidden ${
                        isCurrentDay
                          ? 'border-primary dark:border-blue-500 bg-primary/5 dark:bg-blue-900/20'
                          : 'border-outline-variant/10 dark:border-gray-700/30 bg-surface-container-lowest dark:bg-[#1a1a1a]/50 hover:border-primary/50 dark:hover:border-blue-600/50'
                      } ${dayPerformances.length === 0 ? 'cursor-pointer hover:bg-primary/10 dark:hover:bg-blue-900/30' : ''}`}
                      title={dayPerformances.length === 0 ? 'Click to create performance' : ''}
                    >
                      <div className={`text-xs font-bold mb-1 ${isCurrentDay ? 'text-primary dark:text-blue-400' : 'text-on-surface-variant dark:text-gray-400'}`}>
                        {day}
                      </div>

                      <div className="space-y-0.5 max-h-16 overflow-y-auto">
                        {dayPerformances.slice(0, 3).map((perf, idx) => {
                          const colors = getCategoryColor(perf);
                          return (
                            <div
                              key={perf.id || idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                openPerformanceDetail(perf);
                              }}
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

              
            </div>

            <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4 shadow-sm dark:border-gray-700 dark:bg-[#222]">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <Search className="w-5 text-on-surface-variant dark:text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search by title, location, or description..."
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDayFilterByView((prev) => ({ ...prev, [selectedPerformanceView]: null }));
                      setSelectedPerformanceIdByView((prev) => ({ ...prev, [selectedPerformanceView]: null }));
                    }}
                    className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high dark:border-gray-700 dark:text-gray-300"
                  >
                    Show All
                  </button>
                  <div className="text-xs font-semibold text-on-surface-variant dark:text-gray-400">
                    {filteredPerformanceCount} shown
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)]">
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3 shadow-sm dark:border-gray-700 dark:bg-[#222]">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-on-surface-variant dark:text-gray-400">Loading performances...</div>
                  </div>
                ) : visiblePerformances.length === 0 ? (
                  <div className="py-16 text-center">
                    <CalendarIcon className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-on-surface-variant dark:text-gray-400 text-sm">No performances scheduled</p>
                    <p className="text-on-surface-variant dark:text-gray-500 text-xs mt-2">Create one to get started</p>
                  </div>
                ) : (
                  <div className="max-h-[560px] overflow-y-auto space-y-2 pr-1">
                    {visiblePerformances.map((perf) => {
                      const isSelected = selectedPerformance?.id === perf.id;
                      return (
                        <button
                          key={perf.id}
                          type="button"
                          onClick={() => setSelectedPerformanceIdByView((prev) => ({ ...prev, [selectedPerformanceView]: perf.id }))}
                          className={`w-full rounded-lg border px-3 py-3 text-left transition-all ${isSelected ? 'border-primary bg-primary/10 shadow-sm dark:border-blue-500 dark:bg-blue-900/20' : 'border-outline-variant/20 hover:border-primary/40 hover:bg-surface-container-high dark:border-gray-700 dark:hover:bg-[#2a2a2a]'}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-gray-400">
                                {dayjs(perf.start_time).format('MMM DD')}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-on-surface dark:text-white">{perf.title}</p>
                              <p className="text-xs text-on-surface-variant dark:text-gray-400">{dayjs(perf.start_time).format('h:mm A')}</p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-on-surface-variant dark:text-gray-400" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5 shadow-sm dark:border-gray-700 dark:bg-[#222]">
                {selectedPerformance ? (
                  <div className="space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant dark:text-gray-400">Selected schedule</p>
                        <h3 className="mt-2 text-xl font-semibold text-on-surface dark:text-white">{selectedPerformance.title}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditForm(selectedPerformance)}
                        className="rounded-lg border border-outline-variant/20 p-2 text-on-surface-variant transition hover:bg-surface-container-high dark:border-gray-700 dark:text-gray-300"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg bg-surface-container-high/70 p-4 dark:bg-[#2a2a2a]">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-gray-400">Date</p>
                        <p className="mt-1 text-sm font-medium text-on-surface dark:text-white">{dayjs(selectedPerformance.start_time).format('MMMM D, YYYY')}</p>
                      </div>
                      <div className="rounded-lg bg-surface-container-high/70 p-4 dark:bg-[#2a2a2a]">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-gray-400">Time</p>
                        <p className="mt-1 text-sm font-medium text-on-surface dark:text-white">{dayjs(selectedPerformance.start_time).format('h:mm A')} - {dayjs(selectedPerformance.end_time).format('h:mm A')}</p>
                      </div>
                      <div className="rounded-lg bg-surface-container-high/70 p-4 dark:bg-[#2a2a2a]">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-gray-400">Location</p>
                        <p className="mt-1 text-sm font-medium text-on-surface dark:text-white">{selectedPerformance.location || 'Not specified'}</p>
                      </div>
                      <div className="rounded-lg bg-surface-container-high/70 p-4 dark:bg-[#2a2a2a]">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-gray-400">Division</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {getPerformanceDivisionLabels(selectedPerformance).map((divisionName) => (
                            <span key={`${selectedPerformance.id}-${divisionName}`} className={`rounded-full px-2 py-1 text-[11px] font-semibold ${getDivisionBadgeStyles(divisionName)}`}>
                              {divisionName}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {selectedPerformance.description && (
                      <div className="rounded-lg border border-outline-variant/20 p-4 dark:border-gray-700">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-gray-400">Description</p>
                        <p className="mt-2 text-sm leading-6 text-on-surface dark:text-gray-300">{selectedPerformance.description}</p>
                      </div>
                    )}

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-outline-variant/20 p-4 dark:border-gray-700">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-gray-400">Assigned performers</p>
                        {selectedPerformance.performance_borrowers?.length ? (
                          <div className="mt-3 space-y-2">
                            {selectedPerformance.performance_borrowers.map((borrower, index) => (
                              <div key={borrower.borrower_user_id || index} className="rounded-lg bg-surface-container-high/70 px-3 py-2 text-sm dark:bg-[#2a2a2a]">
                                <p className="font-medium text-on-surface dark:text-white">{borrower.name || 'Unknown performer'}</p>
                                {borrower.department_name && <p className="text-xs text-on-surface-variant dark:text-gray-400">{borrower.department_name}</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-on-surface-variant dark:text-gray-400">No performers assigned</p>
                        )}
                      </div>

                      <div className="rounded-lg border border-outline-variant/20 p-4 dark:border-gray-700">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant dark:text-gray-400">Assigned items</p>
                        {selectedPerformance.performance_items?.length ? (
                          <div className="mt-3 space-y-2">
                            {groupItemsByType(selectedPerformance.performance_items).map((group) => (
                              <div key={group.inventory_item_id} className="rounded-lg bg-surface-container-high/70 px-3 py-2 text-sm dark:bg-[#2a2a2a]">
                                <p className="font-medium text-on-surface dark:text-white">{group.name}</p>
                                <p className="text-xs text-on-surface-variant dark:text-gray-400">{group.units.length} unit{group.units.length !== 1 ? 's' : ''}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-on-surface-variant dark:text-gray-400">No items assigned</p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[260px] items-center justify-center rounded-lg border border-dashed border-outline-variant/20 p-6 text-center text-sm text-on-surface-variant dark:border-gray-700 dark:text-gray-400">
                    Select a performance from the list to view its full details.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-[#222] rounded-xl shadow-2xl dark:shadow-black/60 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-primary dark:bg-blue-600 px-6 py-4 flex items-center justify-between sticky top-0">
              <h2 className="text-lg font-bold text-on-primary dark:text-white">
                {editing ? 'Edit' : 'Create'} Performance - Step {formStep + 1} of 4
              </h2>
              <button
                className="text-on-primary dark:text-white hover:opacity-80 text-2xl transition"
                onClick={() => setIsFormModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={formStep === 3 ? handleSubmit : (e) => { e.preventDefault(); setFormStep(formStep + 1); }} className="p-6 space-y-4 dark:bg-[#222]">
              
              {/* ✅ STEP 0: PERFORMANCE DETAILS */}
              {formStep === 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📋 Performance Details</h3>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Title *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g., Spring Dance Recital"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Location</label>
                    <input
                      type="text"
                      placeholder="e.g., Main Auditorium"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Date *</label>
                    <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <Calendar
                        onClickDay={(date) => setForm({ ...form, date })}
                        value={form.date}
                        minDate={new Date()}
                        firstDayOfWeek={0}
                        tileClassName={({ date }) =>
                          form.date && date.toDateString() === form.date.toDateString()
                            ? 'bg-primary text-white rounded-full font-bold'
                            : null
                        }
                      />
                    </div>
                    {form.date && (
                      <p className="text-sm text-primary dark:text-blue-400 mt-2 font-medium">
                        ✓ {dayjs(form.date).format('MMMM D, YYYY')}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">Start Time *</label>
                      <select
                        required
                        value={form.start_time}
                        onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                        className="w-full border border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">Select time</option>
                        {timeOptions.map(time => (
                          <option key={`start-${time.value}`} value={time.value}>{time.display}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">End Time *</label>
                      <select
                        required
                        value={form.end_time}
                        onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                        className="w-full border border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="">Select time</option>
                        {timeOptions.map(time => (
                          <option key={`end-${time.value}`} value={time.value}>{time.display}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {form.start_time && form.end_time && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-900 dark:text-blue-200">
                        <strong>Summary:</strong> {form.date ? dayjs(form.date).format('MMMM D, YYYY') : 'Date'} from {form.start_time} to {form.end_time}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ✅ STEP 1: ASSIGN PERFORMERS */}
              {formStep === 1 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">👥 Assign Performers</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Select who will perform in this performance</p>
                  
                  {/* ✅ NEW: Division Filter Buttons */}
                  <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
                    {getUniqueDivisions().map(division => (
                      <button
                        key={division}
                        type="button"
                        onClick={() => setSelectedPerformerDivision(division)}
                        className={`px-4 py-2 rounded-full font-medium text-sm transition-all ${
                          selectedPerformerDivision === division
                            ? 'bg-primary text-white dark:bg-blue-600 dark:text-white'
                            : 'bg-gray-100 text-gray-700 dark:bg-[#2a2a2a] dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#333]'
                        }`}
                      >
                        {division}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 dark:bg-[#1a1a1a] rounded-lg p-3 bg-gray-50">
                    {getFilteredBorrowers().length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No performers available</p>
                    ) : (
                      getFilteredBorrowers().map(borrower => (
                        <div key={borrower.id} className="flex items-center gap-3 p-3 bg-white dark:bg-[#2a2a2a] rounded border border-gray-200 dark:border-gray-700 hover:border-primary/50 dark:hover:border-primary/50 transition">
                          <input
                            type="checkbox"
                            checked={form.selectedBorrowerIds.includes(borrower.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm({
                                  ...form,
                                  selectedBorrowerIds: [...form.selectedBorrowerIds, borrower.id]
                                });
                              } else {
                                setForm({
                                  ...form,
                                  selectedBorrowerIds: form.selectedBorrowerIds.filter(id => id !== borrower.id)
                                });
                              }
                            }}
                            className="w-5 h-5 text-primary rounded cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{borrower.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{borrower.email}</p>
                            {borrower.department_name && (
                              <p className="text-xs text-primary dark:text-blue-400 font-medium">{borrower.department_name}</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {form.selectedBorrowerIds.length > 0 && (
                    <div className="mt-4 bg-green-50 dark:bg-green-900/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-900 dark:text-green-200 font-medium">
                        ✓ {form.selectedBorrowerIds.length} performer{form.selectedBorrowerIds.length !== 1 ? 's' : ''} selected
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ✅ STEP 2: SUGGEST ITEMS */}
              {formStep === 2 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">📦 Suggest Items</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Select inventory items to recommend to performers</p>
                  
                  {/* Search Bar */}
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search items..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="w-full border border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-white pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                      />
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 dark:bg-[#1a1a1a] rounded-lg p-3 bg-gray-50">
                    {inventoryItems
                      .filter(item => item.name.toLowerCase().includes(itemSearch.toLowerCase()))
                      .map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-white dark:bg-[#2a2a2a] rounded border border-gray-200 dark:border-gray-700 hover:border-primary/50 dark:hover:border-primary/50 transition">
                          <input
                            type="checkbox"
                            checked={form.selectedItemIds.includes(item.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm({
                                  ...form,
                                  selectedItemIds: [...form.selectedItemIds, item.id]
                                });
                              } else {
                                setForm({
                                  ...form,
                                  selectedItemIds: form.selectedItemIds.filter(id => id !== item.id)
                                });
                              }
                            }}
                            className="w-5 h-5 text-primary rounded cursor-pointer flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.quantity || 0} available</p>
                          </div>
                        </div>
                      ))}
                    {inventoryItems.filter(item => item.name.toLowerCase().includes(itemSearch.toLowerCase())).length === 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">No items found</p>
                    )}
                  </div>

                  {form.selectedItemIds.length > 0 && (
                    <div className="mt-4 bg-green-50 dark:bg-green-900/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                      <p className="text-sm text-green-900 dark:text-green-200 font-medium">
                        ✓ {form.selectedItemIds.length} item{form.selectedItemIds.length !== 1 ? 's' : ''} selected
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ✅ STEP 3: REVIEW & SUBMIT */}
              {formStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">✓ Review Performance</h3>
                  
                  {/* Performance Details Summary */}
                  <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Performance Details</p>
                    <p className="text-sm text-blue-800 dark:text-blue-300"><strong>Title:</strong> {form.title}</p>
                    {form.location && <p className="text-sm text-blue-800 dark:text-blue-300"><strong>Location:</strong> {form.location}</p>}
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      <strong>When:</strong> {form.date ? dayjs(form.date).format('MMM D, YYYY') : 'Not set'} from {form.start_time} to {form.end_time}
                    </p>
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      <strong>Divisions:</strong> {form.selectedDivisionIds.length > 0 ? divisions.filter((division) => form.selectedDivisionIds.includes(division.id)).map((division) => division.name).join(', ') : 'None selected'}
                    </p>
                  </div>

                  {/* Performers Summary */}
                  <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm font-semibold text-green-900 dark:text-green-200 mb-2">Performers ({form.selectedBorrowerIds.length})</p>
                    {form.selectedBorrowerIds.length > 0 ? (
                      <ul className="space-y-1">
                        {borrowers.filter(b => form.selectedBorrowerIds.includes(b.id)).map(borrower => (
                          <li key={borrower.id} className="text-sm text-green-800 dark:text-green-300">• {borrower.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-green-700 dark:text-green-400">None selected</p>
                    )}
                  </div>

                  {/* Items Summary */}
                  <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-2">Suggested Items ({form.selectedItemIds.length})</p>
                    {form.selectedItemIds.length > 0 ? (
                      <ul className="space-y-1">
                        {inventoryItems.filter(i => form.selectedItemIds.includes(i.id)).map(item => (
                          <li key={item.id} className="text-sm text-purple-800 dark:text-purple-300">• {item.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-purple-700 dark:text-purple-400">None selected</p>
                    )}
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      💡 Performers will receive notifications about this performance and can choose from the suggested items.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Navigation Buttons */}
              <div className="flex gap-3 border-t dark:border-gray-700 pt-4 mt-6">
                {formStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormStep(formStep - 1)}
                    className="flex-1 px-4 py-2 bg-surface-container-low dark:bg-[#2a2a2a] text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 rounded-lg hover:bg-surface-container-high dark:hover:bg-[#333] transition font-medium"
                  >
                    ← Back
                  </button>
                )}
                {formStep < 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      // ✅ SIMPLIFIED: Validation for new form structure
                      if (formStep === 0) {
                        if (!form.title) { toast.error('Please enter a title'); return; }
                        if (!form.date) { toast.error('Please select a date'); return; }
                        if (!form.start_time) { toast.error('Please select start time'); return; }
                        if (!form.end_time) { toast.error('Please select end time'); return; }
                      }
                      if (formStep === 1) {
                        if (form.selectedBorrowerIds.length === 0) {
                          toast.error('Please select at least one performer');
                          return;
                        }
                      }
                      if (formStep === 2) {
                        if (form.selectedItemIds.length === 0) {
                          toast.warning('No items selected - performers will see empty pool');
                        }
                      }
                      setFormStep(formStep + 1);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg hover:bg-primary-container dark:hover:bg-blue-700 transition font-medium"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {formStep === 3 && (
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 transition font-medium"
                  >
                    ✓ Save Performance
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ✅ NEW: Performance Detail Modal */}
      {showDetailModal && selectedPerformanceForDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-[#222] rounded-xl shadow-2xl dark:shadow-black/60 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-primary/80 dark:from-blue-600 dark:to-blue-700 px-6 py-5 flex items-center justify-between sticky top-0">
              <div>
                <h2 className="text-xl font-bold text-on-primary dark:text-white">{selectedPerformanceForDetail.title}</h2>
                <p className="text-on-primary/80 dark:text-blue-100 text-sm mt-1">
                  {dayjs(selectedPerformanceForDetail.start_time).format('MMMM D, YYYY')}
                </p>
              </div>
              <button
                className="text-on-primary dark:text-white hover:opacity-80 text-3xl transition"
                onClick={() => setShowDetailModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 dark:bg-[#222]">
              {/* Time & Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 uppercase tracking-wider mb-2">⏰ Time</p>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {dayjs(selectedPerformanceForDetail.start_time).format('h:mm A')} - {dayjs(selectedPerformanceForDetail.end_time).format('h:mm A')}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Duration: {dayjs(selectedPerformanceForDetail.end_time).diff(dayjs(selectedPerformanceForDetail.start_time), 'hour', true).toFixed(1)} hours
                  </p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs font-semibold text-green-900 dark:text-green-200 uppercase tracking-wider mb-2">📍 Location</p>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    {selectedPerformanceForDetail.location || 'Not specified'}
                  </p>
                </div>
              </div>

              {/* Performers */}
              {selectedPerformanceForDetail.performance_borrowers && selectedPerformanceForDetail.performance_borrowers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-on-surface dark:text-white mb-3 flex items-center gap-2">
                    <span>👥 Performers ({selectedPerformanceForDetail.performance_borrowers.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedPerformanceForDetail.performance_borrowers.map((pb, idx) => (
                      <div key={pb.borrower_user_id || idx} className="flex items-center gap-3 p-3 bg-surface-container-low dark:bg-[#2a2a2a] rounded-lg border border-outline-variant/10 dark:border-gray-700">
                        {pb?.profile_pic_url ? (
                          <img 
                            src={pb.profile_pic_url} 
                            alt={pb?.name} 
                            className="w-10 h-10 rounded-full object-cover border-2 border-primary dark:border-blue-500"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/20 dark:bg-blue-900/40 flex items-center justify-center border-2 border-primary dark:border-blue-500 font-bold text-primary dark:text-blue-400">
                            {pb?.name?.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-on-surface dark:text-white truncate">{pb?.name || 'Unknown'}</p>
                          {pb?.department_name && (
                            <p className="text-xs text-on-surface-variant dark:text-gray-400">{pb.department_name}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Items Suggested */}
              {selectedPerformanceForDetail.performance_items && selectedPerformanceForDetail.performance_items.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-on-surface dark:text-white mb-3 flex items-center gap-2">
                    <span>📦 Suggested Items ({selectedPerformanceForDetail.performance_items.length})</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {groupItemsByType(selectedPerformanceForDetail.performance_items).map((group) => (
                      <div key={group.inventory_item_id} className="p-3 bg-surface-container-low dark:bg-[#2a2a2a] rounded-lg border border-outline-variant/10 dark:border-gray-700">
                        <p className="text-sm font-medium text-on-surface dark:text-white">{group.name}</p>
                        <p className="text-xs text-on-surface-variant dark:text-gray-400 mt-1">
                          {group.units.length} unit{group.units.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedPerformanceForDetail.description && (
                <div>
                  <h3 className="text-sm font-semibold text-on-surface dark:text-white mb-2">📝 Description</h3>
                  <p className="text-sm text-on-surface-variant dark:text-gray-300 p-4 bg-surface-container-low dark:bg-[#1a1a1a] rounded-lg border border-outline-variant/10 dark:border-gray-700">
                    {selectedPerformanceForDetail.description}
                  </p>
                </div>
              )}

              {/* Status Summary */}
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wider mb-2">Status Summary</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-amber-700 dark:text-amber-300">Performers: <span className="font-bold">{selectedPerformanceForDetail.performance_borrowers?.length || 0}</span></p>
                  </div>
                  <div>
                    <p className="text-amber-700 dark:text-amber-300">Items: <span className="font-bold">{selectedPerformanceForDetail.performance_items?.length || 0}</span></p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Action Buttons */}
            <div className="border-t border-outline-variant/20 dark:border-gray-700 px-6 py-4 bg-surface-container-lowest dark:bg-[#1a1a1a] flex gap-3 sticky bottom-0">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  openEditForm(selectedPerformanceForDetail);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg hover:bg-primary/90 dark:hover:bg-blue-700 transition font-medium"
              >
                <Edit className="w-4 h-4" />
                Edit Performance
              </button>
              <button
                onClick={() => {
                  if (window.confirm('Delete this performance?')) {
                    handleDelete(selectedPerformanceForDetail.id);
                    setShowDetailModal(false);
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-error/20 dark:bg-red-900/30 text-error dark:text-red-400 border border-error/30 dark:border-red-800 rounded-lg hover:bg-error/30 dark:hover:bg-red-900/40 transition font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={() => setShowDetailModal(false)}
                className="flex-1 px-4 py-2.5 bg-surface-container-low dark:bg-[#2a2a2a] text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 rounded-lg hover:bg-surface-container-high dark:hover:bg-[#333] transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </PageLayout>
  );
}

