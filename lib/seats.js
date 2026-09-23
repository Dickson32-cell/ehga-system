/**
 * Seat availability engine ("Book a seat" flow).
 *
 * A car takes 4 seats by default (vehicle.seat_capacity, editable per car by MD/OM).
 * For every booking we count seats already committed to a vehicle for the same
 * travel_date + direction, and expose:
 *   - seats_taken / seats_left / full
 *   - auto-assign: when a car fills up, the next Available car becomes bookable.
 *
 * Seat counts are computed from the booking register itself (soft-delete aware,
 * active statuses only), so there is no separate counter to drift out of sync.
 */
import { query } from "./db";

export const ACTIVE_BOOKING_STATUSES = ["Pending", "Confirmed", "Boarded"];

/** Vehicles that can take passenger bookings, in code order. */
export async function bookableVehicles(client) {
  const q = client || query;
  const { rows } = await q(
    `SELECT vehicle_code, model, color, registration, seat_capacity
       FROM vehicle
      WHERE deleted = FALSE
        AND status = 'Available'
        AND (primary_role ILIKE '%pass%' OR primary_role ILIKE '%standard%' OR primary_role ILIKE '%school%' OR primary_role ILIKE '%taxi%' OR primary_role = 'Sedan' OR seat_capacity >= 4)
      ORDER BY vehicle_code`
  );
  return rows;
}

/** Seats already committed per vehicle for a date+direction (active bookings only). */
export async function seatsTakenByVehicle(client, travelDate, direction) {
  const q = client || query;
  const { rows } = await q(
    `SELECT vehicle_id, COALESCE(SUM(seats),0)::int AS taken
       FROM booking
      WHERE deleted = FALSE
        AND travel_date = $1
        AND direction = $2
        AND vehicle_id IS NOT NULL
        AND status = ANY($3)
      GROUP BY vehicle_id`,
    [travelDate, direction, ACTIVE_BOOKING_STATUSES]
  );
  const map = {};
  for (const r of rows) map[r.vehicle_id] = r.taken;
  return map;
}

/**
 * Availability list for a date+direction: one entry per bookable vehicle with
 * seats_taken, seats_left, is_full, plus a rolled-up "any seats left" flag.
 */
export async function availabilityForDate(travelDate, direction) {
  const vehicles = await bookableVehicles();
  const taken = await seatsTakenByVehicle(null, travelDate, direction);
  const rows = vehicles.map((v) => {
    const capacity = Math.max(1, Number(v.seat_capacity) || 4);
    const takenSeats = taken[v.vehicle_code] || 0;
    const left = Math.max(0, capacity - takenSeats);
    return {
      vehicle_code: v.vehicle_code,
      model: v.model,
      color: v.color,
      registration: v.registration,
      capacity,
      seats_taken: takenSeats,
      seats_left: left,
      is_full: left <= 0,
      // What customers see: "Full", "2 seats left", "3 seats left"
      label: left <= 0 ? "Full" : left === 1 ? "1 seat left" : `${left} seats left`,
    };
  });
  return {
    date: travelDate,
    direction,
    vehicles: rows,
    total_seats_left: rows.reduce((s, r) => s + r.seats_left, 0),
    any_available: rows.some((r) => !r.is_full),
  };
}

/**
 * Auto-assign a booking to the right car inside a transaction:
 * fills the current car until it is full, then rolls to the next available one.
 * Returns { vehicle_code, seats_left_after } or throws with a customer-friendly
 * message when the day is fully booked.
 */
export async function assignBookingSeats(client, { travelDate, direction, seats, excludeBookingId }) {
  const availability = await availabilityTx(client, travelDate, direction);
  const candidates = availability.vehicles.filter((v) => !v.is_full);
  if (!candidates.length) {
    const err = new Error(
      "All cars are fully booked for that date and route. Choose another date or contact our WhatsApp line."
    );
    err.status = 409;
    throw err;
  }
  const chosen = candidates[0]; // code order = fleet priority; first car fills first
  const leftAfter = chosen.seats_left - seats;
  if (leftAfter < 0) {
    // Booking would straddle two cars: keep it simple — offer the next car with room.
    const fit = candidates.find((v) => v.seats_left - seats >= 0) || candidates[candidates.length - 1];
    const err = new Error(
      `Only ${fit.seats_left} seat${fit.seats_left === 1 ? "" : "s"} left on ${fit.vehicle_code} for that trip. Reduce seats or pick another date.`
    );
    err.status = 409;
    throw err;
  }
  const { rows } = await client.query(
    `UPDATE booking SET vehicle_id = $1 WHERE id = $2 RETURNING vehicle_id`,
    [chosen.vehicle_code, excludeBookingId]
  );
  return { vehicle_code: rows[0].vehicle_id, seats_left_after: leftAfter, capacity: chosen.capacity };
}

/** Availability computed inside an open transaction (sees the booking's own row). */
export async function availabilityTx(client, travelDate, direction) {
  const vehicles = await bookableVehicles(client);
  const taken = await seatsTakenByVehicle(client, travelDate, direction);
  return {
    date: travelDate,
    direction,
    vehicles: vehicles.map((v) => {
      const capacity = Math.max(1, Number(v.seat_capacity) || 4);
      const takenSeats = taken[v.vehicle_code] || 0;
      const left = Math.max(0, capacity - takenSeats);
      return {
        vehicle_code: v.vehicle_code,
        capacity,
        seats_taken: takenSeats,
        seats_left: left,
        is_full: left <= 0,
      };
    }),
  };
}

/** Human line for a vehicle: "Full" / "2 seats left". Used in staff UIs too. */
export function seatLabel(taken, capacity) {
  const left = Math.max(0, (Number(capacity) || 4) - (Number(taken) || 0));
  return left <= 0 ? "Full" : left === 1 ? "1 seat left" : `${left} seats left`;
}