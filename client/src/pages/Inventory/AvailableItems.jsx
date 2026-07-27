// src/pages/AvailableItems.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Package, Music, X, ChevronRight, Star } from 'lucide-react';
import axios from 'axios';
import PageLayout from '../../components/layout/PageLayout.jsx';
import AddToCartModal from '../../components/modals/AddToCartModal.jsx';
import { UserContext } from '../../../context/userContext.jsx';
import { BorrowingContext } from '../../../context/borrowingContext.jsx';
import { getInventoryDivisionInfo } from '../../utils/inventoryDivisionStorage.js';

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
  const [recommendedItemIds, setRecommendedItemIds] = useState(new Set());
  const [recommendations, setRecommendations] = useState([]);

  const { user, loading } = useContext(UserContext);
  const { addToCart, refreshAvailableItems, cart } = useContext(BorrowingContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) {
      if ((user.role === 'admin' || user.role === 'staff') && location.pathname === '/available-items') {
        navigate('/staff/available-items', { replace: true });
        return;
      }
      if (user.role === 'borrower' && location.pathname.startsWith('/staff/available-items')) {
        navigate('/available-items', { replace: true });
        return;
      }
      if (user.role !== 'admin' && user.role !== 'staff' && user.role !== 'borrower') {
        navigate('/login');
      }
    }
  }, [loading, user, navigate, location.pathname]);

  const fetchRecommendations = async () => {
    try {
      if (!user?.id) return;
      const { data } = await axios.get(`/api/performances/recommendations/${user.id}`, { 
        withCredentials: true 
      });
      
      // Filter out past performances dynamically
      const now = new Date();
      const activeRecommendations = data.filter(rec => {
        const performanceDate = new Date(rec.start_time);
        return performanceDate >= now; // Only show today and upcoming
      });
      
      setRecommendations(activeRecommendations);
      const itemIds = new Set(activeRecommendations.map(rec => rec.inventory_item_id));
      setRecommendedItemIds(itemIds);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error fetching recommendations:', error);
      }
    }
  };

  const fetchItems = async () => {
    try {
      const { data } = await axios.get('/api/inventory/');
      setItems(data);
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
    if (!loading) {
      fetchItems();
    }
  }, [loading, user?.id, user?.role, refreshAvailableItems]);

  // Read search query from URL parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
      // Clean up URL
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location.search]);

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

  const getItemRecommendation = (itemId) => {
    return recommendations.find(rec => rec.inventory_item_id === itemId);
  };

  // Check if performance is past, today, or upcoming
  const getPerformanceStatus = (startTime) => {
    if (!startTime) return null;
    
    const now = new Date();
    const performanceDate = new Date(startTime);
    
    // Get just the dates (ignoring time)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const perfDate = new Date(performanceDate.getFullYear(), performanceDate.getMonth(), performanceDate.getDate());
    
    // Check if performance is in the past
    if (perfDate < today) {
      return 'past';
    }
    
    // Check if performance is today
    if (perfDate.getTime() === today.getTime()) {
      return 'today';
    }
    
    return 'upcoming';
  };

  const handleAddToCart = async (item) => {
    if (selectedUnits.length === 0) {
      const selectableUnits = item.units?.filter(u => u.status === 'available') || [];
      if (selectableUnits.length === 0) {
        toast.error('No units available for this item');
        return;
      }
      setSelectedUnits([selectableUnits[0]]);
      return;
    }

    let successCount = 0;
    let failureCount = 0;
    const addedUnitNumbers = [];
    const failedUnits = [];
    const failureReasons = [];

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
          unit_number: unit.unit_number
        }, { suppressToast: true });

        if (result?.success) {
          successCount++;
          addedUnitNumbers.push(unit.unit_number || unit.id.substring(0, 8));
        } else {
          failureCount++;
          const unitDisplay = unit.unit_number || unit.id.substring(0, 8);
          failedUnits.push(unitDisplay);
          
          // Log detailed failure reasons for debugging
          if (result?.failedItems && result.failedItems.length > 0) {
            result.failedItems.forEach(f => {
              failureReasons.push(`${unitDisplay}: ${f.error}`);
            });
          } else {
            failureReasons.push(`${unitDisplay}: ${result?.error || "Unknown error"}`);
          }
          
          console.warn(`⚠️ Unit ${unitDisplay} failed to add:`, result);
        }
      } catch (err) {
        console.error(`❌ Exception adding unit ${unit.unit_number}:`, err);
        failureCount++;
        failedUnits.push(unit.unit_number || unit.id.substring(0, 8));
        failureReasons.push(`${unit.unit_number}: ${err.message}`);
      }
    }

    // Log detailed summary
    console.log(`📊 Add to cart summary:`, {
      itemName: item.name,
      total: selectedUnits.length,
      succeeded: successCount,
      failed: failureCount,
      failureReasons,
    });

    if (successCount > 0) {
      // Show success modal with optional failed items info
      const displayName = selectedUnits.length > 1 
        ? `${item.name}\n${addedUnitNumbers.map(n => `✓ Unit ${n}`).join('\n')}${failureCount > 0 ? `\n\n⚠️ Failed (${failureCount}): ${failedUnits.join(', ')}\n\n💡 Try refreshing items to get latest availability` : ''}`
        : item.name;
      setAddedItemName(displayName);
      setShowAddToCartModal(true);
      closeModal();
      
      // Show toast with summary
      if (failureCount > 0) {
        toast.warning(`Added ${successCount}/${selectedUnits.length}. ${failureCount} unit(s) unavailable (may have been reserved).`, {
          duration: 4000,
        });
      }
    } else {
      // All units failed - show detailed error and offer refresh
      console.error("❌ All units failed to add:", { failureReasons });
      
      const failureMessage = failureReasons.length > 0
        ? `Units unavailable:\n\n${failureReasons.join('\n')}\n\nTry refreshing items to get latest availability.`
        : `Failed to add units: ${failedUnits.join(', ')}\n\nThese items may have been reserved by another user. Try refreshing.`;
      
      toast.error(failureMessage, { duration: 5000 });
      
      // Auto-offer to refresh inventory (debounced)
      setTimeout(() => {
        toast.loading("Refreshing inventory...", { duration: 1000 });
        fetchItems(); // Refresh items to get latest availability
      }, 1500);
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
        <div className="min-h-screen bg-surface dark:bg-[#171717] transition-colors duration-300 scroll-smooth">
          {/* Header - Mobile Optimized */}
          <div className="px-3 sm:px-6 md:px-8 lg:px-12 pt-4 sm:pt-8 pb-3 sm:pb-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-on-surface dark:text-white mb-1 sm:mb-2">
              Available Items
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant dark:text-gray-400">
              Take what you need and preserve the spirit.
            </p>
          </div>

          <div className="px-3 sm:px-6 md:px-8 lg:px-12 space-y-3 sm:space-y-4">
            {/* Search - Mobile Optimized */}
            <div className="flex items-center gap-2 sm:gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-3 sm:px-4 py-2 sm:py-3 border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-blue-400/30 focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-blue-400 focus-within:border-transparent transition shadow-sm">
              <Search className="w-4 sm:w-5 text-on-surface-variant dark:text-gray-400 flex-shrink-0" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent focus:outline-none text-xs sm:text-sm text-on-surface dark:text-white dark:placeholder-gray-500"
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

            {/* Filters - Mobile Optimized */}
            <div className="flex gap-2 flex-wrap items-center overflow-x-auto pb-1">
              {GROUP_TABS.map((grp) => (
                <button
                  key={grp}
                  onClick={() => setSelectedGroup(grp)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex-shrink-0 ${
                    selectedGroup === grp
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'bg-surface-container-low text-on-surface border border-outline-variant/30 hover:bg-surface-container-high'
                  }`}
                >
                  {grp}
                </button>
              ))}

              <div className="ml-auto flex-shrink-0">
                <select
                  value={selectedCategory || 'all'}
                  onChange={(e) => setSelectedCategory(e.target.value === 'all' ? null : e.target.value)}
                  className="px-2 sm:px-4 py-1.5 sm:py-2 bg-surface-container-low dark:bg-[#222] border border-outline-variant/30 dark:border-gray-700 rounded-lg text-xs sm:text-sm font-medium text-on-surface dark:text-white dark:placeholder-gray-400 focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 focus:border-transparent"
                >
                  <option value="all">All</option>
                  <option value="costume">Costume</option>
                  <option value="instrument">Instrument</option>
                  <option value="accessories">Accessories</option>
                </select>
              </div>
            </div>

            {/* Items Grid - Mobile Optimized */}
            {filteredItems.length === 0 ? (
              <div className="py-8 sm:py-16 text-center">
                <Package className="w-8 sm:w-12 h-8 sm:h-12 text-on-surface-variant/30 dark:text-gray-500/30 mx-auto mb-2 sm:mb-4" />
                <p className="text-xs sm:text-sm text-on-surface-variant dark:text-gray-400">
                  {searchQuery ? "No items match your search" : "No items found"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4 pb-6 sm:pb-8">
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
                      <div className="bg-surface-container-low dark:bg-[#1a1a1a] rounded-lg sm:rounded-xl overflow-hidden border border-transparent hover:border-primary/20 dark:border-gray-700 dark:hover:border-blue-500/50 transition-all shadow-sm hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/40 h-full flex flex-col">
                        {/* Image */}
                        <div className="relative h-24 sm:h-32 md:h-48 bg-surface-container-high dark:bg-[#222] overflow-hidden">
                          {item.image_url ? (
                            <img
                              src={item.image_url?.startsWith('http') ? item.image_url : `http://localhost:8000${item.image_url}`}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {(item.category || '').toLowerCase() === 'instrument' ? (
                                <Music className="w-6 sm:w-10 h-6 sm:h-10 text-on-surface-variant/30 dark:text-gray-500/30" />
                              ) : (
                                <Package className="w-6 sm:w-10 h-6 sm:h-10 text-on-surface-variant/30 dark:text-gray-500/30" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-2 sm:p-3 md:p-4 flex-grow flex flex-col justify-between">
                          <div>
                            <p className="text-[10px] sm:text-xs text-on-surface-variant dark:text-gray-400 uppercase tracking-wide mb-0.5 sm:mb-1">
                              {item.category || 'Item'}
                            </p>
                            <h3 className="text-xs sm:text-sm font-bold text-on-surface dark:text-white line-clamp-2 mb-1 sm:mb-2">
                              {item.name}
                            </h3>
                            {(() => {
                              const divisionInfo = getInventoryDivisionInfo(item);
                              return divisionInfo?.division_name ? (
                                <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-primary dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300 mb-1">
                                  {divisionInfo.division_name}
                                </span>
                              ) : null;
                            })()}
                          </div>

                          <div className="flex items-center justify-between">
                            <p className={`text-[9px] sm:text-xs font-medium ${isAvailable ? 'text-primary dark:text-blue-400' : 'text-on-surface-variant dark:text-gray-400'}`}>
                              {availCount} avail
                            </p>
                            <ChevronRight className="w-3 sm:w-4 h-3 sm:h-4 text-primary dark:text-blue-400 opacity-0 group-hover:opacity-100 transition" />
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

        {/* DRAWER MODAL - Mobile Optimized */}
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
                className="fixed top-0 right-0 h-full w-full sm:w-[90%] md:w-[500px] bg-white dark:bg-[#171717] shadow-2xl dark:shadow-black/40 flex flex-col z-50 rounded-l-2xl sm:rounded-l-3xl rounded-r-none overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* HEADER - Mobile Optimized */}
                <div className="border-b border-gray-200 dark:border-gray-800 p-3 sm:p-4 md:p-6 max-h-[25%]" style={{ overflow: 'hidden' }}>
                  <div className="flex justify-between items-start mb-2 sm:mb-4">
                    <div />
                    <button
                      onClick={closeModal}
                      className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition"
                    >
                      <X className="w-5 sm:w-6 h-5 sm:h-6 text-gray-600 dark:text-gray-300" />
                    </button>
                  </div>

                  <div className="flex gap-3 sm:gap-6">
                    <div className="w-16 sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 flex-shrink-0">
                      {selectedItem.image_url ? (
                        <img
                          src={selectedItem.image_url?.startsWith('http') ? selectedItem.image_url : `${import.meta.env.VITE_API_URL || "http://localhost:8000"}${selectedItem.image_url}`}
                          alt={selectedItem.name}
                          className="w-full h-full object-cover rounded-lg sm:rounded-xl"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-800 rounded-lg sm:rounded-xl flex items-center justify-center">
                          <Package className="w-6 sm:w-8 h-6 sm:h-8 text-gray-400 dark:text-gray-600" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-on-surface-variant dark:text-gray-400 font-bold mb-0.5 sm:mb-1">
                        {selectedItem.category || 'Item'}
                      </p>
                      <h2 className="text-xs sm:text-sm font-bold text-on-surface dark:text-white mb-1 sm:mb-2 line-clamp-2">
                        {selectedItem.name}
                      </h2>
                      {(() => {
                        const divisionInfo = getInventoryDivisionInfo(selectedItem);
                        return divisionInfo?.division_name ? (
                          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] sm:text-[10px] font-medium text-primary dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300 mb-2">
                            {divisionInfo.division_name}
                          </div>
                        ) : null;
                      })()}
                      
                      {/* Recommendation Badge with Event Title */}
                      {recommendedItemIds.has(selectedItem.id) && (
                        <div className="bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded px-2 py-1 mb-2 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500 flex-shrink-0" />
                          <div className="min-w-0">
                            {getItemRecommendation(selectedItem.id) && (
                              <p className="text-[8px] sm:text-[9px] font-bold text-amber-800 dark:text-amber-200 line-clamp-1">
                                {getItemRecommendation(selectedItem.id).performance_title}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          (selectedItem.units?.filter(u => u.status === 'available').length || 0) > 0
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}></div>
                        <p className={`text-[8px] sm:text-[10px] font-medium ${
                          (selectedItem.units?.filter(u => u.status === 'available').length || 0) > 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {selectedItem.units?.filter(u => u.status === 'available').length || 0} units
                        </p>
                      </div>
                    </div>

                    {/* Selection Summary - Hidden on Mobile */}
                    <div className="hidden md:flex w-32 flex-shrink-0 overflow-hidden flex-col">
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

                {/* STICKY TOTAL ROW - Hidden on Mobile */}
                <div className="hidden md:flex sticky top-0 bg-white dark:bg-[#171717] px-4 md:px-6 pt-2 pb-0.5">
                  <div className="flex-1" />
                  <div className="w-32 flex-shrink-0 flex justify-between font-bold text-[9px] text-on-surface dark:text-white uppercase tracking-widest">
                    <span>TOTAL</span>
                    <span className="text-primary dark:text-blue-400">{selectedUnits.length}</span>
                  </div>
                </div>

                {/* STICKY SEARCH + FILTERS */}
                <div className="bg-white dark:bg-[#171717] border-b border-gray-200 dark:border-gray-800 p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-4 overflow-y-auto max-h-80">
                  <input
                    type="text"
                    placeholder="Search by unit..."
                    value={unitSearchQuery}
                    onChange={(e) => setUnitSearchQuery(e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                  />

                  {selectedItem.units && selectedItem.units.length > 0 && (
                    <div className="flex gap-2 sm:gap-6 text-xs sm:text-sm font-medium overflow-x-auto pb-1">
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
                            className={`pb-2 px-1 relative transition-all flex-shrink-0 ${
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

                  <div className="flex items-center justify-between">
                    <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                      Select Units ({selectedUnits.length})
                    </p>
                    {selectedUnits.length > 0 && (user?.role === 'staff' || user?.role === 'admin') && (
                      <button
                        onClick={() => setSelectedUnits([])}
                        className="text-[9px] sm:text-xs px-2 py-1 rounded bg-red-500/20 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-500/30 dark:hover:bg-red-900/40 transition"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* SCROLLABLE UNIT SELECTION */}
                {selectedItem.units && selectedItem.units.length > 0 && (
                  <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                    <div className="space-y-2 sm:space-y-3">
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
                              setSelectedUnits(selectedUnits.filter(u => u.id !== unit.id));
                            } else {
                              setSelectedUnits(prev => [...prev, unit]);
                            }
                          };

                          return (
                            <motion.button
                              key={unit.id}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={handleUnitClick}
                              className={`w-full py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg border-2 font-medium text-[9px] sm:text-[10px] transition-all text-center ${
                                isSelected
                                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-300 shadow-lg shadow-blue-500/30 dark:shadow-blue-400/20'
                                  : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              {unit.unit_number ? `#${unit.unit_number}` : `Unit ${unit.id.substring(0, 8)}`}
                              {unit.size && (
                                <span className="text-[8px] ml-2 opacity-70">
                                  {unit.size.charAt(0).toUpperCase() + unit.size.slice(1)}
                                </span>
                              )}
                            </motion.button>
                          );
                        })}
                    </div>

                    {selectedItem.units.filter(u => u.status === 'available').filter(u => {
                      if (!activeSizeFilter) return true;
                      const uSize = (u.size || '').toLowerCase();
                      return uSize === activeSizeFilter;
                    }).filter(u => !unitSearchQuery || (u.unit_number || '').toLowerCase().includes(unitSearchQuery.toLowerCase())).length === 0 && (
                      <div className="text-center py-8 sm:py-12">
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          👉 No units match
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* STICKY BOTTOM ACTION BAR */}
                <div className="sticky bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#171717] p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
                  {selectedUnits.length === 0 && (
                    <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400">
                      👉 Select units
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <button
                      onClick={closeModal}
                      className="px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-on-surface dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition text-[9px] sm:text-[10px]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAddToCart(selectedItem)}
                      disabled={selectedUnits.length === 0}
                      className={`px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg font-bold text-white transition-all text-[9px] sm:text-[10px] ${
                        selectedUnits.length === 0
                          ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60'
                          : 'bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 active:scale-95'
                      }`}
                    >
                      {selectedUnits.length > 0 ? (user?.role === 'borrower' ? 'Add' : `Add (${selectedUnits.length})`) : 'Select'}
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
  
  // ============ BORROWER VIEW ============
  return (
    <PageLayout>
      <div className="min-h-screen bg-surface dark:bg-[#171717] transition-colors duration-300 scroll-smooth">
        {/* Header - Mobile Optimized */}
        <div className="px-3 sm:px-6 md:px-8 lg:px-12 pt-4 sm:pt-8 pb-3 sm:pb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-on-surface dark:text-white mb-1 sm:mb-2">
            Find what you need
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant dark:text-gray-400">
            Browse and borrow items easily
          </p>
        </div>

        <div className="px-3 sm:px-6 md:px-8 lg:px-12 space-y-3 sm:space-y-4 pb-6 sm:pb-8">
          {/* Search - Mobile Optimized */}
          <div className="flex items-center gap-2 sm:gap-3 bg-surface-container-low dark:bg-[#222] rounded-lg px-3 sm:px-4 py-2 sm:py-3 border border-transparent dark:border-gray-700 hover:border-primary/20 dark:hover:border-blue-400/30 focus-within:ring-2 focus-within:ring-primary dark:focus-within:ring-blue-400 focus-within:border-transparent transition shadow-sm">
            <Search className="w-4 sm:w-5 text-on-surface-variant dark:text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent focus:outline-none text-xs sm:text-sm text-on-surface dark:text-white dark:placeholder-gray-500"
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

          {/* Filters - Mobile Optimized */}
          <div className="flex gap-2 flex-wrap items-center overflow-x-auto pb-1">
            {["costume", "instrument", "accessories"].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex-shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-primary dark:bg-blue-600 text-on-primary dark:text-white shadow-sm'
                    : 'bg-surface-container-low dark:bg-[#222] text-on-surface dark:text-white border border-outline-variant/30 dark:border-gray-700 hover:bg-surface-container-high dark:hover:bg-[#252525]'
                }`}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

          {/* Items Grid - Mobile Optimized */}
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

            if (user?.role === 'borrower' && recommendedItemIds.size > 0) {
              filtered = filtered.sort((a, b) => {
                const aIsRecommended = recommendedItemIds.has(a.id);
                const bIsRecommended = recommendedItemIds.has(b.id);
                if (aIsRecommended && !bIsRecommended) return -1;
                if (!aIsRecommended && bIsRecommended) return 1;
                return 0;
              });
            }

            return filtered.length === 0 ? (
              <div className="py-8 sm:py-16 text-center">
                <Package className="w-8 sm:w-12 h-8 sm:h-12 text-on-surface-variant/30 dark:text-gray-500/30 mx-auto mb-2 sm:mb-4" />
                <p className="text-xs sm:text-sm text-on-surface-variant dark:text-gray-400">
                  {searchQuery ? "No items found" : "Try different filters"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                {filtered.map((item) => {
                  const isAvailable = item.units?.some(u => u.status === 'available');
                  const availCount = item.units?.filter(u => u.status === 'available').length || 0;
                  const isRecommended = recommendedItemIds.has(item.id);
                  const recommendation = getItemRecommendation(item.id);

                  return (
                    <motion.div
                      key={item.id}
                      whileHover={{ y: -2 }}
                      onClick={() => openModal(item)}
                      className="group cursor-pointer"
                    >
                      <div className={`rounded-lg sm:rounded-xl overflow-hidden border transition-all shadow-sm hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/40 h-full flex flex-col ${
                        isRecommended 
                          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700/50 hover:border-amber-400 dark:hover:border-amber-700'
                          : 'bg-surface-container-low dark:bg-[#1a1a1a] border-transparent hover:border-primary/20 dark:border-gray-700 dark:hover:border-blue-500/50'
                      }`}>
                        {/* Image */}
                        <div className="relative h-24 sm:h-32 md:h-48 bg-surface-container-high dark:bg-[#222] overflow-hidden">
                          {/* Recommendation Badge with Event Title */}
                          {isRecommended && (
                            <div className="absolute top-1 sm:top-2 left-1 sm:left-2 bg-amber-400 dark:bg-amber-500 text-amber-900 dark:text-white px-2 py-0.5 sm:py-1 rounded text-[8px] sm:text-xs font-bold flex items-center gap-0.5 shadow-md z-20 max-w-[calc(100%-8px)]">
                              <Star className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 fill-current flex-shrink-0" />
                              <span className="line-clamp-1">
                                {recommendation?.performance_title || 'Recommended'}
                              </span>
                            </div>
                          )}
                          
                          {item.image_url ? (
                            <img
                              src={item.image_url?.startsWith('http') ? item.image_url : `http://localhost:8000${item.image_url}`}
                              alt={item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {(item.category || '').toLowerCase() === 'instrument' ? (
                                <Music className="w-6 sm:w-10 h-6 sm:h-10 text-on-surface-variant/30 dark:text-gray-500/30" />
                              ) : (
                                <Package className="w-6 sm:w-10 h-6 sm:h-10 text-on-surface-variant/30 dark:text-gray-500/30" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-2 sm:p-3 md:p-4 flex-grow flex flex-col justify-between">
                          <div>
                            <h3 className="text-xs sm:text-sm font-bold text-on-surface dark:text-white line-clamp-2 mb-1">
                              {item.name}
                            </h3>
                            {(() => {
                              const divisionInfo = getInventoryDivisionInfo(item);
                              return divisionInfo?.division_name ? (
                                <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] sm:text-[10px] font-medium text-primary dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300 mb-2">
                                  {divisionInfo.division_name}
                                </span>
                              ) : null;
                            })()}
                            <p className={`text-[9px] sm:text-xs font-medium ${isAvailable ? 'text-primary dark:text-blue-400' : 'text-error/70 dark:text-red-400/70'}`}>
                              {isAvailable ? `${availCount} avail` : 'All borrowed'}
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

      {/* RIGHT-SIDE DRAWER MODAL - Mobile Optimized */}
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
              className="fixed top-0 right-0 h-full w-full sm:w-[90%] md:w-[500px] bg-white dark:bg-[#171717] shadow-2xl dark:shadow-black/40 flex flex-col z-50 rounded-l-2xl sm:rounded-l-3xl rounded-r-none overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* HEADER - Mobile Optimized */}
              <div className="border-b border-gray-200 dark:border-gray-800 p-3 sm:p-4 md:p-6 max-h-[25%]" style={{ overflow: 'hidden' }}>
                <div className="flex justify-between items-start mb-2 sm:mb-4">
                  <div />
                  <button
                    onClick={closeModal}
                    className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition"
                  >
                    <X className="w-5 sm:w-6 h-5 sm:h-6 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>

                <div className="flex gap-3 sm:gap-4">
                  <div className="w-16 sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 flex-shrink-0">
                    {selectedItem.image_url ? (
                      <img
                        src={selectedItem.image_url?.startsWith('http') ? selectedItem.image_url : `http://localhost:8000${selectedItem.image_url}`}
                        alt={selectedItem.name}
                        className="w-full h-full object-cover rounded-lg sm:rounded-xl"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 dark:bg-gray-800 rounded-lg sm:rounded-xl flex items-center justify-center">
                        <Package className="w-6 sm:w-8 h-6 sm:h-8 text-gray-400 dark:text-gray-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-on-surface-variant dark:text-gray-400 font-bold mb-0.5 sm:mb-1">
                      {selectedItem.category || 'Item'}
                    </p>
                    <h2 className="text-xs sm:text-sm font-bold text-on-surface dark:text-white mb-1 sm:mb-2 line-clamp-2">
                      {selectedItem.name}
                    </h2>
                    
                    {/* Recommendation Badge with Event Title - Hidden if past, Red if today, Amber if upcoming */}
                    {recommendedItemIds.has(selectedItem.id) && (() => {
                      const rec = getItemRecommendation(selectedItem.id);
                      if (!rec) return null;
                      
                      const status = getPerformanceStatus(rec.start_time);
                      
                      // Don't show star if performance is past
                      if (status === 'past') return null;
                      
                      // Show star in red if performance is today
                      if (status === 'today') {
                        return (
                          <div className="bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded px-2 py-1 mb-2 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-red-500 text-red-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[8px] sm:text-[9px] font-bold text-red-800 dark:text-red-200 line-clamp-1">
                                {rec.performance_title}
                              </p>
                            </div>
                          </div>
                        );
                      }
                      
                      // Show star in amber for upcoming performances
                      return (
                        <div className="bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700 rounded px-2 py-1 mb-2 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[8px] sm:text-[9px] font-bold text-amber-800 dark:text-amber-200 line-clamp-1">
                              {rec.performance_title}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        (selectedItem.units?.filter(u => u.status === 'available').length || 0) > 0
                          ? 'bg-green-500'
                          : 'bg-red-500'
                      }`}></div>
                      <p className={`text-[8px] sm:text-[10px] font-medium ${
                        (selectedItem.units?.filter(u => u.status === 'available').length || 0) > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {selectedItem.units?.filter(u => u.status === 'available').length || 0} units
                      </p>
                    </div>
                  </div>

                  {/* Selection Summary - Hidden on Mobile */}
                  <div className="hidden md:flex w-32 flex-shrink-0 overflow-hidden flex-col">
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

              {/* STICKY TOTAL ROW - Hidden on Mobile */}
              <div className="hidden md:flex sticky top-0 bg-white dark:bg-[#171717] px-4 md:px-6 pt-2 pb-0.5">
                <div className="flex-1" />
                <div className="w-32 flex-shrink-0 flex justify-between font-bold text-[9px] text-on-surface dark:text-white uppercase tracking-widest">
                  <span>TOTAL</span>
                  <span className="text-primary dark:text-blue-400">{selectedUnits.length}</span>
                </div>
              </div>

              {/* STICKY SEARCH + FILTERS */}
              <div className="bg-white dark:bg-[#171717] border-b border-gray-200 dark:border-gray-800 px-3 sm:px-4 md:px-6 pt-3 sm:pt-4 md:pt-0 pb-2 md:pb-0 space-y-2 sm:space-y-4 overflow-y-auto max-h-80">
                <input
                  type="text"
                  placeholder="Search units..."
                  value={unitSearchQuery}
                  onChange={(e) => setUnitSearchQuery(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-xs sm:text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition"
                />

                {selectedItem.units && selectedItem.units.length > 0 && (
                  <div className="flex gap-2 sm:gap-6 text-[9px] sm:text-sm font-medium uppercase tracking-widest overflow-x-auto pb-1">
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
                          className={`pb-2 px-1 relative transition-all flex-shrink-0 ${
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
                <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                  <div className="space-y-2 sm:space-y-3">
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
                            setSelectedUnits(selectedUnits.filter(u => u.id !== unit.id));
                          } else {
                            setSelectedUnits(prev => [...prev, unit]);
                          }
                        };

                        return (
                          <motion.button
                            key={unit.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleUnitClick}
                            className={`w-full py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg border-2 font-medium text-[9px] sm:text-[10px] transition-all text-center uppercase tracking-wide ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-300 shadow-lg shadow-blue-500/30 dark:shadow-blue-400/20'
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-on-surface dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {unit.unit_number ? `#${unit.unit_number}` : `Unit ${unit.id.substring(0, 8)}`}
                            {unit.size && (
                              <span className="text-[8px] ml-2 opacity-70">
                                {unit.size.charAt(0).toUpperCase() + unit.size.slice(1)}
                              </span>
                            )}
                          </motion.button>
                        );
                      })}
                  </div>

                  {selectedItem.units.filter(u => u.status === 'available').filter(u => {
                    if (!activeSizeFilter) return true;
                    const uSize = (u.size || '').toLowerCase();
                    return uSize === activeSizeFilter;
                  }).filter(u => !unitSearchQuery || (u.unit_number || '').toLowerCase().includes(unitSearchQuery.toLowerCase())).length === 0 && (
                    <div className="text-center py-8 sm:py-12">
                      <p className="text-[9px] sm:text-xs text-on-surface-variant dark:text-gray-400">
                        👉 No units match
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* STICKY BOTTOM ACTION BAR */}
              <div className="sticky bottom-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-[#171717] p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
                {selectedUnits.length === 0 && (
                  <p className="text-[9px] sm:text-xs text-on-surface-variant dark:text-gray-400">
                    👉 Select units
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    onClick={closeModal}
                    className="px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-on-surface dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition text-[9px] sm:text-[10px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAddToCart(selectedItem)}
                    disabled={selectedUnits.length === 0}
                    className={`px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg font-bold text-white transition-all text-[9px] sm:text-[10px] ${
                      selectedUnits.length === 0
                        ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-60'
                        : 'bg-blue-600 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 active:scale-95'
                    }`}
                  >
                    {selectedUnits.length > 0 ? (user?.role === 'borrower' ? 'Add' : `Add (${selectedUnits.length})`) : 'Select'}
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