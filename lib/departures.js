// Departure schedule — single source of truth for the homepage board and the
// NEXT-departure marker. Times are Ghana local (GMT + 0); the board renders " · "
// separated; nextDepartureFor() marks the upcoming slot at render time.

export const DEPARTURES = {
  "Koforidua → Accra": ["06:00", "10:00", "14:00"],
  "Accra → Koforidua": ["07:00", "11:00", "15:00"],
};

export const FARES = {
  "Koforidua → Accra": "GHS 90",
  "Accra → Koforidua": "GHS 90",
  "Within Koforidua": "GHS 15",
  "Within Accra": "GHS 20",
};

/**
 * Returns the next upcoming departure. Ghana rides on GMT year-round (no DST),
 * so a fixed UTC+0 clock is correct for schedule comparisons.
 * @param {string[]} times "HH:MM" strings, ascending
 * @param {Date} now current time in Ghana-local terms
 * @returns {{ time: string, index: number } | null} null when none remain today
 */
export function nextDepartureFor(times, now) {
  const mins = now.getHours() * 60 + now.getMinutes();
  for (let i = 0; i < times.length; i++) {
    const [h, m] = times[i].split(":").map(Number);
    if (h * 60 + m > mins) return { time: times[i], index: i };
  }
  return null;
}