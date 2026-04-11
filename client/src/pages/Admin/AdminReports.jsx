import { useState, useEffect, useContext } from "react";
import toast from "react-hot-toast";
import { UserContext } from "../../../context/userContext";
import PageLayout from "../../components/layout/PageLayout";
import { useNavigate } from "react-router-dom";
import {
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  FileText,
  BarChart3,
  Download,
  Printer,
  CalendarIcon,
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
} from "lucide-react";

import {
  fetchMonthlyReport,
  exportMonthlyReport as exportMonthlyReportService,
  fetchBorrowerHistory as fetchBorrowerHistoryService,
} from "../../services/reportService";

// Helpers
const now = new Date();
const CURRENT_MONTH = now.getUTCMonth() + 1;
const CURRENT_YEAR = now.getUTCFullYear();

/**
 * Small util to pretty-print a date (nullable).
 */
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString();
}

/**
 * Color badge for status.
 */
function StatusBadge({ status }) {
  const base =
    "px-3 py-1 rounded-full text-xs font-semibold inline-block whitespace-nowrap";
  const map = {
    pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
    approved: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    declined: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
    returned: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
    pending_return: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200",
  };
  const cls = map[status] || "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
  return <span className={`${base} ${cls}`}>{status.toUpperCase()}</span>;
}

/**
 * Render a grouped borrower request (one card per borrow submission).
 */
