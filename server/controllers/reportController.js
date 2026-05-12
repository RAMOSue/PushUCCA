// reportController.js 
// ------------------------------------------------------------
// Endpoints implemented in reportRoutes.js:
//   GET  /api/reports/borrower/:borrowerId           -> borrower history + totals (GROUPED by request)
//   GET  /api/reports/monthly                        -> on-demand monthly summary (does NOT persist unless ?persist=1)
//   POST /api/reports/monthly/generate               -> generate + persist summary row in monthly_reports
//   GET  /api/reports/monthly/export                 -> export csv|pdf
//
// NOTES:
// - month is 1-12; year 4-digit.
// - We aggregate using request_date (when borrowing_request created).
// - overdue_count = requests approved where due_date < today AND (returned_at IS NULL OR returned_at > due_date).
// - total_borrowed_items = COUNT of borrowing_items rows (each unit).
// - inventory_changes: JSON of { item_id, name, qty_borrowed_in_month }.
// - Requires npm libs: pdfkit (for PDF). Install: `npm i pdfkit`
//
// Security: routes protect w/ requireStaffOrAdmin in reportRoutes.js.
//
const pool = require("../db");
const { generatePlainReport } = require("../utils/reportGenerator");

// Load pdfkit only if installed
let PDFDocument;
try {
  PDFDocument = require("pdfkit");
} catch (err) {
  console.warn(
    "[reportController] pdfkit not installed. PDF exports will fail until you run `npm i pdfkit`.",
    err?.message
  );
}

/* ---------------------------------------------------------- *
 * Helpers
 * ---------------------------------------------------------- */
function parseMonthYear(rawMonth, rawYear) {
  const m = Number(rawMonth);
  const y = Number(rawYear);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error("Invalid month (1-12 required).");
  if (!Number.isInteger(y) || y < 1970 || y > 3000) throw new Error("Invalid year.");
  return { month: m, year: y };
}

function monthDateRange(month, year) {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
}

function monthKey(month, year) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function rowsToInventoryChanges(rows) {
  return rows.map((r) => ({
    item_id: r.item_id,
    name: r.item_name,
    quantity: Number(r.total_quantity) || 0,
  }));
}

/* ---------------------------------------------------------- *
 * Borrower Report
 * ---------------------------------------------------------- */
async function getBorrowerReport(req, res) {
  const { borrowerId } = req.params;
  try {
    // Detail rows per borrowed unit
    const detailSql = `
      SELECT 
        br.id AS request_id,
        br.status,
        br.request_date,
        br.due_date,
        br.returned_at,
        ii.uuid AS item_id,
        ii.name AS item_name
      FROM borrowing_requests br
      JOIN borrowing_items bi ON bi.borrowing_id = br.id
      JOIN inventory_units iu ON iu.id = bi.inventory_unit_id
      JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
      WHERE br.borrower_id = $1
      ORDER BY br.request_date DESC, br.id DESC, ii.name ASC
    `;
    const detailRes = await pool.query(detailSql, [borrowerId]);

    const groupedMap = new Map();
    for (const row of detailRes.rows) {
      const rid = row.request_id;
      let grp = groupedMap.get(rid);
      if (!grp) {
        grp = {
          request_id: rid,
          status: row.status,
          request_date: row.request_date,
          due_date: row.due_date,
          returned_date: row.returned_at,
          total_items: 0,
          items: [],
        };
        groupedMap.set(rid, grp);
      }
      grp.items.push({
        item_id: row.item_id,
        item_name: row.item_name,
        quantity_borrowed: 1,
      });
      grp.total_items += 1;
    }
    const groupedRequests = Array.from(groupedMap.values());

    // Summary totals
    const summarySql = `
      SELECT
        COUNT(DISTINCT br.id) AS total_requests,
        COUNT(DISTINCT br.id) FILTER (WHERE status = 'pending')  AS pending_count,
        COUNT(DISTINCT br.id) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(DISTINCT br.id) FILTER (WHERE status = 'declined') AS declined_count,
        COUNT(DISTINCT br.id) FILTER (WHERE status = 'returned') AS returned_count,
        COUNT(bi.id) AS total_items_borrowed
      FROM borrowing_requests br
      JOIN borrowing_items bi ON bi.borrowing_id = br.id
      WHERE br.borrower_id = $1
    `;
    const summaryRes = await pool.query(summarySql, [borrowerId]);

    const overdueSql = `
      SELECT COUNT(*) AS overdue_count
      FROM borrowing_requests
      WHERE borrower_id = $1
        AND status = 'approved'
        AND due_date IS NOT NULL
        AND due_date < CURRENT_DATE
        AND (returned_at IS NULL OR returned_at > due_date)
    `;
    const overdueRes = await pool.query(overdueSql, [borrowerId]);

    const summary = {
      ...summaryRes.rows[0],
      overdue_count: Number(overdueRes.rows[0].overdue_count) || 0,
    };

    res.json({ borrower_id: Number(borrowerId), summary, requests: groupedRequests });
  } catch (err) {
    console.error("❌ getBorrowerReport error:", err.message);
    res.status(500).json({ error: "Failed to fetch borrower report." });
  }
}

