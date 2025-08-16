// src/components/Navbar.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useContext } from "react";
import { UserContext } from "../../context/userContext";
import axios from "axios";

export default function Navbar() {
  const { user, setUser } = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout");
      setUser(null);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err.message);
    }
  };

  return (
    <nav className="bg-white shadow-md px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold text-blue-600">
          MyApp
        </Link>

        {/* Links */}
        <div className="space-x-4">
          {!user ? (
            <>
              <Link
                to="/login"
                className="text-gray-700 hover:text-blue-600 transition font-medium"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="text-gray-700 hover:text-blue-600 transition font-medium"
              >
                Register
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/dashboard"
                className="text-gray-700 hover:text-blue-600 transition font-medium"
              >
                Dashboard
              </Link>
              <Link
                to="/available-items"
                className="text-gray-700 hover:text-blue-600 transition font-medium"
              >
                Available Items
              </Link>
              {user?.role === "borrower" && (
              <Link to="/borrow-cart" className="text-gray-700 hover:text-blue-600 font-medium">
              Borrow Cart
              </Link>
                )}

              <button
                onClick={handleLogout}
                className="text-red-500 hover:text-red-700 font-medium"
              >
                Logout
              </button>
              {user?.role === "admin" && (
                <Link
                  to="/admin/users"
                  className="text-sm text-blue-600 hover:underline"
                >
                  Manage Users
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
