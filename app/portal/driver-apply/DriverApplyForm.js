"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const COLORS = ["White", "Silver", "Black", "Grey", "Blue", "Red", "Gold", "Green", "Brown", "Yellow", "Other"];

async function fileToDataUrl(file) {
  // Returns { ok, dataUrl, error } — sized to fit our 2MB-per-image server cap.
  if (!file) return { error: "Choose a file" };
  const okTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!okTypes.includes(file.type)) return { error: "Must be a JPG, PNG or WebP image" };
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ ok: true, dataUrl: reader.result });
    reader.onerror = () => resolve({ error: "Could not read the file" });
    reader.readAsDataURL(file);
  });
}

export default function DriverApplyForm() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 identity, 2 licence/card, 3 vehicle, 4 review+submit
  const [form, setForm] = useState({
    full_name: "", phone: "", email: "", password: "",
    license_no: "", license_expiry: "", ghana_card_no: "", ghana_card_image: "",
    vehicle_reg_no: "", vehicle_make: "", vehicle_color: "",
    insurance_expiry: "", roadworthy_expiry: "",
  });
  const [vehicleImages, setVehicleImages] = useState([]); // dataUrls, max 3
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function pickCardImage(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = await fileToDataUrl(f);
    if (r.error) { setError(r.error); return; }
    setForm((p) => ({ ...p, ghana_card_image: r.dataUrl }));
    setError("");
  }

  async function pickVehicleImage(e) {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    const slotsLeft = 3 - vehicleImages.length;
    const take = files.slice(0, slotsLeft);
    const urls = [];
    for (const f of take) {
      const r = await fileToDataUrl(f);
      if (r.error) { setError(r.error); break; }
      urls.push(r.dataUrl);
    }
    setVehicleImages((p) => [...p, ...urls].slice(0, 3));
    setError("");
  }

  function removeVehicleImage(i) {
    setVehicleImages((p) => p.filter((_, idx) => idx !== i));
  }

  function next() {
    if (step === 1) {
      if (form.full_name.trim().length < 3) return setError("Enter your full name");
      if (!/^[0245]\d{9}$/.test(form.phone.replace(/\s/g, ""))) return setError("Enter a valid Ghana phone number (e.g. 024 123 4567)");
      if (form.password.length < 8) return setError("Password must be at least 8 characters");
    }
    if (step === 2) {
      if (!form.license_no.trim()) return setError("Enter your driver's licence number");
      if (!form.license_expiry) return setError("Enter the licence expiry date");
      if (!form.ghana_card_no.trim()) return setError("Enter your Ghana Card number");
      if (!form.ghana_card_image) return setError("Upload a photo of your Ghana Card");
    }
    if (step === 3) {
      if (form.vehicle_reg_no.trim().length < 5) return setError("Enter the vehicle registration number");
      if (!form.vehicle_color) return setError("Select the vehicle colour");
      if (form.insurance_expiry && form.insurance_expiry < todayStr()) return setError("Insurance already expired — renew it, then apply");
      if (!form.insurance_expiry) return setError("Enter the insurance expiry date");
      if (form.roadworthy_expiry && form.roadworthy_expiry < todayStr()) return setError("Roadworthy already expired — renew it, then apply");
      if (!form.roadworthy_expiry) return setError("Enter the roadworthy expiry date");
      if (!vehicleImages.length) return setError("Upload at least one photo of the vehicle");
    }
    setError("");
    setStep(step + 1);
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/drivers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, vehicle_images: vehicleImages.join("|") }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Submission failed — try again");
      setDone(j.message || "Application received. Our office will call you within 48 hours.");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="da-done">
        <div className="da-done-badge">✓</div>
        <h2>Application received</h2>
        <p>{done}</p>
        <p className="da-done-sub">Keep your phone close — we confirm by call and SMS.</p>
        <a className="btn da-done-btn" href="/login">Back to sign in</a>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); step === 4 ? submit() : next(); }}>
      {error ? <div className="form-error">{error}</div> : null}

      {/* progress */}
      <div className="da-steps" aria-label="Application progress">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={"da-step" + (n === step ? " on" : n < step ? " done" : "")}>{n}</span>
        ))}
        <span className="da-steplabel">{["Your identity", "Licence & Ghana Card", "Your vehicle", "Check & submit"][step - 1]}</span>
      </div>

      {step === 1 ? (
        <>
          <div className="field"><label>Full name *</label>
            <input value={form.full_name} onChange={set("full_name")} required placeholder="e.g. Kwame Mensah" />
          </div>
          <div className="field"><label>Phone number * (this becomes your login)</label>
            <input type="tel" value={form.phone} onChange={set("phone")} required placeholder="024 123 4567" />
          </div>
          <div className="field"><label>Email (optional)</label>
            <input type="email" value={form.email} onChange={set("email")} placeholder="name@example.com" />
          </div>
          <div className="field"><label>Choose a password * (min 8 characters)</label>
            <div className="pw-row">
              <input type="password" value={form.password} onChange={set("password")} required minLength={8} autoComplete="new-password" />
            </div>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div className="field"><label>Driver&rsquo;s licence number *</label>
            <input value={form.license_no} onChange={set("license_no")} required placeholder="e.g. V0001234567" />
          </div>
          <div className="field"><label>Licence expiry date *</label>
            <input type="date" value={form.license_expiry} onChange={set("license_expiry")} required />
          </div>
          <div className="field"><label>Ghana Card number *</label>
            <input value={form.ghana_card_no} onChange={set("ghana_card_no")} required placeholder="GHA-123456789-0" />
          </div>
          <div className="field"><label>Upload Ghana Card photo *</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={pickCardImage} required />
            {form.ghana_card_image ? <div className="hint">Photo attached ✓</div> : <div className="hint">Clear photo of the front — name and photo visible.</div>}
          </div>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <div className="field"><label>Vehicle registration number *</label>
            <input value={form.vehicle_reg_no} onChange={set("vehicle_reg_no")} required placeholder="e.g. GT 1234-20" />
          </div>
          <div className="field"><label>Vehicle make / model (optional)</label>
            <input value={form.vehicle_make} onChange={set("vehicle_make")} placeholder="e.g. Toyota Sienna" />
          </div>
          <div className="field"><label>Vehicle colour *</label>
            <select value={form.vehicle_color} onChange={set("vehicle_color")} required>
              <option value="">Select colour…</option>
              {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field"><label>Insurance expiry *</label>
            <input type="date" value={form.insurance_expiry} onChange={set("insurance_expiry")} required />
          </div>
          <div className="field"><label>Roadworthy expiry *</label>
            <input type="date" value={form.roadworthy_expiry} onChange={set("roadworthy_expiry")} required />
          </div>
          <div className="field"><label>Vehicle photos * (up to 3)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" onChange={pickVehicleImage} disabled={vehicleImages.length >= 3} />
            <div className="da-pics">
              {vehicleImages.map((src, i) => (
                <span key={i} className="da-pic">
                  <img src={src} alt={"Vehicle photo " + (i + 1)} />
                  <button type="button" onClick={() => removeVehicleImage(i)} aria-label="Remove photo">×</button>
                </span>
              ))}
            </div>
            <div className="hint">Front and side views help approval go faster.</div>
          </div>
        </>
      ) : null}

      {step === 4 ? (
        <div className="da-review">
          <h3>Check your details</h3>
          <div className="da-rrow"><span>Name</span><b>{form.full_name}</b></div>
          <div className="da-rrow"><span>Phone</span><b>{form.phone}</b></div>
          <div className="da-rrow"><span>Licence</span><b>{form.license_no} · exp {form.license_expiry}</b></div>
          <div className="da-rrow"><span>Ghana Card</span><b>{form.ghana_card_no}</b></div>
          <div className="da-rrow"><span>Vehicle</span><b>{form.vehicle_reg_no} · {form.vehicle_color}{form.vehicle_make ? " · " + form.vehicle_make : ""}</b></div>
          <div className="da-rrow"><span>Insurance exp.</span><b>{form.insurance_expiry}</b></div>
          <div className="da-rrow"><span>Roadworthy exp.</span><b>{form.roadworthy_expiry}</b></div>
          <div className="da-rrow"><span>Photos</span><b>{vehicleImages.length} attached</b></div>
        </div>
      ) : null}

      <div className="da-actions">
        {step > 1 ? (
          <button type="button" className="btn da-back" onClick={() => setStep(step - 1)} disabled={busy}>Back</button>
        ) : null}
        {step < 4 ? (
          <button type="button" className="btn da-next" onClick={next}>Continue</button>
        ) : (
          <button type="submit" className="btn da-submit" disabled={busy}>{busy ? "Sending..." : "Submit application"}</button>
        )}
      </div>
    </form>
  );
}