/* ---------------------------------------------------------- *
 * Monthly Report
 * ---------------------------------------------------------- */
async function buildMonthlySummary(month, year) {
  const { start, end } = monthDateRange(month, year);

  // 1️⃣ Totals + Additional Metrics
  const totalsSql = `
    SELECT
      COUNT(DISTINCT br.id) AS total_requests,
      COUNT(DISTINCT br.id) FILTER (WHERE status = 'pending')  AS pending_count,
      COUNT(DISTINCT br.id) FILTER (WHERE status = 'approved') AS approved_count,
      COUNT(DISTINCT br.id) FILTER (WHERE status = 'declined') AS declined_count,
      COUNT(DISTINCT br.id) FILTER (WHERE status = 'returned') AS returned_count,
      COUNT(DISTINCT br.borrower_id) AS unique_borrowers,
      COUNT(bi.id) AS total_borrowed_items
    FROM borrowing_requests br
    JOIN borrowing_items bi ON bi.borrowing_id = br.id
    WHERE br.request_date >= $1
      AND br.request_date < $2
  `;
  const totalsRes = await pool.query(totalsSql, [start, end]);
  const totals = totalsRes.rows[0];

  // 2️⃣ Overdue count
  const overdueSql = `
    SELECT COUNT(*) AS overdue_count
    FROM borrowing_requests br
    WHERE br.request_date >= $1
      AND br.request_date < $2
      AND br.status = 'approved'
      AND br.due_date IS NOT NULL
      AND br.due_date < CURRENT_DATE
      AND (br.returned_at IS NULL OR br.returned_at > br.due_date)
  `;
  const overdueRes = await pool.query(overdueSql, [start, end]);
  const overdue_count = Number(overdueRes.rows[0].overdue_count) || 0;

  // 2.5️⃣ Count unique items borrowed
  const uniqueItemsSql = `
    SELECT COUNT(DISTINCT ii.uuid) AS unique_items_borrowed
    FROM borrowing_requests br
    JOIN borrowing_items bi ON bi.borrowing_id = br.id
    JOIN inventory_units iu ON iu.id = bi.inventory_unit_id
    JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
    WHERE br.request_date >= $1
      AND br.request_date < $2
      AND br.status <> 'declined'
  `;
  const uniqueItemsRes = await pool.query(uniqueItemsSql, [start, end]);
  const unique_items_borrowed = Number(uniqueItemsRes.rows[0]?.unique_items_borrowed) || 0;

  // 3️⃣ Inventory usage (FIXED UUID issue)
  const invSql = `
    SELECT 
      ii.uuid AS item_id,
      ii.name AS item_name,
      COUNT(bi.id) AS total_quantity
    FROM borrowing_requests br
    JOIN borrowing_items bi ON bi.borrowing_id = br.id
    JOIN inventory_units iu ON iu.id = bi.inventory_unit_id
    JOIN inventory_items ii ON ii.uuid = iu.inventory_item_id
    WHERE br.request_date >= $1
      AND br.request_date < $2
      AND br.status <> 'declined'
    GROUP BY ii.uuid, ii.name
    ORDER BY total_quantity DESC, ii.name ASC
  `;
  const invRes = await pool.query(invSql, [start, end]);

  // 4️⃣ Raw request list
  const reqSql = `
    SELECT 
      br.id,
      br.borrower_id,
      br.status,
      br.request_date,
      br.due_date,
      br.returned_at,
      u.name AS borrower_name
    FROM borrowing_requests br
    JOIN users u ON u.id = br.borrower_id
    WHERE br.request_date >= $1
      AND br.request_date < $2
    ORDER BY br.request_date ASC;
  `;
  const reqRes = await pool.query(reqSql, [start, end]);

  // 5️⃣ Low stock costumes (category = 'costume')
  const lowStockCostumesSql = `
    SELECT 
      ii.uuid AS item_id,
      ii.name AS item_name,
      ii.quantity,
      ii.category
    FROM inventory_items ii
    WHERE ii.category = 'costume'
      AND (ii.quantity <= 2 OR ii.quantity IS NULL OR ii.quantity = 0)
    ORDER BY ii.quantity ASC NULLS LAST, ii.name ASC
    LIMIT 10
  `;
  const lowStockCostumesRes = await pool.query(lowStockCostumesSql);

  // 6️⃣ Total inventory statistics
  const totalInventorySql = `
    SELECT 
      COUNT(DISTINCT ii.uuid) AS total_items,
      COUNT(iu.id) AS total_units,
      SUM(ii.quantity) AS total_quantity
    FROM inventory_items ii
    LEFT JOIN inventory_units iu ON iu.inventory_item_id = ii.uuid
  `;
  const totalInventoryRes = await pool.query(totalInventorySql);
  const totalInventoryStats = totalInventoryRes.rows[0];

  // 7️⃣ Overdue borrowers who haven't returned items
  const overdueBorrowersSql = `
    SELECT
      u.id AS borrower_id,
      u.name AS borrower_name,
      COUNT(DISTINCT br.id) AS overdue_request_count,
      COUNT(bi.id) AS overdue_item_count,
      MIN(br.due_date) AS earliest_due_date
    FROM borrowing_requests br
    JOIN borrowing_items bi ON bi.borrowing_id = br.id
    JOIN users u ON u.id = br.borrower_id
    WHERE br.status = 'approved'
      AND br.due_date IS NOT NULL
      AND br.due_date < CURRENT_DATE
      AND (br.returned_at IS NULL OR br.returned_at > br.due_date)
    GROUP BY u.id, u.name
    ORDER BY MIN(br.due_date) ASC
  `;
  const overdueBorrowersRes = await pool.query(overdueBorrowersSql);

  const summary = {
    ...totals,
    unique_items_borrowed,
    overdue_count,
    approval_rate: totals.total_requests > 0 
      ? parseFloat(((Number(totals.approved_count) + Number(totals.returned_count)) / Number(totals.total_requests) * 100).toFixed(1))
      : 0,
    decline_rate: totals.total_requests > 0 
      ? parseFloat((Number(totals.declined_count) / Number(totals.total_requests) * 100).toFixed(1))
      : 0,
    pending_rate: totals.total_requests > 0 
      ? parseFloat((Number(totals.pending_count) / Number(totals.total_requests) * 100).toFixed(1))
      : 0,
    month,
    year,
    start: start.toISOString(),
    end: end.toISOString(),
  };

  const inventoryChanges = rowsToInventoryChanges(invRes.rows);
  const rawRequests = reqRes.rows;
  const lowStockCostumes = lowStockCostumesRes.rows.map(r => ({
    item_id: r.item_id,
    name: r.item_name,
    quantity: Number(r.quantity) || 0,
    category: r.category
  }));
  const totalInventory = {
    total_items: Number(totalInventoryStats.total_items) || 0,
    total_units: Number(totalInventoryStats.total_units) || 0,
    total_quantity: Number(totalInventoryStats.total_quantity) || 0
  };
  const overdueBorrowers = overdueBorrowersRes.rows.map(r => ({
    borrower_id: r.borrower_id,
    borrower_name: r.borrower_name,
    overdue_request_count: Number(r.overdue_request_count) || 0,
    overdue_item_count: Number(r.overdue_item_count) || 0,
    earliest_due_date: r.earliest_due_date
  }));

  return { summary, inventoryChanges, rawRequests, lowStockCostumes, totalInventory, overdueBorrowers };
}

