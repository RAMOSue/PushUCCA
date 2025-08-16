import { useContext } from "react";
import { UserContext } from "../../context/userContext";
import { Link } from "react-router-dom";

export default function DashboardStaff() {
  const { user } = useContext(UserContext);

  return (
    <div>
      <h2 className="text-2xl font-semibold mb-4 text-purple-600">Staff Dashboard</h2>
      <p>
        Welcome <span className="font-semibold">{user?.name}</span>! You have staff access.
      </p>

      <div className="mt-6 space-y-4">
        <Link
          to="/manage-requests"
          className="block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          📋 Manage Borrow Requests
        </Link>

        {/* ✅ NEW: Manage Returns */}
        <Link
          to="/return-items"
          className="block bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700"
        >
          🔄 Manage Returns
        </Link>

        <Link
          to="/available-items"
          className="block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          📦 View Available Items
        </Link>

        <Link
          to="/manage-inventory"
          className="block bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
        >
          🛠 Manage Inventory
        </Link>
      </div>
    </div>
  );
}
