// client/src/pages/DashboardStaff.jsx
import { useContext } from "react";
import { UserContext } from "../../context/userContext";
import { Link, Outlet, useLocation } from "react-router-dom";
// StaffNotificationPanel (dev) removed; NotificationBell is used elsewhere in Navbar

export default function DashboardStaff() {
  const { user } = useContext(UserContext);
  const location = useLocation();

  // ✅ Updated paths to nested staff routes
  const navItems = [
    { path: "/staff/manage-requests", label: "📋 Manage Borrow Requests" },
    { path: "/staff/return-items", label: "🔄 Manage Returns" },
    { path: "/staff/schedule", label: "📅 Schedule Perfomance" },
    { path: "/staff/available-items", label: "📦 View Available Items" },
    { path: "/staff/manage-inventory", label: "🛠 Manage Inventory" },
    { path: "/staff/borrower-profiles", label: "🧾 View Borrower Profiles" },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-purple-800 text-white flex flex-col p-4 shadow-lg">
        <h2 className="text-2xl font-bold mb-6 text-center">Staff Dashboard</h2>

        <p className="mb-6 text-center text-sm">
          Welcome, <span className="font-semibold">{user?.name}</span> 👋
        </p>

        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-2 rounded-md transition text-sm ${
                location.pathname === item.path
                  ? "bg-pink-500 font-semibold shadow"
                  : "hover:bg-purple-700"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 gap-6">
          {/* Notification Panel removed - staff notifications are accessible via the navbar bell */}
          
          {/* Main Content */}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