/* ---------------------------------------------------------- *
 * Handlers
 * ---------------------------------------------------------- */
async function getMonthlyReport(req, res) {
  const { month: m, year: y, persist } = req.query;
  let month, year;
  try {
    ({ month, year } = parseMonthYear(m, y));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const { summary, inventoryChanges, rawRequests, lowStockCostumes, totalInventory, overdueBorrowers } = await buildMonthlySummary(month, year);
    if (persist === "1") {
      const key = monthKey(month, year);
      await pool.query(
        `
        INSERT INTO monthly_reports (month, generated_by, total_borrowed, overdue_count, inventory_changes, created_at)
        VALUES ($1, $2, $3, $4, $5::json, NOW())
        ON CONFLICT (month) DO UPDATE
          SET total_borrowed = EXCLUDED.total_borrowed,
              overdue_count = EXCLUDED.overdue_count,
              inventory_changes = EXCLUDED.inventory_changes,
              generated_by = EXCLUDED.generated_by,
              created_at = NOW()
        `,
        [
          key,
          req.user?.id || null,
          Number(summary.total_borrowed_items) || 0,
          Number(summary.overdue_count) || 0,
          JSON.stringify(inventoryChanges),
        ]
      );
    }

    res.json({ summary, inventory_changes: inventoryChanges, requests: rawRequests, low_stock_costumes: lowStockCostumes, total_inventory: totalInventory, overdue_borrowers: overdueBorrowers });
  } catch (err) {
    console.error("❌ getMonthlyReport error:", err.message);
    res.status(500).json({ error: "Failed to build monthly report." });
  }
}

