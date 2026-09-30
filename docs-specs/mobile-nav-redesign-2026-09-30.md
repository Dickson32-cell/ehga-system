# EHGA Mobility — Mobile Navigation Redesign (2026-09-30)

Patterns chosen from the user's list (Grid / Side menu / Tab bar / Sheet / FAB / Three dots / Rudder):

- **Staff app** (`/app`, 17 links) → **Side menu**: Uber-Driver-style full-height drawer
  (account block: name + role, scrollable link list, Sign out button at bottom).
- **Customer portal** (`/portal`, 7 tabs) → **Tab bar + Sheet**: Uber-Rider-style bottom
  tab bar — Home · Book · Parcel · Track · More — where **More** opens a **bottom Sheet**
  (Private hire · School run · Profile · Sign out). Nothing dropped.

Design law: LX ink-on-paper (ink #17150f bars, gold #b98a2f active edge, radius 0),
stroke SVG icons (no emoji), desktop/tablet strips untouched, 44px targets, safe-area insets.

## Scope
- `app/app/AppNav.js` — phone drawer → slide-in overlay; tablet/desktop strip unchanged
- `app/portal/PortalShell.js` — phone bottom tab bar + More sheet; strip unchanged
- `app/globals.css` — mobile nav blocks rewritten (LX tokens), tab-bar & sheet styles added
- Both shells patched in ONE deploy (skill rule 12)

## Checks (fill from actual run results only)
- [x] Staff: drawer opens/closes at 390/320 (16 links each, role-filtered), all role-filtered links present, sign-out works
- [x] Portal: tab bar at 390/320 (5 tabs, 78px each), More sheet with 4 rows, active tab gold-edged, More sheet opens with 4 items
- [x] No horizontal overflow (scrollWidth==clientWidth at 320); safe-area padding respected
- [x] Overlap sweep clean (8 elements, 0 pairs, 0 offscreen @390) (pairwise + viewport-edge) on dashboard + a register page
- [x] Tablet 768: strip=flex, drawer hidden (unchanged)
- [x] CEO panel untouched (nav-only change; layout.js passes fullName through)
- [x] Test data soft-deleted: TEST Nav Audit customer deactivated (id 20); zero bookings/parcels to clean