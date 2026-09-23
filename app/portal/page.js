import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

const SERVICES = [
  {
    href: "/portal/book",
    title: "Book a seat",
    desc: "Intercity Koforidua ↔ Accra and local runs. Pick your date, seats and pickup point.",
    tag: "From GHS 90 per seat",
  },
  {
    href: "/portal/parcel",
    title: "Send a parcel",
    tag: "Same-day dispatch",
    desc: "Door-to-door pickup and delivery with proof of delivery on your phone.",
  },
  {
    href: "/portal/hire",
    title: "Request private hire",
    tag: "Instant quote",
    desc: "Whole vehicle, airport transfers, hourly hire. Get a distance-based quote instantly.",
  },
  {
    href: "/portal/school",
    title: "School run sign-up",
    tag: "Guardian pickup codes",
    desc: "Safe daily school transport with authorized-guardian pickup codes and alerts.",
  },
];

export default async function PortalHome() {
  const session = await getCustomerSession();

  return (
    <div className="portal">
      <header className="portal-top">
        <div className="portal-brand">
          <b>EHGA Mobility</b>
          <span>Koforidua · Accra · passenger · parcel · private hire</span>
        </div>
        <nav className="portal-authnav">
          {session ? (
            <>
              <span className="portal-hello">Hello, {session.full_name.split(" ")[0]}</span>
              <Link className="btn" href="/portal/dashboard">My account</Link>
            </>
          ) : (
            <>
              <Link className="btn secondary" href="/portal/auth?mode=register">Create account</Link>
              <Link className="btn" href="/portal/auth">Sign in</Link>
            </>
          )}
        </nav>
      </header>

      <main className="portal-main">
        <section className="portal-hero">
          <h1>Travel and send parcels the easy way.</h1>
          <p>
            Book your seat, send a parcel, hire a car or sign up for the school run — then watch it
            live on a map, like Uber, Yango or Bolt. Your trip, your data, one app.
          </p>
          <div className="portal-cta">
            <Link className="btn big" href={session ? "/portal/book" : "/portal/auth?mode=register"}>
              Get started
            </Link>
            <Link className="btn secondary big" href="/portal/track">Track my trip</Link>
          </div>
        </section>

        <section className="portal-services">
          {SERVICES.map((s) => (
            <Link key={s.href} href={session ? s.href : "/portal/auth"} className="service-card">
              <span className="service-tag">{s.tag}</span>
              <h2>{s.title}</h2>
              <p>{s.desc}</p>
            </Link>
          ))}
        </section>

        <section className="portal-trust">
          <div>
            <h3>Sees the car</h3>
            <p>When your driver is assigned you see the model, colour and registration — never guess.</p>
          </div>
          <div>
            <h3>Watch it live</h3>
            <p>Parcel en route? Child on board? Driver arriving? Follow it on the map with a live ETA.</p>
          </div>
          <div>
            <h3>Own data only</h3>
            <p>Your account shows only YOUR bookings, parcels and children. Nobody else&apos;s. Ever.</p>
          </div>
        </section>
      </main>

      <footer className="portal-footer">
        <span>EHGA Mobility · Koforidua / Accra</span>
        <span>
          Staff? <Link href="/login">Operations sign-in</Link>
        </span>
      </footer>
    </div>
  );
}