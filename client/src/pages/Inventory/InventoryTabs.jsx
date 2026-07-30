import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PageLayout from '../../components/layout/PageLayout';
import AvailableItems from './AvailableItems';
import ManageInventory from './ManageInventory';
import { motion } from 'framer-motion';

export default function InventoryTabs() {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('inventoryActiveTab') || 'manage';
    } catch (e) {
      return 'manage';
    }
  });

  useEffect(() => {
    try { localStorage.setItem('inventoryActiveTab', activeTab); } catch (e) {}
  }, [activeTab]);

  const location = useLocation();

  // When opening the Inventory page via route (sidebar/navigation),
  // force default tab to 'manage' so Manage Inventory is shown first.
  useEffect(() => {
    try {
      if (location.pathname === '/inventory' || location.pathname === '/staff/inventory') {
        setActiveTab('manage');
      }
    } catch (e) {}
  }, [location.pathname]);

  return (
    <PageLayout>
      <div className="min-h-screen bg-surface dark:bg-[#171717] transition-colors duration-300 scroll-smooth">
        <div className="px-6 md:px-8 lg:px-12 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
          <div className="rounded-full border border-outline-variant/20 bg-surface-container-low dark:border-gray-700 dark:bg-[#222] p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 ${activeTab === 'manage' ? 'bg-primary text-white shadow-sm dark:bg-blue-600' : 'text-on-surface-variant hover:bg-surface-container-high dark:text-gray-300 dark:hover:bg-[#2a2a2a]'}`}
          >
            Manage Inventory
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('available')}
            className={`rounded-full ml-2 px-4 py-2 text-sm font-semibold transition-all duration-300 ${activeTab === 'available' ? 'bg-primary text-white shadow-sm dark:bg-blue-600' : 'text-on-surface-variant hover:bg-surface-container-high dark:text-gray-300 dark:hover:bg-[#2a2a2a]'}`}
          >
            Available Items
          </button>
        </div>
          </div>
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === 'manage' ? <ManageInventory /> : <AvailableItems />}
        </motion.div>
      </div>
    </PageLayout>
  );
}
