import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState, DeviceEventEmitter, type AppStateStatus } from "react-native";
import { useAuth } from "./AuthContext";
import { fetchReservedBorrowCart } from "../services/borrowCart";
import { fetchUnreadNotificationCount } from "../services/notifications";

type MobileRealtimeContextValue = {
  cartCount: number;
  notificationCount: number;
  divisionFilter: string | null;
  refreshCartCount: () => Promise<number>;
  refreshNotificationCount: () => Promise<number>;
  setCartCount: (next: number | ((previous: number) => number)) => void;
  setNotificationCount: (next: number | ((previous: number) => number)) => void;
  setDivisionFilter: (next: string | null | ((previous: string | null) => string | null)) => void;
  applyCartDelta: (delta: number) => void;
  applyNotificationDelta: (delta: number) => void;
};

const MobileRealtimeContext = createContext<MobileRealtimeContextValue | undefined>(undefined);

export function MobileRealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cartCount, setCartCountState] = useState(0);
  const [notificationCount, setNotificationCountState] = useState(0);
  const [divisionFilter, setDivisionFilterState] = useState<string | null>(null);

  const setCartCount = useCallback((next: number | ((previous: number) => number)) => {
    setCartCountState((previous) => (typeof next === "function" ? next(previous) : next));
  }, []);

  const setNotificationCount = useCallback((next: number | ((previous: number) => number)) => {
    setNotificationCountState((previous) => (typeof next === "function" ? next(previous) : next));
  }, []);

  const setDivisionFilter = useCallback((next: string | null | ((previous: string | null) => string | null)) => {
    setDivisionFilterState((previous) => (typeof next === "function" ? next(previous) : next));
  }, []);

  const applyCartDelta = useCallback((delta: number) => {
    setCartCountState((previous) => Math.max(0, previous + delta));
  }, []);

  const applyNotificationDelta = useCallback((delta: number) => {
    setNotificationCountState((previous) => Math.max(0, previous + delta));
  }, []);

  const refreshCartCount = useCallback(async () => {
    if (!user?.id) {
      setCartCountState(0);
      return 0;
    }

    try {
      const cart = await fetchReservedBorrowCart(user.id);
      const nextCount = Array.isArray(cart.items) ? cart.items.length : 0;
      setCartCountState(nextCount);
      return nextCount;
    } catch (error) {
      console.error("Error refreshing mobile cart count:", error);
      return 0;
    }
  }, [user?.id]);

  const refreshNotificationCount = useCallback(async () => {
    if (!user?.id) {
      setNotificationCountState(0);
      return 0;
    }

    try {
      const nextCount = await fetchUnreadNotificationCount();
      setNotificationCountState(nextCount);
      return nextCount;
    } catch (error) {
      console.error("Error refreshing mobile notification count:", error);
      return 0;
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setCartCountState(0);
      setNotificationCountState(0);
      return;
    }

    void refreshCartCount();
    void refreshNotificationCount();

    const interval = setInterval(() => {
      void refreshCartCount();
      void refreshNotificationCount();
    }, 10000);

    return () => clearInterval(interval);
  }, [refreshCartCount, refreshNotificationCount, user?.id]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        void refreshCartCount();
        void refreshNotificationCount();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [refreshCartCount, refreshNotificationCount]);

  useEffect(() => {
    const cartSubscription = DeviceEventEmitter.addListener("cart:updated", (payload) => {
      if (typeof payload?.count === "number") {
        setCartCountState(payload.count);
        return;
      }

      const delta = Number(payload?.countDelta ?? payload?.delta ?? 0);
      if (!Number.isFinite(delta) || delta === 0) {
        return;
      }

      setCartCountState((previous) => Math.max(0, previous + delta));
    });

    const notificationSubscription = DeviceEventEmitter.addListener("notifications:updated", (payload) => {
      if (typeof payload?.count === "number") {
        setNotificationCountState(payload.count);
        return;
      }

      const delta = Number(payload?.countDelta ?? payload?.delta ?? 0);
      if (!Number.isFinite(delta) || delta === 0) {
        return;
      }

      setNotificationCountState((previous) => Math.max(0, previous + delta));
    });

    const refreshSubscription = DeviceEventEmitter.addListener("mobile:refresh", (payload) => {
      if (!payload?.screen || payload.screen === "all" || payload.screen === "cart" || payload.screen === "borrow-cart" || payload.screen === "available-items") {
        void refreshCartCount();
      }

      if (!payload?.screen || payload.screen === "all" || payload.screen === "notifications") {
        void refreshNotificationCount();
      }
    });

    return () => {
      cartSubscription.remove();
      notificationSubscription.remove();
      refreshSubscription.remove();
    };
  }, [refreshCartCount, refreshNotificationCount]);

  const value = useMemo<MobileRealtimeContextValue>(
    () => ({
      cartCount,
      notificationCount,
      divisionFilter,
      refreshCartCount,
      refreshNotificationCount,
      setCartCount,
      setNotificationCount,
      setDivisionFilter,
      applyCartDelta,
      applyNotificationDelta,
    }),
    [applyCartDelta, applyNotificationDelta, cartCount, divisionFilter, notificationCount, refreshCartCount, refreshNotificationCount, setCartCount, setNotificationCount, setDivisionFilter]
  );

  return <MobileRealtimeContext.Provider value={value}>{children}</MobileRealtimeContext.Provider>;
}

export function useMobileRealtime() {
  const context = useContext(MobileRealtimeContext);
  if (!context) {
    throw new Error("useMobileRealtime must be used within a MobileRealtimeProvider");
  }

  return context;
}
