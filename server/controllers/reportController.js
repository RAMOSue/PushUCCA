//
// Phase 5 Reporting Controller
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
// - overdue_count = requests approved where due_date < today AND (returned_date IS NULL OR returned_date > due_date).
// - total_borrowed_items = SUM of borrowing_items.quantity for all requests in range (any status except declined).
// - inventory_changes: JSON of { item_id, name, qty_borrowed_in_month }.
// - Requires npm libs: pdfkit (for PDF). Install: `npm i pdfkit`
//
// Security: routes protect w/ requireStaffOrAdmin in reportRoutes.js.
//
const pool = require("../db");

// Load pdfkit only if installed (prevents crash when missing)
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

/** Validate and normalize month/year from query params. */
function parseMonthYear(rawMonth, rawYear) {
  const m = Number(rawMonth);
  const y = Number(rawYear);
  if (!Number.isInteger(m) || m < 1 || m > 12) {
    throw new Error("Invalid month (1-12 required).");
  }
  if (!Number.isInteger(y) || y < 1970 || y > 3000) {
    throw new Error("Invalid year.");
  }
  return { month: m, year: y };
}

/** Get start/end timestamps for a given month/year (Postgres friendly). */
function monthDateRange(month, year) {
  // JS months are 0-based
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0)); // first day NEXT month
  return { start, end };
}

/** Format YYYY-MM for storage in monthly_reports.month column. */
function monthKey(month, year) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Convert rows (inventory changes) into compact JSON for DB. */
function rowsToInventoryChanges(rows) {
  return rows.map((r) => ({
    item_id: r.item_id,
    name: r.item_name,
    quantity: Number(r.total_quantity) || 0,
  }));
}

/* ---------------------------------------------------------- *
 * Borrower Report  (GROUPED)
 * ---------------------------------------------------------- */

/**
 * getBorrowerReport
 * Detailed transaction history for a borrower + summary totals.
 * Response shape:
 * {
 *   borrower_id: 123,
 *   summary: {...},
 *   requests: [
 *     {
 *       request_id,
 *       status,
 *       request_date,
 *       due_date,
 *       returned_date,
 *       total_items,        // sum of quantities in this request
 *       items: [ {item_id, item_name, quantity_borrowed}, ... ]
 *     },
 *     ...
 *   ]
 * }
 */
async function getBorrowerReport(req, res) {
  const { borrowerId } = req.params;

  try {
    // Detail rows (one row per item in request)
    const detailSql = `
      SELECT 
        br.id AS request_id,
        br.status,
        br.request_date,
        br.due_date,
        br.returned_date,
        ii.id AS item_id,
        ii.name AS item_name,
        bi.quantity AS quantity_borrowed
      FROM borrowing_requests br
      JOIN borrowing_items bi ON bi.borrowing_id = br.id
      JOIN inventory_items ii ON ii.id = bi.inventory_item_id
      WHERE br.borrower_id = $1
      ORDER BY br.request_date DESC, br.id DESC, ii.name ASC
    `;
    const detailRes = await pool.query(detailSql, [borrowerId]);

    // GROUP detail rows by request_id
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
          returned_date: row.returned_date,
          total_items: 0,
          items: [],
        };
        groupedMap.set(rid, grp);
      }
      grp.items.push({
        item_id: row.item_id,
        item_name: row.item_name,
        quantity_borrowed: Number(row.quantity_borrowed) || 0,
      });
      grp.total_items += Number(row.quantity_borrowed) || 0;
    }
    const groupedRequests = Array.from(groupedMap.values());

    // Summary totals
    const summarySql = `
      SELECT
        COUNT(*)                            AS total_requests,
        COUNT(*) FILTER (WHERE status = 'pending')  AS pending_count,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'declined') AS declined_count,
        COUNT(*) FILTER (WHERE status = 'returned') AS returned_count,
        SUM(bi.quantity) AS total_items_borrowed
      FROM borrowing_requests br
      JOIN borrowing_items bi ON bi.borrowing_id = br.id
      WHERE br.borrower_id = $1
    `;
    const summaryRes = await pool.query(summarySql, [borrowerId]);

    // Overdue count
    const overdueSql = `
      SELECT COUNT(*) AS overdue_count
      FROM borrowing_requests
      WHERE borrower_id = $1
        AND status = 'approved'
        AND due_date IS NOT NULL
        AND due_date < CURRENT_DATE
        AND (returned_date IS NULL OR returned_date > due_date)
    `;
    const overdueRes = await pool.query(overdueSql, [borrowerId]);

    const summary = {
      ...summaryRes.rows[0],
      overdue_count: Number(overdueRes.rows[0].overdue_count) || 0,
    };

    res.json({
      borrower_id: Number(borrowerId),
      summary,
      requests: groupedRequests,
    });
  } catch (err) {
    console.error("❌ getBorrowerReport error:", err.message);
    res.status(500).json({ error: "Failed to fetch borrower report." });
  }
}

