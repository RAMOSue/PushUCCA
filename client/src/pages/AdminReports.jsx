import { useState, useEffect, useContext } from "react";
import toast from "react-hot-toast";
import { UserContext } from "../../context/userContext";
import { useNavigate } from "react-router-dom";

import {
  fetchMonthlyReport,
  generateMonthlyReport as generateMonthlyReportService,
  exportMonthlyReport as exportMonthlyReportService,
  fetchBorrowerHistory as fetchBorrowerHistoryService,
} from "../services/reportService";

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
    "px-2 py-0.5 rounded text-xs font-semibold inline-block whitespace-nowrap";
  const map = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-blue-100 text-blue-800",
    declined: "bg-red-100 text-red-800",
    returned: "bg-green-100 text-green-800",
  };
  const cls = map[status] || "bg-gray-100 text-gray-700";
  return <span className={`${base} ${cls}`}>{status}</span>;
}

/**
 * Render a grouped borrower request (one card per borrow submission).
 */
function BorrowerRequestCard({ req }) {
  return (
    <details
      className="group border rounded p-3 mb-3 bg-white shadow-sm"
      defaultOpen={false}
    >
      <summary className="cursor-pointer select-none flex items-center gap-2">
        <span className="font-semibold">#{req.request_id}</span>
        <StatusBadge status={req.status} />
        <span className="text-xs text-gray-500">
          Req: {fmtDate(req.request_date)}
        </span>
        {req.due_date && (
          <span className="text-xs text-gray-500">
            • Due: {fmtDate(req.due_date)}
          </span>
        )}
        {req.returned_date && (
          <span className="text-xs text-gray-500">
            • Returned: {fmtDate(req.returned_date)}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-700">
          {req.total_items} item{req.total_items === 1 ? "" : "s"}
        </span>
      </summary>

      <ul className="mt-3 pl-5 list-disc text-sm text-gray-700">
        {req.items.map((it) => (
          <li key={it.item_id}>
            {it.item_name} &times;{it.quantity_borrowed}
          </li>
        ))}
      </ul>
    </details>
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

  const handlePersist = async () => {
    try {
      await generateMonthlyReportService(month, year);
      toast.success("Monthly report saved.");
      await fetchMonthly();
    } catch (err) {
      console.error("Persist error:", err);
      const status = err?.response?.status;
      if (status === 403) {
        toast.error("You are not allowed to save reports.");
      } else {
        toast.error("Failed to save monthly report.");
      }
    }
  };

  const handleExport = (fmt) => {
    exportMonthlyReportService(month, year, fmt);
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

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-blue-600">Reports & Analytics</h1>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
        >
          ⬅ Back
        </button>
      </div>

      {/* Month / Year Controls */}
      <div className="bg-white p-4 rounded shadow flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Month</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m.toString().padStart(2, "0")}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded px-2 py-1 w-24"
          />
        </div>

        <button
          onClick={fetchMonthly}
          className="h-9 px-3 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Refresh
        </button>

        <button
          onClick={handlePersist}
          className="h-9 px-3 bg-green-600 text-white text-sm rounded hover:bg-green-700"
        >
          Save to DB
        </button>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => handleExport("csv")}
            className="h-9 px-3 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport("pdf")}
            className="h-9 px-3 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Monthly Summary</h2>
        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : summary ? (
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <dt className="text-xs uppercase text-gray-500">Total Requests</dt>
              <dd className="font-semibold">{summary.total_requests}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Approved</dt>
              <dd className="font-semibold">{summary.approved_count}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Pending</dt>
              <dd className="font-semibold">{summary.pending_count}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Declined</dt>
              <dd className="font-semibold">{summary.declined_count}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Returned</dt>
              <dd className="font-semibold">{summary.returned_count}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Items Borrowed</dt>
              <dd className="font-semibold">{summary.total_borrowed_items}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Overdue</dt>
              <dd className="font-semibold text-red-600">
                {summary.overdue_count}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="text-gray-500">No data.</div>
        )}
      </div>

      {/* Inventory Usage */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-lg font-semibold mb-3">Top Borrowed Items</h2>
        {inventoryChanges.length === 0 ? (
          <div className="text-gray-500">No items this month.</div>
        ) : (
          <ul className="divide-y">
            {inventoryChanges.map((it) => (
              <li
                key={it.item_id}
                className="py-2 flex justify-between items-center"
              >
                <span>{it.name}</span>
                <span className="font-semibold">{it.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Borrower Lookup */}
      <div className="bg-white p-4 rounded shadow space-y-4">
        <h2 className="text-lg font-semibold">Borrower Lookup</h2>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Borrower ID"
            value={borrowerIdInput}
            onChange={(e) => setBorrowerIdInput(e.target.value)}
            className="border rounded px-2 py-1 w-36"
          />
          <button
            onClick={handleBorrowerLookup}
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Load
          </button>
        </div>

        {borrowerHistory && (
          <div className="mt-4 space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Borrower Summary</h3>
              <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(borrowerHistory.summary, null, 2)}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Requests</h4>
              {borrowerHistory.requests.length === 0 ? (
                <div className="text-sm text-gray-500">No requests.</div>
              ) : (
                borrowerHistory.requests.map((req) => (
                  <BorrowerRequestCard key={req.request_id} req={req} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
