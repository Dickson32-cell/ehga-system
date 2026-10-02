import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-auth";
import { nextDepartureFor, DEPARTURES } from "@/lib/departures";

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
        <span key={t} className="lx-time-next">
          {t}
          <span className="lx-time-tag">next</span>
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
  // Ghana runs on UTC year-round: express "now" in UTC terms for schedule math.
  const nowGha = new Date(Date.now() + new Date().getTimezoneOffset() * 60_000);
  const nextKofA = nextDepartureFor(DEPARTURES["Koforidua → Accra"], nowGha);
  const nextAKof = nextDepartureFor(DEPARTURES["Accra → Koforidua"], nowGha);

  return (
    <div className="lx">
      <header className="lx-mast">
        <div className="lx-mast-inner">
          <Link href="/portal" className="lx-mark">
            <span className="lx-mark-rule" />
            EHGA<span className="lx-mark-thin">Mobility</span>
          </Link>
          <nav className="lx-mast-nav">
            {session ? (
              <>
                <span className="lx-mast-user">{session.full_name}</span>
                <Link className="lx-cta" href="/portal/dashboard">My account</Link>
              </>
            ) : (
              <>
                <Link className="lx-mast-link" href="/login">Sign in</Link>
                <Link className="lx-cta" href="/portal/auth?mode=register">Open an account</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        {/* ---- Departure board ---- */}
        <section className="lx-board">
          <div className="lx-board-head">
            <p className="lx-kicker">Koforidua — Accra — parcels — private hire</p>
            <h1 className="lx-display">
              The road,<br />run properly.
            </h1>
            <p className="lx-lede">
              Seats, parcels and private hire on the Eastern corridor — tracked live, start to finish.
            </p>
            <div className="lx-board-cta">
              {session ? (
                <Link className="lx-btn-solid" href="/portal/book">Book a seat</Link>
              ) : (
                <Link className="lx-btn-solid" href="/portal/auth?mode=register">Open an account</Link>
              )}
              <Link className="lx-btn-line" href="/portal/track">Track a trip</Link>
            </div>

            {/* ---- Fleet car: the corridor sedan, specimen on the page ---- */}
            <div className="lx-hero-car">
              <img
                src="/hero-sedan.png"
                alt="EHGA Mobility fleet sedan"
                width={619}
                height={221}
                className="lx-hero-car-body"
              />
              <p className="lx-hero-car-cap">
                On the corridor — Koforidua <i>→</i> Accra · seats from <b>GHS 90</b> · tracked live
              </p>
            </div>
          </div>

          <div className="lx-board-panel">
            <div className="lx-board-row lx-board-row--head">
              <span>Route</span>
              <span>Departs</span>
              <span>Fare</span>
            </div>
            <div className="lx-board-row">
              <span className="lx-board-route">Koforidua <i>→</i> Accra</span>
              <span className="lx-timecell">{renderTimes(DEPARTURES["Koforidua → Accra"], nextKofA)}</span>
              <span className="lx-board-fare">GHS 90</span>
            </div>
            <div className="lx-board-row">
              <span className="lx-board-route">Accra <i>→</i> Koforidua</span>
              <span className="lx-timecell">{renderTimes(DEPARTURES["Accra → Koforidua"], nextAKof)}</span>
              <span className="lx-board-fare">GHS 90</span>
            </div>
            <div className="lx-board-row">
              <span className="lx-board-route">Within Koforidua</span>
              <span>On demand</span>
              <span className="lx-board-fare">GHS 15</span>
            </div>
            <div className="lx-board-row">
              <span className="lx-board-route">Within Accra</span>
              <span>On demand</span>
              <span className="lx-board-fare">GHS 20</span>
            </div>
            <div className="lx-board-foot">
              Parcels from GHS 40 flat · fleet of 8 · school runs with guardian codes
            </div>
          </div>
        </section>

        {/* ---- Corridor line: the Eastern corridor drawn as a waybill rule ---- */}
        <section className="lx-corridor" aria-label="Route overview">
          <svg className="lx-corridor-svg" viewBox="0 0 1100 96" role="img" aria-label="Koforidua to Accra route line">
            <line x1="40" y1="48" x2="1060" y2="48" stroke="var(--lx-ink)" strokeWidth="2" />
            <line x1="40" y1="48" x2="1060" y2="48" stroke="var(--lx-gold)" strokeWidth="2" strokeDasharray="1 9" />
            <rect x="26" y="34" width="28" height="28" fill="var(--lx-green)" />
            <text x="40" y="53" textAnchor="middle" fontSize="15" fontWeight="700" fill="#f4f1e8">K</text>
            <text x="40" y="20" textAnchor="middle" fontSize="14" fontWeight="700">Koforidua</text>
            <rect x="1046" y="34" width="28" height="28" fill="var(--lx-ink)" />
            <text x="1060" y="53" textAnchor="middle" fontSize="15" fontWeight="700" fill="#f4f1e8">A</text>
            <text x="1060" y="20" textAnchor="middle" fontSize="14" fontWeight="700">Accra</text>
            <text x="550" y="36" textAnchor="middle" fontSize="13" fontStyle="italic" fill="var(--lx-ink-3)">tracked live, start to finish</text>
            <text x="550" y="72" textAnchor="middle" fontSize="13" fill="var(--lx-ink-2)">06:00 · 10:00 · 14:00 out — 07:00 · 11:00 · 15:00 back — seats GHS 90</text>
          </svg>
          <div className="lx-corridor-m">
            <p className="lx-corridor-m-route">Koforidua <i>→</i> Accra <span>· tracked live, start to finish</span></p>
            <p className="lx-corridor-m-times">06:00 · 10:00 · 14:00 out — 07:00 · 11:00 · 15:00 back — seats GHS 90</p>
          </div>
        </section>

        {/* ---- Services: numbered ledger rows, not cards ---- */}
        <section className="lx-ledger">
          <div className="lx-ledger-head">
            <h2>What we carry</h2>
            <p className="lx-kicker">Four services · one account · live tracking on all</p>
          </div>

          <Link href={session ? "/portal/book" : "/portal/auth"} className="lx-row">
            <span className="lx-row-no">01</span>
            <span className="lx-row-name">Seat bookings</span>
            <span className="lx-row-desc">Reserve your seat, see the car assigned — model, colour, plate. Pay by MoMo.</span>
            <span className="lx-row-go">Book<i>→</i></span>
          </Link>

          <Link href={session ? "/portal/parcel" : "/portal/auth"} className="lx-row">
            <span className="lx-row-no">02</span>
            <span className="lx-row-name">Parcels</span>
            <span className="lx-row-desc">Collected at your door, delivered same day, proof of delivery on your phone.</span>
            <span className="lx-row-go">Send<i>→</i></span>
          </Link>

          <Link href={session ? "/portal/hire" : "/portal/auth"} className="lx-row">
            <span className="lx-row-no">03</span>
            <span className="lx-row-name">Private hire</span>
            <span className="lx-row-desc">Whole vehicle, airport runs, hourly hire. The quote comes to you in seconds.</span>
            <span className="lx-row-go">Request<i>→</i></span>
          </Link>

          <Link href={session ? "/portal/school" : "/portal/auth"} className="lx-row">
            <span className="lx-row-no">04</span>
            <span className="lx-row-name">School transport</span>
            <span className="lx-row-desc">Guardian pickup codes, &quot;child on board&quot; alerts, route discipline.</span>
            <span className="lx-row-go">Sign up<i>→</i></span>
          </Link>
        </section>

        {/* ---- Proof: three factual trust rows on ruled lines ---- */}
        <section className="lx-proof">
          <div className="lx-proof-head">
            <h2>Every trip shows its work</h2>
          </div>
          <div className="lx-proof-grid">
            <div className="lx-proof-item">
              <div className="lx-proof-no">01</div>
              <h3>Tracked live</h3>
              <p>Every booking carries a tracking code. Watch the assigned car — model, colour, plate — from pickup to drop-off.</p>
            </div>
            <div className="lx-proof-item">
              <div className="lx-proof-no">02</div>
              <h3>Pay by MoMo, after confirmation</h3>
              <p>Your seat is confirmed first, you pay after. No argument at the door of the car.</p>
            </div>
            <div className="lx-proof-item">
              <div className="lx-proof-no">03</div>
              <h3>Proof of delivery</h3>
              <p>Parcels are collected at your door and delivered same day; the proof photo lands on your phone.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="lx-foot">
        <div className="lx-foot-inner">
          <span className="lx-mark lx-mark--foot">
            <span className="lx-mark-rule" />
            EHGA<span className="lx-mark-thin">Mobility</span>
          </span>
          <span className="lx-foot-note">
            Koforidua · Eastern Region · Ghana
            <span className="lx-foot-routes">
              Koforidua <i>→</i> Accra <i>→</i> Koforidua · within Koforidua · within Accra · private hire · school runs
            </span>
          </span>
          <span className="lx-foot-links">
            <Link href="/portal/track">Track</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}