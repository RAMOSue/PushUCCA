import React, { useState, useMemo, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import PageLayout from "../../components/layout/PageLayout";
import toast from "react-hot-toast";
import { UserContext } from "../../../context/userContext";
import borrowerService from "../../services/borrowerService";
import {
  Settings as SettingsIcon,
  Bell,
  Lock,
  User,
  Palette,
  Search,
  ChevronDown,
  Eye,
  Download,
  Zap,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle,
  Moon,
  Sun,
  Monitor,
  Smartphone,
  Plug,
  FileText,
  LogOut,
  ToggleRight,
  ToggleLeft,
  AlertTriangle,
  RefreshCw,
  Loader,
  Globe,
  Smartphone as MobileIcon,
} from "lucide-react";

export default function Settings() {
  const { user, darkMode, setDarkMode, changePassword } = useContext(UserContext);
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Password change modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Activity Logs State
  const [activityLogs, setActivityLogs] = useState([]);
  const [loginHistory, setLoginHistory] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState(null);
  
  // Settings state from database
  const [settings, setSettings] = useState({
    dark_mode: false,
    notifications_enabled: true,
    two_fa_enabled: false,
    compact_mode: false,
    duplicate_protection: true,
    animation_level: "standard",
    request_alerts: true,
    conflict_alerts: true,
    reminder_frequency: "daily",
    auto_approval_enabled: false,
    accent_color: "indigo",
    date_format: "MM/DD/YYYY",
    theme: "system",
  });

  // Fetch settings on component mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        const data = await borrowerService.getUserSettings();
        setSettings(data);
        // ✅ Sync dark_mode from database with UserContext
        if (data.dark_mode !== darkMode) {
          setDarkMode(data.dark_mode);
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
        setHasError(true);
        toast.error("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Function to save settings to backend
  const saveSettings = async (updatedSettings) => {
    try {
      setIsSaving(true);
      const response = await borrowerService.updateUserSettings(updatedSettings);
      setSettings(response.settings);
      toast.success("Settings saved successfully");
      return true;
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error("Failed to save settings");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // Handle setting change
  const handleSettingChange = (fieldName, fieldValue) => {
    // Update local state immediately for UI responsiveness
    const newSettings = {
      ...settings,
      [fieldName]: fieldValue,
    };
    setSettings(newSettings);
    
    // Special handling for dark_mode - sync with UserContext
    if (fieldName === "dark_mode") {
      setDarkMode(fieldValue);
    }
    
    // Save to backend
    saveSettings({ [fieldName]: fieldValue });
  };

  // Handle password change form submission
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    // ✅ Comprehensive validation
    if (!passwordForm.currentPassword.trim()) {
      toast.error("⚠️ Current password is required");
      return;
    }
    
    if (!passwordForm.newPassword.trim()) {
      toast.error("⚠️ New password is required");
      return;
    }
    
    if (!passwordForm.confirmPassword.trim()) {
      toast.error("⚠️ Please confirm your new password");
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("❌ New passwords do not match");
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      toast.error("❌ Password must be at least 6 characters");
      return;
    }

    // ✅ Prevent same password
    if (passwordForm.currentPassword === passwordForm.newPassword) {
      toast.error("❌ New password must be different from current password");
      return;
    }
    
    try {
      setIsChangingPassword(true);
      const result = await changePassword(
        passwordForm.currentPassword.trim(), 
        passwordForm.newPassword.trim()
      );
      
      if (result.success) {
        toast.success(result.message || "✅ Password changed successfully!");
        setShowPasswordModal(false);
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        toast.error(result.message || "Failed to change password");
      }
    } catch (err) {
      console.error("Password change error:", err);
      toast.error("❌ An error occurred while changing your password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ✅ Fetch Activity Logs
  const fetchActivityLogs = async () => {
    try {
      setIsLoadingLogs(true);
      setLogsError(null);
      const response = await borrowerService.getActivityLogs();
      setActivityLogs(Array.isArray(response) ? response : response.logs || []);
    } catch (err) {
      console.error("Failed to fetch activity logs:", err);
      setLogsError("Failed to load activity logs");
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // ✅ Fetch Login History
  const fetchLoginHistory = async () => {
    try {
      setIsLoadingLogs(true);
      setLogsError(null);
      const response = await borrowerService.getLoginHistory();
      setLoginHistory(Array.isArray(response) ? response : response.history || []);
    } catch (err) {
      console.error("Failed to fetch login history:", err);
      setLogsError("Failed to load login history");
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // ✅ Download Logs as CSV
  const downloadLogsAsCSV = async () => {
    try {
      const response = await borrowerService.downloadActivityLogsCSV();
      // Create a blob and trigger download
      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `activity-logs-${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Logs downloaded successfully");
    } catch (err) {
      console.error("Failed to download logs:", err);
      toast.error("Failed to download logs");
    }
  };

  const sections = [
    {
      id: "quick",
      title: "Quick Settings",
      icon: Zap,
      items: [
        {
          label: "Dark Mode",
          description: "Reduce eye strain",
          type: "toggle",
          fieldName: "dark_mode",
          value: settings.dark_mode,
          onChange: (val) => handleSettingChange("dark_mode", val),
          status: settings.dark_mode ? "enabled" : "disabled",
        },
        {
          label: "Notifications",
          description: "Receive alerts",
          type: "toggle",
          fieldName: "notifications_enabled",
          value: settings.notifications_enabled,
          onChange: (val) => handleSettingChange("notifications_enabled", val),
          status: settings.notifications_enabled ? "enabled" : "disabled",
        },
        {
          label: "Change Password",
          description: "Update security",
          type: "button",
          action: "changePassword",
        },
      ],
      defaultExpanded: true,
    },
    {
      id: "account",
      title: "Account Settings",
      icon: User,
      items: [
        { label: "Edit Profile", description: "Update your personal information", type: "button" },
        { label: "Change Email", description: "Update your email address", type: "button" },
        { label: "Account Status", description: "View your account status", type: "button", status: "active" },
      ],
    },
    {
      id: "security",
      title: "Security",
      icon: Lock,
      items: [
        { label: "Change Password", description: "Update your password", type: "button", action: "changePassword" },
        { label: "Active Sessions", description: "Manage your login sessions", type: "button" },
        {
          label: "Two-Factor Authentication",
          description: "Enable additional security",
          type: "toggle",
          fieldName: "two_fa_enabled",
          value: settings.two_fa_enabled,
          onChange: (val) => handleSettingChange("two_fa_enabled", val),
          status: settings.two_fa_enabled ? "enabled" : "disabled",
        },
      ],
    },
    {
      id: "notifications",
      title: "Notifications (Smart)",
      icon: Bell,
      items: [
        {
          label: "Request Alerts",
          description: "Approvals, rejections, updates",
          type: "toggle",
          fieldName: "request_alerts",
          value: settings.request_alerts,
          onChange: (val) => handleSettingChange("request_alerts", val),
          status: settings.request_alerts ? "enabled" : "disabled",
        },
        {
          label: "Conflict Alerts",
          description: "Duplicate/overlapping requests",
          type: "toggle",
          fieldName: "conflict_alerts",
          value: settings.conflict_alerts,
          onChange: (val) => handleSettingChange("conflict_alerts", val),
          status: settings.conflict_alerts ? "enabled" : "disabled",
        },
        {
          label: "Reminder Frequency",
          description: "How often to receive reminders",
          type: "select",
          fieldName: "reminder_frequency",
          value: settings.reminder_frequency,
          onChange: (val) => handleSettingChange("reminder_frequency", val),
          options: [
            { value: "realtime", label: "Real-time" },
            { value: "hourly", label: "Hourly" },
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
          ],
        },
      ],
    },
    {
      id: "appearance",
      title: "Appearance (Upgraded)",
      icon: Palette,
      items: [
        {
          label: "Theme",
          description: "Light / Dark / System",
          type: "select",
          fieldName: "theme",
          value: settings.theme,
          onChange: (val) => handleSettingChange("theme", val),
          options: [
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ],
        },
        {
          label: "Accent Color",
          description: "Choose your accent color",
          type: "select",
          fieldName: "accent_color",
          value: settings.accent_color,
          onChange: (val) => handleSettingChange("accent_color", val),
          options: [
            { value: "indigo", label: "Indigo" },
            { value: "blue", label: "Blue" },
            { value: "purple", label: "Purple" },
            { value: "green", label: "Green" },
          ],
        },
        {
          label: "Compact Mode",
          description: "Reduce spacing",
          type: "toggle",
          fieldName: "compact_mode",
          value: settings.compact_mode,
          onChange: (val) => handleSettingChange("compact_mode", val),
          status: settings.compact_mode ? "enabled" : "disabled",
        },
        {
          label: "Animation Level",
          description: "Smooth / Standard / Minimal",
          type: "select",
          fieldName: "animation_level",
          value: settings.animation_level,
          onChange: (val) => handleSettingChange("animation_level", val),
          options: [
            { value: "smooth", label: "Smooth" },
            { value: "standard", label: "Standard" },
            { value: "minimal", label: "Minimal" },
          ],
        },
      ],
    },
    {
      id: "system",
      title: "System Preferences",
      icon: Monitor,
      items: [
        {
          label: "Default Settings",
          description: "Preset values for requests",
          type: "button",
        },
        {
          label: "Date & Time Format",
          description: "Choose your preferred format",
          type: "select",
          fieldName: "date_format",
          value: settings.date_format,
          onChange: (val) => handleSettingChange("date_format", val),
          options: [
            { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
            { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
            { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
          ],
        },
        {
          label: "Auto-Approval Rules",
          description: "Configure automatic approvals",
          type: "toggle",
          fieldName: "auto_approval_enabled",
          value: settings.auto_approval_enabled,
          onChange: (val) => handleSettingChange("auto_approval_enabled", val),
          status: settings.auto_approval_enabled ? "enabled" : "disabled",
        },
        {
          label: "Duplicate Request Protection",
          description: "Prevent overlapping travel orders",
          type: "toggle",
          fieldName: "duplicate_protection",
          value: settings.duplicate_protection,
          onChange: (val) => handleSettingChange("duplicate_protection", val),
          status: settings.duplicate_protection ? "enabled" : "disabled",
          highlight: true,
        },
      ],
    },
    {
      id: "privacy",
      title: "Privacy & Data",
      icon: Eye,
      items: [
        { label: "Data Visibility", description: "Control who sees your data", type: "button" },
        { label: "Download My Data", description: "Export your information", type: "button", icon: Download },
        { label: "Delete Account", description: "Permanently delete your account", type: "button", danger: true },
      ],
    },
    {
      id: "activity",
      title: "Activity & Logs",
      icon: FileText,
      items: [
        { 
          label: "View Activity Logs", 
          description: "Track your activities", 
          type: "custom",
          customType: "activityLogs",
          action: fetchActivityLogs,
        },
        { 
          label: "Login History", 
          description: "See your login attempts", 
          type: "custom",
          customType: "loginHistory",
          action: fetchLoginHistory,
        },
        { 
          label: "Borrow History", 
          description: "View your borrowing records", 
          type: "button",
          icon: RefreshCw,
          action: "viewHistory",
        },
        { 
          label: "Download Logs", 
          description: "Export activity data", 
          type: "button",
          action: downloadLogsAsCSV,
        },
      ],
    },
    {
      id: "integrations",
      title: "Integrations (Optional)",
      icon: Plug,
      items: [
        { label: "Email Services", description: "Connect email providers", type: "button" },
        { label: "Calendar Sync", description: "Sync with your calendar", type: "button" },
        { label: "API Access", description: "Manage API keys", type: "button" },
      ],
    },
  ];

  const toggleSection = (id) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;

    const query = searchQuery.toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.label.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [searchQuery]);

  // ✅ Activity Logs Display Component
  const ActivityLogsDisplay = ({ items, logsType = "activity" }) => {
    const logs = logsType === "activity" ? activityLogs : loginHistory;
    const isLoading = isLoadingLogs;
    const error = logsError;

    const handleFetch = () => {
      if (logsType === "activity") {
        fetchActivityLogs();
      } else {
        fetchLoginHistory();
      }
    };

    return (
      <div className="p-2 sm:p-4 rounded-lg border border-outline-variant/10 dark:border-gray-700 bg-surface-container-lowest dark:bg-[#222]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-on-surface dark:text-white text-sm sm:text-base">
              {logsType === "activity" ? "Activity Logs" : "Login History"}
            </h3>
            <p className="text-xs sm:text-sm text-on-surface-variant dark:text-gray-400 mt-0.5">
              {logsType === "activity"
                ? "View all your account activities"
                : "View your login attempts and sessions"}
            </p>
          </div>
          <button
            onClick={handleFetch}
            disabled={isLoading}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-primary dark:bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-primary/90 dark:hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2 whitespace-nowrap flex-shrink-0"
          >
            {isLoading ? (
              <>
                <Loader className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">Loading...</span>
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" />
                <span className="hidden sm:inline">View</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {logs.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.map((log, idx) => (
              <div
                key={idx}
                className="p-2 sm:p-3 bg-surface-container-high dark:bg-[#252525] rounded-lg border border-outline-variant/5 dark:border-gray-700/50 text-xs"
              >
                <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-on-surface dark:text-white font-medium truncate">
                      {logsType === "activity"
                        ? log.action || log.activity || "Activity"
                        : log.ip_address || log.device || "Login"}
                    </p>
                    <p className="text-on-surface-variant dark:text-gray-400 mt-0.5 text-xs truncate">
                      {logsType === "activity"
                        ? log.description || "No description"
                        : `${log.device_type || "Unknown"} • ${log.location || "Unknown location"}`}
                    </p>
                  </div>
                  <span className="text-on-surface-variant dark:text-gray-500 text-xs whitespace-nowrap flex-shrink-0">
                    {log.timestamp
                      ? new Date(log.timestamp).toLocaleDateString() +
                        " " +
                        new Date(log.timestamp).toLocaleTimeString()
                      : "N/A"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : logs === null || logs === undefined || isLoading ? (
          <div className="p-4 text-center">
            <p className="text-on-surface-variant dark:text-gray-400 text-xs sm:text-sm">
              {isLoading ? "Loading logs..." : "Click View to load logs"}
            </p>
          </div>
        ) : (
          <div className="p-4 text-center">
            <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-on-surface-variant dark:text-gray-500 mx-auto mb-2 opacity-50" />
            <p className="text-on-surface-variant dark:text-gray-400 text-xs sm:text-sm">No logs found</p>
          </div>
        )}
      </div>
    );
  };

  const QuickSettingsCard = ({ item }) => (
    <div className="bg-surface-container-lowest dark:bg-[#222] p-3 sm:p-4 rounded-lg border border-outline-variant/10 dark:border-gray-700 flex items-center justify-between hover:bg-surface-container-high dark:hover:bg-[#252525] transition-all duration-200">
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-on-surface dark:text-white text-xs sm:text-sm truncate">{item.label}</h3>
        <p className="text-xs text-on-surface-variant dark:text-gray-400 mt-0.5 truncate">{item.description}</p>
      </div>
      {item.type === "toggle" && (
        <button
          onClick={() => item.onChange(!item.value)}
          className="ml-3 sm:ml-4 focus:outline-none transition-transform duration-200 flex-shrink-0"
        >
          {item.value ? (
            <ToggleRight className="w-5 h-5 sm:w-6 sm:h-6 text-primary dark:text-blue-400" />
          ) : (
            <ToggleLeft className="w-5 h-5 sm:w-6 sm:h-6 text-outline-variant dark:text-gray-600" />
          )}
        </button>
      )}
    </div>
  );

  const SettingItem = ({ item }) => {
    const Icon = item.icon;

    // ✅ Handle custom component types
    if (item.type === "custom") {
      if (item.customType === "activityLogs") {
        return <ActivityLogsDisplay items={[item]} logsType="activity" />;
      }
      if (item.customType === "loginHistory") {
        return <ActivityLogsDisplay items={[item]} logsType="login" />;
      }
    }

    if (item.type === "toggle") {
      return (
        <div
          className={`p-3 sm:p-4 rounded-lg border border-outline-variant/10 dark:border-gray-700 flex items-center justify-between hover:bg-surface-container-high dark:hover:bg-[#252525] transition-all duration-200 ${
            item.highlight ? "bg-primary/5 dark:bg-blue-900/20" : ""
          }`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-on-surface dark:text-white text-sm sm:text-base truncate">{item.label}</h3>
              {item.highlight && (
                <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-primary dark:text-blue-400 flex-shrink-0" />
              )}
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant dark:text-gray-400 mt-1">{item.description}</p>
          </div>
          <button
            onClick={() => item.onChange(!item.value)}
            className="ml-3 sm:ml-4 focus:outline-none transition-transform duration-200 flex-shrink-0"
          >
            {item.value ? (
              <ToggleRight className="w-5 h-5 sm:w-6 sm:h-6 text-primary dark:text-blue-400" />
            ) : (
              <ToggleLeft className="w-5 h-5 sm:w-6 sm:h-6 text-outline-variant dark:text-gray-600" />
            )}
          </button>
        </div>
      );
    }

    if (item.type === "select") {
      return (
        <div className="p-3 sm:p-4 rounded-lg border border-outline-variant/10 dark:border-gray-700 hover:bg-surface-container-high dark:hover:bg-[#252525] transition-all duration-200">
          <label className="block">
            <span className="font-semibold text-on-surface dark:text-white text-sm sm:text-base">{item.label}</span>
            <p className="text-xs sm:text-sm text-on-surface-variant dark:text-gray-400 mt-1 mb-2 sm:mb-3">{item.description}</p>
            <select
              value={item.value}
              onChange={(e) => item.onChange(e.target.value)}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-surface-container dark:bg-[#222] border border-outline-variant dark:border-gray-700 text-on-surface dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 transition-all duration-200"
            >
              {item.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      );
    }

    return (
      <button
        onClick={() => {
          if (item.action === "changePassword") {
            setShowPasswordModal(true);
          } else if (item.action === "viewHistory") {
            if (user?.role === "borrower") {
              navigate("/borrow-history");
            } else if (user?.role === "staff") {
              navigate("/staff/history");
            }
          } else if (typeof item.action === "function") {
            item.action();
          }
        }}
        className={`w-full p-3 sm:p-4 rounded-lg border border-outline-variant/10 dark:border-gray-700 text-left group transition-all duration-200 flex items-center justify-between ${
          item.danger ? "hover:bg-red-50 dark:hover:bg-red-900/20 dark:hover:border-red-800" : "hover:bg-surface-container-high dark:hover:bg-[#252525]"
        }`}
      >
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm sm:text-base truncate ${item.danger ? "text-red-600 dark:text-red-400" : "text-on-surface dark:text-white group-hover:text-primary dark:group-hover:text-blue-400"} transition-colors`}>
            {item.label}
          </h3>
          <p className="text-xs sm:text-sm text-on-surface-variant dark:text-gray-400 mt-1 truncate">{item.description}</p>
        </div>
        {item.status === "active" && (
          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 dark:text-green-400 ml-3 sm:ml-4 flex-shrink-0" />
        )}
        {item.status === "enabled" && (
          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 dark:text-blue-400 ml-3 sm:ml-4 flex-shrink-0" />
        )}
        {item.status === "disabled" && (
          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-outline-variant dark:text-gray-600 ml-3 sm:ml-4 flex-shrink-0" />
        )}
        {!item.status && Icon && (
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-outline-variant dark:text-gray-600 ml-3 sm:ml-4 flex-shrink-0" />
        )}
      </button>
    );
  };

  const CollapsibleSection = ({ section }) => {
    const Icon = section.icon;
    const isExpanded = expandedSections[section.id] ?? section.defaultExpanded;

    return (
      <div className="bg-surface-container-lowest dark:bg-[#222] rounded-xl border border-outline-variant/10 dark:border-gray-700 shadow-sm dark:shadow-black/40 overflow-hidden">
        <button
          onClick={() => toggleSection(section.id)}
          className="w-full p-3 sm:p-4 lg:p-6 flex items-center justify-between hover:bg-surface-container-high dark:hover:bg-[#252525] transition-all duration-200 border-b border-outline-variant/10 dark:border-gray-700"
        >
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary dark:text-blue-400" />
            </div>
            <h2 className="font-headline text-sm sm:text-base lg:text-lg font-bold text-on-surface dark:text-white truncate">{section.title}</h2>
          </div>
          <ChevronDown
            className={`w-4 h-4 sm:w-5 sm:h-5 text-on-surface-variant dark:text-gray-400 transition-transform duration-300 flex-shrink-0 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {isExpanded && (
          <div className={`p-3 sm:p-4 lg:p-6 space-y-2 sm:space-y-3 lg:space-y-4`}>
            {section.items.map((item, idx) => (
              <SettingItem key={idx} item={item} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <PageLayout>
      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center min-h-screen bg-surface dark:bg-[#171717] transition-colors duration-300">
          <div className="text-center px-4">
            <Loader className="w-10 h-10 sm:w-12 sm:h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-xs sm:text-sm text-on-surface-variant dark:text-gray-400">Loading your settings...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && !isLoading && (
        <div className="max-w-6xl mx-auto mt-4 sm:mt-8 px-4">
          <div className="p-4 sm:p-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <AlertCircle className="w-8 h-8 sm:w-12 sm:h-12 text-red-500 dark:text-red-400 mx-auto mb-3 sm:mb-4" />
            <p className="text-center text-red-600 dark:text-red-300 font-semibold text-sm sm:text-base">Failed to load settings</p>
            <p className="text-center text-red-500 dark:text-red-400 text-xs sm:text-sm mt-2">Please try refreshing the page</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 mx-auto block px-4 sm:px-6 py-1.5 sm:py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg text-xs sm:text-sm hover:bg-red-600 dark:hover:bg-red-700 transition-all duration-200"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )}

      {/* Main Settings Content */}
      {!isLoading && !hasError && (
        <div className={`max-w-6xl mx-auto px-4 ${settings.compact_mode ? "space-y-4 sm:space-y-6" : "space-y-6 sm:space-y-8"}`}>
          {/* Header */}
          <div className={settings.compact_mode ? "mb-4 sm:mb-6" : "mb-6 sm:mb-12"}>
            <span className="text-[8px] sm:text-[10px] uppercase tracking-widest text-primary dark:text-blue-400 font-bold mb-2 block">
              System
            </span>
            <div className="flex items-start gap-2 sm:gap-4">
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-primary/10 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <SettingsIcon className="w-4 h-4 sm:w-6 sm:h-6 text-primary dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-headline text-3xl sm:text-4xl lg:text-5xl text-on-surface dark:text-white">Settings</h1>
                <p className="text-xs sm:text-sm text-on-surface-variant dark:text-gray-400 mt-1">
                  Manage your account preferences and security
                </p>
                {isSaving && (
                  <p className="text-xs text-primary dark:text-blue-400 mt-2 flex items-center gap-1">
                    <Loader className="w-3 h-3 animate-spin" /> Saving...
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Settings */}
          <div>
            <h2 className="font-headline text-sm sm:text-base lg:text-lg font-bold text-on-surface dark:text-white mb-3 sm:mb-4">
              Quick Access
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
              {sections
                .find((s) => s.id === "quick")
                ?.items.map((item, idx) => (
                  <QuickSettingsCard key={idx} item={item} />
                ))}
            </div>
          </div>

          {/* Search Bar - Sticky */}
          <div className="sticky top-0 z-10 bg-surface/95 dark:bg-[#171717]/95 backdrop-blur-sm py-2 transition-colors duration-300">
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-2.5 sm:top-3.5 w-4 h-4 sm:w-5 sm:h-5 text-on-surface-variant dark:text-gray-400" />
              <input
                type="text"
                placeholder="Search settings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 rounded-lg bg-surface-container dark:bg-[#222] border border-outline-variant dark:border-gray-700 text-on-surface dark:text-white placeholder-on-surface-variant dark:placeholder-gray-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 transition-all duration-200"
              />
            </div>
          </div>

          {/* Collapsible Sections */}
          <div className={settings.compact_mode ? "space-y-2 sm:space-y-3" : "space-y-3 sm:space-y-4"}>
            {filteredSections.map((section) => (
              section.id !== "quick" && <CollapsibleSection key={section.id} section={section} />
            ))}
          </div>

          {/* No Results */}
          {filteredSections.length === 0 && (
            <div className="p-6 sm:p-8 text-center bg-surface-container-low dark:bg-[#222] rounded-xl border border-outline-variant/10 dark:border-gray-700">
              <AlertCircle className="w-8 h-8 sm:w-12 sm:h-12 text-on-surface-variant dark:text-gray-500 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-xs sm:text-sm text-on-surface-variant dark:text-gray-400">
                No settings found for "{searchQuery}"
              </p>
            </div>
          )}
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-container-lowest dark:bg-[#222] rounded-xl shadow-lg dark:shadow-black/60 max-w-md w-full border border-outline-variant/10 dark:border-gray-700">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-outline-variant/10 dark:border-gray-700">
              <h2 className="font-headline text-lg sm:text-xl font-bold text-on-surface dark:text-white">Change Password</h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-on-surface-variant dark:text-gray-400 hover:text-on-surface dark:hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handlePasswordChange} className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-on-surface dark:text-white mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                  }
                  placeholder="Enter your current password"
                  className="w-full px-3 sm:px-4 py-2 rounded-lg bg-surface-container dark:bg-[#1a1a1a] border border-outline-variant dark:border-gray-700 text-on-surface dark:text-white placeholder-on-surface-variant dark:placeholder-gray-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 transition-all duration-200"
                />
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-on-surface dark:text-white mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                  }
                  placeholder="Enter your new password (min 6 characters)"
                  className="w-full px-3 sm:px-4 py-2 rounded-lg bg-surface-container dark:bg-[#1a1a1a] border border-outline-variant dark:border-gray-700 text-on-surface dark:text-white placeholder-on-surface-variant dark:placeholder-gray-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 transition-all duration-200"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-on-surface dark:text-white mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                  }
                  placeholder="Confirm your new password"
                  className="w-full px-3 sm:px-4 py-2 rounded-lg bg-surface-container dark:bg-[#1a1a1a] border border-outline-variant dark:border-gray-700 text-on-surface dark:text-white placeholder-on-surface-variant dark:placeholder-gray-500 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-blue-400 transition-all duration-200"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-outline-variant dark:border-gray-700 text-on-surface dark:text-white hover:bg-surface-container-high dark:hover:bg-[#252525] transition-all duration-200 text-xs sm:text-sm font-medium"
                  disabled={isChangingPassword}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-primary dark:bg-blue-600 text-on-primary dark:text-white hover:bg-primary/90 dark:hover:bg-blue-700 transition-all duration-200 font-semibold flex items-center justify-center gap-2 text-xs sm:text-sm"
                  disabled={isChangingPassword}
                >
                  {isChangingPassword && <Loader className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />}
                  {isChangingPassword ? "Changing..." : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}