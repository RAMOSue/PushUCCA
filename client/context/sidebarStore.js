import { create } from 'zustand';

/**
 * 🚀 Sidebar Store (Zustand)
 * Replaces SidebarContext with better performance
 * - No re-renders of entire app on sidebar toggle
 * - Selective subscription to exact state changes
 */
export const useSidebarStore = create((set) => ({
  sidebarOpen: true,
  isMobile: false,

  // Actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
  setIsMobile: (mobile) => set({ isMobile: mobile }),

  // Utility: Initialize mobile state on app load
  initializeMobile: () => {
    const isMobile = window.innerWidth < 1024;
    set({ isMobile });
    return isMobile;
  },
}));
