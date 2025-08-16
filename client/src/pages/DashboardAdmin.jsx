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
        <Link
          to="/manage-requests"
          className="block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          📋 Manage Borrow Requests
        </Link>

        {/* Manage Returns */}
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