/* ---------------------------------------------------------- *
 * Monthly Report (aggregate)
 * ---------------------------------------------------------- */

/**
 * buildMonthlySummary
 * Returns { summary, inventoryChanges, rawRequests }
 * Does NOT write to DB.
 */
async function buildMonthlySummary(month, year) {
  const { start, end } = monthDateRange(month, year);

  // 1) Aggregate totals by status & item counts
  const totalsSql = `
    SELECT
      COUNT(*) AS total_requests,
      COUNT(*) FILTER (WHERE status = 'pending')  AS pending_count,
      COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
      COUNT(*) FILTER (WHERE status = 'declined') AS declined_count,
      COUNT(*) FILTER (WHERE status = 'returned') AS returned_count,
      COALESCE(SUM(bi.quantity),0) AS total_borrowed_items
    FROM borrowing_requests br
    JOIN borrowing_items bi ON bi.borrowing_id = br.id
    WHERE br.request_date >= $1
      AND br.request_date < $2
  `;
  const totalsRes = await pool.query(totalsSql, [start, end]);
  const totals = totalsRes.rows[0];

  // 2) Overdue count within month (requests CREATED in month that later became overdue)
  const overdueSql = `
    SELECT COUNT(*) AS overdue_count
    FROM borrowing_requests br
    WHERE br.request_date >= $1
      AND br.request_date < $2
      AND br.status = 'approved'
      AND br.due_date IS NOT NULL
      AND br.due_date < CURRENT_DATE
      AND (br.returned_date IS NULL OR br.returned_date > br.due_date)
  `;
  const overdueRes = await pool.query(overdueSql, [start, end]);
  const overdue_count = Number(overdueRes.rows[0].overdue_count) || 0;

  // 3) Inventory usage by item
  const invSql = `
    SELECT 
      ii.id AS item_id,
      ii.name AS item_name,
      SUM(bi.quantity) AS total_quantity
    FROM borrowing_requests br
    JOIN borrowing_items bi ON bi.borrowing_id = br.id
    JOIN inventory_items ii ON ii.id = bi.inventory_item_id
    WHERE br.request_date >= $1
      AND br.request_date < $2
      AND br.status <> 'declined'
    GROUP BY ii.id, ii.name
    ORDER BY total_quantity DESC, ii.name ASC
  `;
  const invRes = await pool.query(invSql, [start, end]);

  // 4) Raw request list (basic)
  const reqSql = `
    SELECT 
      br.id,
      br.borrower_id,
      br.status,
      br.request_date,
      br.due_date,
      br.returned_date,
      u.name AS borrower_name
    FROM borrowing_requests br
    JOIN users u ON u.id = br.borrower_id
    WHERE br.request_date >= $1
      AND br.request_date < $2
    ORDER BY br.request_date ASC;
  `;
  const reqRes = await pool.query(reqSql, [start, end]);

  const summary = {
    ...totals,
    overdue_count,
    month,
    year,
    start: start.toISOString(),
    end: end.toISOString(),
  };

  const inventoryChanges = rowsToInventoryChanges(invRes.rows);
  const rawRequests = reqRes.rows;

  return { summary, inventoryChanges, rawRequests };
}

/**
 * getMonthlyReport (GET /api/reports/monthly)
 * Builds and returns summary; optional ?persist=1 writes to monthly_reports if not already stored.
 */
