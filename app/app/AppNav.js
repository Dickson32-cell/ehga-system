"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCallback } from "react";

const LINKS = [
  { href: "/app", label: "Dashboard", roles: null },
  { href: "/app/my-job", label: "My Job", roles: ["DRIVER", "RIDER"] },
  { href: "/app/bookings", label: "Bookings", roles: null },
  { href: "/app/dispatch", label: "Dispatch", roles: null },
  { href: "/app/tracker", label: "Fleet Tracker", roles: null },
  { href: "/app/incidents", label: "Incidents", roles: null },
  { href: "/app/momo", label: "MoMo", roles: ["MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "ACCOUNTANT"] },
  { href: "/app/reports", label: "Reports", roles: null },
  { href: "/app/parcels", label: "Parcels", roles: null },
  { href: "/app/trips", label: "Trips", roles: null },
  { href: "/app/fuel", label: "Fuel", roles: null },
  { href: "/app/fleet", label: "Fleet", roles: null },
  { href: "/app/private-hire", label: "Private Hire", roles: null },
  { href: "/app/school", label: "School Transport", roles: null },
  { href: "/app/cash", label: "Cash Reconciliation", roles: null },
  { href: "/app/setup", label: "Setup", roles: ["MANAGING_DIRECTOR", "OPERATIONS_MANAGER"] },
  { href: "/app/staff", label: "Staff", roles: ["MANAGING_DIRECTOR", "HR"] },
];

/**
 * Desktop/tablet: the usual horizontal strip.
 * Phone: hamburger opens a full-height slide-in drawer (Uber-driver style):
 * account block up top (name + role), scrollable links, Sign out pinned at the foot.
 */
const ICON = {
  burger: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
};

export default function AppNav({ role, fullName }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const links = LINKS.filter((l) => !l.roles || l.roles.includes(role));

  // Close the drawer whenever the page changes or Escape is pressed.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock body scroll while the drawer is open (it overlays the whole viewport).
  useEffect(() => {
    document.documentElement.classList.toggle("nav-locked", open);
    return () => document.documentElement.classList.remove("nav-locked");
  }, [open]);

  const signOut = useCallback(async () => {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }, [router]);

  const current = links.find((l) => l.href === pathname);

  return (
    <nav className="mainnav-wrap" aria-label="Register navigation">
      {/* Phone-only menu bar */}
      <div className="mainnav-mobile">
        <button
          type="button"
          className="mainnav-toggle"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? ICON.close : ICON.burger}
          Menu
          {current && !open ? <span className="mainnav-current">{current.label}</span> : null}
        </button>
      </div>

      {/* Phone drawer: scrim + panel */}
      {open ? <div className="mainnav-scrim" onClick={() => setOpen(false)} /> : null}
      <aside className={open ? "mainnav-side open" : "mainnav-side"} aria-hidden={!open}>
        <div className="side-account">
          <span className="side-avatar" aria-hidden="true">
            {(fullName || "E").trim().charAt(0).toUpperCase()}
          </span>
          <span className="side-who">
            <b>{fullName || "Signed in"}</b>
            <i>{role.replace(/_/g, " ").toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())}</i>
          </span>
        </div>
        <div className="side-scroll">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? "drawer-link active" : "drawer-link"}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="side-foot">
          <button type="button" className="side-signout" onClick={signOut} disabled={busy}>
            {busy ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Tablet/desktop strip (unchanged behaviour) */}
      <div className="mainnav mainnav-strip">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}