async function generateMonthlyReport(req, res) {
  const { month: m, year: y } = req.body;
  let month, year;
  try {
    ({ month, year } = parseMonthYear(m, y));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const { summary, inventoryChanges, lowStockCostumes, totalInventory, overdueBorrowers } = await buildMonthlySummary(month, year);
    const key = monthKey(month, year);
    const result = await pool.query(
      `
      INSERT INTO monthly_reports (month, generated_by, total_borrowed, overdue_count, inventory_changes, created_at)
      VALUES ($1, $2, $3, $4, $5::json, NOW())
      ON CONFLICT (month) DO UPDATE
        SET total_borrowed = EXCLUDED.total_borrowed,
            overdue_count = EXCLUDED.overdue_count,
            inventory_changes = EXCLUDED.inventory_changes,
            generated_by = EXCLUDED.generated_by,
            created_at = NOW()
      RETURNING *
      `,
      [
        key,
        req.user?.id || null,
        Number(summary.total_borrowed_items) || 0,
        Number(summary.overdue_count) || 0,
        JSON.stringify(inventoryChanges),
      ]
    );

    res.json({
      persisted: true,
      report: result.rows[0],
      summary,
      inventory_changes: inventoryChanges,
      low_stock_costumes: lowStockCostumes,
      total_inventory: totalInventory,
      overdue_borrowers: overdueBorrowers,
    });
  } catch (err) {
    console.error("❌ generateMonthlyReport error:", err.message);
    res.status(500).json({ error: "Failed to generate monthly report." });
  }
}

/* ---------------------------------------------------------- *
 * Export: PDF / CSV
 * ---------------------------------------------------------- */