async function getMonthlyReport(req, res) {
  const { month: m, year: y, persist } = req.query;
  let month, year;
  try {
    ({ month, year } = parseMonthYear(m, y));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const { summary, inventoryChanges, rawRequests } =
      await buildMonthlySummary(month, year);

    // persist?
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

    res.json({
      summary,
      inventory_changes: inventoryChanges,
      requests: rawRequests,
    });
  } catch (err) {
    console.error("❌ getMonthlyReport error:", err.message);
    res.status(500).json({ error: "Failed to build monthly report." });
  }
}

/**
 * generateMonthlyReport (POST /api/reports/monthly/generate)
 * Forces regeneration & persistence (admin/staff action).
 * Body: { month, year }
 */
async function generateMonthlyReport(req, res) {
  const { month: m, year: y } = req.body;
  let month, year;
  try {
    ({ month, year } = parseMonthYear(m, y));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    const { summary, inventoryChanges } = await buildMonthlySummary(
      month,
      year
    );

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
    });
  } catch (err) {
    console.error("❌ generateMonthlyReport error:", err.message);
    res.status(500).json({ error: "Failed to generate monthly report." });
  }
}

/* ---------------------------------------------------------- *
 * Export: PDF / CSV
 * ---------------------------------------------------------- */

/**
 * exportMonthlyReport (GET /api/reports/monthly/export?month=..&year=..&format=pdf|csv)
 */
async function exportMonthlyReport(req, res) {
  const { month: m, year: y, format } = req.query;
  let month, year;
  try {
    ({ month, year } = parseMonthYear(m, y));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // Build summary fresh (so export always up-to-date)
  let data;
  try {
    data = await buildMonthlySummary(month, year);
  } catch (err) {
    console.error("❌ exportMonthlyReport summary error:", err.message);
    return res.status(500).json({ error: "Failed to build report for export." });
  }

  const { summary, inventoryChanges, rawRequests } = data;
  const fileBase = `monthly-report-${summary.year}-${String(summary.month).padStart(2, "0")}`;

  // CSV
  if (format === "csv") {
    const rows = [];
    rows.push(["Metric", "Value"]);
    rows.push(["Total Requests", summary.total_requests]);
    rows.push(["Pending", summary.pending_count]);
    rows.push(["Approved", summary.approved_count]);
    rows.push(["Declined", summary.declined_count]);
    rows.push(["Returned", summary.returned_count]);
    rows.push(["Total Items Borrowed", summary.total_borrowed_items]);
    rows.push(["Overdue Count", summary.overdue_count]);
    rows.push([]);
    rows.push(["Item ID", "Item Name", "Qty Borrowed"]);
    inventoryChanges.forEach((i) => {
      rows.push([i.item_id, i.name, i.quantity]);
    });

    // simple CSV serialization
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

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileBase}.csv"`
    );
    return res.send(csv);
  }

  // PDF (default)
  if (!PDFDocument) {
    return res
      .status(500)
      .json({ error: "PDF export requested but pdfkit is not installed." });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileBase}.pdf"`
  );

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  doc.fontSize(18).text("Monthly Borrowing Report", { align: "center" });
  doc.moveDown(0.5);
  doc
    .fontSize(12)
    .text(`Month: ${summary.year}-${String(summary.month).padStart(2, "0")}`);
  doc.moveDown();

  doc.fontSize(14).text("Summary Metrics");
  doc.moveDown(0.25);
  const metrics = [
    ["Total Requests", summary.total_requests],
    ["Pending", summary.pending_count],
    ["Approved", summary.approved_count],
    ["Declined", summary.declined_count],
    ["Returned", summary.returned_count],
    ["Total Items Borrowed", summary.total_borrowed_items],
    ["Overdue Count", summary.overdue_count],
  ];
  metrics.forEach(([label, val]) => {
    doc.fontSize(12).text(`${label}: ${val}`);
  });
  doc.moveDown();

  doc.fontSize(14).text("Inventory Usage");
  doc.moveDown(0.25);
  inventoryChanges.forEach((i) => {
    doc.fontSize(12).text(`• ${i.name} (ID ${i.item_id}) — ${i.quantity}`);
  });
  doc.moveDown();

  doc.fontSize(14).text("Requests (IDs)");
  doc.moveDown(0.25);
  rawRequests.forEach((r) => {
    doc
      .fontSize(12)
      .text(
        `#${r.id} | ${r.borrower_name} | ${r.status} | Req: ${new Date(
          r.request_date
        ).toLocaleDateString()}`
      );
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
