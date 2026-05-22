/**
 * 🚀 ZUSTAND MIGRATION GUIDE
 * 
 * This file shows before/after examples for migrating from Context to Zustand
 */

// ============================================================================
// 1️⃣ SIDEBAR STATE - Before (Context) → After (Zustand)
// ============================================================================

// ❌ BEFORE: Using SidebarContext
// import { useContext } from 'react';
// import { SidebarContext } from './context/SidebarContext';
// 
// function Navbar() {
//   const { sidebarOpen, setSidebarOpen, isMobile } = useContext(SidebarContext);
//   return (
//     <button onClick={() => setSidebarOpen(!sidebarOpen)}>
//       {sidebarOpen ? 'Close' : 'Open'}
//     </button>
//   );
// }

// ✅ AFTER: Using Zustand
import { useSidebarStore } from '../context/sidebarStore';

function NavbarExample() {
  // Select ONLY the state you need (prevents re-renders on other state changes)
  const sidebarOpen = useSidebarStore((state) => state.sidebarOpen);
  const toggleSidebar = useSidebarStore((state) => state.toggleSidebar);

  return (
    <button onClick={toggleSidebar}>
      {sidebarOpen ? 'Close' : 'Open'}
    </button>
  );
}

// ============================================================================
// 2️⃣ MODAL STATE - Before (Context) → After (Zustand)
// ============================================================================

// ❌ BEFORE: Using LoginModalContext
// import { useContext } from 'react';
// import { LoginModalContext } from './context/LoginModalContext';
// 
// function LoginButton() {
//   const { openLoginModal } = useContext(LoginModalContext);
//   return <button onClick={openLoginModal}>Login</button>;
// }
//
// function LoginModal() {
//   const { showLoginModal, closeLoginModal } = useContext(LoginModalContext);
//   if (!showLoginModal) return null;
//   return (
//     <div>Login Modal Content</div>
//   );
// }

// ✅ AFTER: Using Zustand
import { useLoginModalStore } from '../context/loginModalStore';

function LoginButtonExample() {
  const openLoginModal = useLoginModalStore((state) => state.openLoginModal);
  return <button onClick={openLoginModal}>Login</button>;
}

function LoginModalExample() {
  const showLoginModal = useLoginModalStore((state) => state.showLoginModal);
  const closeLoginModal = useLoginModalStore((state) => state.closeLoginModal);
  
  if (!showLoginModal) return null;
  return (
    <div>Login Modal Content</div>
  );
}

// ============================================================================
// 3️⃣ CART STATE - Before (Context) → After (Zustand)
// ============================================================================

// ❌ BEFORE: Using BorrowingContext
// import { useContext } from 'react';
// import { BorrowingContext } from './context/borrowingContext';
// 
// function BorrowCart() {
//   const { cart, setCart, addToCart, removeFromCart } = useContext(BorrowingContext);
//   
//   return (
//     <div>
//       {cart.map(item => (
//         <div key={item.unitId}>{item.name}</div>
//       ))}
//     </div>
//   );
// }

// ✅ AFTER: Using Zustand
import { useBorrowingStore } from '../context/borrowingStore';

function BorrowCartExample() {
  // Only subscribe to cart (not entire store)
  const cart = useBorrowingStore((state) => state.cart);
  const removeFromCart = useBorrowingStore((state) => state.removeFromCart);

  return (
    <div>
      {cart.map((item) => (
        <div key={item.unitId}>
          {item.name}
          <button onClick={() => removeFromCart(item.unitId)}>Remove</button>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// 4️⃣ MULTIPLE STATE SELECTORS (Advanced)
// ============================================================================

// When you need multiple state values, use shallow comparison
import { shallow } from 'zustand/react';

function CartSummary() {
  // Select multiple values without triggering re-renders on unrelated changes
  const { cart, requestId, availableItems } = useBorrowingStore(
    (state) => ({
      cart: state.cart,
      requestId: state.requestId,
      availableItems: state.availableItems,
    }),
    shallow // Only re-render if these specific values change
  );

  return (
    <div>
      <p>Items in cart: {cart.length}</p>
      <p>Request ID: {requestId}</p>
    </div>
  );
}

// ============================================================================
// 5️⃣ LOADING & ERROR STATES
// ============================================================================

function AvailableItemsLoader() {
  const loading = useBorrowingStore((state) => state.loading);
  const error = useBorrowingStore((state) => state.error);
  const refreshAvailableItemsFromServer = useBorrowingStore(
    (state) => state.refreshAvailableItemsFromServer
  );

  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}
      <button onClick={refreshAvailableItemsFromServer}>
        Refresh Items
      </button>
    </div>
  );
}

// ============================================================================
// 🎯 PERFORMANCE BENEFITS
// ============================================================================

/**
 * ✅ Why Zustand is faster:
 * 
 * 1. GRANULAR SUBSCRIPTIONS
 *    - Only components that use a specific state re-render
 *    - Example: Changing sidebarOpen doesn't re-render LoginModal
 * 
 * 2. NO CONTEXT OVERHEAD
 *    - Context causes Provider re-renders
 *    - Zustand directly updates subscribers
 * 
 * 3. LESS BOILERPLATE
 *    - No need for useCallback, useMemo
 *    - No memo() needed on consumers
 * 
 * 4. BETTER FOR FREQUENT UPDATES
 *    - Cart item additions/removals
 *    - Modal toggles
 *    - Sidebar resizing
 * 
 * EXPECTED IMPROVEMENTS:
 * - 30-50% faster re-renders in navigation/UI components
 * - Smoother sidebar toggle animations
 * - Faster modal open/close
 * - Better performance on cart operations
 */

export { NavbarExample, LoginButtonExample, BorrowCartExample, CartSummary };
