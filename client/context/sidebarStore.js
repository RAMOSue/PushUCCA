import { create } from 'zustand';

export const DIVISION_OPTIONS = ['All', 'Dulimbay', 'Budjong', 'Kayam'];

const normalizeDivision = (value) => {
  if (!value || !DIVISION_OPTIONS.includes(value)) {
    return 'All';
  }
  return value;
};

const getPersistedDivision = () => {
  try {
    const saved = localStorage.getItem('duBudKaSelectedDivision');
    return normalizeDivision(saved);
  } catch {
    return 'All';
  }
};

/**
 * 🚀 Sidebar Store (Zustand)
 * Replaces SidebarContext with better performance
 * - No re-renders of entire app on sidebar toggle
 * - Selective subscription to exact state changes
 */
export const useSidebarStore = create((set) => ({
  sidebarOpen: true,
  isMobile: false,
  selectedDivision: getPersistedDivision(),

  // Actions
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (isOpen) => set({ sidebarOpen: isOpen }),
  setIsMobile: (mobile) => set({ isMobile: mobile }),
  setSelectedDivision: (division) => {
    const nextDivision = normalizeDivision(division);
    try {
      localStorage.setItem('duBudKaSelectedDivision', nextDivision);
    } catch (error) {
      console.warn('Failed to persist selected division:', error);
    }
    set({ selectedDivision: nextDivision });
  },

  // Utility: Initialize mobile state on app load
  initializeMobile: () => {
    const isMobile = window.innerWidth < 1024;
    set({ isMobile });
    return isMobile;
  },
}));
