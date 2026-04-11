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
 * Downloads as a proper file attachment.
 */
export const exportMonthlyReport = async (month, year, format) => {
  try {
    const response = await axios.get(
      `/api/reports/monthly/export`,
      {
        params: { month, year, format },
        ...AXIOS_OPTS,
        responseType: 'blob'
      }
    );

    // Create blob URL and trigger download
    const blob = new Blob([response.data], { 
      type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/pdf'
    });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generate filename with proper extension
    const monthStr = String(month).padStart(2, '0');
    const filename = `monthly-report-${year}-${monthStr}.${format}`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export error:', err);
    throw err;
  }
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
