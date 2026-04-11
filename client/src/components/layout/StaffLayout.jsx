import { Outlet } from "react-router-dom";
import SideNavbar from "../navigation/SideNavbar";
import RightNavbar from "../navigation/RightNavbar";

export default function StaffLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#171717]">
      <SideNavbar role="staff" />
      <RightNavbar />
      <Outlet />
    </div>
  );
}
