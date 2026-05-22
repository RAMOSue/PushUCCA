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
  BarChart3,
  Download,
  Printer,
  CalendarIcon,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
} from "lucide-react";

import {
  fetchMonthlyReport,
  exportMonthlyReport as exportMonthlyReportService,
  fetchBorrowerHistory as fetchBorrowerHistoryService,
} from "../../services/reportService";
import {
  generatePlainReport,
  printPlainReport,
} from "../../utils/reportGenerator";

// Helpers
const now = new Date();
const CURRENT_MONTH = now.getUTCMonth() + 1;
const CURRENT_YEAR = now.getUTCFullYear();

// Professional color palette
const COLORS = {
  green: "#10b981",   // Approved/Good
  yellow: "#f59e0b",  // Pending/Warning
  red: "#ef4444",     // Declined/Overdue/Bad
  gray: "#6b7280",    // Neutral/Returned
};

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
 * Professional status badge with color coding.
 */
function StatusBadge({ status }) {
  const base =
    "px-3 py-1.5 rounded-full text-xs font-semibold inline-block whitespace-nowrap";
  const map = {
    pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
    approved: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    declined: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
    returned: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
    pending_return: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200",
  };
  const cls = map[status] || "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200";
  return <span className={`${base} ${cls}`}>{status.toUpperCase()}</span>;
}

/**
 * Metric card with icon
 */
