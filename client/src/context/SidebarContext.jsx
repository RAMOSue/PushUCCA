import { createContext, useState, useEffect, useCallback } from "react";

const defaultSidebarContext = {
  sidebarOpen: true,
  setSidebarOpen: () => {},
  leftSidebarCollapsed: false,
  setLeftSidebarCollapsed: () => {},
  rightSidebarOpen: true,
  setRightSidebarOpen: () => {},
  isMobile: false,
};

export const SidebarContext = createContext(defaultSidebarContext);

export function SidebarProvider({ children }) {
  const [leftSidebarCollapsed, setLeftSidebarCollapsedState] = useState(() => {
    try {
      const saved = localStorage.getItem("leftSidebarCollapsed");
      if (saved !== null) {
        return JSON.parse(saved);
      }

      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        return true;
      }

      return false;
    } catch {
      return typeof window !== "undefined" && window.innerWidth < 1024;
    }
  });

  const [rightSidebarOpen, setRightSidebarOpenState] = useState(() => {
    try {
      const saved = localStorage.getItem("rightSidebarOpen");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 1024;
    }
    return false;
  });

  const sidebarOpen = !leftSidebarCollapsed;

  const setSidebarOpen = useCallback((value) => {
    setLeftSidebarCollapsedState((prevState) => {
      const nextOpen = typeof value === "function" ? value(!prevState) : value;
      const nextCollapsed = !nextOpen;

      try {
        localStorage.setItem("leftSidebarCollapsed", JSON.stringify(nextCollapsed));
      } catch (e) {
        console.warn("Failed to save left sidebar state:", e);
      }

      return nextCollapsed;
    });
  }, []);

  const setLeftSidebarCollapsed = useCallback((value) => {
    setLeftSidebarCollapsedState((prevState) => {
      const nextValue = typeof value === "function" ? value(prevState) : value;

      try {
        localStorage.setItem("leftSidebarCollapsed", JSON.stringify(nextValue));
      } catch (e) {
        console.warn("Failed to save left sidebar state:", e);
      }

      return nextValue;
    });
  }, []);

  const setRightSidebarOpen = useCallback((value) => {
    setRightSidebarOpenState((prevState) => {
      const nextValue = typeof value === "function" ? value(prevState) : value;

      try {
        localStorage.setItem("rightSidebarOpen", JSON.stringify(nextValue));
      } catch (e) {
        console.warn("Failed to save right sidebar state:", e);
      }

      return nextValue;
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        sidebarOpen,
        setSidebarOpen,
        leftSidebarCollapsed,
        setLeftSidebarCollapsed,
        rightSidebarOpen,
        setRightSidebarOpen,
        isMobile,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
