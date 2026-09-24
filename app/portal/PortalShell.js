"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/portal/dashboard", label: "My account" },
  { href: "/portal/book", label: "Book a seat" },
  { href: "/portal/parcel", label: "Send a parcel" },
  { href: "/portal/hire", label: "Private hire" },
  { href: "/portal/school", label: "School run" },
  { href: "/portal/track", label: "Track" },
  { href: "/portal/profile", label: "Profile" },
];

export default function PortalShell({ active, session, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer on navigation or Escape (same behaviour as the staff app).
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function logout() {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    router.replace("/portal");
    router.refresh();
  }

  const current = NAV.find((n) => n.href === active || n.href === pathname);

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

      <nav className="lx-tabs" aria-label="Portal navigation">
        {/* Phone-only menu button */}
        <div className="lx-tabs-mobile">
          <button
            type="button"
            className="lx-tabs-toggle"
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
          <div className="lx-tabs-drawer">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={(active === n.href || pathname === n.href) ? "drawer-link active" : "drawer-link"}
                onClick={() => setOpen(false)}
              >
                {n.label}
              </Link>
            ))}
          </div>
        ) : null}

        {/* Tablet/desktop strip (unchanged) */}
        <div className="lx-tabs-inner">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={(active === n.href || pathname === n.href) ? "active" : ""}>
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
        </div>
      </footer>
    </div>
  );
}