function MetricCard({ label, value, icon: Icon, color = "gray" }) {
  const colorMap = {
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400",
    yellow: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400",
    red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400",
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400",
    gray: "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400",
  };

  return (
    <div className={`rounded-lg p-5 border ${colorMap[color]} transition-all hover:shadow-md dark:hover:shadow-lg`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
        {Icon && <Icon className="w-5 h-5" />}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

/**
 * Render a grouped borrower request (one card per borrow submission).
 */
function BorrowerRequestCard({ req }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-md dark:hover:shadow-lg transition">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900 dark:text-white">Request #{req.request_id}</span>
          <StatusBadge status={req.status} />
        </div>
        <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full font-medium">
          {req.total_items} item{req.total_items === 1 ? "" : "s"}
        </span>
      </div>

      <div className="text-xs text-gray-600 dark:text-gray-400 mb-3 space-y-1">
        <p>Requested: {fmtDate(req.request_date)}</p>
        {req.due_date && <p>Due: {fmtDate(req.due_date)}</p>}
        {req.returned_date && <p>Returned: {fmtDate(req.returned_date)}</p>}
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
        <ul className="space-y-1">
          {req.items.map((it) => (
            <li key={it.item_id} className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">{it.item_name}</span>
              <span className="text-gray-500 dark:text-gray-400"> × {it.quantity_borrowed}</span>
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
    if (!summary) {
      toast.error("No report data available to print.");
      return;
    }

    try {
      const plainTextReport = generatePlainReport({
        summary,
        month,
        year,
        user,
      });

      printPlainReport(plainTextReport, `Inventory_Report_${year}_${String(month).padStart(2, "0")}`);
      toast.success("Opening print preview...");
    } catch (err) {
      console.error("Print error:", err);
      toast.error("Failed to generate print report.");
    }
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
      <PageLayout>
        <div className="text-center mt-10 text-red-600 dark:text-red-400 text-xl font-semibold">
          🔒 Access Denied
        </div>
      </PageLayout>
    );
  }

  // Prepare chart data with professional colors
  const donutData = summary
    ? [
        { name: "Approved", value: Number(summary.approved_count) || 0, fill: COLORS.green },
        { name: "Pending", value: Number(summary.pending_count) || 0, fill: COLORS.yellow },
        { name: "Declined", value: Number(summary.declined_count) || 0, fill: COLORS.red },
        { name: "Returned", value: Number(summary.returned_count) || 0, fill: COLORS.gray },
      ]
    : [];

  const barData = summary
    ? [
        {
          name: "Monthly Progress",
          approved: Number(summary.approved_count) || 0,
          pending: Number(summary.pending_count) || 0,
          declined: Number(summary.declined_count) || 0,
          returned: Number(summary.returned_count) || 0,
        },
      ]
    : [];

  const hasChartData = donutData.some(d => d.value > 0);

  return (
    <PageLayout>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BarChart3 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Reports</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Monthly analytics and borrowing statistics</p>
              </div>
            </div>
          </div>

          {/* Controls Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <CalendarIcon className="w-4 h-4 inline-block mr-2" />
                  Month & Year
                </label>
                <div className="flex gap-2">
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {new Date(0, m - 1).toLocaleString("default", { month: "long" })}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="w-32 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                  />
                </div>
              </div>

              <button
                onClick={fetchMonthly}
                className="px-6 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition font-medium text-sm"
              >
                Refresh
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => handleExport("csv")}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition font-medium text-sm"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </button>
                <button
                  onClick={() => handleExport("pdf")}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition font-medium text-sm"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition font-medium text-sm"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>
            </div>
          </div>

          {/* Main Summary Section */}
          {loading ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400">Loading report data...</p>
            </div>
          ) : summary && summary.total_requests > 0 ? (
            <>
              {/* Key Metrics */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Key Metrics</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <MetricCard label="Total Requests" value={summary?.total_requests || 0} icon={TrendingUp} color="blue" />
                  <MetricCard label="Approved" value={summary?.approved_count || 0} icon={CheckCircle} color="green" />
                  <MetricCard label="Pending" value={summary?.pending_count || 0} icon={Clock} color="yellow" />
                  <MetricCard label="Declined" value={summary?.declined_count || 0} icon={AlertTriangle} color="red" />
                  <MetricCard label="Returned" value={summary?.returned_count || 0} icon={CheckCircle} color="gray" />
                  <MetricCard label="Overdue" value={summary?.overdue_count || 0} color={summary?.overdue_count > 0 ? "red" : "green"} />
                </div>
              </div>

              {/* Secondary Metrics */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">Approval Rate</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary?.approval_rate || 0}%</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">Unique Borrowers</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary?.unique_borrowers || 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">Items Borrowed</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary?.total_borrowed_items || 0}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">Unique Items</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary?.unique_items_borrowed || 0}</p>
                  </div>
                </div>
              </div>

              {/* Summary Text */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Summary</h3>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
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
                        In <strong>{month_name} {summary.year}</strong>, the system processed <strong>{total}</strong> request{total !== 1 ? 's' : ''} from <strong>{borrowers}</strong> borrower{borrowers !== 1 ? 's' : ''}. A total of <strong>{total_qty}</strong> item{total_qty !== 1 ? 's' : ''} were borrowed across <strong>{items}</strong> unique item{items !== 1 ? 's' : ''}. The approval rate was <strong>{approval_rate}%</strong>, with <strong>{approved}</strong> approved and <strong>{returned}</strong> returned.
                        {pending > 0 && <> Currently <strong>{pending}</strong> request{pending !== 1 ? 's' : ''} {pending === 1 ? 'is' : 'are'} pending.</>}
                        {declined > 0 && <> <strong>{declined}</strong> request{declined !== 1 ? 's' : ''} {declined === 1 ? 'was' : 'were'} declined.</>}
                        {overdue > 0 ? (
                          <span className="text-red-600 dark:text-red-400 font-semibold"> ⚠️ <strong>{overdue}</strong> item{overdue !== 1 ? 's' : ''} overdue and require immediate attention.</span>
                        ) : (
                          <span className="text-green-600 dark:text-green-400 font-semibold"> ✅ No overdue items.</span>
                        )}
                      </>
                    );
                  })()}
                </p>
              </div>

              {/* Alerts & Inventory Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Overdue Borrowers */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 border-red-500 border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    Overdue Borrowers
                  </h3>
                  {overdueBorrowers.length === 0 ? (
                    <div className="text-center py-8 text-green-600 dark:text-green-400 font-semibold">
                      ✓ No overdue items
                    </div>
                  ) : (
                    <div className="overflow-y-auto max-h-96 space-y-3">
                      {overdueBorrowers.map((borrower) => (
                        <div key={borrower.borrower_id} className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">{borrower.borrower_name}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">ID: {borrower.borrower_id}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-2">
                            <div className="bg-white dark:bg-gray-700 rounded px-2 py-1.5 border border-gray-200 dark:border-gray-600">
                              <p className="text-xs text-gray-600 dark:text-gray-400">Requests</p>
                              <p className="text-lg font-bold text-red-600 dark:text-red-400">{borrower.overdue_request_count}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-700 rounded px-2 py-1.5 border border-gray-200 dark:border-gray-600">
                              <p className="text-xs text-gray-600 dark:text-gray-400">Items</p>
                              <p className="text-lg font-bold text-red-600 dark:text-red-400">{borrower.overdue_item_count}</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300">Due: {new Date(borrower.earliest_due_date).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Low Stock Items */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 border-yellow-500 border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    Low Stock Items
                  </h3>
                  {lowStockCostumes.length === 0 ? (
                    <div className="text-center py-8 text-green-600 dark:text-green-400 font-semibold">
                      ✓ No low stock items
                    </div>
                  ) : (
                    <div className="overflow-y-auto max-h-96 space-y-3">
                      {lowStockCostumes.map((item) => (
                        <div key={item.item_id} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">{item.name}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{item.category}</p>
                            </div>
                            <span className="inline-block bg-yellow-200 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 px-3 py-1 rounded-full text-sm font-bold">
                              {item.quantity || 0}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Inventory Insights */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Inventory Insights</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
                  {/* Total Inventory Stats */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Total Inventory</h3>
                    {totalInventory && Object.keys(totalInventory).length > 0 ? (
                      <div className="space-y-3">
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">Total Items</p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalInventory.total_items || 0}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">Total Units</p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalInventory.total_units || 0}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-1">Total Quantity</p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalInventory.total_quantity || 0}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>No inventory data</p>
                      </div>
                    )}
                  </div>

                  {/* Top Borrowed Items */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Borrowed Items</h3>
                    {inventoryChanges.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>No items borrowed</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {inventoryChanges
                          .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
                          .slice(0, 5)
                          .map((it, idx) => (
                            <div key={it.item_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{it.name}</span>
                              </div>
                              <span className="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-full text-xs font-bold ml-2">
                                {it.quantity || 0}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Least Borrowed Items */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Least Borrowed</h3>
                    {inventoryChanges.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>No items data</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {inventoryChanges
                          .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
                          .slice(0, 5)
                          .map((it) => (
                            <div key={it.item_id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{it.name}</span>
                              </div>
                              <span className="inline-block bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2.5 py-1 rounded-full text-xs font-bold ml-2">
                                {it.quantity || 0}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Visual Analytics</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Donut Chart */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Request Status Distribution</h3>
                    {summary && donutData.length > 0 ? (
                      <div className="w-full">
                        {hasChartData ? (
                          <>
                            <ResponsiveContainer width="100%" height={280}>
                              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                <Pie
                                  data={donutData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={100}
                                  paddingAngle={3}
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
                                    padding: "10px",
                                    color: "#ffffff"
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                              {donutData.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
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
                          </>
                        ) : (
                          <div className="w-full h-48 flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <p>No requests for this month</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p>No chart data available</p>
                      </div>
                    )}
                  </div>

                  {/* Bar Chart */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Monthly Progress</h3>
                    {barData.length > 0 && hasChartData ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#3a3a3a" />
                          <XAxis dataKey="name" stroke="#999" />
                          <YAxis stroke="#999" />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: "#1a1a1a",
                              border: "1px solid #3a3a3a",
                              borderRadius: "8px",
                              padding: "10px",
                              color: "#ffffff"
                            }}
                          />
                          <Legend />
                          <Bar dataKey="approved" fill={COLORS.green} name="Approved" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="pending" fill={COLORS.yellow} name="Pending" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="declined" fill={COLORS.red} name="Declined" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="returned" fill={COLORS.gray} name="Returned" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <p>No progress data available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">No borrow data available for {new Date(0, month - 1).toLocaleString('default', { month: 'long' })} {year}</p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
