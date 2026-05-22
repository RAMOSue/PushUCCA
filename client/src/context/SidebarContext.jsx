import { createContext, useState, useEffect, useCallback } from "react";

export const SidebarContext = createContext();

export function SidebarProvider({ children }) {
  // Initialize from localStorage, default to true if not found
  const [sidebarOpen, setSidebarOpenState] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebarOpen");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  
  const [isMobile, setIsMobile] = useState(false);

  // Wrapper to persist sidebar state to localStorage - using useCallback to avoid closure issues
  const setSidebarOpen = useCallback((value) => {
    setSidebarOpenState((prevState) => {
      const newValue = typeof value === "function" ? value(prevState) : value;
      try {
        localStorage.setItem("sidebarOpen", JSON.stringify(newValue));
        console.log("✅ Sidebar state saved to localStorage:", newValue);
      } catch (e) {
        console.warn("Failed to save sidebar state:", e);
      }
      return newValue;
    });
  }, []);

  // Detect mobile screen
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <SidebarContext.Provider value={{ sidebarOpen, setSidebarOpen, isMobile }}>
      {children}
    </SidebarContext.Provider>
  );
}
