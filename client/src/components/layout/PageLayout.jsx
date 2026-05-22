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
import { SidebarContext } from "../../context/SidebarContext";

export function PageLayout({ children }) {
  const contextValue = useContext(SidebarContext);
  
  // Sidebar widths:
  // - Left sidebar (SideNavbar): w-64 (16rem / 256px)
  // - Right navbar (RightNavbar): w-72 (18rem / 288px)
  const defaultMarginLeft = "lg:ml-64";
  const defaultMarginRight = "lg:mr-72";
  
  // Fallback if context is not available
  if (!contextValue) {
    return (
      <div className={`pt-2 px-0 sm:px-2 md:px-4 transition-all duration-300 ease-in-out ${defaultMarginLeft} ${defaultMarginRight} min-h-screen bg-gray-50 dark:bg-[#171717] dark:text-white`}>
        {children}
      </div>
    );
  }
  
  const { sidebarOpen, isMobile } = contextValue;
  
  // Content shifts inward on desktop when sidebars open
  // On mobile, sidebars overlay (no shift) with 0 margins
  // Always apply margins on lg+ screens to account for sidebars
  const marginLeft = !isMobile ? "lg:ml-64" : "ml-0";
  const marginRight = !isMobile ? "lg:mr-72" : "mr-0";
  
  return (
    <div 
      className={`pt-2 px-0 sm:px-2 md:px-4 transition-all duration-300 ease-in-out ${marginLeft} ${marginRight} min-h-screen bg-gray-50 dark:bg-[#171717] dark:text-white`}
      style={{
        willChange: sidebarOpen ? "margin" : "auto",
      }}
    >
      {children}
    </div>
  );
}

export default PageLayout;
