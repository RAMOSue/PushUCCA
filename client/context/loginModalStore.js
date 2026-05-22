import { create } from 'zustand';

/**
 * 🚀 Login Modal Store (Zustand)
 * Replaces LoginModalContext with better performance
 * - No re-renders of entire app on modal visibility change
 * - Lightweight, direct subscriptions to modal state
 */
export const useLoginModalStore = create((set) => ({
  showLoginModal: false,
  showRegisterModal: false,

  // Actions
  openLoginModal: () => set({ showLoginModal: true, showRegisterModal: false }),
  closeLoginModal: () => set({ showLoginModal: false }),
  
  openRegisterModal: () => set({ showRegisterModal: true, showLoginModal: false }),
  closeRegisterModal: () => set({ showRegisterModal: false }),
  
  switchToRegister: () => {
    set({ showLoginModal: false });
    setTimeout(() => {
      set({ showRegisterModal: true });
    }, 300);
  },
  
  switchToLogin: () => {
    set({ showRegisterModal: false });
    setTimeout(() => {
      set({ showLoginModal: true });
    }, 300);
  },
}));