async function exportMonthlyReport(req, res) {
  const { month: m, year: y, format } = req.query;
  let month, year;
  try {
    ({ month, year } = parseMonthYear(m, y));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  let data;
  try {
    data = await buildMonthlySummary(month, year);
  } catch (err) {
    console.error("❌ exportMonthlyReport summary error:", err.message);
    return res.status(500).json({ error: "Failed to build report for export." });
  }

  const { summary, inventoryChanges, rawRequests, lowStockCostumes, totalInventory, overdueBorrowers } = data;
  const fileBase = `monthly-report-${summary.year}-${String(summary.month).padStart(2, "0")}`;
  const monthName = new Date(summary.year, summary.month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  // CSV export
  if (format === "csv") {
    const rows = [];
    
    // Header
    rows.push(["MONTHLY BORROWING REPORT"]);
    rows.push([monthName]);
    rows.push(["Generated on", new Date().toLocaleString()]);
    rows.push([]);
    
    // Summary Section
    rows.push(["SUMMARY METRICS"]);
    rows.push(["Metric", "Value"]);
    rows.push(["Total Requests", summary.total_requests]);
    rows.push(["Pending", summary.pending_count]);
    rows.push(["Approved", summary.approved_count]);
    rows.push(["Declined", summary.declined_count]);
    rows.push(["Returned", summary.returned_count]);
    rows.push(["Unique Borrowers", summary.unique_borrowers]);
    rows.push(["Unique Items Borrowed", summary.unique_items_borrowed]);
    rows.push(["Total Items Borrowed", summary.total_borrowed_items]);
    rows.push(["Overdue Count", summary.overdue_count]);
    rows.push(["Approval Rate (%)", summary.approval_rate]);
    rows.push(["Pending Rate (%)", summary.pending_rate]);
    rows.push(["Decline Rate (%)", summary.decline_rate]);
    rows.push([]);
    
    // Total Inventory Stats
    rows.push(["TOTAL INVENTORY STATS"]);
    rows.push(["Metric", "Count"]);
    rows.push(["Total Distinct Items", totalInventory.total_items]);
    rows.push(["Total Units", totalInventory.total_units]);
    rows.push(["Total Quantity Available", totalInventory.total_quantity]);
    rows.push([]);
    
    // Low Stock Costumes
    rows.push(["LOW STOCK COSTUMES (≤2 units)"]);
    rows.push(["Item Name", "Item UUID", "Current Quantity", "Category"]);
    lowStockCostumes.forEach((item) => 
      rows.push([item.name, item.item_id, item.quantity || 0, item.category])
    );
    rows.push([]);
    
    // Overdue Borrowers
    rows.push(["OVERDUE BORROWERS"]);
    rows.push(["Borrower Name", "Overdue Requests", "Overdue Items", "Earliest Due Date"]);
    overdueBorrowers.forEach((borrower) => 
      rows.push([
        borrower.borrower_name, 
        borrower.overdue_request_count, 
        borrower.overdue_item_count,
        new Date(borrower.earliest_due_date).toLocaleDateString()
      ])
    );
    rows.push([]);
    
    // Inventory Usage
    rows.push(["TOP BORROWED ITEMS"]);
    rows.push(["Item Name", "Item UUID", "Times Borrowed"]);
    inventoryChanges.slice(0, 10).forEach((i) => 
      rows.push([i.name, i.item_id, i.quantity])
    );
    rows.push([]);
    
    // All Requests
    rows.push(["DETAILED REQUESTS"]);
    rows.push(["Request ID", "Borrower Name", "Status", "Request Date", "Due Date", "Returned Date"]);
    rawRequests.forEach((r) => {
      rows.push([
        r.id,
        r.borrower_name,
        r.status,
        new Date(r.request_date).toLocaleDateString(),
        r.due_date ? new Date(r.due_date).toLocaleDateString() : "",
        r.returned_at ? new Date(r.returned_at).toLocaleDateString() : ""
      ]);
    });

    const csv = rows
      .map((r) =>
        r
          .map((v) => {
            if (v == null) return "";
            const s = String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.csv"`);
    return res.send("\uFEFF" + csv); // Add BOM for Excel UTF-8
  }

  // Plain text export
  if (format === "text") {
    const plainText = generatePlainReport(summary, month, year, req.user?.name || "System Administrator");
    
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.txt"`);
    return res.send(plainText);
  }

  // PDF export
  if (!PDFDocument) {
    return res.status(500).json({ error: "PDF export requested but pdfkit is not installed." });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.pdf"`);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  // Title
  doc.fontSize(24).font("Helvetica-Bold").text("Monthly Borrowing Report", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(14).font("Helvetica").text(monthName, { align: "center" });
  doc.fontSize(10).fillColor("#666").text(`Generated on ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(1);
  doc.strokeColor("#000").moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  // Summary Section
  doc.fontSize(14).font("Helvetica-Bold").fillColor("#000").text("📊 Summary Metrics", { underline: true });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(11);
  
  const metricPairs = [
    ["Total Requests", summary.total_requests, "Pending", summary.pending_count],
    ["Approved", summary.approved_count, "Declined", summary.declined_count],
    ["Returned", summary.returned_count, "Unique Borrowers", summary.unique_borrowers],
    ["Unique Items Borrowed", summary.unique_items_borrowed, "Total Items Borrowed", summary.total_borrowed_items],
    ["Overdue Count", summary.overdue_count, "Approval Rate", `${summary.approval_rate}%`],
    ["Pending Rate", `${summary.pending_rate}%`, "Decline Rate", `${summary.decline_rate}%`],
  ];

  metricPairs.forEach(([label1, val1, label2, val2]) => {
    doc.text(`${label1}: `, { continued: true }).font("Helvetica-Bold").text(val1, { continued: true })
       .font("Helvetica").text(`  |  ${label2}: `, { continued: true }).font("Helvetica-Bold").text(val2);
  });
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  // Total Inventory Stats
  doc.fontSize(14).font("Helvetica-Bold").text("📦 Total Inventory Stats");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(11);
  doc.text(`Total Distinct Items: `, { continued: true }).font("Helvetica-Bold").text(totalInventory.total_items);
  doc.font("Helvetica").text(`Total Units: `, { continued: true }).font("Helvetica-Bold").text(totalInventory.total_units);
  doc.font("Helvetica").text(`Total Quantity Available: `, { continued: true }).font("Helvetica-Bold").text(totalInventory.total_quantity);
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  // Low Stock Costumes
  if (lowStockCostumes.length > 0) {
    doc.fontSize(14).font("Helvetica-Bold").text("⚠️  Low Stock Costumes (≤2 units)");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10);
    lowStockCostumes.forEach((item) => {
      doc.text(`• ${item.name} - Quantity: `, { continued: true }).font("Helvetica-Bold").text(item.quantity || 0, { continued: true }).font("Helvetica").text(` [${item.item_id}]`);
    });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
  }

  // Overdue Borrowers
  if (overdueBorrowers.length > 0) {
    doc.fontSize(14).font("Helvetica-Bold").text("⏰ Overdue Borrowers");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10);
    overdueBorrowers.forEach((borrower) => {
      const dueDate = new Date(borrower.earliest_due_date).toLocaleDateString();
      doc.text(`• ${borrower.borrower_name} - Requests: ${borrower.overdue_request_count}, Items: ${borrower.overdue_item_count}, Due: ${dueDate}`);
    });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
  }

  // Top Borrowed Items
  if (inventoryChanges.length > 0) {
    doc.fontSize(14).font("Helvetica-Bold").text("📈 Top Borrowed Items");
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10);
    inventoryChanges.slice(0, 10).forEach((item, idx) => {
      doc.text(`${idx + 1}. ${item.name} - Times Borrowed: ${item.quantity} [${item.item_id}]`);
    });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
  }

  // Detailed Requests Summary
  doc.fontSize(14).font("Helvetica-Bold").text("📋 All Requests");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9);
  
  // Table header
  const tableTop = doc.y;
  const col1 = 50, col2 = 100, col3 = 200, col4 = 300, col5 = 400, col6 = 500;
  
  doc.font("Helvetica-Bold").text("ID", col1, tableTop, { width: 50 })
     .text("Borrower", col2, tableTop, { width: 100 })
     .text("Status", col3, tableTop, { width: 100 })
     .text("Req. Date", col4, tableTop, { width: 100 })
     .text("Due Date", col5, tableTop, { width: 100 })
     .text("Returned", col6, tableTop, { width: 50 });

  doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();
  
  let rowY = tableTop + 20;
  doc.font("Helvetica").fontSize(8);
  
  rawRequests.slice(0, 15).forEach((req) => {
    if (rowY > 720) {
      doc.addPage();
      rowY = 50;
    }
    const status = req.status || "-";
    const reqDate = new Date(req.request_date).toLocaleDateString();
    const dueDate = req.due_date ? new Date(req.due_date).toLocaleDateString() : "-";
    const retDate = req.returned_at ? new Date(req.returned_at).toLocaleDateString() : "-";
    
    doc.text(String(req.id), col1, rowY, { width: 50 })
       .text(req.borrower_name.substring(0, 12), col2, rowY, { width: 100 })
       .text(status, col3, rowY, { width: 100 })
       .text(reqDate, col4, rowY, { width: 100 })
       .text(dueDate, col5, rowY, { width: 100 })
       .text(retDate, col6, rowY, { width: 50 });
    
    rowY += 15;
  });

  doc.end();
}

/* ---------------------------------------------------------- *
 * Exports
 * ---------------------------------------------------------- */
module.exports = {
  getBorrowerReport,
  getMonthlyReport,
  generateMonthlyReport,
  exportMonthlyReport,
};
