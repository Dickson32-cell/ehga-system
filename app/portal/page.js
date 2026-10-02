import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-auth";
import { nextDepartureFor, DEPARTURES } from "@/lib/departures";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "EHGA Mobility — Seats, parcels & private hire on the Eastern corridor",
  description:
    "Book seats Koforidua–Accra, send parcels, hire a car or arrange school transport. Tracked live, start to finish. Pay by MoMo.",
};

/** Render the time list with the upcoming slot marked (server-computed). */
function renderTimes(times, next) {
  if (!next) return times.join(" · ");
  const out = [];
  times.forEach((t, i) => {
    if (i > 0) out.push(" · ");
    if (i === next.index) {
      out.push(
        <span key={t} className="pt-time-next">
          {t}
          <span className="pt-time-tag">next</span>
        </span>
      );
    } else {
      out.push(<span key={t}>{t}</span>);
    }
  });
  return out;
}

export default async function PortalHome() {
  const session = await getCustomerSession();
  // Ghana = UTC+0 year-round; nextDepartureFor reads UTC accessors (TZ-safe).
  const now = new Date();
  const nextKofA = nextDepartureFor(DEPARTURES["Koforidua → Accra"], now);
  const nextAKof = nextDepartureFor(DEPARTURES["Accra → Koforidua"], now);

  // Company payment number — set ONLY by the CEO in the settings panel
  // (/api/momo-number, MANAGING_DIRECTOR role). Nothing hard-coded here;
  // the contact line renders only when the number has been configured.
  let momoNumber = null;
  try {
    const { rows } = await query(
      "SELECT key, value FROM setup_kv WHERE key = 'momo_number'"
    );
    momoNumber = rows[0]?.value || null;
  } catch {
    momoNumber = null;
  }

  const bookHref = session ? "/portal/book" : "/portal/auth?mode=register";

  return (
    <div className="pt">
      <header className="pt-top">
        <Link href="/portal" className="pt-brand">
          <span className="pt-brand-rule" />
          EHGA<span className="pt-brand-thin">Mobility</span>
        </Link>
        <nav className="pt-topnav">
          {session ? (
            <span className="pt-topuser">{session.full_name}</span>
          ) : (
            <Link href="/login" className="pt-toplink">
              Sign in
            </Link>
          )}
          <Link href="/portal/track" className="pt-toplink">
            Track a trip
          </Link>
          <Link href={bookHref} className="pt-ctasm">
            BOOK NOW
          </Link>
        </nav>
      </header>

      <main>
        {/* ---- Hero: the printed-advert language ---- */}
        <section className="pt-hero">
          <div className="pt-hero-wedge" aria-hidden="true" />
          <div className="pt-badges" aria-hidden="true">
            <div className="pt-badge">BOOK 24/7</div>
            <div className="pt-badge pt-badge--dark">LIVE TRACK</div>
          </div>
          <div className="pt-hero-inner">
            <div className="pt-hero-copy">
              <h1 className="pt-display">
                Discover the ease
                <br />
                of booking with
                <br />
                <span className="pt-display-g">EHGA Mobility.</span>
              </h1>
              <p className="pt-sub">
                Seats, parcels, private hire and school runs on the Eastern corridor —
                tracked live, start to finish. Pay by MoMo.
              </p>
              <div className="pt-ctarow">
                <Link href={bookHref} className="pt-pill">
                  BOOK NOW
                </Link>
                <Link href="/portal/track" className="pt-pill pt-pill-ghost">
                  Track a trip
                </Link>
              </div>
              {momoNumber ? (
                <p className="pt-contact">
                  <b>{momoNumber}</b> · payments &amp; bookings
                </p>
              ) : null}
            </div>
            <div className="pt-hero-car">
              <img
                src="/hero-sedan.png"
                alt="EHGA Mobility fleet sedan"
                width={619}
                height={221}
              />
            </div>
          </div>
        </section>

        {/* ---- Departure board: floating card ---- */}
        <section className="pt-board">
          <div className="pt-board-card">
            <div className="pt-brow pt-brow-head">
              <span>Route</span>
              <span>Departs</span>
              <span className="pt-bfare-head">Fare</span>
            </div>
            <div className="pt-brow">
              <span className="pt-broute">Koforidua <i>→</i> Accra</span>
              <span className="pt-timecell">{renderTimes(DEPARTURES["Koforidua → Accra"], nextKofA)}</span>
              <span className="pt-bfare">GHS 90</span>
            </div>
            <div className="pt-brow">
              <span className="pt-broute">Accra <i>→</i> Koforidua</span>
              <span className="pt-timecell">{renderTimes(DEPARTURES["Accra → Koforidua"], nextAKof)}</span>
              <span className="pt-bfare">GHS 90</span>
            </div>
            <div className="pt-brow">
              <span className="pt-broute">Within Koforidua</span>
              <span>On demand</span>
              <span className="pt-bfare">GHS 15</span>
            </div>
            <div className="pt-brow">
              <span className="pt-broute">Within Accra</span>
              <span>On demand</span>
              <span className="pt-bfare">GHS 20</span>
            </div>
            <div className="pt-bfoot">
              Parcels from GHS 40 flat · fleet of 8 · school runs with guardian codes
            </div>
          </div>
        </section>

        {/* ---- Services: rounded cards, yellow numbers ---- */}
        <section className="pt-services">
          <h2>What we carry</h2>
          <p className="pt-k">Four services · one account · live tracking on all</p>
          <div className="pt-svcgrid">
            <Link href={bookHref} className="pt-svc">
              <span className="pt-svcno">01</span>
              <span>
                <span className="pt-svct">Seat bookings</span>
                <p className="pt-svcd">Reserve your seat, see the car assigned — model, colour, plate. Pay by MoMo.</p>
              </span>
              <span className="pt-svcgo">Book →</span>
            </Link>
            <Link href={session ? "/portal/parcel" : "/portal/auth?mode=register"} className="pt-svc">
              <span className="pt-svcno">02</span>
              <span>
                <span className="pt-svct">Parcels</span>
                <p className="pt-svcd">Collected at your door, delivered same day, proof of delivery on your phone.</p>
              </span>
              <span className="pt-svcgo">Send →</span>
            </Link>
            <Link href={session ? "/portal/hire" : "/portal/auth?mode=register"} className="pt-svc">
              <span className="pt-svcno">03</span>
              <span>
                <span className="pt-svct">Private hire</span>
                <p className="pt-svcd">Whole vehicle, airport runs, hourly hire. The quote comes to you in seconds.</p>
              </span>
              <span className="pt-svcgo">Request →</span>
            </Link>
            <Link href={session ? "/portal/school" : "/portal/auth?mode=register"} className="pt-svc">
              <span className="pt-svcno">04</span>
              <span>
                <span className="pt-svct">School transport</span>
                <p className="pt-svcd">Guardian pickup codes, &quot;child on board&quot; alerts, route discipline.</p>
              </span>
              <span className="pt-svcgo">Sign up →</span>
            </Link>
          </div>
        </section>

        {/* ---- Proof: factual trust trio ---- */}
        <section className="pt-proof">
          <div className="pt-proofgrid">
            <div className="pt-pf">
              <div className="pt-pfno">01</div>
              <h3>Tracked live</h3>
              <p>Every booking carries a tracking code. Watch the assigned car — model, colour, plate — from pickup to drop-off.</p>
            </div>
            <div className="pt-pf">
              <div className="pt-pfno">02</div>
              <h3>Pay by MoMo, after confirmation</h3>
              <p>Your seat is confirmed first, you pay after. No argument at the door of the car.</p>
            </div>
            <div className="pt-pf">
              <div className="pt-pfno">03</div>
              <h3>Proof of delivery</h3>
              <p>Parcels are collected at your door and delivered same day; the proof photo lands on your phone.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="pt-foot">
        <div className="pt-foot-inner">
          <span className="pt-brand pt-brand--foot">
            <span className="pt-brand-rule" />
            EHGA<span className="pt-brand-thin">Mobility</span>
          </span>
          <span className="pt-foot-c">
            Koforidua <i>→</i> Accra <i>→</i> Koforidua · within-city · private hire · school runs
            <span className="pt-foot-sub">
              {momoNumber ? <b>{momoNumber}</b> : null}
              {momoNumber ? " · " : ""}Koforidua · Eastern Region · Ghana
            </span>
          </span>
          <span className="pt-foot-links">
            <Link href="/portal/track">Track a trip</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}