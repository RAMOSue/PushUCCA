import axios from "axios";

/**
 * All report service calls MUST send credentials so the server
 * can read the session cookie and attach req.user.
 */
const AXIOS_OPTS = { withCredentials: true };

/**
 * Fetch monthly report data for a given month and year.
 * Returns:
 * {
 *   summary: { total_requests, approved_count, ... },
 *   inventory_changes: [ { item_id, name, quantity }, ... ],
 *   requests: [...]
 * }
 */
export const fetchMonthlyReport = async (month, year) => {
  const response = await axios.get("/api/reports/monthly", {
    params: { month, year },
    ...AXIOS_OPTS,
  });
  return response.data;
};

/**
 * Persist/generate the monthly report to the database.
 * Returns a success message + summary.
 */
export const generateMonthlyReport = async (month, year) => {
  const response = await axios.post(
    "/api/reports/monthly/generate",
    { month, year },
    AXIOS_OPTS
  );
  return response.data;
};

/**
 * Export monthly report in the specified format (csv or pdf).
 * Opens the report in a new browser tab.
 */
export const exportMonthlyReport = (month, year, format) => {
  // For same-origin, cookies (session) send automatically.
  // If you proxy, ensure credentials are passed.
  const url = `/api/reports/monthly/export?month=${month}&year=${year}&format=${format}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

/**
 * Fetch the full borrowing history and summary for a borrower by ID.
 * Returns:
 * {
 *   borrower_id,
 *   summary: {...},
 *   requests: [
 *     { request_id, status, request_date, due_date, returned_date, total_items, items:[...] },
 *     ...
 *   ]
 * }
 */
export const fetchBorrowerHistory = async (borrowerId) => {
  const response = await axios.get(
    `/api/reports/borrower/${encodeURIComponent(borrowerId)}`,
    AXIOS_OPTS
  );
  return response.data;
};
