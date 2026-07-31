import { useState, useEffect, useRef } from 'react';
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

  const [manageFilterCategory, setManageFilterCategory] = useState(null);
  const addItemHandlerRef = useRef(null);

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
        <div className="px-4 sm:px-4 md:px-4 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4 border-b border-outline-variant/20 dark:border-gray-700 pb-2">
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => setActiveTab('manage')}
                className={`text-sm transition duration-300 ${activeTab === 'manage' ? 'text-primary dark:text-blue-400 font-semibold border-b-2 border-primary dark:border-blue-400 pb-2' : 'text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white pb-2'}`}
              >
                Manage Inventory
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('available')}
                className={`text-sm transition duration-300 ${activeTab === 'available' ? 'text-primary dark:text-blue-400 font-semibold border-b-2 border-primary dark:border-blue-400 pb-2' : 'text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white pb-2'}`}
              >
                Available Items
              </button>
            </div>

            {activeTab === 'manage' && (
              <div className="flex items-center gap-3">
                <select
                  value={manageFilterCategory || 'all'}
                  onChange={(e) => setManageFilterCategory(e.target.value === 'all' ? null : e.target.value)}
                  className="text-sm rounded-full border border-outline-variant/20 bg-surface-container-low dark:bg-[#222] px-4 py-2 text-on-surface dark:text-white"
                >
                  <option value="all">Filter</option>
                  <option value="costume">Costumes</option>
                  <option value="instrument">Instruments</option>
                  <option value="accessories">Accessories</option>
                </select>
                <button
                  type="button"
                  onClick={() => addItemHandlerRef.current?.()}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/10 hover:bg-primary-container transition"
                >
                  <span className="text-lg leading-none">+</span>
                  Add Item
                </button>
              </div>
            )}
          </div>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'manage' ? (
              <ManageInventory
                filterCategory={manageFilterCategory}
                registerAddItemHandler={(handler) => { addItemHandlerRef.current = handler; }}
              />
            ) : (
              <AvailableItems />
            )}
          </motion.div>
        </div>
      </div>
    </PageLayout>
  );
}
