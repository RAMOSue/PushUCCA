import { Link, useLocation, useNavigate } from "react-router-dom";
import { useContext, useEffect } from "react";
import { UserContext } from "../../context/userContext";
import axios from "axios";
import { Home, LogOut, Camera, Menu, BookOpen } from "lucide-react";
import NotificationBadge from "./ui/NotificationBadge";
import { notificationService } from "../services/notifications";

export default function Navbar() {
  const { user, setUser } = useContext(UserContext);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const setupNotifications = async () => {
        const initialized = await notificationService.init();
        if (initialized && Notification.permission === "granted") {
          await notificationService.subscribe(user.id);
        }
      };
      setupNotifications();
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await axios.post("/api/auth/logout");
      setUser(null);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err.message);
    }
  };

  const getDashboardLink = () => {
    if (user?.role === "admin") return "/admin/dashboard";
    if (user?.role === "staff") return "/staff";
    return "/dashboard"; // borrower
  };

  // 📱 Borrower Bottom Navbar
  if (user?.role === "borrower") {
    const borrowerRoutes = [
      "/dashboard",
      "/available-items",
      "/borrow-cart",
      "/my-borrowed-items",
      "/scan",
      "/scanner",
    ];

    const isBorrowerRoute = borrowerRoutes.some(
      (r) => location.pathname === r || location.pathname.startsWith(r + "/")
    );

    if (isBorrowerRoute) {
      return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="flex justify-around py-2">
            {/* Home */}
            <Link
              to="/available-items"
              className={`flex flex-col items-center text-sm ${
                location.pathname.includes("/available-items")
                  ? "text-blue-600"
                  : "text-gray-600"
              }`}
            >
              <Home size={22} />
              <span className="text-xs mt-1">Home</span>
            </Link>

            {/* Scan to Borrow */}
            <Link
              to="/scan"
              className={`flex flex-col items-center text-sm ${
                location.pathname.includes("/scan")
                  ? "text-green-600"
                  : "text-gray-600"
              }`}
            >
              <Camera size={22} />
              <span className="text-xs mt-1">Scan</span>
            </Link>

            {/* Borrowed Items */}
            <Link
              to="/my-borrowed-items"
              className={`flex flex-col items-center text-sm ${
                location.pathname.includes("/my-borrowed-items")
                  ? "text-blue-600"
                  : "text-gray-600"
              }`}
            >
              <BookOpen size={22} />
              <span className="text-xs mt-1">Borrowed</span>
            </Link>

            {/* Menu */}
            <Link
              to={getDashboardLink()}
              className={`flex flex-col items-center text-sm ${
                location.pathname === "/dashboard"
                  ? "text-blue-600"
                  : "text-gray-600"
              }`}
            >
              <Menu size={22} />
              <span className="text-xs mt-1">Menu</span>
            </Link>
          </div>
        </nav>
      );
    }
  }

  // 💻 Admin & Staff Navbar (Optimized for 1024px, 1440px, 2560px)
  return (
    <nav className="sticky top-0 bg-white shadow-sm border-b border-gray-200 z-10">
      <div
        className="
          max-w-[2500px] mx-auto 
          flex justify-between items-center 
          px-6 py-4 
          md:px-12 lg:px-20 xl:px-28 
          2xl:px-40
        "
      >
        {/* Logo */}
        <Link
          to="/"
          className="text-2xl lg:text-3xl font-bold text-blue-600 tracking-tight"
        >
          MyApp
        </Link>

        {/* Navigation Links */}
        <div
          className="
            flex items-center space-x-4 
            md:space-x-6 lg:space-x-8 
            xl:space-x-10
            text-sm md:text-base
          "
        >
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
              {/* Dashboard (hidden for staff) */}
              {user?.role !== "staff" && (
                <Link
                  to={getDashboardLink()}
                  className={`transition font-medium ${
                    location.pathname.includes("/dashboard") ||
                    location.pathname.startsWith("/staff")
                      ? "text-blue-600 font-semibold"
                      : "text-gray-700 hover:text-blue-600"
                  }`}
                >
                  Dashboard
                </Link>
              )}

              {/* Available Items (hidden for staff) */}
              {user?.role !== "staff" && (
                <Link
                  to="/available-items"
                  className={`transition font-medium ${
                    location.pathname.includes("/available-items")
                      ? "text-blue-600 font-semibold"
                      : "text-gray-700 hover:text-blue-600"
                  }`}
                >
                  Available Items
                </Link>
              )}

              {/* Admin-only link */}
              {user?.role === "admin" && (
                <Link
                  to="/admin/users"
                  className={`transition font-medium ${
                    location.pathname.includes("/admin/users")
                      ? "text-blue-600 font-semibold"
                      : "text-gray-700 hover:text-blue-600"
                  }`}
                >
                  Manage Users
                </Link>
              )}

              {/* Staff notification badge */}
              {user?.role === "staff" && (
                <div className="ml-2">
                  <NotificationBadge />
                </div>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="
                  text-red-500 hover:text-red-700 
                  transition font-medium 
                  flex items-center gap-1
                "
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
