import { create } from 'zustand';
import axios from 'axios';
import toast from 'react-hot-toast';

/**
 * 🚀 Borrowing Store (Zustand)
 * Replaces BorrowingContext with better performance
 * - Granular subscriptions prevent unnecessary re-renders
 * - Debounced localStorage persistence
 * - Better separation of concerns
 */
export const useBorrowingStore = create((set, get) => {
  // Helper: Debounced localStorage setter
  let cartTimeout;
  const saveCartToStorage = (cart) => {
    clearTimeout(cartTimeout);
    cartTimeout = setTimeout(() => {
      localStorage.setItem('borrow_cart', JSON.stringify(cart));
    }, 300); // Debounce to prevent excessive writes
  };

  let itemsTimeout;
  const saveItemsToStorage = (items) => {
    clearTimeout(itemsTimeout);
    itemsTimeout = setTimeout(() => {
      localStorage.setItem('available_items', JSON.stringify(items));
    }, 300);
  };

  return {
    // State
    cart: (() => {
      try {
        const saved = localStorage.getItem('borrow_cart');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    })(),
    
    requestId: null,
    
    availableItems: (() => {
      try {
        const saved = localStorage.getItem('available_items');
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    })(),
    
    refreshTrigger: false,
    refreshHistoryTrigger: false,
    loading: false,
    error: null,

    // Actions
    setCart: (cart) => {
      set({ cart });
      saveCartToStorage(cart);
    },

    addToCart: (item) => {
      const newCart = [...get().cart, item];
      set({ cart: newCart });
      saveCartToStorage(newCart);
    },

    removeFromCart: (unitId) => {
      const newCart = get().cart.filter((item) => item.unitId !== unitId);
      set({ cart: newCart });
      saveCartToStorage(newCart);
    },

    updateCartItem: (unitId, updates) => {
      const newCart = get().cart.map((item) =>
        item.unitId === unitId ? { ...item, ...updates } : item
      );
      set({ cart: newCart });
      saveCartToStorage(newCart);
    },

    clearCart: () => {
      set({ cart: [], requestId: null });
      localStorage.removeItem('borrow_cart');
    },

    setRequestId: (id) => set({ requestId: id }),

    setAvailableItems: (items) => {
      set({ availableItems: items });
      saveItemsToStorage(items);
    },

    // Fetch available items from backend
    refreshAvailableItemsFromServer: async () => {
      set({ loading: true, error: null });
      try {
        const { data } = await axios.get('/api/inventory/available');
        const itemsMap = {};
        data.forEach((item) => {
          itemsMap[item.uuid] = item.total_available ?? 0;
        });
        set({ availableItems: itemsMap, loading: false });
      } catch (err) {
        const message = '❌ Failed to refresh available items: ' + err.message;
        console.error(message);
        set({ error: message, loading: false });
        toast.error(message);
      }
    },

    // Trigger refresh
    triggerRefresh: () => set((state) => ({ refreshTrigger: !state.refreshTrigger })),
    triggerHistoryRefresh: () => set((state) => ({ refreshHistoryTrigger: !state.refreshHistoryTrigger })),

    // Load reserved request from backend
    loadReservedRequest: async (userId) => {
      if (!userId) return;
      try {
        const res = await axios.get(`/api/borrow/reserved/${userId}`);
        if (res.status === 200 && res.data.success && res.data.items?.length) {
          const savedCart = localStorage.getItem('borrow_cart');
          const localCart = savedCart ? JSON.parse(savedCart) : [];
          const hasTemporaryUnits = localCart.some((unit) => unit.unitId?.startsWith('temp-'));

          if (hasTemporaryUnits) {
            console.log('✅ PRESERVING local cart with temporary units:', localCart);
            set({ requestId: res.data.request_id });
            return;
          }

          const restoredCart = res.data.items.map((item) => ({
            unitId: item.unit_id,
            itemId: item.item_id,
            name: item.name,
            size: item.size || 'nosize',
            image_url: item.image_url,
            category: item.garment_type || item.category || 'costume',
            quantity: 1,
            status: 'reserved',
            unit_number: item.unit_number,
          }));

          set({ cart: restoredCart, requestId: res.data.request_id });
          saveCartToStorage(restoredCart);
        }
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error('Failed to load reserved request:', err.message);
        }
      }
    },
  };
});
