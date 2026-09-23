"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
 * Phone: links collapse into a slide-down menu behind a "Menu" button.
 */
export default function AppNav({ role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = LINKS.filter((l) => !l.roles || l.roles.includes(role));

  // Close the drawer whenever the page changes or Escape is pressed.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

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
          <span className="mainnav-burger" aria-hidden="true">
            <i /><i /><i />
          </span>
          Menu
          {current ? <span className="mainnav-current">{current.label}</span> : null}
        </button>
      </div>

      {open ? (
        <div className="mainnav-drawer">
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
      ) : null}

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