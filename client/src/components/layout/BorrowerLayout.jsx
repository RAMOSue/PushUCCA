/**
 * BorrowerLayout - Layout shell for borrower pages
 * 
 * NOTE: Sidebars are now rendered at root level in App.jsx for all roles
 * This layout just provides the page structure via Outlet
 * 
 * Provides:
 * - Page content outlet
 * - Background styling
 */

import { Outlet } from "react-router-dom";

export default function BorrowerLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#171717]">
      {/* ✅ SideNavbar and RightNavbar are now shown at root level in App.jsx for all roles */}
      <Outlet />
    </div>
  );
}
