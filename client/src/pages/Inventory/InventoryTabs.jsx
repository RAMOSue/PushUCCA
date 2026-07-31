import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import AvailableItems from './AvailableItems';
import ManageInventory from './ManageInventory';
import { motion } from 'framer-motion';
import PageLayout from '../../components/layout/PageLayout';

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
        <div className="px-3 sm:px-6 md:px-8 lg:px-12 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 border-b border-outline-variant/20 dark:border-gray-700 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('manage')}
                className={`text-sm font-semibold transition duration-300 ${activeTab === 'manage' ? 'text-primary dark:text-blue-400' : 'text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white'}`}
              >
                Manage Inventory
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('available')}
                className={`text-sm font-semibold transition duration-300 ${activeTab === 'available' ? 'text-primary dark:text-blue-400' : 'text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white'}`}
              >
                Available Items
              </button>
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
      </div>
    </PageLayout>
  );
}
