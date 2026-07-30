import { useState, useEffect } from 'react';
import AvailableItems from './AvailableItems';
import ManageInventory from './ManageInventory';
import { motion } from 'framer-motion';

export default function InventoryTabs() {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('inventoryActiveTab') || 'available';
    } catch (e) {
      return 'available';
    }
  });

  useEffect(() => {
    try { localStorage.setItem('inventoryActiveTab', activeTab); } catch (e) {}
  }, [activeTab]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="rounded-full border border-outline-variant/20 bg-surface-container-low dark:border-gray-700 dark:bg-[#222] p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('available')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ${activeTab === 'available' ? 'bg-primary text-white shadow-sm dark:bg-blue-600' : 'text-on-surface-variant hover:bg-surface-container-high dark:text-gray-300 dark:hover:bg-[#2a2a2a]'}`}
          >
            Available Items
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`rounded-full ml-2 px-4 py-2 text-sm font-semibold transition-all duration-300 ${activeTab === 'inventory' ? 'bg-primary text-white shadow-sm dark:bg-blue-600' : 'text-on-surface-variant hover:bg-surface-container-high dark:text-gray-300 dark:hover:bg-[#2a2a2a]'}`}
          >
            Inventory
          </button>
        </div>
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        {activeTab === 'available' ? <AvailableItems /> : <ManageInventory />}
      </motion.div>
    </div>
  );
}
