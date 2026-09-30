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

const TABS = [
  { href: "/portal/dashboard", label: "Home", icon: "home" },
  { href: "/portal/book", label: "Book", icon: "seat" },
  { href: "/portal/parcel", label: "Parcel", icon: "parcel" },
  { href: "/portal/track", label: "Track", icon: "pin" },
  { key: "more", label: "More", icon: "dots" },
];
const MORE_HREFS = ["/portal/hire", "/portal/school", "/portal/profile"];

const ICONS = {
  home: <path d="M4 11.5 12 5l8 6.5V20h-5.5v-5h-5v5H4z" />,
  seat: (
    <>
      <path d="M7 5v9h8" />
      <path d="M15 10h3v6a3 3 0 0 1-3 3H8" />
    </>
  ),
  parcel: (
    <>
      <path d="M12 3 20 7v10l-8 4-8-4V7z" />
      <path d="M4 7l8 4 8-4M12 11v9" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.6" />
    </>
  ),
  dots: (
    <>
      <circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none" />
    </>
  ),
  car: (
    <>
      <path d="M4 15l1.5-5A2 2 0 0 1 7.4 8.5h9.2a2 2 0 0 1 1.9 1.5L20 15" />
      <path d="M4 15h16v4h-2.5M4 15v4h2.5M6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
    </>
  ),
  school: (
    <>
      <path d="M3 10l9-4 9 4-9 4z" />
      <path d="M7 12.4V16c0 1.2 2.2 2.4 5 2.4s5-1.2 5-2.4v-3.6M21 10v5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
};

function TabIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

/**
 * Customer portal shell. Desktop/tablet: masthead + horizontal tabs.
 * Phone (Uber-rider style): bottom tab bar — Home / Book / Parcel / Track / More —
 * with "More" opening a bottom sheet holding the remaining destinations + Sign out.
 * Every destination remains reachable; nothing is dropped.
 */
export default function PortalShell({ active, session, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);

  // Back out of any open mobile surface on navigation or Escape.
  useEffect(() => { setOpen(false); setSheet(false); }, [pathname]);
  useEffect(() => {
    if (!open && !sheet) return;
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); setSheet(false); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, sheet]);

  // Lock body scroll while the drawer or sheet is open.
  useEffect(() => {
    document.documentElement.classList.toggle("nav-locked", open || sheet);
    return () => document.documentElement.classList.remove("nav-locked");
  }, [open, sheet]);

  async function logout() {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    router.replace("/portal");
    router.refresh();
  }

  const current = NAV.find((n) => n.href === active || n.href === pathname);
  const moreActive = MORE_HREFS.includes(pathname) ||
    MORE_HREFS.includes(active) || sheet;

  function onTab(tab) {
    if (tab.href) { setSheet(false); return; } // <Link> handles navigation
    setSheet((s) => !s);
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

      <nav className="lx-tabs" aria-label="Portal navigation">
        {/* Tablet/desktop strip (unchanged behaviour) */}
        <div className="lx-tabs-inner">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={(active === n.href || pathname === n.href) ? "active" : ""}>
              {n.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="lx-page">{children}</main>

      {/* Phone-only bottom tab bar (Uber-rider style) */}
      <nav className="ptab-bar" aria-label="Portal quick navigation">
        {TABS.map((t) => {
          const isActive = t.key === "more" ? moreActive
            : (active === t.href || pathname === t.href);
          const cls = `ptab${isActive ? " active" : ""}`;
          const inner = (
            <>
              <TabIcon name={t.icon} />
              <span>{t.label}</span>
            </>
          );
          return t.href ? (
            <Link key={t.href} href={t.href} className={cls} onClick={() => onTab(t)}>
              {inner}
            </Link>
          ) : (
            <button key={t.key} type="button" className={cls}
              aria-expanded={sheet} onClick={() => onTab(t)}>
              {inner}
            </button>
          );
        })}
      </nav>

      {/* Phone-only "More" bottom sheet */}
      {sheet ? <div className="sheet-scrim" onClick={() => setSheet(false)} /> : null}
      <div className={sheet ? "ptab-sheet open" : "ptab-sheet"} role="dialog" aria-label="More options" aria-hidden={!sheet}>
        <div className="sheet-grab" aria-hidden="true" />
        <span className="sheet-title">More options</span>
        {NAV.filter((n) => MORE_HREFS.includes(n.href)).map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={(active === n.href || pathname === n.href) ? "sheet-row active" : "sheet-row"}
            onClick={() => setSheet(false)}
          >
            <TabIcon name={n.href === "/portal/hire" ? "car" : n.href === "/portal/school" ? "school" : "user"} />
            <span>{n.label}</span>
          </Link>
        ))}
        <button type="button" className="sheet-row sheet-signout" onClick={logout}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 12H4m0 0 3.5-3.5M4 12l3.5 3.5M10 5h8a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 18 19h-8" />
          </svg>
          <span>Sign out</span>
        </button>
      </div>

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