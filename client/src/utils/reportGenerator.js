/**
 * Pure text-based report generator
 * Generates formal inventory summary reports without any UI/HTML structure
 */

export function generatePlainReport({ summary, month, year, user }) {
  if (!summary) {
    return "ERROR: No summary data available for report generation.";
  }

  const monthName = new Date(0, month - 1).toLocaleString("default", {
    month: "long",
  });

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const userName = user?.name || "System Administrator";

  // === CONSTRUCT THE REPORT ===
  // Simple letter-style format
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
  
  const report = lines.join("\n");

  return report;
}

/**
 * Opens a new window with the plain text report and enables printing
 * @param {string} textReport - The plain text report string
 * @param {string} title - Window/document title
 */
export function printPlainReport(textReport, title = "Inventory Report") {
  const printWindow = window.open("", "_blank", "width=900,height=700");

  if (!printWindow) {
    console.error("Failed to open print window. Please enable pop-ups.");
    return;
  }

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      width: 100%;
      height: 100%;
      background: white;
      color: #000;
    }

    body {
      font-family: 'Courier New', monospace;
      font-size: 11pt;
      line-height: 1.6;
      padding: 40px 60px;
      white-space: pre-wrap;
      word-wrap: break-word;
      text-align: center;
      background: #ffffff;
      color: #000;
    }

    @media print {
      body {
        padding: 20mm;
        font-size: 10pt;
      }

      * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @page {
        size: A4;
        margin: 20mm;
      }

      body {
        page-break-after: avoid;
        orphans: 3;
        widows: 3;
      }
    }

    /* No buttons in print view */
    @media print {
      button, input, select {
        display: none !important;
      }
    }
  </style>
</head>
<body>
${textReport}
</body>
</html>
  `;

  try {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Give the document time to render before printing
    setTimeout(() => {
      printWindow.print();
    }, 250);
  } catch (err) {
    console.error("Error writing to print window:", err);
    printWindow.close();
  }
}

/**
 * Download plain text report as a .txt file
 * @param {string} textReport - The plain text report string
 * @param {string} filename - Filename for download (without extension)
 */
export function downloadPlainTextReport(textReport, filename = "inventory-report") {
  const element = document.createElement("a");
  const file = new Blob([textReport], { type: "text/plain;charset=utf-8" });
  
  element.href = URL.createObjectURL(file);
  element.download = `${filename}.txt`;
  
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
  
  URL.revokeObjectURL(element.href);
}
