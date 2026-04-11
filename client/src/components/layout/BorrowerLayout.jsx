/**
 * BorrowerLayout - Layout shell for borrower pages
 * 
 * Provides:
 * - Left sidebar navigation (SideNavbar with borrower items)
 * - Top navbar (Navbar with profile and actions)
 * - Responsive design for desktop and mobile
 * - SidebarContext handles overlay on mobile, shift on desktop
 */

import { Outlet } from "react-router-dom";
import SideNavbar from "../navigation/SideNavbar";
import RightNavbar from "../navigation/RightNavbar";

export default function BorrowerLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#171717]">
      {/* Left Sidebar - Borrower Navigation (Mobile: overlay, Desktop: shift) */}
      <SideNavbar role="borrower" />
      
      {/* Top Navbar - Profile & Actions */}
      <RightNavbar />
      
      {/* Page Content - Will be wrapped with PageLayout by individual pages */}
      <Outlet />
    </div>
  );
}
