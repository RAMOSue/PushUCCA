// client/src/pages/Admin/MetricsDashboard.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch main metrics
        const metricsRes = await axios.get("/api/metrics");
        setMetrics(metricsRes.data);

        // Fetch performance metrics
        const perfRes = await axios.get("/api/metrics/performance");
        setPerformance(perfRes.data);

        // Fetch health check
        const healthRes = await axios.get("/api/metrics/health");
        setHealth(healthRes.data);
      } catch (err) {
        console.error("Error fetching metrics:", err);
        setError(err.response?.data?.error || "Failed to load metrics");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();

    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md">
          <h3 className="text-red-800 dark:text-red-400 font-semibold mb-2">Error Loading Metrics</h3>
          <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const borrowData = metrics?.borrowing || {};
  const userData = metrics?.users || {};
  const inventoryData = metrics?.inventory || {};
  const perfData = performance || {};
  const healthData = health || {};

  // Prepare chart data
  const borrowingChartData = [
    { name: "Approved", value: borrowData.approved_borrows || 0 },
    { name: "Pending", value: borrowData.pending_borrows || 0 },
    { name: "Returned", value: borrowData.returned_borrows || 0 },
    { name: "Declined", value: borrowData.declined_borrows || 0 },
  ];

  const userChartData = [
    { name: "Borrowers", value: userData.borrowers || 0 },
    { name: "Staff", value: userData.staff || 0 },
    { name: "Admins", value: userData.admins || 0 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            System Metrics Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Real-time monitoring of system performance and usage
          </p>
          {healthData?.status === "healthy" && (
            <div className="mt-4 inline-block bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 px-4 py-2 rounded-lg text-sm">
              ✅ System Status: {healthData.status}
            </div>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Borrows */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Borrows</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {borrowData.total_borrows || 0}
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Active Borrows */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Currently Borrowed</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {metrics?.activeBorrows?.active_count || 0}
                </p>
              </div>
              <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-full">
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 6H6.28l-.31-1.243A1 1 0 005 4H3z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Users */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {userData.total_users || 0}
                </p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-full">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM9 6a3 3 0 11-6 0 3 3 0 016 0zm12 0a3 3 0 11-6 0 3 3 0 016 0zm-5 9a4 4 0 10-8 0v2a2 2 0 01-2 2H1a2 2 0 01-2-2v-2a4 4 0 108 0v2a2 2 0 01-2 2h8a2 2 0 01-2-2v-2zm9-9a3 3 0 11-6 0 3 3 0 016 0zm-2 9a4 4 0 10-8 0v2a2 2 0 01-2 2H9a2 2 0 01-2-2v-2a4 4 0 108 0v2a2 2 0 01-2 2h8a2 2 0 002-2v-2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Inventory */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Inventory Items</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {inventoryData.total_quantity || 0}
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-full">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Processing Time */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Processing Performance</h3>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Avg Processing Time</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {perfData.avgProcessingTime ? `${(perfData.avgProcessingTime / 3600).toFixed(2)} hours` : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Return Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {perfData.returnRatePercentage ? `${perfData.returnRatePercentage.toFixed(1)}%` : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* System Uptime */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">System Status</h3>
            <div className="space-y-4">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Database Status</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">Connected</p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Server Uptime</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {healthData.uptime ? `${(healthData.uptime / 3600).toFixed(2)}h` : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Borrowing Status Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Borrowing Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={borrowingChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* User Type Distribution Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">User Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={userChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Detailed Statistics</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-2 text-gray-700 dark:text-gray-300 font-semibold">Metric</th>
                  <th className="px-4 py-2 text-gray-700 dark:text-gray-300 font-semibold text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Approved Borrows</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {borrowData.approved_borrows || 0}
                  </td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Pending Requests</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {borrowData.pending_borrows || 0}
                  </td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Returned Items</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {borrowData.returned_borrows || 0}
                  </td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Declined Requests</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {borrowData.declined_borrows || 0}
                  </td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Total Users</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {userData.total_users || 0}
                  </td>
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">Total Inventory Items</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {inventoryData.total_items || 0}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Last Updated */}
        <div className="mt-6 text-center text-gray-600 dark:text-gray-400 text-sm">
          <p>Last updated: {new Date(metrics?.timestamp).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
