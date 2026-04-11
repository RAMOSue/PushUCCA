/**
 * Test User Switcher - Component to manage multiple logged-in users
 * Shows list of stored users and allows quick switching
 * Only visible in development/testing mode
 */

import { useState, useEffect, useContext } from "react";
import { ChevronDown, LogOut, User } from "lucide-react";
import tokenManager from "../utils/tokenManager";
import { UserContext } from "../../context/userContext";
import axios from "axios";

export default function TestUserSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const { setUser, user } = useContext(UserContext);

  // Only show in development
  const isDevelopment = process.env.NODE_ENV === "development";

  // Refresh user list
  useEffect(() => {
    const updateUsers = () => {
      const allUsers = tokenManager.getAllUsers();
      setUsers(allUsers);
      const active = tokenManager.getActiveUser();
      setActiveUser(active);
    };

    updateUsers();

    // Listen for storage changes (updates from other tabs)
    const handleStorageChange = (e) => {
      if (e.key === tokenManager.STORAGE_KEY || e.key === tokenManager.ACTIVE_TOKEN_KEY) {
        updateUsers();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  if (!isDevelopment || users.length === 0) {
    return null; // Hidden in production or when no users stored
  }

  const handleSwitchUser = (userId) => {
    tokenManager.setActiveToken(userId);
    const activeUser = tokenManager.getActiveUser();
    
    if (activeUser) {
      // Update axios default header
      axios.defaults.headers.common["Authorization"] = `Bearer ${tokenManager.getActiveTokenString()}`;
      
      // Update UserContext
      setUser(activeUser);
      console.log(`🔄 Switched to: ${activeUser.email}`);
    }
    
    setIsOpen(false);
  };

  const handleLogoutUser = (userId, e) => {
    e.stopPropagation();
    tokenManager.removeToken(userId);
    
    // If logged out user was active, switch to first available
    if (tokenManager.getActiveToken() === null && tokenManager.count() > 0) {
      const firstUser = Object.values(tokenManager.tokens)[0];
      handleSwitchUser(firstUser.userId);
    } else {
      setUsers(tokenManager.getAllUsers());
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all"
        title={`Test Mode: ${users.length} user(s) logged in`}
      >
        <User className="w-4 h-4" />
        <span className="text-sm font-medium">{users.length} Users</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-14 right-0 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-72 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
              Logged In Users ({users.length})
            </p>
          </div>

          <div className="p-2 space-y-1">
            {users.map((testUser) => {
              const isActive = activeUser?.id === testUser.userId;
              return (
                <div
                  key={testUser.userId}
                  onClick={() => handleSwitchUser(testUser.userId)}
                  className={`p-3 rounded-lg cursor-pointer transition-all flex items-center justify-between group ${
                    isActive
                      ? "bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700"
                      : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white"}`}>
                      {testUser.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {testUser.email}
                    </p>
                    <p className={`text-xs font-semibold mt-1 ${
                      testUser.role === "admin"
                        ? "text-red-600 dark:text-red-400"
                        : testUser.role === "staff"
                        ? "text-orange-600 dark:text-orange-400"
                        : "text-green-600 dark:text-green-400"
                    }`}>
                      {testUser.role.toUpperCase()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-2">
                    {isActive && (
                      <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full" />
                    )}
                    <button
                      onClick={(e) => handleLogoutUser(testUser.userId, e)}
                      className="p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50"
                      title="Logout this user"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                tokenManager.clearAll();
                setUsers([]);
                setActiveUser(null);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
            >
              Clear All Users
            </button>
          </div>

          <div className="p-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              💡 Tip: Use <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">localStorage.getItem('debug:multi-user-tokens')</code> to inspect in console
            </p>
          </div>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
