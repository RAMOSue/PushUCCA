// client/src/pages/DashboardAdmin.jsx
import { useContext } from "react";
import { UserContext } from "../../context/userContext";
import { Link } from "react-router-dom";

export default function DashboardAdmin() {
  const { user } = useContext(UserContext);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-red-600">Admin Dashboard</h2>
      <p>
        Welcome <span className="font-semibold">{user?.name}</span>! You have admin access.
      </p>

      <div className="mt-6 space-y-4">
        {/* Manage Borrow Requests */}
        <Link
          to="/admin/manage-requests"
          className="block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          📋 Manage Borrow Requests
        </Link>

        {/* Manage Returns */}
        <Link
          to="/admin/return-items"
          className="block bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700"
        >
          🔄 Manage Returns
        </Link>

        {/* Available Items */}
        <Link
          to="/admin/available-items"
          className="block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          📦 View Available Items
        </Link>

        {/* Manage Inventory */}
        <Link
          to="/admin/manage-inventory"
          className="block bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
        >
          🛠 Manage Inventory
        </Link>

        {/* Reports */}
        <Link
          to="/admin/reports"
          className="block bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
        >
          📊 Reports & Analytics
        </Link>
      </div>
    </div>
  );
}
