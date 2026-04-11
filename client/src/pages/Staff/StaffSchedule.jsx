import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useNavigate } from 'react-router-dom';
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
  const [formStep, setFormStep] = useState(0); // 0=date+time, 1=borrowers, 2=items, 3=review
  const [expandedPerformance, setExpandedPerformance] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '', // For title/brief info only
    location: '',
    date: null,
    start_time: '09:00',
    end_time: '10:00',
    selectedBorrowers: [], // Array of {id, num_dancers}
    dancers: { male: 0, female: 0, all: 0 }, // Dancer counts
    items: []
  });
  const [newItem, setNewItem] = useState({ inventory_item_id: '', size: null, quantity: 1 });
  const [itemSearch, setItemSearch] = useState('');
  const [timeOptions, setTimeOptions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDetailsReadOnly, setIsDetailsReadOnly] = useState(false); // ✅ NEW: Track if items added to cart
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
  const [selectedPerformance, setSelectedPerformance] = useState(null);
  const [inventoryRefreshCount, setInventoryRefreshCount] = useState(0);
  const [itemUnitCounter, setItemUnitCounter] = useState({}); // Track unit numbers per item type
  const [expandedItemGroups, setExpandedItemGroups] = useState({}); // Track expanded item groups {itemId: bool}
  const [itemsSearchQuery, setItemsSearchQuery] = useState(''); // Search items by name or unit_number
  const [searchQuery, setSearchQuery] = useState(''); // Search performances by title
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [groupedPerformances, setGroupedPerformances] = useState([]);

  useEffect(() => {
    fetchPerformances();
    fetchInventoryItems();
    fetchBorrowers();
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

  // Group performances by date whenever performances change or search updates
  useEffect(() => {
    let filtered = performances;
    
    // Filter by search query
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter((p) =>
        (p.title || '').toLowerCase().includes(searchLower) ||
        (p.description || '').toLowerCase().includes(searchLower) ||
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
    
    // Sort by date descending
    const arr = Object.entries(groups)
      .map(([day, perfs]) => ({ day, performances: perfs }))
      .sort((a, b) => new Date(b.day) - new Date(a.day));
    
    setGroupedPerformances(arr);
  }, [performances, searchQuery]);

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
    setForm({
      title: '',
      description: '',
      location: '',
      date: null,
      start_time: '09:00',
      end_time: '10:00',
      selectedBorrowers: [],
      dancers: { male: 0, female: 0, all: 0 },
      items: []
    });
    setItemUnitCounter({}); // Reset unit counter
    setNewItem({ inventory_item_id: '', size: null, quantity: 1 });
    setItemsSearchQuery(''); // Reset search
    setExpandedItemGroups({}); // Reset expanded groups
    setIsFormModalOpen(true);
  };

  const openEditForm = (p) => {
    setEditing(p.id);
    setFormStep(0);
    const startDayjs = dayjs(p.start_time);
    const endDayjs = dayjs(p.end_time);
    
    // Convert dancers array to object format {male: X, female: Y, all: Z}
    const dancersObj = { male: 0, female: 0, all: 0 };
    if (p.dancers && Array.isArray(p.dancers)) {
      p.dancers.forEach(d => {
        if (d.dance_type === 'male' || d.dance_type === 'female' || d.dance_type === 'all') {
          dancersObj[d.dance_type] = d.num_dancers || 0;
        }
      });
    }
    
    // Restore unit counters from existing items
    const counters = {};
    if (p.items && Array.isArray(p.items)) {
      p.items.forEach(item => {
        const key = item.inventory_item_id;
        counters[key] = (counters[key] || 0) + 1;
      });
    }
    setItemUnitCounter(counters);
    
    setForm({
      title: p.title || '',
      description: p.description || '',
      location: p.location || '',
      date: new Date(p.start_time),
      start_time: startDayjs.format('HH:mm'),
      end_time: endDayjs.format('HH:mm'),
      selectedBorrowers: p.selectedBorrowers || [],
      dancers: dancersObj,
      items: p.items || []
    });
    setNewItem({ inventory_item_id: '', size: null, quantity: 1 });
    setItemsSearchQuery(''); // Reset search
    setExpandedItemGroups({}); // Reset expanded groups
    setIsFormModalOpen(true);
  };

  const openDetailsModal = (perf) => {
    // ✅ UPDATED: Check if this performance was already added to cart
    const wasAdded = addedPerformanceIds.has(perf.id);
    setIsDetailsReadOnly(wasAdded);
    
    setSelectedPerformance(perf);
    setIsDetailsModalOpen(true);
    setItemsSearchQuery(''); // Reset search
    setExpandedItemGroups({}); // Reset expanded groups
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

      // Extract borrower IDs from the new format {id, num_dancers}
      const borrowerIds = form.selectedBorrowers.map(b => typeof b === 'object' ? b.id : b);

      // Convert dancers object to array format for backend
      const dancersArray = [];
      if (form.dancers.male > 0) dancersArray.push({ dance_type: 'male', num_dancers: form.dancers.male });
      if (form.dancers.female > 0) dancersArray.push({ dance_type: 'female', num_dancers: form.dancers.female });
      if (form.dancers.all > 0) dancersArray.push({ dance_type: 'all', num_dancers: form.dancers.all });

      const payload = {
        title: form.title,
        description: form.description,
        location: form.location,
        start_time: start,
        end_time: end,
        selectedBorrowers: borrowerIds,
        dancers: dancersArray,
        items: form.items
      };

      if (editing) {
        await axios.put(`/api/performances/${editing}`, payload);
        toast.success('Performance updated');
      } else {
        await axios.post('/api/performances', payload);
        toast.success('Performance created');
      }

      // Add items to cart automatically after performance is saved
      if (form.items && form.items.length > 0) {
        for (const item of form.items) {
          try {
            await addItemToCart(item);
          } catch (cartErr) {
            console.error('Failed to add item to cart:', cartErr);
          }
        }
      }

      fetchPerformances();
      // Refresh inventory to sync available items
      setInventoryRefreshCount(prev => prev + 1);
      setIsFormModalOpen(false);
      openNewForm();
    } catch (err) {
      console.error('Save failed:', err.response?.data || err.message);
      toast.error('Save failed');
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
      setIsDetailsModalOpen(false);
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
        // ✅ NEW: Set modal to read-only after successful add
        setIsDetailsReadOnly(true);
        
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

  const totalSchedules = performances.length;
  const upcomingSchedules = performances.filter((p) => new Date(p.start_time) > new Date()).length;
  const todaySchedules = performances.filter((p) => new Date(p.start_time).toDateString() === new Date().toDateString()).length;
  const pastSchedules = performances.filter((p) => new Date(p.start_time) < new Date()).length;

  return (
    <PageLayout>
      <div className="dark:bg-[#171717]">
        {/* ========== Header Section ========== */}
        <div className="px-6 md:px-8 lg:px-12 pt-8 pb-6 dark:bg-[#171717]">
          <div className="flex items-start justify-between gap-6">
            {/* Left Side - Title */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-2">Performance Schedule</h1>
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">Manage and schedule performances</p>
            </div>

            {/* Right Side - Summary Pills */}
            <div className="flex gap-3 flex-wrap items-center justify-end">
              <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Total: <span className="font-bold text-primary dark:text-blue-400">{performances.length}</span>
              </div>
              <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Upcoming: <span className="font-bold text-primary dark:text-blue-400">{upcomingSchedules}</span>
              </div>
              <div className="px-4 py-2 bg-surface-container-low dark:bg-[#222] rounded-full text-sm font-medium text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 whitespace-nowrap">
                Today: <span className="font-bold text-warning dark:text-orange-400">{todaySchedules}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========== Action Bar ========== */}
        <div className="px-6 md:px-8 lg:px-12 pb-6">
          <button
            onClick={openNewForm}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary rounded-lg hover:bg-primary-container transition font-medium text-sm shadow-sm"
          >
            <Plus className="w-5 h-5" />
            New Schedule
          </button>
        </div>

        {/* ========== Main Content Area ========== */}
        <div className="px-6 md:px-8 lg:px-12 space-y-4 dark:bg-[#171717]">
          {/* Full Width Search Bar */}
          <div className="flex items-center gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-4 py-3 border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-gray-600 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition shadow-sm dark:shadow-black/40">
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

          {/* Performances List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-on-surface-variant dark:text-gray-400">Loading performances...</div>
            </div>
          ) : groupedPerformances.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarIcon className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-on-surface-variant dark:text-gray-400 text-sm">No performances scheduled</p>
              <p className="text-on-surface-variant dark:text-gray-500 text-xs mt-2">Create one to get started</p>
            </div>
          ) : (
            <div className="space-y-8">
              {groupedPerformances.map((group) => (
                <div key={group.day} className="space-y-4">
                  {/* Sticky Date Header */}
                  <div className="sticky top-20 bg-surface-container-lowest dark:bg-[#1a1a1a] z-10 pt-2 pb-4">
                    <div className="flex items-center gap-4">
                      <p className="text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase tracking-widest">
                        {new Date(group.day).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <div className="flex-1 h-px bg-outline-variant/20 dark:bg-gray-700"></div>
                    </div>
                  </div>

                  {/* Performance Cards */}
                  <div className="space-y-3">
                    {group.performances.map((perf) => {
                      const isExpanded = expandedPerformance === perf.id;

                      return (
                        <div
                          key={perf.id}
                          className="bg-surface-container-low dark:bg-[#222] rounded-xl border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-gray-600 transition-all shadow-sm dark:shadow-black/40 hover:shadow-md dark:hover:shadow-black/60 overflow-hidden"
                        >
                          {/* Collapsed Header */}
                          <button
                            onClick={() => setExpandedPerformance(isExpanded ? null : perf.id)}
                            className="w-full p-4 flex items-center gap-4 hover:bg-surface-container-high dark:hover:bg-[#2a2a2a] transition-colors text-left"
                          >
                            {/* Icon/Avatar */}
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/15 dark:bg-blue-900/30 flex items-center justify-center border border-primary/20 dark:border-blue-800">
                              <Clock className="w-5 h-5 text-primary dark:text-blue-400" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-on-surface dark:text-white text-sm">{perf.title}</p>
                              <p className="text-xs text-on-surface-variant dark:text-gray-400">
                                {dayjs(perf.start_time).format('h:mm A')} — {dayjs(perf.end_time).format('h:mm A')}
                                {perf.location && ` • ${perf.location}`}
                              </p>
                            </div>

                            {/* Item Count */}
                            <div className="flex items-center gap-3">
                              {perf.items && perf.items.length > 0 && (
                                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/15 dark:bg-blue-900/30 text-primary dark:text-blue-400">
                                  {perf.items.length} item{perf.items.length !== 1 ? 's' : ''}
                                </span>
                              )}
                              <ChevronRight
                                className={`w-5 h-5 text-on-surface-variant dark:text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              />
                            </div>
                          </button>

                          {/* Expanded Details - Two Column Layout */}
                          <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${
                              isExpanded ? 'max-h-full' : 'max-h-0'
                            }`}
                          >
                            <div className="border-t dark:border-gray-700 border-outline-variant/20 p-4 bg-surface-container-lowest/50 dark:bg-[#1a1a1a]/80 space-y-4">
                              {/* Details Section */}
                              <div className="space-y-3">
                                {/* Date & Time */}
                                <div className="flex items-center gap-3">
                                  <Clock className="w-4 h-4 text-on-surface-variant dark:text-gray-400" />
                                  <div>
                                    <p className="text-xs font-medium text-on-surface-variant dark:text-gray-400">TIME</p>
                                    <p className="text-sm text-on-surface dark:text-white">{dayjs(perf.start_time).format('MMM D, YYYY h:mm A')} — {dayjs(perf.end_time).format('h:mm A')}</p>
                                  </div>
                                </div>

                                {/* Location */}
                                {perf.location && (
                                  <div className="flex items-center gap-3">
                                    <p className="text-xs font-medium text-on-surface-variant dark:text-gray-400">📍 LOCATION</p>
                                    <p className="text-sm text-on-surface dark:text-white">{perf.location}</p>
                                  </div>
                                )}

                                {/* Description */}
                                {perf.description && (
                                  <div>
                                    <p className="text-xs font-medium text-on-surface-variant dark:text-gray-400 mb-1">DESCRIPTION</p>
                                    <p className="text-sm text-on-surface dark:text-white">{perf.description}</p>
                                  </div>
                                )}

                                {/* Dancers */}
                                {perf.dancers && perf.dancers.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-on-surface-variant dark:text-gray-400 mb-2">DANCERS NEEDED</p>
                                    <div className="grid grid-cols-3 gap-2">
                                      {perf.dancers.map((d, idx) => (
                                        <div key={idx} className="px-3 py-2 bg-surface-container-low dark:bg-[#2a2a2a] rounded-lg border border-outline-variant/20 dark:border-gray-700">
                                          <p className="text-xs text-on-surface-variant dark:text-gray-400 capitalize">{d.dance_type}</p>
                                          <p className="text-sm font-bold text-on-surface dark:text-white">{d.num_dancers}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Items Needed */}
                                {perf.items && perf.items.length > 0 && (
                                  <div className="bg-surface-container-low dark:bg-[#2a2a2a] rounded-lg p-3 border border-outline-variant/20 dark:border-gray-700">
                                    <p className="text-xs font-bold text-on-surface-variant dark:text-gray-400 uppercase tracking-wide mb-2">Items ({perf.items.length})</p>
                                    <div className="space-y-1 max-h-32 overflow-y-auto">
                                      {groupItemsByType(perf.items).map((group) => (
                                        <div key={group.inventory_item_id} className="text-xs text-on-surface dark:text-white">
                                          <p className="font-medium">{group.name}</p>
                                          <p className="text-on-surface-variant dark:text-gray-400 text-xs ml-2">{group.units.length} unit(s)</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-2 pt-2 border-t dark:border-gray-700 border-outline-variant/20">
                                <button
                                  onClick={() => openDetailsModal(perf)}
                                  className="flex-1 px-3 py-2 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg font-medium text-xs hover:bg-primary-container dark:hover:bg-blue-700 transition-all"
                                >
                                  View Details
                                </button>
                                <button
                                  onClick={() => openEditForm(perf)}
                                  className="flex-1 px-3 py-2 bg-surface-container-low dark:bg-[#2a2a2a] border border-outline-variant/20 dark:border-gray-700 text-on-surface dark:text-white rounded-lg font-medium text-xs hover:bg-surface-container-high dark:hover:bg-[#333] transition-all"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm('Delete this performance?')) {
                                      handleDelete(perf.id);
                                    }
                                  }}
                                  className="px-3 py-2 bg-error/15 dark:bg-red-900/30 text-error dark:text-red-400 rounded-lg font-medium text-xs hover:bg-error/25 dark:hover:bg-red-900/40 transition-all"
                                >
                                  Delete
                                </button>
                              </div>
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

      {/* Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-[#222] rounded-xl shadow-2xl dark:shadow-black/60 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-primary dark:bg-blue-600 px-6 py-4 flex items-center justify-between sticky top-0">
              <h2 className="text-lg font-bold text-on-primary dark:text-white">{editing ? 'Edit' : 'New'} Performance - Step {formStep + 1} of 4</h2>
              <button
                className="text-on-primary dark:text-white hover:opacity-80 text-2xl transition"
                onClick={() => setIsFormModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={formStep === 3 ? handleSubmit : (e) => { e.preventDefault(); setFormStep(formStep + 1); }} className="p-6 space-y-4 dark:bg-[#222]">
              
              {/* STEP 0: SELECT DATE & TIME RANGE */}
              {formStep === 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📅 Select Date & Time Range</h3>
                  
                  {/* Calendar */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-3">Select Date</p>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <Calendar
                        onClickDay={(date) => setForm({ ...form, date })}
                        value={form.date}
                        minDate={new Date()}
                        firstDayOfWeek={0}
                        tileClassName={({ date }) =>
                          form.date && date.toDateString() === form.date.toDateString()
                            ? 'bg-green-500 text-white rounded-full font-bold'
                            : null
                        }
                      />
                    </div>
                    {form.date && (
                      <p className="text-sm text-green-600 mt-3 font-medium">
                        ✓ Selected: {dayjs(form.date).format('MMMM D, YYYY')}
                      </p>
                    )}
                  </div>

                  {/* Time Range */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3">🕐 Select Time Range</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">Start Time</label>
                        <select
                          value={form.start_time}
                          onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                          className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="">Select Start Time</option>
                          {timeOptions.map(time => (
                            <option key={`start-${time.value}`} value={time.value}>{time.display}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">End Time</label>
                        <select
                          value={form.end_time}
                          onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                          className="w-full border border-gray-300 px-4 py-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        >
                          <option value="">Select End Time</option>
                          {timeOptions.map(time => (
                            <option key={`end-${time.value}`} value={time.value}>{time.display}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {form.start_time && form.end_time && (
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mt-3">
                        <p className="text-sm text-blue-900">
                          <strong>Summary:</strong> {dayjs(form.date).format('MMMM D, YYYY')} from {form.start_time} to {form.end_time}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 1: SELECT BORROWERS */}
              {formStep === 1 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">👥 Select Borrowers (Performers)</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Who will perform at this event? Add number of dancers for each.</p>
                  <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 dark:bg-[#1a1a1a] rounded-lg p-3 bg-gray-50">
                    {borrowers.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">No borrowers available</p>
                    ) : (
                      borrowers.map(borrower => {
                        const isSelected = form.selectedBorrowers.some(b => b.id === borrower.id);
                        const selectedBorrower = form.selectedBorrowers.find(b => b.id === borrower.id);
                        return (
                          <div key={borrower.id} className="flex items-center gap-3 p-3 bg-white dark:bg-[#2a2a2a] rounded border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600 transition">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setForm({
                                    ...form,
                                    selectedBorrowers: [...form.selectedBorrowers, { id: borrower.id, num_dancers: 1 }]
                                  });
                                } else {
                                  setForm({
                                    ...form,
                                    selectedBorrowers: form.selectedBorrowers.filter(b => b.id !== borrower.id)
                                  });
                                }
                              }}
                              className="w-5 h-5 text-green-600 rounded cursor-pointer"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{borrower.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{borrower.email}</p>
                            </div>
                            {isSelected && (
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Dancers:</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={selectedBorrower?.num_dancers || 1}
                                  onChange={(e) => {
                                    const newNum = parseInt(e.target.value) || 1;
                                    setForm({
                                      ...form,
                                      selectedBorrowers: form.selectedBorrowers.map(b =>
                                        b.id === borrower.id ? { ...b, num_dancers: newNum } : b
                                      )
                                    });
                                  }}
                                  className="w-16 border border-gray-300 px-2 py-1 rounded text-sm focus:ring-2 focus:ring-green-500"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  {form.selectedBorrowers.length > 0 && (
                    <div className="mt-4 bg-green-50 p-3 rounded-lg border border-green-200">
                      <p className="text-sm text-green-900 font-medium">✓ {form.selectedBorrowers.length} performer(s) selected</p>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: ADD DETAILS AND ITEMS */}
              {formStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📝 Performance Details</h3>
                    <input
                      required
                      placeholder="Performance Title"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-3"
                    />
                    <input
                      placeholder="Location"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent mb-3"
                    />
                    <textarea
                      placeholder="Brief Description (optional)"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full border border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      rows={2}
                    />
                  </div>

                  {/* Dancers Section */}
                  <div className="border-t dark:border-gray-700 pt-4">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">💃 Number of Dancers Needed</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">Specify how many dancers are needed for this performance</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">Male Dancers</label>
                        <input
                          type="number"
                          min="0"
                          value={form.dancers.male}
                          onChange={(e) => setForm({
                            ...form,
                            dancers: { ...form.dancers, male: parseInt(e.target.value) || 0 }
                          })}
                          className="w-full border border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">Female Dancers</label>
                        <input
                          type="number"
                          min="0"
                          value={form.dancers.female}
                          onChange={(e) => setForm({
                            ...form,
                            dancers: { ...form.dancers, female: parseInt(e.target.value) || 0 }
                          })}
                          className="w-full border border-gray-300 dark:border-gray-600 dark:bg-[#1a1a1a] dark:text-white px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 block">Any Gender</label>
                        <input
                          type="number"
                          min="0"
                          value={form.dancers.all}
                          onChange={(e) => setForm({
                            ...form,
                            dancers: { ...form.dancers, all: parseInt(e.target.value) || 0 }
                          })}
                          className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    {(form.dancers.male > 0 || form.dancers.female > 0 || form.dancers.all > 0) && (
                      <div className="mt-3 bg-green-50 p-2 rounded text-xs text-green-700">
                        ✓ Total: {form.dancers.male + form.dancers.female + form.dancers.all} dancers needed
                      </div>
                    )}
                  </div>

                  {/* Items Section */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-900 mb-3">📦 Items Needed for Performance</h4>
                    <p className="text-sm text-gray-600 mb-4">Select items needed. You can add multiple quantities or sizes of the same item.</p>
                    
                    {/* Search Bar */}
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by item name or unit_number (e.g., Suyam or Suyam-S-1)..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="w-full border border-gray-300 pl-10 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                      />
                    </div>

                    {/* ✅ UPDATED: Items Grid shows INDIVIDUAL UNITS (like AvailableItems) */}
                    <div className="space-y-2 mb-4 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                      {inventoryItems
                        .flatMap(item => {
                          // ✅ NEW: Flatten to show individual units instead of generic quantity
                          const itemsBySize = {
                            small: [],
                            medium: [],
                            large: []
                          };
                          
                          // If we have detailed units array, use it
                          if (item.units && Array.isArray(item.units) && item.units.length > 0) {
                            item.units.forEach(unit => {
                              const rawSize = unit.size?.toLowerCase() || unit.size_category?.toLowerCase() || 'small';
                              // ✅ FIX: Normalize size to valid keys, default to 'small' if unknown
                              const size = ['small', 'medium', 'large'].includes(rawSize) ? rawSize : 'small';
                              if (!itemsBySize[size]) {
                                itemsBySize[size] = [];
                              }
                              itemsBySize[size].push(unit);
                            });
                          } else {
                            // Fallback: estimate units by size breakdown
                            const sizes = ['small', 'medium', 'large'];
                            sizes.forEach(size => {
                              const qty = item[`qty_${size}`] || 0;
                              for (let i = 1; i <= qty; i++) {
                                itemsBySize[size].push({
                                  id: `${item.id}-${size}-${i}`,
                                  unit_number: `${item.name}-${size.charAt(0).toUpperCase()}-${i}`,
                                  size: size,
                                  inventory_item_id: item.id,
                                  item_name: item.name
                                });
                              }
                            });
                          }
                          
                          // Flatten all units into a list
                          return Object.values(itemsBySize).flat().map((unit, idx) => ({
                            ...unit,
                            _itemId: item.id,
                            _itemName: item.name
                          }));
                        })
                        // ✅ NEW: Filter by search term - search both item name and unit_number
                        .filter(unit => {
                          const searchTerm = itemSearch.toLowerCase();
                          const itemNameMatch = unit._itemName.toLowerCase().includes(searchTerm);
                          const unitNumberMatch = unit.unit_number?.toLowerCase().includes(searchTerm) || false;
                          return itemNameMatch || unitNumberMatch;
                        })
                        .map((unit, idx) => (
                          <div key={`${unit._itemId}-${unit.size}-${idx}`} className="bg-white p-3 rounded border border-gray-200 hover:border-green-300 transition">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                {/* ✅ NEW: Show unit_number prominently like AvailableItems */}
                                <p className="text-sm font-medium text-gray-900">🏷️ {unit.unit_number || `${unit._itemName}-${unit.size?.charAt(0).toUpperCase() || 'N'}`}</p>
                                <p className="text-xs text-gray-600 mt-1">{unit._itemName}</p>
                                <p className="text-xs text-gray-500 mt-1">Size: <strong>{unit.size?.charAt(0).toUpperCase() + unit.size?.slice(1) || 'Standard'}</strong></p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  // ✅ UPDATED: Directly add item without form section
                                  const uniqueItemId = `${unit.id}_${Date.now()}_${Math.random()}`;
                                  const sizeLabel = unit.size?.charAt(0).toUpperCase() || '';
                                  const unitNumberPart = unit.unit_number ? unit.unit_number.split('-').pop() : '1';
                                  const itemLabel = `${unit._itemName}${sizeLabel ? '-' + sizeLabel : ''}-${unitNumberPart}`;
                                  
                                  const newItemToAdd = {
                                    id: uniqueItemId,
                                    inventory_item_id: unit._itemId,
                                    unit_id: unit.id,
                                    name: unit._itemName,
                                    size: unit.size || 'nosize',
                                    unit_label: itemLabel,
                                    unit_number: unit.unit_number,
                                    quantity: 1
                                  };
                                  
                                  setForm(prev => ({
                                    ...prev,
                                    items: [...prev.items, newItemToAdd]
                                  }));
                                  
                                  toast.success(`Added ${unit._itemName} (${unit.unit_number}) to performance`);
                                }}
                                className="px-3 py-1 text-sm bg-primary text-on-primary rounded hover:bg-primary-container transition font-medium whitespace-nowrap"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        ))}
                      {inventoryItems.filter(item => item.name.toLowerCase().includes(itemSearch.toLowerCase())).length === 0 && (
                        <p className="text-gray-500 text-sm text-center py-4">No items found</p>
                      )}
                    </div>

                    {/* Item Form Section */}
                    <div data-items-form className="bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
                      {newItem.inventory_item_id ? (
                        <>
                          <p className="text-sm font-medium text-gray-900 mb-3">
                            Adding: <strong>{newItem.item_name || inventoryItems.find(i => i.id == newItem.inventory_item_id)?.name}</strong>
                            {newItem.unit_number && <span className="text-xs text-gray-600 ml-2">🏷️ {newItem.unit_number}</span>}
                          </p>
                          <div className="space-y-3">
                            {/* ✅ NEW: Show unit details if available */}
                            {newItem.unit_number && (
                              <div className="bg-white p-3 rounded border border-green-300">
                                <p className="text-xs text-gray-700"><strong>Unit:</strong> {newItem.unit_number}</p>
                                <p className="text-xs text-gray-700"><strong>Size:</strong> {newItem.size?.charAt(0).toUpperCase() + newItem.size?.slice(1) || 'Standard'}</p>
                              </div>
                            )}
                            {/* ✅ UPDATED: Size field is now read-only since we're adding individual units */}
                            {!newItem.unit_number && (
                              <div>
                                <label className="text-xs font-medium text-gray-700 block mb-2">Size (Optional)</label>
                                <select
                                  value={newItem.size || ''}
                                  onChange={(e) => setNewItem({ ...newItem, size: e.target.value || null })}
                                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                                >
                                  <option value="">No Size</option>
                                  <option value="small">Small</option>
                                  <option value="medium">Medium</option>
                                  <option value="large">Large</option>
                                </select>
                              </div>
                            )}
                            {/* ✅ NOTE: For individual units, quantity is typically 1 */}
                            {newItem.unit_number ? (
                              <input type="hidden" value="1" />
                            ) : (
                              <div>
                                <label className="text-xs font-medium text-gray-700 block mb-2">Quantity Needed</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={newItem.quantity}
                                  onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                                />
                                <p className="text-xs text-gray-600 mt-1">Available: {inventoryItems.find(i => i.id == newItem.inventory_item_id)?.quantity || 0} units</p>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={addItem}
                                className="flex-1 px-4 py-2 bg-primary text-on-primary rounded-lg hover:bg-primary-container text-sm font-medium transition"
                              >
                                ✓ Add to Performance
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewItem({ inventory_item_id: '', size: null, quantity: 1 })}
                                className="px-4 py-2 bg-surface-container-low text-on-surface border border-outline-variant/20 rounded-lg hover:bg-surface-container-high text-sm font-medium transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-600 text-center py-2">Click an item above to add it to the performance</p>
                      )}
                    </div>

                    {form.items.length > 0 && (
                      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-semibold text-purple-900">📦 Items in Performance</p>
                          <p className="text-xs text-purple-700 font-medium">{form.items.length} unit(s)</p>
                        </div>
                        
                        {/* ✅ NEW: Search bar for items */}
                        <div className="mb-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search by name or unit_number..."
                              value={itemsSearchQuery}
                              onChange={(e) => setItemsSearchQuery(e.target.value)}
                              className="w-full border border-purple-300 pl-10 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            {itemsSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setItemsSearchQuery('')}
                                className="absolute right-3 top-2.5 text-purple-600 hover:text-purple-800"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* ✅ NEW: Grouped items with expandable units */}
                        <div className="space-y-2">
                          {filterItemsBySearch(groupItemsByType(form.items)).map((itemGroup) => (
                            <div key={itemGroup.inventory_item_id} className="bg-white rounded border border-purple-200">
                              {/* Item Group Header - Clickable to expand */}
                              <button
                                type="button"
                                onClick={() => toggleItemGroup(itemGroup.inventory_item_id)}
                                className="w-full flex items-center justify-between p-3 hover:bg-purple-50 transition"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <div className={`transform transition ${expandedItemGroups[itemGroup.inventory_item_id] ? 'rotate-90' : ''}`}>
                                    <ChevronRight className="w-4 h-4 text-purple-600" />
                                  </div>
                                  <div className="text-left flex-1">
                                    <p className="text-sm font-semibold text-gray-900">{itemGroup.name}</p>
                                    <p className="text-xs text-purple-600">📦 {itemGroup.units.length} unit(s)</p>
                                  </div>
                                </div>
                                <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded">{itemGroup.units.length}</span>
                              </button>

                              {/* Expanded Units List */}
                              {expandedItemGroups[itemGroup.inventory_item_id] && (
                                <div className="border-t border-purple-200 bg-purple-50 p-3 space-y-2">
                                  {itemGroup.units.map((unit, unitIdx) => (
                                    <div key={unit.id || unitIdx} className="flex items-center justify-between bg-white p-2 rounded border border-purple-100">
                                      <div className="flex-1 min-w-0">
                                        {/* ✅ UPDATED: Show unit_number prominently */}
                                        <p className="text-sm font-bold text-purple-700">
                                          🏷️ {unit.unit_number || unit.unit_label || `Unit ${unitIdx + 1}`}
                                        </p>
                                        <div className="flex gap-3 mt-1 flex-wrap">
                                          {unit.size && unit.size !== 'nosize' && (
                                            <p className="text-xs text-gray-600">Size: <strong>{unit.size.charAt(0).toUpperCase() + unit.size.slice(1)}</strong></p>
                                          )}
                                          
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => removeItem(unit.id)}
                                        className="ml-2 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition flex-shrink-0"
                                        title="Remove unit"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                          {form.items.length > 0 && filterItemsBySearch(groupItemsByType(form.items)).length === 0 && (
                            <p className="text-sm text-purple-600 text-center py-2">No items match your search</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW AND SAVE */}
              {formStep === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">✓ Review Performance</h3>
                  
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-900"><strong>Date & Time:</strong> {dayjs(form.date).format('MMMM D, YYYY')} | {form.start_time} - {form.end_time}</p>
                    <p className="text-sm text-blue-900 mt-1"><strong>Performers:</strong> {form.selectedBorrowers.length} borrower(s) selected</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">📋 Title & Details</p>
                    <p className="text-sm text-gray-900 p-2 bg-gray-50 rounded">{form.title || '(No title)'}</p>
                  </div>

                  {(form.dancers.male > 0 || form.dancers.female > 0 || form.dancers.all > 0) && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">💃 Dancers Needed</p>
                      <div className="bg-purple-50 p-3 rounded border border-purple-200">
                        <p className="text-sm text-gray-700">👨 Male: {form.dancers.male}</p>
                        <p className="text-sm text-gray-700">👩 Female: {form.dancers.female}</p>
                        <p className="text-sm text-gray-700">👥 Any Gender: {form.dancers.all}</p>
                      </div>
                    </div>
                  )}

                  {form.items.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">📦 Items Needed ({form.items.length} units)</p>
                      <div className="space-y-2">
                        {groupItemsByType(form.items).map((itemGroup) => (
                          <div key={itemGroup.inventory_item_id} className="p-3 bg-purple-50 rounded border border-purple-200">
                            <p className="text-sm text-gray-700 font-medium">{itemGroup.name}</p>
                            <p className="text-xs text-purple-600 mt-1">🏆 {itemGroup.units.length} unit(s) needed</p>
                            <div className="mt-2 space-y-1">
                              {itemGroup.units.map((unit, idx) => (
                                <div key={unit.id || idx} className="text-xs text-gray-600 bg-white p-1.5 rounded">
                                  <span className="font-medium">{unit.unit_label || `Unit ${idx + 1}`}</span>
                                  {unit.size && unit.size !== 'nosize' && <span> • Size: {unit.size}</span>}
                                  {unit.unit_number && <span className="text-purple-600 font-semibold"> • {unit.unit_number}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    Back
                  </button>
                )}
                {formStep < 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (formStep === 0 && !form.date) {
                        toast.error('Please select a date');
                        return;
                      }
                      if (formStep === 0 && !form.start_time) {
                        toast.error('Please select start time');
                        return;
                      }
                      if (formStep === 0 && !form.end_time) {
                        toast.error('Please select end time');
                        return;
                      }
                      if (formStep === 1 && form.selectedBorrowers.length === 0) {
                        toast.error('Please select at least one performer');
                        return;
                      }
                      if (formStep === 2 && !form.title) {
                        toast.error('Please enter performance title');
                        return;
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
                    className="flex-1 px-4 py-2 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg hover:bg-primary-container dark:hover:bg-blue-700 transition font-medium"
                  >
                    Save Performance
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {isDetailsModalOpen && selectedPerformance && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-[#222] rounded-xl shadow-2xl dark:shadow-black/60 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-primary dark:bg-blue-600 px-6 py-4 flex items-center justify-between sticky top-0">
              <h2 className="text-lg font-bold text-on-primary dark:text-white">{selectedPerformance.title}</h2>
              <button
                className="text-on-primary dark:text-white hover:opacity-80 text-2xl transition"
                onClick={() => setIsDetailsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 dark:bg-[#222]">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">TIME</p>
                <p className="text-sm text-gray-900 dark:text-white">{dayjs(selectedPerformance.start_time).format('MMM D, YYYY h:mm A')} — {dayjs(selectedPerformance.end_time).format('h:mm A')}</p>
              </div>

              {selectedPerformance.location && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">LOCATION</p>
                  <p className="text-sm text-gray-900 dark:text-white">📍 {selectedPerformance.location}</p>
                </div>
              )}

              {selectedPerformance.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">DESCRIPTION</p>
                  <p className="text-sm text-gray-900 dark:text-white">{selectedPerformance.description}</p>
                </div>
              )}

              {selectedPerformance.items && selectedPerformance.items.length > 0 && (
                <div className="bg-purple-50 dark:bg-[#2a2a2a] rounded-lg p-4 border border-purple-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">📦 Items Needed</p>
                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">{selectedPerformance.items.length} units</span>
                  </div>
                  
                  {/* ✅ NEW: Search bar for items in details */}
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <input
                        type="text"
                        placeholder="Search by name or unit_number..."
                        value={itemsSearchQuery}
                        onChange={(e) => setItemsSearchQuery(e.target.value)}
                        className="w-full border border-purple-300 dark:border-gray-600 dark:bg-[#1a1a1a] pl-10 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 dark:text-white dark:placeholder-gray-500 focus:border-transparent"
                      />
                      {itemsSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setItemsSearchQuery('')}
                          className="absolute right-3 top-2.5 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ✅ NEW: Grouped items display */}
                  <div className="space-y-2">
                    {filterItemsBySearch(groupItemsByType(selectedPerformance.items)).map((itemGroup) => (
                      <div key={itemGroup.inventory_item_id} className="bg-white dark:bg-[#1a1a1a] rounded border border-purple-200 dark:border-gray-700">
                        {/* Item Group Header - Clickable to expand */}
                        <button
                          type="button"
                          onClick={() => toggleItemGroup(itemGroup.inventory_item_id)}
                          className="w-full flex items-center justify-between p-3 hover:bg-purple-50 dark:hover:bg-[#2a2a2a] transition text-left"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`transform transition ${expandedItemGroups[itemGroup.inventory_item_id] ? 'rotate-90' : ''}`}>
                              <ChevronRight className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{itemGroup.name}</p>
                              <p className="text-xs text-purple-600 dark:text-purple-400">📦 {itemGroup.units.length} unit(s)</p>
                            </div>
                          </div>
                          <span className="text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">{itemGroup.units.length}</span>
                        </button>

                        {/* Expanded Units List */}
                        {expandedItemGroups[itemGroup.inventory_item_id] && (
                          <div className="border-t dark:border-gray-700 border-purple-200 bg-purple-50 dark:bg-[#2a2a2a] p-3 space-y-2">
                            {itemGroup.units.map((unit, unitIdx) => (
                              <div key={unit.id || unitIdx} className="p-2 rounded border border-purple-100 dark:border-gray-700 bg-white dark:bg-[#1a1a1a]">
                                <p className="text-xs font-medium text-gray-900 dark:text-white">
                                  {unit.unit_label || `Unit ${unitIdx + 1}`}
                                </p>
                                <div className="flex gap-3 mt-1">
                                  {unit.size && unit.size !== 'nosize' && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400">📋 Size: <strong>{unit.size}</strong></p>
                                  )}
                                  {unit.unit_number && (
                                    <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold">🔖 {unit.unit_number}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {selectedPerformance.items.length > 0 && filterItemsBySearch(groupItemsByType(selectedPerformance.items)).length === 0 && (
                      <p className="text-sm text-purple-600 text-center py-2">No items match your search</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 border-t pt-4">
                {!isDetailsReadOnly ? (
                  <>
                    <button
                      onClick={addPerformanceToCart}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary dark:bg-blue-600 text-on-primary dark:text-white rounded-lg hover:bg-primary-container dark:hover:bg-blue-700 transition font-medium"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Add All to Cart
                    </button>
                    <button
                      onClick={() => {
                        setIsDetailsModalOpen(false);
                        openEditForm(selectedPerformance);
                      }}
                      className="flex-1 px-4 py-2 bg-surface-container-low dark:bg-[#2a2a2a] text-on-surface dark:text-white border border-outline-variant/20 dark:border-gray-700 rounded-lg hover:bg-surface-container-high dark:hover:bg-[#333] transition font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        handleDelete(selectedPerformance.id);
                      }}
                      className="flex-1 px-4 py-2 bg-error/15 dark:bg-red-900/30 text-error dark:text-red-400 rounded-lg hover:bg-error/25 dark:hover:bg-red-900/40 transition font-medium"
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  // ✅ NEW: Read-only state after adding to cart
                  <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-800 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">Items Already Added</p>
                      <p className="text-xs text-green-700 dark:text-green-400">View only</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
