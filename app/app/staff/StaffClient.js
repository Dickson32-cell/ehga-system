"use client";

import { useEffect, useState } from "react";

const ROLES = ["MANAGING_DIRECTOR","OPERATIONS_MANAGER","DISPATCHER","ACCOUNTANT","DRIVER","RIDER"];
const LABELS = {
  MANAGING_DIRECTOR: "Managing Director",
  OPERATIONS_MANAGER: "Operations Manager",
  DISPATCHER: "Dispatcher",
  ACCOUNTANT: "Accountant",
  DRIVER: "Driver",
  RIDER: "Rider",
};

export default function StaffClient({ me }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: "", full_name: "", role: "DRIVER", password: "" });

  async function load() {
    const res = await fetch("/api/staff");
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || "Failed to load staff");
      return;
    }
    setRows((await res.json()).data || []);
  }
  useEffect(() => { load(); }, []);

  async function createUser(e) {
    e.preventDefault();
    setBusy(true); setError(""); setOkMsg("");
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Create failed");
      setOkMsg(`Created ${json.data.username} (${LABELS[json.data.role]}). Share the password securely.`);
      setForm({ username: "", full_name: "", role: "DRIVER", password: "" });
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function patchUser(id, payload, confirmMsg) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true); setError(""); setOkMsg("");
    try {
      const res = await fetch(`/api/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Update failed");
      setOkMsg("Staff record updated");
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Staff Accounts</h1>
          <p className="panel-note">Create staff logins, change roles, reset passwords, deactivate accounts.</p>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {okMsg ? <div className="form-ok">{okMsg}</div> : null}

      <div className="panel">
        <h2>Add staff member</h2>
        <form onSubmit={createUser}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="s-username">Username *</label>
              <input id="s-username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="s-fullname">Full name *</label>
              <input id="s-fullname" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="s-role">Role *</label>
              <select id="s-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{LABELS[r]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="s-pw">Temporary password * (min 8 chars)</label>
              <input id="s-pw" type="text" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
          </div>
          <div className="actions">
            <button className="btn" type="submit" disabled={busy}>Create account</button>
          </div>
        </form>
      </div>

      <div className="tablewrap">
        <table>
          <thead>
            <tr><th>#</th><th>Username</th><th>Full name</th><th>Role</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((u, i) => (
              <tr key={u.id}>
                <td>{i + 1}</td>
                <td><span className="badge code">{u.username}</span></td>
                <td>{u.full_name}</td>
                <td>
                  <select
                    value={u.role}
                    disabled={busy}
                    onChange={(e) => patchUser(u.id, { role: e.target.value }, `Change ${u.username} role to ${LABELS[e.target.value]}?`)}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{LABELS[r]}</option>)}
                  </select>
                </td>
                <td>{u.active ? <span className="badge ok">Active</span> : <span className="badge bad">Inactive</span>}</td>
                <td>
                  {u.active ? (
                    <button className="btn small danger" disabled={busy} type="button"
                      onClick={() => patchUser(u.id, { active: false }, `Deactivate ${u.username}? They will be signed out on next request.`)}>
                      Deactivate
                    </button>
                  ) : (
                    <button className="btn small secondary" disabled={busy} type="button" onClick={() => patchUser(u.id, { active: true })}>
                      Reactivate
                    </button>
                  )}{" "}
                  <button className="btn small secondary" disabled={busy} type="button"
                    onClick={() => {
                      const pw = window.prompt(`New password for ${u.username} (min 8 characters):`);
                      if (pw) patchUser(u.id, { password: pw });
                    }}>
                    Reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
