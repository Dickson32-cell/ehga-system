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
- [ ] Staff: drawer opens/closes at 320/360/390, all role-filtered links present, sign-out works
- [ ] Portal: tab bar at 320/360/390, active tab gold-edged, More sheet opens with 4 items
- [ ] No horizontal overflow any width; safe-area padding respected
- [ ] Overlap sweep clean (pairwise + viewport-edge) on dashboard + a register page
- [ ] Tablet 768 + desktop 1280 unchanged
- [ ] CEO must_change_password panel unaffected
- Test data soft-deleted after shots