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

  const defaultMarginLeft = "lg:ml-64";
  const defaultMarginRight = "lg:mr-72";

  if (!contextValue) {
    return (
      <PageLayoutContext.Provider value={true}>
        <div className={`pt-2 px-0 sm:px-2 md:px-4 transition-all duration-300 ease-in-out ${defaultMarginLeft} ${defaultMarginRight} min-h-screen bg-gray-50 dark:bg-[#171717] dark:text-white`}>
          {children}
        </div>
      </PageLayoutContext.Provider>
    );
  }

  const { leftSidebarCollapsed, rightSidebarOpen, isMobile } = contextValue;

  const leftWidthClass = leftSidebarCollapsed ? "lg:ml-20" : "lg:ml-64";
  const rightWidthClass = rightSidebarOpen ? "lg:mr-72" : "lg:mr-0";

  const marginLeft = isNested ? "" : (!isMobile ? leftWidthClass : "ml-0");
  const marginRight = isNested ? "" : (!isMobile ? rightWidthClass : "mr-0");

  return (
    <PageLayoutContext.Provider value={true}>
      <div
        className={`pt-2 px-0 sm:px-2 md:px-4 transition-all duration-300 ease-in-out ${marginLeft} ${marginRight} min-h-screen bg-gray-50 dark:bg-[#171717] dark:text-white`}
        style={{
          willChange: "margin",
        }}
      >
        {children}
      </div>
    </PageLayoutContext.Provider>
  );
}

export default PageLayout;
