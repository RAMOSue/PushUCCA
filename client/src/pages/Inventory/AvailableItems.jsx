// src/pages/AvailableItems.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Package, Music, X, ChevronRight } from 'lucide-react';
import axios from 'axios';
import PageLayout from '../../components/layout/PageLayout.jsx';
import AddToCartModal from '../../components/modals/AddToCartModal.jsx';
import { UserContext } from '../../../context/userContext.jsx';
import { BorrowingContext } from '../../../context/borrowingContext.jsx';

export default function AvailableItems() {
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState("Dulimbay");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddToCartModal, setShowAddToCartModal] = useState(false);
  const [addedItemName, setAddedItemName] = useState("");
  const [selectedUnits, setSelectedUnits] = useState([]);
  const [unitSearchQuery, setUnitSearchQuery] = useState("");
  const [activeSizeFilter, setActiveSizeFilter] = useState(null);

  const { user, loading } = useContext(UserContext);
  const { addToCart, refreshAvailableItems, cart } = useContext(BorrowingContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) {
      // Redirect staff/admin away from borrower route to their staff route
      if ((user.role === 'admin' || user.role === 'staff') && location.pathname === '/available-items') {
        navigate('/staff/available-items', { replace: true });
        return;
      }
      // Redirect borrowers away from staff route to borrower route
      if (user.role === 'borrower' && location.pathname.startsWith('/staff/available-items')) {
        navigate('/available-items', { replace: true });
        return;
      }
      // Redirect invalid roles to login
      if (user.role !== 'admin' && user.role !== 'staff' && user.role !== 'borrower') {
        navigate('/login');
      }
    }
  }, [loading, user, navigate, location.pathname]);

  // Fetch recommendations for borrower
  const fetchRecommendations = async () => {
    try {
      if (!user?.id) return; // Skip if user not loaded
      await axios.get(`/api/performances/recommendations/${user.id}`, { 
        withCredentials: true 
      });
    } catch (error) {
      // Silently fail - recommendations are optional
      if (error.response?.status !== 404) {
        console.error('Error fetching recommendations:', error);
      }
    }
  };

  const fetchItems = async () => {
    try {
      const { data } = await axios.get('/api/inventory/');
      setItems(data);
      // Only fetch recommendations if user is loaded and is a borrower
      if (user?.id && user?.role === 'borrower') {
        fetchRecommendations();
      }
    } catch (error) {
      console.error('Error fetching items:', error.response?.data || error.message);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    // Only fetch items when user is loaded
    if (!loading) {
      fetchItems();
    }
  }, [loading, user?.id, user?.role, refreshAvailableItems]);

  const openModal = (item) => {
    setSelectedItem(item);
    setSelectedUnits([]);
    setUnitSearchQuery("");
  };

  const closeModal = () => {
    setSelectedItem(null);
    setSelectedUnits([]);
    setUnitSearchQuery("");
    setActiveSizeFilter(null);
  };

  const handleAddToCart = async (item) => {
    // Unified flow: Works for all authenticated users (staff, admin, borrower)
    // Requires selectedUnits to be set from modal selection
    if (selectedUnits.length === 0) {
      // Fallback for borrowers clicking Borrow button directly (auto-select first unit)
      const selectableUnits = item.units?.filter(u => u.status === 'available') || [];
      if (selectableUnits.length === 0) {
        alert('No units available');
        return;
      }
      // Auto-select first available unit
      setSelectedUnits([selectableUnits[0]]);
      return; // Exit - user should confirm in modal
    }

    // Process all selected units with proper error handling and no duplicate toasts
    let successCount = 0;
    let failureCount = 0;
    const addedUnitNumbers = [];
    const failedUnits = [];

    // ✅ Add units sequentially with server-side deduplication to prevent race conditions
    for (const unit of selectedUnits) {
      try {
        const result = await addToCart({
          itemId: item.id,
          unitId: unit.id,
          name: item.name,
          image_url: item.image_url,
          category: item.category,
          garment_type: item.garment_type,
          size: unit.size || "nosize",
          status: 'available',
          unit_number: unit.unit_number // ✅ Include unit_number for tracking
        }, { suppressToast: true }); // ✅ Suppress individual toasts during bulk add

        if (result?.success) {
          successCount++;
          addedUnitNumbers.push(unit.unit_number || unit.id.substring(0, 8));
        } else {
          failureCount++;
          failedUnits.push(unit.unit_number || unit.id.substring(0, 8));
        }
      } catch (err) {
        console.error(`Failed to add unit ${unit.unit_number}:`, err);
        failureCount++;
        failedUnits.push(unit.unit_number || unit.id.substring(0, 8));
      }
    }

    // Show consolidated notification
    if (successCount > 0) {
      const displayName = selectedUnits.length > 1 
        ? `${item.name}\n${addedUnitNumbers.map(n => `✓ Unit ${n}`).join('\n')}${failureCount > 0 ? `\n\n⚠️ Failed: ${failedUnits.join(', ')}` : ''}`
        : item.name;
      setAddedItemName(displayName);
      setShowAddToCartModal(true);
      closeModal();
    } else {
      // All failed
      alert(`Failed to add units: ${failedUnits.join(', ')}`);
    }
  };

  if (loading || loadingItems)
    return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <div className="h-screen flex items-center justify-center">Not authenticated</div>;

  // ============ STAFF/ADMIN VIEW ============
  if (user?.role === 'admin' || user?.role === 'staff') {
    const GROUP_TABS = ["Dulimbay", "Budjong", "Kayam"];
    const groupFor = (item) => (item.collection_group || item.group || '').toString().trim() || 'Uncategorized';

    let filteredItems = items.filter(it => groupFor(it).toLowerCase() === selectedGroup.toLowerCase());

    if (selectedCategory) {
      filteredItems = filteredItems.filter(it =>
        (it.category || '').toString().toLowerCase().includes(selectedCategory.toLowerCase())
      );
    }

    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase();
      filteredItems = filteredItems.filter(it =>
        it.name?.toLowerCase().includes(searchLower)
      );
    }

    return (
      <PageLayout>
        <div className="min-h-screen bg-surface dark:bg-[#171717] transition-colors duration-300">
          {/* Header - Unified Styling */}
          <div className="px-6 md:px-8 lg:px-12 pt-8 pb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-2">
              Available Items
            </h1>
            <p className="text-on-surface-variant dark:text-gray-400 text-sm">
              Take what you need and preserve the spirit.
            </p>
          </div>

          <div className="px-6 md:px-8 lg:px-12 space-y-4">
            {/* Search - Unified Style */}
            <div className="flex items-center gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-4 py-3 border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-blue-400/30 focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-blue-400 focus-within:border-transparent dark:focus-within:border-transparent transition shadow-sm">
              <Search className="w-5 text-on-surface-variant dark:text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent focus:outline-none text-sm text-on-surface dark:text-white dark:placeholder-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="px-2 text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white transition"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filters - Unified Layout */}
            <div className="flex gap-2 flex-wrap items-center">
              {/* Group Chips */}
              {GROUP_TABS.map((grp) => (
                <button
                  key={grp}
                  onClick={() => setSelectedGroup(grp)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedGroup === grp
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container-low text-on-surface border border-outline-variant/30 hover:bg-surface-container-high'
                  }`}
                >
                  {grp}
                </button>
              ))}

              {/* Category Select */}
              <div className="ml-auto">
                <select
                  value={selectedCategory || 'all'}
                  onChange={(e) => setSelectedCategory(e.target.value === 'all' ? null : e.target.value)}
                  className="px-4 py-2 bg-surface-container-low dark:bg-[#222] border border-outline-variant/30 dark:border-gray-700 rounded-lg text-sm font-medium text-on-surface dark:text-white dark:placeholder-gray-400 focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="all">All</option>
                  <option value="costume">Costume</option>
                  <option value="instrument">Instrument</option>
                  <option value="accessories">Accessories</option>
                </select>
              </div>
            </div>

            {/* Items Grid - Unified Breakpoints */}
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-500/30 mx-auto mb-4" />
                <p className="text-on-surface-variant dark:text-gray-400">
                  {searchQuery ? "No items match your search" : "No items found"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
                {filteredItems.map((item) => {
                  const isAvailable = item.units?.some(u => u.status === 'available');
                  const availCount = item.units?.filter(u => u.status === 'available').length || 0;

                  return (
                    <motion.div
                      key={item.id}
                      whileHover={{ y: -2 }}
                      onClick={() => openModal(item)}
                      className="group cursor-pointer"
                    >
                      <div className="bg-surface-container-low dark:bg-[#1a1a1a] rounded-xl overflow-hidden border border-transparent hover:border-primary/20 dark:border-gray-700 dark:hover:border-blue-500/50 transition-all shadow-sm hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/40 h-full flex flex-col">
                        {/* Image */}
                        <div className="relative h-48 bg-surface-container-high dark:bg-[#222] overflow-hidden">
                          {item.image_url ? (
                            <img
                              src={item.image_url?.startsWith('http') ? item.image_url : `http://localhost:8000${item.image_url}`}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {(item.category || '').toLowerCase() === 'instrument' ? (
                                <Music className="w-10 h-10 text-on-surface-variant/30 dark:text-gray-500/30" />
                              ) : (
                                <Package className="w-10 h-10 text-on-surface-variant/30 dark:text-gray-500/30" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4 flex-grow flex flex-col justify-between">
                          <div>
                            <p className="text-xs text-on-surface-variant dark:text-gray-400 uppercase tracking-wide mb-1">
                              {item.category || 'Item'}
                            </p>
                            <h3 className="text-sm font-bold text-on-surface dark:text-white line-clamp-2 mb-2">
                              {item.name}
                            </h3>
                          </div>

                          <div className="flex items-center justify-between">
                            <p className={`text-xs font-medium ${isAvailable ? 'text-primary dark:text-blue-400' : 'text-on-surface-variant dark:text-gray-400'}`}>
                              {availCount} available
                            </p>
                            <ChevronRight className="w-4 h-4 text-primary dark:text-blue-400 opacity-0 group-hover:opacity-100 transition" />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ============ DRAWER MODAL - Unified for All Roles ============ */}
        <AnimatePresence>
          {selectedItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
              onClick={closeModal}
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
                {/* HEADER - Horizontal Layout */}
                <div className="border-b border-gray-200 dark:border-gray-800 p-4 md:p-6 max-h-[25%]" style={{ overflow: 'hidden' }}>
                  {/* Close Button */}
                  <div className="flex justify-between items-start mb-4">
                    <div />
                    <button
                      onClick={closeModal}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition"
                    >
                      <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                    </button>
                  </div>

                  {/* Header Content - Image + Info */}
                  <div className="flex gap-6">
                    {/* Image - Small Thumbnail */}
                    <div className="w-24 h-24 flex-shrink-0">
                      {selectedItem.image_url ? (
                        <img
                          src={selectedItem.image_url?.startsWith('http') ? selectedItem.image_url : `http://localhost:8000${selectedItem.image_url}`}
                          alt={selectedItem.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400 dark:text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* Details - Text */}
                    <div className="flex-1">
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant dark:text-gray-400 font-bold mb-1">
                        {selectedItem.category || 'Item'}
                      </p>
                      <h2 className="text-sm font-bold text-on-surface dark:text-white mb-2 line-clamp-2">
                        {selectedItem.name}
                      </h2>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          (selectedItem.units?.filter(u => u.status === 'available').length || 0) > 0
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}></div>
                        <p className={`text-[10px] font-medium ${
                          (selectedItem.units?.filter(u => u.status === 'available').length || 0) > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {selectedItem.units?.filter(u => u.status === 'available').length || 0} units available
                        </p>
                      </div>
                    </div>

                    {/* RIGHT: Selection Summary */}
                    <div className="w-40 flex-shrink-0 overflow-hidden flex flex-col">
                      {/* Header - Always Visible */}
                      <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1 text-[8px] font-bold text-on-surface dark:text-gray-300 uppercase tracking-widest">
                        <span>UNIT</span>
                        <span>SIZE</span>
                      </div>
                      
                      {selectedUnits.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-[9px] text-on-surface-variant dark:text-gray-400 font-medium">No units</p>
                        </div>
                      ) : (
                        <div className="space-y-1 overflow-y-auto flex-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                          <style>{`.staff-selection::-webkit-scrollbar { display: none; }`}</style>
                          {selectedUnits.map((unit, idx) => (
                            <div key={unit.id} className="flex justify-between items-center text-[9px] border-b border-gray-100 dark:border-gray-800 py-1 hover:bg-gray-50 dark:hover:bg-white/5 group">
                              <span className="truncate flex-1 font-semibold text-on-surface dark:text-white">
                                {idx + 1}. {unit.unit_number ? `#${unit.unit_number}` : unit.id.substring(0, 6)}
                              </span>
                              <div className="flex items-center gap-0.5 ml-1">
                                <span className="text-on-surface-variant dark:text-gray-400 text-[8px]">
                                  {unit.size ? unit.size.charAt(0).toUpperCase() : "—"}
                                </span>
                                <button
                                  onClick={() => setSelectedUnits(selectedUnits.filter(u => u.id !== unit.id))}
                                  className="p-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* STICKY TOTAL ROW */}
                <div className="sticky top-0 bg-white dark:bg-[#171717] px-4 md:px-6 pt-2 pb-0.5 flex">
                  <div className="flex-1" />
                  <div className="w-40 flex-shrink-0 flex justify-between font-bold text-[9px] text-on-surface dark:text-white uppercase tracking-widest">
                    <span>TOTAL</span>
                    <span className="text-primary dark:text-blue-400">{selectedUnits.length}</span>
                  </div>
                </div>

                  {/* STICKY SEARCH + FILTERS */}
                <div className="bg-white dark:bg-[#171717] border-b border-gray-200 dark:border-gray-800 p-4 md:p-6 space-y-4 overflow-y-auto max-h-80">
                  {/* Search Input */}
                  <input
                    type="text"
                    placeholder="Search by unit number..."
                    value={unitSearchQuery}
                    onChange={(e) => setUnitSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                  />

                  {/* Size Filter Tabs */}
                  {selectedItem.units && selectedItem.units.length > 0 && (
                    <div className="flex gap-6 text-sm font-medium">
                      {['small', 'medium', 'large'].map(size => {
                        const count = selectedItem.units.filter(u => {
                          const uSize = (u.size || '').toLowerCase();
                          return uSize === size && u.status === 'available';
                        }).length;

                        const isActive = activeSizeFilter === size;

                        return (
                          <motion.button
                            key={size}
                            onClick={() => setActiveSizeFilter(isActive ? null : size)}
                            className={`pb-2 px-1 relative transition-all ${
                              isActive
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                            }`}
                          >
                            {size.charAt(0).toUpperCase() + size.slice(1)} ({count})
                            {isActive && (
                              <div className="absolute bottom-0 left-0 right-0 h-0.5 origin-left bg-blue-500"></div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  {/* Select Units Header */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      Select Units ({selectedUnits.length})
                    </p>
                    {selectedUnits.length > 0 && (user?.role === 'staff' || user?.role === 'admin') && (
                      <button
                        onClick={() => setSelectedUnits([])}
                        className="text-xs px-2 py-1 rounded bg-red-500/20 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-500/30 dark:hover:bg-red-900/40 transition"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* SCROLLABLE UNIT SELECTION */}
                {selectedItem.units && selectedItem.units.length > 0 && (
                  <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
                    <div className="space-y-3">
                      {selectedItem.units
                        .filter(u => u.status === 'available')
                        .filter(u => {
                          if (!activeSizeFilter) return true;
                          const uSize = (u.size || '').toLowerCase();
                          return uSize === activeSizeFilter;
                        })
                        .filter(u => !unitSearchQuery || (u.unit_number || '').toLowerCase().includes(unitSearchQuery.toLowerCase()))
                        .map(unit => {
                          const isSelected = selectedUnits.some(u => u.id === unit.id);
                          
                          const handleUnitClick = () => {
                            if (isSelected) {
                              // Remove from selection
                              setSelectedUnits(selectedUnits.filter(u => u.id !== unit.id));
                            } else {
                              // Add to selection - multi-select for everyone
                              setSelectedUnits(prev => [...prev, unit]);
                            }
                          };

                          return (
                            <motion.button
                              key={unit.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleUnitClick}
                              className={`w-full py-1.5 px-3 rounded-lg border-2 font-medium text-[10px] transition-all text-center ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-300 shadow-lg shadow-blue-500/30 dark:shadow-blue-400/20'
                                  : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              {unit.unit_number ? `#${unit.unit_number}` : `Unit ${unit.id.substring(0, 8)}`}
                              {unit.size && (
                                <span className="text-[9px] ml-2 opacity-70">
                                  {unit.size.charAt(0).toUpperCase() + unit.size.slice(1)}
                                </span>
                              )}
                            </motion.button>
                          );
                        })}
                    </div>

                    {/* Empty State */}
                    {selectedItem.units.filter(u => u.status === 'available').filter(u => {
                      if (!activeSizeFilter) return true;
                      const uSize = (u.size || '').toLowerCase();
                      return uSize === activeSizeFilter;
                    }).filter(u => !unitSearchQuery || (u.unit_number || '').toLowerCase().includes(unitSearchQuery.toLowerCase())).length === 0 && (
                      <div className="text-center py-12">
                        <p className="text-gray-500 dark:text-gray-400">
                          👉 No units match your search
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* STICKY BOTTOM ACTION BAR */}
                <div className="sticky bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#171717] p-4 md:p-6 space-y-3">
                  {selectedUnits.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      👉 Select one or more units
                    </p>
                  )}

                  {/* Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={closeModal}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-on-surface dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition text-[10px]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAddToCart(selectedItem)}
                      disabled={selectedUnits.length === 0}
                      className={`px-3 py-1.5 rounded-lg font-bold text-white transition-all text-[10px] ${
                        selectedUnits.length === 0
                          ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60'
                          : 'bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 active:scale-95'
                      }`}
                    >
                      {selectedUnits.length > 0 ? (user?.role === 'borrower' ? 'Add to Cart' : `Add (${selectedUnits.length})`) : 'Select'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AddToCartModal
          isOpen={showAddToCartModal}
          onClose={() => setShowAddToCartModal(false)}
          itemName={addedItemName}
          userRole={user?.role}
        />
      </PageLayout>
    );
  }
  
  // ============ BORROWER VIEW - Unified with Staff/Admin ============
  return (
    <PageLayout>
      <div className="min-h-screen bg-surface dark:bg-[#171717] transition-colors duration-300">
        {/* Header - Unified Styling */}
        <div className="px-6 md:px-8 lg:px-12 pt-8 pb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-on-surface dark:text-white mb-2">
            Find what you need
          </h1>
          <p className="text-on-surface-variant dark:text-gray-400 text-sm">
            Browse and borrow items easily
          </p>
        </div>

        <div className="px-6 md:px-8 lg:px-12 space-y-4 pb-8">
          {/* Search - Unified Style */}
          <div className="flex items-center gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-4 py-3 border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-blue-400/30 focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-blue-400 focus-within:border-transparent dark:focus-within:border-transparent transition shadow-sm">
            <Search className="w-5 text-on-surface-variant dark:text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search costumes, instruments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none text-sm text-on-surface dark:text-white dark:placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="px-2 text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white transition"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filters - Unified Layout (Simpler for Borrowers) */}
          <div className="flex gap-2 flex-wrap items-center">
            {["costume", "instrument", "accessories"].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-primary dark:bg-blue-600 text-on-primary dark:text-white shadow-sm'
                    : 'bg-surface-container-low dark:bg-[#222] text-on-surface dark:text-white border border-outline-variant/30 dark:border-gray-700 hover:bg-surface-container-high dark:hover:bg-[#252525]'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* Items Grid - Unified Breakpoints */}
          {(() => {
            let filtered = items;
            if (selectedCategory) {
              filtered = filtered.filter(item =>
                (item.category || '').toLowerCase().includes(selectedCategory.toLowerCase())
              );
            }
            if (searchQuery.trim()) {
              filtered = filtered.filter(item =>
                item.name?.toLowerCase().includes(searchQuery.toLowerCase())
              );
            }

            return filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Package className="w-12 h-12 text-on-surface-variant/30 dark:text-gray-500/30 mx-auto mb-4" />
                <p className="text-on-surface-variant dark:text-gray-400">
                  {searchQuery ? "No items match your search" : "Try adjusting filters"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map((item) => {
                  const isAvailable = item.units?.some(u => u.status === 'available');
                  const availCount = item.units?.filter(u => u.status === 'available').length || 0;

                  return (
                    <motion.div
                      key={item.id}
                      whileHover={{ y: -2 }}
                      onClick={() => openModal(item)}
                      className="group cursor-pointer"
                    >
                      <div className="bg-surface-container-low dark:bg-[#1a1a1a] rounded-xl overflow-hidden border border-transparent hover:border-primary/20 dark:border-gray-700 dark:hover:border-blue-500/50 transition-all shadow-sm hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/40 h-full flex flex-col">
                        {/* Image */}
                        <div className="relative h-48 bg-surface-container-high dark:bg-[#222] overflow-hidden">
                          {item.image_url ? (
                            <img
                              src={item.image_url?.startsWith('http') ? item.image_url : `http://localhost:8000${item.image_url}`}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {(item.category || '').toLowerCase() === 'instrument' ? (
                                <Music className="w-10 h-10 text-on-surface-variant/30 dark:text-gray-500/30" />
                              ) : (
                                <Package className="w-10 h-10 text-on-surface-variant/30 dark:text-gray-500/30" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4 flex-grow flex flex-col justify-between">
                          <div>
                            <h3 className="text-sm font-bold text-on-surface dark:text-white line-clamp-2 mb-1">
                              {item.name}
                            </h3>
                            <p className={`text-xs font-medium ${isAvailable ? 'text-primary dark:text-blue-400' : 'text-error/70 dark:text-red-400/70'}`}>
                              {isAvailable ? `${availCount} available` : 'All borrowed'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* RIGHT-SIDE DRAWER MODAL - Unified for All Roles */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            onClick={closeModal}
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
              {/* HEADER - Two Column Layout */}
              <div className="border-b border-gray-200 dark:border-gray-800 p-4 md:p-6 max-h-[20%]" style={{ overflow: 'hidden' }}>
                

                {/* Header Content - Image + Info */}
                <div className="flex">
                  {/* LEFT: Item Details with Image */}
                  <div className="flex gap-4 flex-1">
                    {/* Image - Small Thumbnail */}
                    <div className="w-24 h-24 flex-shrink-0">
                      {selectedItem.image_url ? (
                        <img
                          src={selectedItem.image_url?.startsWith('http') ? selectedItem.image_url : `http://localhost:8000${selectedItem.image_url}`}
                          alt={selectedItem.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-800 rounded-xl flex items-center justify-center">
                          <Package className="w-8 h-8 text-gray-400 dark:text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* Details - Text */}
                    <div className="flex-1">
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant dark:text-gray-400 font-bold mb-1">
                        {selectedItem.category || 'Item'}
                      </p>
                      <h2 className="text-sm font-bold text-on-surface dark:text-white mb-2 line-clamp-2">
                        {selectedItem.name}
                      </h2>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          (selectedItem.units?.filter(u => u.status === 'available').length || 0) > 0
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}></div>
                        <p className={`text-[10px] font-medium ${
                          (selectedItem.units?.filter(u => u.status === 'available').length || 0) > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {selectedItem.units?.filter(u => u.status === 'available').length || 0} units available
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Selection Summary */}
                  <div className="w-40 flex-shrink-0 overflow-hidden flex flex-col">
                    {/* Header - Always Visible */}
                    <div className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1 text-[8px] font-bold text-on-surface dark:text-gray-300 uppercase tracking-widest">
                      <span>UNIT</span>
                      <span>SIZE</span>
                    </div>
                    
                    {selectedUnits.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-[9px] text-on-surface-variant dark:text-gray-400 font-medium">No units</p>
                      </div>
                    ) : (
                      <div className="space-y-1 overflow-y-auto flex-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        <style>{`.borrower-selection::-webkit-scrollbar { display: none; }`}</style>
                        {selectedUnits.map((unit, idx) => (
                          <div key={unit.id} className="flex justify-between items-center text-[9px] border-b border-gray-100 dark:border-gray-800 py-1 hover:bg-gray-50 dark:hover:bg-white/5 group">
                            <span className="truncate flex-1 font-semibold text-on-surface dark:text-white">
                              {idx + 1}. {unit.unit_number ? `#${unit.unit_number}` : unit.id.substring(0, 6)}
                            </span>
                            <div className="flex items-center gap-0.5 ml-1">
                              <span className="text-on-surface-variant dark:text-gray-400 text-[8px]">
                                {unit.size ? unit.size.charAt(0).toUpperCase() : "—"}
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedUnits(selectedUnits.filter(u => u.id !== unit.id));
                                }}
                                className="p-0 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove unit"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* STICKY TOTAL ROW */}
              <div className="sticky top-0 bg-white dark:bg-[#171717] px-4 md:px-6 pt-2 pb-0.5 flex">
                <div className="flex-1" />
                <div className="w-40 flex-shrink-0 flex justify-between font-bold text-[9px] text-on-surface dark:text-white uppercase tracking-widest">
                  <span>TOTsAL</span>
                  <span className="text-primary dark:text-blue-400">{selectedUnits.length}</span>
                </div>
              </div>

              {/* STICKY SEARCH + FILTERS */}
              <div className="bg-white dark:bg-[#171717] border-b border-gray-200 dark:border-gray-800 px-4 pt-0 pb-2 md:px-6 md:pt-1 md:pb-0 space-y-1.5 overflow-y-auto max-h-80">
                {/* Search Input */}
                <input
                  type="text"
                  placeholder="Search by unit number..."
                  value={unitSearchQuery}
                  onChange={(e) => setUnitSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                />

                {/* Size Filter Tabs */}
                {selectedItem.units && selectedItem.units.length > 0 && (
                  <div className="flex gap-6 text-[10px] font-medium uppercase tracking-widest">
                    {['small', 'medium', 'large'].map(size => {
                      const count = selectedItem.units.filter(u => {
                        const uSize = (u.size || '').toLowerCase();
                        return uSize === size && u.status === 'available';
                      }).length;

                      const isActive = activeSizeFilter === size;

                      return (
                        <motion.button
                          key={size}
                          onClick={() => setActiveSizeFilter(isActive ? null : size)}
                          className={`pb-2 px-1 relative transition-all ${
                            isActive
                              ? 'text-blue-600 dark:text-blue-400 font-bold'
                              : 'text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white'
                          }`}
                        >
                          {size.charAt(0).toUpperCase() + size.slice(1)} ({count})
                          {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 origin-left bg-blue-500"></div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}

               
              </div>

              {/* SCROLLABLE UNIT SELECTION */}
              {selectedItem.units && selectedItem.units.length > 0 && (
                <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4">
                  <div className="space-y-3">
                    {selectedItem.units
                      .filter(u => u.status === 'available')
                      .filter(u => {
                        if (!activeSizeFilter) return true;
                        const uSize = (u.size || '').toLowerCase();
                        return uSize === activeSizeFilter;
                      })
                      .filter(u => !unitSearchQuery || (u.unit_number || '').toLowerCase().includes(unitSearchQuery.toLowerCase()))
                      .map(unit => {
                        const isSelected = selectedUnits.some(u => u.id === unit.id);
                        
                        const handleUnitClick = () => {
                          if (isSelected) {
                            // Remove from selection
                            setSelectedUnits(selectedUnits.filter(u => u.id !== unit.id));
                          } else {
                            // Add to selection - multi-select for everyone
                            setSelectedUnits(prev => [...prev, unit]);
                          }
                        };

                        return (
                          <motion.button
                            key={unit.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleUnitClick}
                            className={`w-full py-1.5 px-3 rounded-lg border-2 font-medium text-[10px] transition-all text-center uppercase tracking-wide ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-300 shadow-lg shadow-blue-500/30 dark:shadow-blue-400/20'
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-on-surface dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {unit.unit_number ? `#${unit.unit_number}` : `Unit ${unit.id.substring(0, 8)}`}
                            {unit.size && (
                              <span className="text-[9px] ml-2 opacity-70">
                                {unit.size.charAt(0).toUpperCase() + unit.size.slice(1)}
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                  </div>

                  {/* Empty State */}
                  {selectedItem.units.filter(u => u.status === 'available').filter(u => {
                    if (!activeSizeFilter) return true;
                    const uSize = (u.size || '').toLowerCase();
                    return uSize === activeSizeFilter;
                  }).filter(u => !unitSearchQuery || (u.unit_number || '').toLowerCase().includes(unitSearchQuery.toLowerCase())).length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-[10px] text-on-surface-variant dark:text-gray-400">
                        👉 No units match your search
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* STICKY BOTTOM ACTION BAR */}
              <div className="sticky bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#171717] p-4 md:p-6 space-y-3">
                {selectedUnits.length === 0 && (
                  <p className="text-[10px] text-on-surface-variant dark:text-gray-400">
                    👉 Select one or more units
                  </p>
                )}

                {/* Buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={closeModal}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-on-surface dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition text-[10px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAddToCart(selectedItem)}
                    disabled={selectedUnits.length === 0}
                    className={`px-3 py-1.5 rounded-lg font-bold text-white transition-all text-[10px] ${
                      selectedUnits.length === 0
                        ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60'
                        : 'bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 active:scale-95'
                    }`}
                  >
                    {selectedUnits.length > 0 ? (user?.role === 'borrower' ? 'Add to Cart' : `Add (${selectedUnits.length})`) : 'Select'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AddToCartModal
        isOpen={showAddToCartModal}
        onClose={() => setShowAddToCartModal(false)}
        itemName={addedItemName}
        userRole={user?.role}
      />
    </PageLayout>
  );
}
