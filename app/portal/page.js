import Link from "next/link";
import { getCustomerSession } from "@/lib/customer-auth";

export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const session = await getCustomerSession();

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
              <span>06:00 · 10:00 · 14:00</span>
              <span className="lx-board-fare">GHS 90</span>
            </div>
            <div className="lx-board-row">
              <span className="lx-board-route">Accra <i>→</i> Koforidua</span>
              <span>07:00 · 11:00 · 15:00</span>
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
      </main>

      <footer className="lx-foot">
        <div className="lx-foot-inner">
          <span className="lx-mark lx-mark--foot">
            <span className="lx-mark-rule" />
            EHGA<span className="lx-mark-thin">Mobility</span>
          </span>
          <span className="lx-foot-note">Koforidua · Eastern Region · Ghana</span>
          <span className="lx-foot-links">
            <Link href="/portal/track">Track</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}