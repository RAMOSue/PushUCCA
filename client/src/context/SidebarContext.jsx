import { createContext, useState, useEffect, useCallback } from "react";

export const SidebarContext = createContext();

export function SidebarProvider({ children }) {
  const [leftSidebarCollapsed, setLeftSidebarCollapsedState] = useState(() => {
    try {
      const saved = localStorage.getItem("leftSidebarCollapsed");
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
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

  const [isMobile, setIsMobile] = useState(false);

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
