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

import { useContext, createContext } from "react";
import { SidebarContext } from "../../context/SidebarContext";

// Context to detect nested PageLayout usage so inner layouts don't re-apply margins
export const PageLayoutContext = createContext(false);

export function PageLayout({ children }) {
  const contextValue = useContext(SidebarContext);
  const isNested = useContext(PageLayoutContext);
  
  // Sidebar widths:
  // - Left sidebar (SideNavbar): w-64 (16rem / 256px)
  // - Right navbar (RightNavbar): w-72 (18rem / 288px)
  const defaultMarginLeft = "lg:ml-64";
  const defaultMarginRight = "lg:mr-72";
  
  // Fallback if context is not available
  if (!contextValue) {
    return (
      <PageLayoutContext.Provider value={true}>
        <div className={`pt-2 px-0 sm:px-2 md:px-4 transition-all duration-300 ease-in-out ${defaultMarginLeft} ${defaultMarginRight} min-h-screen bg-gray-50 dark:bg-[#171717] dark:text-white`}>
          {children}
        </div>
      </PageLayoutContext.Provider>
    );
  }
  
  const { sidebarOpen, isMobile } = contextValue;
  
  // Content shifts inward on desktop when sidebars open
  // On mobile, sidebars overlay (no shift) with 0 margins
  // Always apply margins on lg+ screens to account for sidebars
  // If this PageLayout is nested inside another PageLayout, avoid re-applying
  // the large-screen margins so content width is not reduced twice.
  const marginLeft = isNested ? "" : (!isMobile ? "lg:ml-64" : "ml-0");
  const marginRight = isNested ? "" : (!isMobile ? "lg:mr-72" : "mr-0");
  
  return (
    <PageLayoutContext.Provider value={true}>
      <div 
        className={`pt-2 px-0 sm:px-2 md:px-4 transition-all duration-300 ease-in-out ${marginLeft} ${marginRight} min-h-screen bg-gray-50 dark:bg-[#171717] dark:text-white`}
        style={{
          willChange: sidebarOpen ? "margin" : "auto",
        }}
      >
        {children}
      </div>
    </PageLayoutContext.Provider>
  );
}

export default PageLayout;
