import { apiHandler, requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Monthly (or any-period) Excel export: one sheet per register, exactly as
 * stored (computed columns included) - "for the MD, bank and GRA".
 */
export const GET = apiHandler(async (req) => {
  await requireRole("MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "ACCOUNTANT");
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "2026-01-01";
  const to = url.searchParams.get("to") || "2026-12-31";

  const sheets = [
    ["Bookings", "booking", "travel_date", "booking_code"],
    ["Dispatch", "dispatch", "date", "dispatch_code"],
    ["Parcels", "parcel", "booking_date", "parcel_code"],
    ["Private Hire", "private_hire", "service_date", "hire_code"],
    ["School Transport", "school_student", "start_date", "student_code"],
    ["Trips", "trip", "date", "trip_code"],
    ["Fuel", "fuel", "date", "fuel_code"],
    ["Cash Reconciliation", "cash_reconciliation", "date", null],
    ["Incidents", "incident", "date", "incident_code"],
  ];

  const wb = XLSX.utils.book_new();
  let anyData = false;

  for (const [name, table, dateCol, codeCol] of sheets) {
    const params = [from, to];
    const { rows } = await query(
      `SELECT * FROM ${table}
        WHERE deleted = FALSE AND ${dateCol} BETWEEN $1 AND $2
        ORDER BY ${dateCol} DESC${codeCol ? ", " + codeCol : ""} LIMIT 20000`,
      params
    );
    if (rows.length) anyData = true;
    // Flatten dates for xlsx
    const clean = rows.map((r) => {
      const o = {};
      for (const [k, v] of Object.entries(r)) {
        if (v instanceof Date) o[k] = v.toISOString().slice(0, 10);
        else if (k !== "deleted") o[k] = v;
      }
      return o;
    });
    const ws = XLSX.utils.json_to_sheet(clean.length ? clean : [{ Note: "No rows in period" }]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="EHGA_export_${from}_to_${to}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
});