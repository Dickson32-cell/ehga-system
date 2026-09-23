import { requireSession, apiHandler } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function statusOf(result, target, betterWhenHigher = true, tolerance = 0) {
  const r = Number(result);
  const t = Number(target);
  if (!isFinite(r) || !isFinite(t)) return "neutral";
  const diff = betterWhenHigher ? r - t : t - r;
  if (diff >= -tolerance) return "On target";
  return "Below target";
}

function pct(part, whole) {
  if (!whole) return 0;
  return part / whole;
}

export const GET = apiHandler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "2026-10-01";
  const to = url.searchParams.get("to") || "2026-12-31";

  const setupRes = await query("SELECT key, value FROM setup_kv");
  const kv = {};
  for (const r of setupRes.rows) kv[r.key] = r.value;
  const T = {
    occupancy: Number(kv.occupancy_target || 0.75),
    parcelDay: Number(kv.parcel_revenue_target || 150),
    fare: Number(kv.standard_fare || 90),
    reserve: Number(kv.maintenance_reserve || 0.35),
    cashTol: Number(kv.cash_variance_tolerance || 50),
    completion: 0.92,
  };

  const [bookings, parcels, hires, trips, fuel, cash, dispatch, fleet, students] = await Promise.all([
    query(
      "SELECT count(*)::int n, COALESCE(SUM(passenger_revenue),0)::float8 rev, COALESCE(SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END),0)::int completed FROM booking WHERE deleted=FALSE AND travel_date BETWEEN $1 AND $2 AND status <> 'Cancelled'",
      [from, to]
    ),
    query(
      "SELECT COALESCE(SUM(total_charge),0)::float8 rev FROM parcel WHERE deleted=FALSE AND booking_date BETWEEN $1 AND $2 AND status NOT IN ('Cancelled','Returned')",
      [from, to]
    ),
    query(
      "SELECT COALESCE(SUM(quoted_amount),0)::float8 rev FROM private_hire WHERE deleted=FALSE AND service_date BETWEEN $1 AND $2 AND status <> 'Cancelled'",
      [from, to]
    ),
    query(
      "SELECT COALESCE(SUM(kilometres),0)::float8 km, COALESCE(SUM(total_revenue),0)::float8 rev, COALESCE(SUM(direct_contribution),0)::float8 contrib, COALESCE(SUM(fuel_cost),0)::float8 fuelcost, count(*)::int n FROM trip WHERE deleted=FALSE AND date BETWEEN $1 AND $2",
      [from, to]
    ),
    query(
      "SELECT COALESCE(SUM(total_fuel_cost),0)::float8 cost FROM fuel WHERE deleted=FALSE AND date BETWEEN $1 AND $2",
      [from, to]
    ),
    query(
      "SELECT count(*)::int n, COALESCE(SUM(school_receipts),0)::float8 school, COALESCE(SUM(cash_variance),0)::float8 var_sum, COALESCE(SUM(CASE WHEN ABS(cash_variance) > $3 THEN 1 ELSE 0 END),0)::int review_days FROM cash_reconciliation WHERE deleted=FALSE AND date BETWEEN $1 AND $2",
      [from, to, T.cashTol]
    ),
    query(
      "SELECT COALESCE(SUM(seats_booked),0)::int booked, COALESCE(SUM(seat_capacity),0)::int capacity, COALESCE(SUM(CASE WHEN on_time_status='Late' THEN 1 ELSE 0 END),0)::int late, count(*)::int n FROM dispatch WHERE deleted=FALSE AND date BETWEEN $1 AND $2",
      [from, to]
    ),
    query(
      "SELECT COALESCE(SUM(CASE WHEN incident_status IN ('Open','Investigating') THEN 1 ELSE 0 END),0)::int open FROM trip WHERE deleted=FALSE AND date BETWEEN $1 AND $2",
      [from, to]
    ),
    query(
      "SELECT COALESCE(SUM(amount_paid),0)::float8 receipts FROM school_student WHERE deleted=FALSE",
      []
    ),
  ]);

  const b = bookings.rows[0];
  const p = parcels.rows[0];
  const h = hires.rows[0];
  const t = trips.rows[0];
  const f = fuel.rows[0];
  const c = cash.rows[0];
  const d = dispatch.rows[0];

  const dispatchOccupancy = d.capacity ? d.booked / d.capacity : 0;
  const revPerKm = t.km ? t.rev / t.km : 0;
  const completedRate = b.n ? b.completed / b.n : 0;
  const parcelPerCarDay = d.n ? p.rev / d.n : 0;

  const metrics = [
    {
      key: "passenger_bookings",
      label: "Passenger bookings",
      result: b.n,
      unit: "bookings",
      target: null,
      status: "neutral",
      detail: `${b.completed} completed of ${b.n} (completed rate ${(completedRate * 100).toFixed(1)}%)`,
    },
    {
      key: "passenger_revenue",
      label: "Passenger revenue",
      result: b.rev,
      unit: "GHS",
      target: null,
      status: "neutral",
      detail: `Fare GHS ${T.fare.toFixed(2)} per seat`,
    },
    {
      key: "parcel_revenue",
      label: "Parcel revenue",
      result: p.rev,
      unit: "GHS",
      target: null,
      status: "neutral",
      detail: `Per dispatch car-day GHS ${parcelPerCarDay.toFixed(2)} vs GHS ${T.parcelDay.toFixed(2)} target`,
    },
    {
      key: "parcel_per_car_day",
      label: "Parcel revenue per car-day",
      result: Number(parcelPerCarDay.toFixed(2)),
      unit: "GHS",
      target: T.parcelDay,
      status: statusOf(parcelPerCarDay, T.parcelDay),
      detail: `${d.n} dispatch days in period`,
    },
    {
      key: "private_hire_revenue",
      label: "Private-hire revenue",
      result: h.rev,
      unit: "GHS",
      target: null,
      status: "neutral",
      detail: "Quoted amounts excluding cancelled hires",
    },
    {
      key: "school_receipts",
      label: "School transport receipts",
      result: c.school,
      unit: "GHS",
      target: null,
      status: "neutral",
      detail: "Recorded on daily cash reconciliation",
    },
    {
      key: "dispatch_occupancy",
      label: "Weighted dispatch occupancy",
      result: Number(dispatchOccupancy.toFixed(4)),
      unit: "ratio",
      target: T.occupancy,
      status: statusOf(dispatchOccupancy, T.occupancy),
      detail: `${d.booked} seats booked of ${d.capacity} seat capacity`,
    },
    {
      key: "revenue_per_km",
      label: "Revenue per trip km",
      result: Number(revPerKm.toFixed(2)),
      unit: "GHS/km",
      target: T.fare * 3 / 260,
      status: statusOf(revPerKm, (T.fare * 3) / 260),
      detail: `${t.km.toFixed(1)} km across ${t.n} trips; reference Koforidua-Accra round trip ~260 km at full load`,
    },
    {
      key: "fuel_cost",
      label: "Fuel cost",
      result: f.cost,
      unit: "GHS",
      target: null,
      status: "neutral",
      detail: `Trip-recorded fuel cost GHS ${t.fuelcost.toFixed(2)}`,
    },
    {
      key: "direct_contribution",
      label: "Direct trip contribution",
      result: t.contrib,
      unit: "GHS",
      target: 0,
      status: statusOf(t.contrib, 0),
      detail: `Revenue minus tolls, fuel and GHS ${T.reserve.toFixed(2)}/km maintenance reserve`,
    },
    {
      key: "cash_review_days",
      label: "Cash variance days needing review",
      result: c.review_days,
      unit: "days",
      target: 0,
      status: statusOf(c.review_days, 0, false),
      detail: `Tolerance GHS ${T.cashTol.toFixed(2)}; ${c.n} reconciled days`,
    },
    {
      key: "late_departures",
      label: "Late departures",
      result: d.late,
      unit: "departures",
      target: 0,
      status: statusOf(d.late, 0, false),
      detail: `${d.n} dispatch records`,
    },
    {
      key: "open_incidents",
      label: "Open trip incidents",
      result: fleet.rows[0].open,
      unit: "incidents",
      target: 0,
      status: statusOf(fleet.rows[0].open, 0, false),
      detail: "Trips with incident status Open or Investigating",
    },
    {
      key: "completed_rate",
      label: "Completed booking rate",
      result: Number(completedRate.toFixed(4)),
      unit: "ratio",
      target: T.completion,
      status: statusOf(completedRate, T.completion),
      detail: `${b.completed} of ${b.n} bookings completed`,
    },
  ];

  return Response.json({
    period: { from, to },
    metrics,
    generated_at: new Date().toISOString(),
  });
});
