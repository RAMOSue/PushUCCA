// client/src/pages/Settings.jsx
import { useContext, useState } from "react";
import { UserContext } from "../../context/userContext";
import { Sun, Moon, Save } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

export default function Settings() {
  const { user, setUser, theme, toggleTheme } = useContext(UserContext);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    currentPassword: "",
    newPassword: "",
  });

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  // 💾 Update profile info
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await axios.put("/api/auth/update-profile", {
        name: formData.name,
        email: formData.email,
      });
      toast.success("Profile updated successfully!");
      setUser({ ...user, name: formData.name, email: formData.email });
    } catch (err) {
      toast.error("Failed to update profile");
    }
  };

  // 🔐 Change password
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    try {
      await axios.put("/api/auth/change-password", {
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });
      toast.success("Password updated successfully!");
      setFormData({ ...formData, currentPassword: "", newPassword: "" });
    } catch (err) {
      toast.error(
        err.response?.data?.error || "Failed to change password. Try again."
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-6 transition-colors duration-300">
      <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 shadow-md rounded-xl p-6">
        <h2 className="text-2xl font-semibold mb-6 dark:text-white">
          Account Settings
        </h2>

        {/* Profile Info */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="mt-1 w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium dark:text-gray-300">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="mt-1 w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
          >
            <Save size={18} /> Save Changes
          </button>
        </form>

        

        {/* Change Password */}
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <h3 className="text-lg font-semibold dark:text-white">
            Change Password
          </h3>
          <input
            type="password"
            name="currentPassword"
            placeholder="Current Password"
            value={formData.currentPassword}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="password"
            name="newPassword"
            placeholder="New Password"
            value={formData.newPassword}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="submit"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
          >
            <Save size={18} /> Update Password
          </button>
        </form>

        <hr className="my-8 border-gray-300 dark:border-gray-600" />

        {/* 🌙 Dark Mode Toggle (Global Context) */}
        <div className="flex items-center justify-between">
          <span className="font-medium dark:text-white">Dark Mode</span>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 transition"
          >
            {theme === "dark" ? (
              <Sun className="text-yellow-400" size={20} />
            ) : (
              <Moon className="text-gray-800" size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
