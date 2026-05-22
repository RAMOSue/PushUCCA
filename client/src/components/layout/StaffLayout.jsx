import { Outlet } from "react-router-dom";
import RightNavbar from "../navigation/RightNavbar";

export default function StaffLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#171717]">
      {/* ✅ SideNavbar is now shown at root level in App.jsx for all roles */}
      {/* ✅ RightNavbar is also shown at root level in App.jsx */}
      <Outlet />
    </div>
  );
}
