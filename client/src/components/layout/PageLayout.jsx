/**
 * PageLayout Component - Synchronized Content with Sidebars
 * 
 * Features:
 * - Smooth transitions synchronized with left and right sidebars
 * - Mobile: Sidebars overlay (no margin shift)
 * - Desktop: Content shifts inward when both sidebars are open
 * - No content distortion—sidebar animations don't affect layout
 * - Cubic-bezier timing matches navbar animations
 * 
 * Usage:
 * <PageLayout>
 *   <YourPageContent />
 * </PageLayout>
 */

import { useContext } from "react";
import { SidebarContext } from "../../../context/SidebarContext";

export function PageLayout({ children }) {
  const contextValue = useContext(SidebarContext);
  
  // Fallback if context is not available
  if (!contextValue) {
    return (
      <div className={`pt-16 px-4 md:px-6 transition-all duration-300 ease-in-out ml-0 lg:mr-72 min-h-screen bg-gray-50 dark:bg-[#171717] dark:text-white`}>
        {children}
      </div>
    );
  }
  
  const { sidebarOpen, isMobile } = contextValue;
  
  // Content shifts inward on desktop when sidebars open
  // On mobile, sidebars overlay (no shift)
  const marginLeft = !isMobile && sidebarOpen ? "lg:ml-72" : "ml-0";
  const marginRight = !isMobile && sidebarOpen ? "lg:mr-72" : "lg:mr-0";
  
  return (
    <div 
      className={`pt-2 px-4 md:px-6 transition-all duration-300 ease-in-out ${marginLeft} ${marginRight} min-h-screen bg-gray-50 dark:bg-[#171717] dark:text-white`}
      style={{
        willChange: sidebarOpen ? "margin" : "auto",
      }}
    >
      {children}
    </div>
  );
}

export default PageLayout;