function BorrowerRequestCard({ req }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-[#1a1a1a] hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/30 transition">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-white">Request #{req.request_id}</span>
          <StatusBadge status={req.status} />
        </div>
        <span className="text-xs text-yellow-800 dark:text-yellow-200 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
          {req.total_items} item{req.total_items === 1 ? "" : "s"}
        </span>
      </div>

      <div className="text-xs text-gray-600 dark:text-gray-400 mb-3 space-y-1">
        <p>📅 Requested: {fmtDate(req.request_date)}</p>
        {req.due_date && <p>⏰ Due: {fmtDate(req.due_date)}</p>}
        {req.returned_date && <p>✓ Returned: {fmtDate(req.returned_date)}</p>}
      </div>

      <div className="bg-white dark:bg-[#222] p-3 rounded border border-gray-200 dark:border-gray-700">
        <ul className="space-y-1">
          {req.items.map((it) => (
            <li key={it.item_id} className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">{it.item_name}</span>
              <span className="text-gray-500 dark:text-gray-500"> × {it.quantity_borrowed}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function AdminReports() {
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  // Month/year selection
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [year, setYear] = useState(CURRENT_YEAR);

  // Monthly summary data
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [inventoryChanges, setInventoryChanges] = useState([]);
  const [requests, setRequests] = useState([]);
  const [lowStockCostumes, setLowStockCostumes] = useState([]);
  const [totalInventory, setTotalInventory] = useState(null);
  const [overdueBorrowers, setOverdueBorrowers] = useState([]);

  // Borrower lookup
  const [borrowerIdInput, setBorrowerIdInput] = useState("");
  const [borrowerHistory, setBorrowerHistory] = useState(null);

  // Auto-load on mount + whenever month/year changes
  useEffect(() => {
    fetchMonthly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year]);

  const fetchMonthly = async () => {
    setLoading(true);
    try {
      const data = await fetchMonthlyReport(month, year);
      console.log("📊 Monthly report data:", data);
      setSummary(data.summary);
      setInventoryChanges(data.inventory_changes || []);
      setRequests(data.requests || []);
      setLowStockCostumes(data.low_stock_costumes || []);
      setTotalInventory(data.total_inventory || {});
      setOverdueBorrowers(data.overdue_borrowers || []);
    } catch (err) {
      console.error("Monthly report fetch error:", err);
      const status = err?.response?.status;
      if (status === 403) {
        toast.error("Access denied: reports are restricted.");
      } else {
        toast.error("Failed to load monthly report.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (fmt) => {
    try {
      setLoading(true);
      await exportMonthlyReportService(month, year, fmt);
      toast.success(`${fmt.toUpperCase()} exported successfully!`);
    } catch (err) {
      console.error('Export failed:', err);
      toast.error(`Failed to export ${fmt.toUpperCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBorrowerLookup = async () => {
    if (!borrowerIdInput.trim()) return;
    try {
      const data = await fetchBorrowerHistoryService(borrowerIdInput.trim());
      setBorrowerHistory(data);
    } catch (err) {
      console.error("Borrower lookup error:", err);
      const status = err?.response?.status;
      if (status === 403) {
        toast.error("Access denied for borrower history.");
      } else if (status === 404) {
        toast.error("Borrower not found.");
      } else {
        toast.error("Failed to load borrower history.");
      }
    }
  };

  // Role protect in UI (front-end guard; server also checks)
  if (user?.role !== "admin" && user?.role !== "staff") {
    return (
      <div className="text-center mt-10 text-red-500 text-xl">
        ❌ Access Denied
      </div>
    );
  }

  // Prepare chart data with validation
  const donutData = summary
    ? [
        { name: "Pending", value: Number(summary.pending_count) || 0, fill: "#FBBF24" },
        { name: "Approved", value: Number(summary.approved_count) || 0, fill: "#10B981" },
        { name: "Declined", value: Number(summary.declined_count) || 0, fill: "#EF4444" },
        { name: "Returned", value: Number(summary.returned_count) || 0, fill: "#3B82F6" },
      ]
    : [];

  const barData = summary
    ? [
        {
          name: "Monthly Progress",
          pending: Number(summary.pending_count) || 0,
          approved: Number(summary.approved_count) || 0,
          declined: Number(summary.declined_count) || 0,
          returned: Number(summary.returned_count) || 0,
        },
      ]
    : [];

  // ✅ NEW: Check if there's any data to display + console log for debugging
  const hasChartData = donutData.some(d => d.value > 0);
  console.log("📈 Chart data:", { donutData, barData, hasChartData, summary }); // ✅ NEW: Debug logging

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h1>
            </div>
            
          </div>
          <p className="text-gray-600 dark:text-gray-400">View detailed analytics and borrowing statistics</p>
        </div>

        {/* Month / Year Controls */}
        <div className="bg-white dark:bg-[#222] rounded-lg shadow dark:shadow-lg p-6 mb-8 transition-colors">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                <CalendarIcon className="w-4 h-4 inline-block mr-2" />
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-[#333] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(0, m - 1).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 w-28 bg-white dark:bg-[#222] text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent dark:focus:border-transparent transition-colors"
              />
            </div>

            <button
              onClick={fetchMonthly}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition font-medium text-sm"
            >
              🔄 Refresh
            </button>

            <div className="ml-auto flex gap-2">
              <button
                onClick={() => handleExport("csv")}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => handleExport("pdf")}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium text-sm"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        {loading ? (
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow dark:shadow-lg p-12 text-center">
            <p className="text-gray-500 dark:text-gray-400 text-lg">Loading data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Donut Chart */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow dark:shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📊 Request Status Distribution</h2>
              {summary && donutData.length > 0 ? (
                <div className="w-full h-full">
                  {hasChartData ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          startAngle={90}
                          endAngle={450}
                        >
                          {donutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => [`${value}`, 'Count']}
                          contentStyle={{
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #3a3a3a",
                            borderRadius: "8px",
                            padding: "8px",
                            color: "#ffffff"
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center py-20">
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <p>No requests for {new Date(0, month - 1).toLocaleString('default', { month: 'long' })} {year}</p>
                      </div>
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {donutData.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: item.fill }}
                        ></div>
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                          <strong>{item.name}:</strong> {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p>Loading data...</p>
                </div>
              )}
            </div>

            {/* Bar Chart */}
            <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow dark:shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📈 Monthly Progress</h2>
              {barData.length > 0 && hasChartData ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                    <XAxis dataKey="name" stroke="#999" />
                    <YAxis stroke="#999" />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: "#1a1a1a",
                        border: "1px solid #3a3a3a",
                        borderRadius: "8px",
                        padding: "8px",
                        color: "#ffffff"
                      }}
                    />
                    <Legend />
                    <Bar dataKey="pending" fill="#FBBF24" name="Pending" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="approved" fill="#10B981" name="Approved" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="declined" fill="#EF4444" name="Declined" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="returned" fill="#3B82F6" name="Returned" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p>No progress data available for {new Date(0, month - 1).toLocaleString('default', { month: 'long' })} {year}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top Borrowed Items & Low Borrowed Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Borrowed Items */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow dark:shadow-lg p-6 transition-colors">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📈 Top Borrowed Items</h2>
            {inventoryChanges.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No items borrowed this month</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-3 font-semibold text-gray-700">Item Name</th>
                      <th className="text-right py-3 px-3 font-semibold text-gray-700">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryChanges
                      .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
                      .slice(0, 5)
                      .map((it) => (
                        <tr
                          key={it.item_id}
                          className="border-b border-gray-100 hover:bg-green-50 transition"
                        >
                          <td className="py-3 px-3 text-gray-900">{it.name}</td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-block bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">
                              {it.quantity || 0}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Low Borrowed Items */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow dark:shadow-lg p-6 transition-colors">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📉 Least Borrowed Items</h2>
            {inventoryChanges.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No items data available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Item Name</th>
                      <th className="text-right py-3 px-3 font-semibold text-gray-700 dark:text-gray-300">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryChanges
                      .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
                      .slice(0, 5)
                      .map((it) => (
                        <tr
                          key={it.item_id}
                          className="border-b border-gray-100 dark:border-gray-700 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-colors"
                        >
                          <td className="py-3 px-3 text-gray-900 dark:text-gray-100">{it.name}</td>
                          <td className="py-3 px-3 text-right">
                            <span className="inline-block bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-200 px-2 py-1 rounded text-xs font-semibold transition-colors">
                              {it.quantity || 0}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Total Inventory Stats + Low Stock Costumes + Overdue Borrowers */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Total Inventory */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow dark:shadow-lg p-6 transition-colors">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">📦 Total Inventory Stats</h2>
            {totalInventory && Object.keys(totalInventory).length > 0 ? (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 transition-colors">
                  <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Items</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                    {totalInventory.total_items || 0}
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 transition-colors">
                  <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Units</p>
                  <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                    {totalInventory.total_units || 0}
                  </p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 transition-colors">
                  <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Quantity</p>
                  <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                    {totalInventory.total_quantity || 0}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No inventory data</p>
              </div>
            )}
          </div>

          {/* Low Stock Costumes */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow dark:shadow-lg p-6 transition-colors">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">⚠️ Low Stock Costumes</h2>
            {lowStockCostumes.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>✅ No low stock items</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-96 space-y-2">
                {lowStockCostumes.map((item) => (
                  <div key={item.item_id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 hover:shadow-md dark:hover:shadow-black/30 transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{item.category}</p>
                      </div>
                      <span className="inline-block bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200 px-3 py-1 rounded-full text-sm font-bold transition-colors">
                        {item.quantity || 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Overdue Borrowers */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-lg shadow dark:shadow-lg p-6 transition-colors">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">🔴 Overdue Borrowers</h2>
            {overdueBorrowers.length === 0 ? (
              <div className="text-center py-8 text-green-600 dark:text-green-400 font-semibold">
                <p>✅ No overdue items</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-96 space-y-2">
                {overdueBorrowers.map((borrower) => (
                  <div key={borrower.borrower_id} className="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-800 rounded-lg p-3 hover:shadow-md dark:hover:shadow-black/30 transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{borrower.borrower_name}</p>
                        <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                          ID: {borrower.borrower_id}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white dark:bg-[#222] rounded px-2 py-1 transition-colors">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Requests</p>
                        <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{borrower.overdue_request_count}</p>
                      </div>
                      <div className="bg-white dark:bg-[#222] rounded px-2 py-1 transition-colors">
                        <p className="text-xs text-gray-600 dark:text-gray-400">Items</p>
                        <p className="text-lg font-bold text-red-600 dark:text-red-400">{borrower.overdue_item_count}</p>
                      </div>
                    </div>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-2 font-semibold">
                      Due: {new Date(borrower.earliest_due_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Monthly Summary Section - MOVED TO BOTTOM */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg shadow p-8 mb-8 border border-indigo-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📊 Monthly Borrow Summary</h2>
          
          {loading ? (
            <div className="text-center py-8 text-gray-500">
              <p>Loading summary data...</p>
            </div>
          ) : summary && summary.total_requests > 0 ? (
            <div className="space-y-6">
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-gray-600 text-sm font-medium">👥 Unique Borrowers</p>
                  <p className="text-2xl font-bold text-indigo-600 mt-2">
                    {summary?.unique_borrowers || 0}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-gray-600 text-sm font-medium">📦 Unique Items</p>
                  <p className="text-2xl font-bold text-purple-600 mt-2">
                    {summary?.unique_items_borrowed || 0}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-gray-600 text-sm font-medium">🔄 Total Items Borrowed</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">
                    {summary?.total_borrowed_items || 0}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-gray-600 text-sm font-medium">⚠️ Overdue Items</p>
                  <p className="text-2xl font-bold text-orange-600 mt-2">
                    {summary?.overdue_count || 0}
                  </p>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-gray-600 text-sm font-medium">✅ Approval Rate</p>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-3xl font-bold text-green-600">
                      {summary?.approval_rate || 0}%
                    </p>
                    <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-green-500 h-full" 
                        style={{ width: `${summary?.approval_rate || 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-gray-600 text-sm font-medium">⏳ Pending Rate</p>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-3xl font-bold text-yellow-600">
                      {summary?.pending_rate || 0}%
                    </p>
                    <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-yellow-500 h-full" 
                        style={{ width: `${summary?.pending_rate || 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <p className="text-gray-600 text-sm font-medium">❌ Decline Rate</p>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-3xl font-bold text-red-600">
                      {summary?.decline_rate || 0}%
                    </p>
                    <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-red-500 h-full" 
                        style={{ width: `${summary?.decline_rate || 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Conclusion */}
              <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-indigo-600">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">📝 Monthly Conclusion</h3>
                <p className="text-gray-700 leading-relaxed text-sm">
                  {(() => {
                    const month_name = new Date(0, summary.month - 1).toLocaleString('default', { month: 'long' });
                    const total = summary.total_requests;
                    const approved = summary.approved_count;
                    const returned = summary.returned_count;
                    const pending = summary.pending_count;
                    const declined = summary.declined_count;
                    const overdue = summary.overdue_count;
                    const borrowers = summary.unique_borrowers;
                    const items = summary.unique_items_borrowed;
                    const total_qty = summary.total_borrowed_items;
                    const approval_rate = summary.approval_rate;
                    
                    return (
                      <>
                        In <strong>{month_name} {summary.year}</strong>, the borrowing system processed{' '}
                        <strong>{total} request{total !== 1 ? 's' : ''}</strong> from{' '}
                        <strong>{borrowers} unique borrower{borrowers !== 1 ? 's' : ''}</strong>. A total of{' '}
                        <strong>{total_qty} item{total_qty !== 1 ? 's' : ''}</strong> were borrowed across{' '}
                        <strong>{items} unique item{items !== 1 ? 's' : ''}</strong>. The approval rate stood at{' '}
                        <strong>{approval_rate}%</strong>, with{' '}
                        <strong>{approved} request{approved !== 1 ? 's' : ''}</strong> approved and{' '}
                        <strong>{returned} returned</strong>.{' '}
                        {pending > 0 && (
                          <>
                            Currently, <strong>{pending} request{pending !== 1 ? 's' : ''}</strong>{' '}
                            {pending === 1 ? 'is' : 'are'} still pending.{' '}
                          </>
                        )}
                        {declined > 0 && (
                          <>
                            <strong>{declined} request{declined !== 1 ? 's' : ''}</strong>{' '}
                            {declined === 1 ? 'was' : 'were'} declined.{' '}
                          </>
                        )}
                        {overdue > 0 ? (
                          <span className="text-orange-600 font-semibold">
                            ⚠️ <strong>{overdue} item{overdue !== 1 ? 's' : ''}</strong>{' '}
                            {overdue === 1 ? 'is' : 'are'} currently overdue and need immediate attention.
                          </span>
                        ) : (
                          <span className="text-green-600 font-semibold">
                            ✅ No items are currently overdue, indicating good borrower compliance.
                          </span>
                        )}
                      </>
                    );
                  })()}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>No borrow data available for {new Date(0, month - 1).toLocaleString('default', { month: 'long' })} {year}</p>
            </div>
          )}
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background: white;
          }
          
          .bg-gradient-to-br {
            background: white !important;
          }
          
          body {
            background: white;
          }
          
          button,
          input[type="select"],
          input[type="number"],
          input[type="text"] {
            display: none;
          }
          
          .print\\:block {
            display: block;
          }
          
          /* Page breaks for reports */
          .section-charts {
            page-break-after: auto;
          }
          
          .overflow-x-auto {
            overflow: visible;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          
          thead {
            background-color: #f3f4f6 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          th {
            border: 1px solid #d1d5db;
            padding: 8px;
            text-align: left;
            font-weight: bold;
          }
          
          td {
            border: 1px solid #d1d5db;
            padding: 8px;
          }
          
          tr:nth-child(even) {
            background-color: #f9fafb !important;
          }
          
          /* Responsive text sizing */
          h1 {
            font-size: 28px;
            margin-bottom: 10px;
          }
          
          h2 {
            font-size: 18px;
            margin-top: 15px;
            margin-bottom: 10px;
            page-break-after: avoid;
          }
          
          /* Chart sizing for print */
          .chart-container {
            page-break-inside: avoid;
            margin-bottom: 20px;
          }
          
          /* Card styling */
          .bg-white {
            border: 1px solid #e5e7eb;
            page-break-inside: avoid;
          }
          
          /* Prevent orphaned lines */
          p {
            page-break-inside: avoid;
          }
          
          /* Summary cards */
          .grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 15px;
          }
          
          /* Color preservation */
          .text-blue-600 { color: #2563eb !important; }
          .text-green-600 { color: #16a34a !important; }
          .text-red-600 { color: #dc2626 !important; }
          .text-amber-600 { color: #d97706 !important; }
          .text-purple-600 { color: #7c3aed !important; }
          .bg-blue-50 { background-color: #eff6ff !important; }
          .bg-green-50 { background-color: #f0fdf4 !important; }
          .bg-red-50 { background-color: #fef2f2 !important; }
          .bg-amber-50 { background-color: #fffbeb !important; }
          .bg-purple-50 { background-color: #faf5ff !important; }
          
          /* Progress bars */
          .w-full {
            width: 100%;
          }
          
          .bg-gray-200 {
            background-color: #e5e7eb !important;
          }
          
          .h-2 {
            height: 8px;
          }
          
          /* Remove shadows and borders that don't print well */
          .shadow, .shadow-md, .shadow-lg {
            box-shadow: 1px 1px 1px rgba(0,0,0,0.1) !important;
          }
          
          /* Margins and spacing */
          .container {
            max-width: 100%;
            margin: 0;
            padding: 20px;
          }
          
          /* Responsive adjustments */
          @page {
            size: A4;
            margin: 20mm;
          }
        }
      `}</style>
    </PageLayout>
  );
}
