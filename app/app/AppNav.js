"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/app", label: "Dashboard", roles: null },
  { href: "/app/bookings", label: "Bookings", roles: null },
  { href: "/app/dispatch", label: "Dispatch", roles: null },
  { href: "/app/parcels", label: "Parcels", roles: null },
  { href: "/app/trips", label: "Trips", roles: null },
  { href: "/app/fuel", label: "Fuel", roles: null },
  { href: "/app/fleet", label: "Fleet", roles: null },
  { href: "/app/private-hire", label: "Private Hire", roles: null },
  { href: "/app/school", label: "School Transport", roles: null },
  { href: "/app/cash", label: "Cash Reconciliation", roles: null },
  { href: "/app/setup", label: "Setup", roles: ["MANAGING_DIRECTOR", "OPERATIONS_MANAGER"] },
  { href: "/app/staff", label: "Staff", roles: ["MANAGING_DIRECTOR"] },
];

export default function AppNav({ role }) {
  const pathname = usePathname();
  return (
    <nav className="mainnav" aria-label="Register navigation">
      {LINKS.filter((l) => !l.roles || l.roles.includes(role)).map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? "active" : ""}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
