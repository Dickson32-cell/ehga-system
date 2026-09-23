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
    <div className="lx">
      <header className="lx-mast">
        <div className="lx-mast-inner">
          <Link href="/portal" className="lx-mark">
            <span className="lx-mark-rule" />
            EHGA<span className="lx-mark-thin">Mobility</span>
          </Link>
          <nav className="lx-mast-nav">
            <span className="lx-mast-user">{session.full_name}</span>
            <button className="lx-mast-link lx-as-btn" type="button" onClick={logout}>
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <nav className="lx-tabs">
        <div className="lx-tabs-inner">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={active === n.href ? "active" : ""}>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="lx-page">{children}</main>

      <footer className="lx-foot">
        <div className="lx-foot-inner">
          <span className="lx-mark lx-mark--foot">
            <span className="lx-mark-rule" />
            EHGA<span className="lx-mark-thin">Mobility</span>
          </span>
          <span className="lx-foot-note">Koforidua · Eastern Region · Ghana · amounts in GHS</span>
          <span className="lx-foot-links">
            <Link href="/login">Staff sign-in</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}