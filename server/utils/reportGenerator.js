/**
 * Server-side plain text report generator
 * Mirrors the client-side generatePlainReport function
 */

/**
 * Generate a plain text inventory report from summary data
 * @param {Object} summary - Summary data from database
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year (4 digits)
 * @param {string} userName - Name of user generating the report
 * @returns {string} Plain text report
 */
function generatePlainReport(summary, month, year, userName = "System Administrator") {
  if (!summary) {
    return "ERROR: No summary data available for report generation.\n";
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthName = monthNames[month - 1] || "Unknown";

  const today = new Date();
  const dateStr = String(today.getMonth() + 1).padStart(2, "0") + "/" +
                  String(today.getDate()).padStart(2, "0") + "/" +
                  today.getFullYear();

  // === BUILD THE REPORT ===
  // Simple letter-style format matching client
  const lines = [];
  
  // Title and month/year (centered)
  lines.push("                      INVENTORY SUMMARY REPORT");
  lines.push("");
  lines.push(`                              ${monthName} ${year}`);
  lines.push("");
  lines.push("");
  
  // Salutation
  lines.push(`Good day, ${userName},`);
  lines.push("");
  
  // Main paragraph with key data
  lines.push(`In ${monthName} ${year}, the borrowing system processed a total of ${summary.total_requests || 0} requests from ${summary.unique_borrowers || 0} unique borrower${summary.unique_borrowers !== 1 ? "s" : ""}. A total of ${summary.total_borrowed_items || 0} items were borrowed across ${summary.unique_items_borrowed || 0} different inventory item${summary.unique_items_borrowed !== 1 ? "s" : ""}. The approval rate stood at ${summary.approval_rate || 0}%, with ${summary.approved_count || 0} requests approved and ${summary.returned_count || 0} items subsequently returned.`);
  lines.push("");
  
  // Status paragraph
  if (summary.overdue_count > 0) {
    lines.push(`⚠️  ATTENTION REQUIRED: There are currently ${summary.overdue_count} item${summary.overdue_count !== 1 ? "s" : ""} overdue. Please contact borrowers for immediate return or follow-up action needed.`);
  } else {
    lines.push(`No items are currently overdue, indicating good compliance among borrowers.`);
  }
  
  lines.push("");
  lines.push("");
  
  // Signature area
  lines.push("System Administrator");
  lines.push("");
  lines.push(userName);

  return lines.join("\n");
}

module.exports = { generatePlainReport };
