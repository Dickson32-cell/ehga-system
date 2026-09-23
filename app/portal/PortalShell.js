"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const NAV = [
  { href: "/portal/dashboard", label: "My account" },
  { href: "/portal/book", label: "Book a seat" },
  { href: "/portal/parcel", label: "Send a parcel" },
  { href: "/portal/hire", label: "Private hire" },
  { href: "/portal/school", label: "School run" },
  { href: "/portal/track", label: "Track" },
];

export default function PortalShell({ active, session, children }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    router.replace("/portal");
    router.refresh();
  }

  return (
    <div className="portal">
      <header className="portal-top">
        <Link href="/portal" className="portal-brand">
          <b>EHGA Mobility</b>
          <span>Customer Portal</span>
        </Link>
        <div className="portal-authnav">
          <span className="portal-hello">{session.full_name}</span>
          <button className="btn small secondary" type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="portal-nav" aria-label="Portal navigation">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={active === n.href ? "active" : ""}>
            {n.label}
          </Link>
        ))}
      </nav>

      <main className="portal-main">{children}</main>

      <footer className="portal-footer">
        <span>EHGA Mobility · Koforidua / Accra · All amounts in Ghana Cedis (GHS)</span>
        <span>
          Staff? <Link href="/login">Operations sign-in</Link>
        </span>
      </footer>
    </div>
  );
}