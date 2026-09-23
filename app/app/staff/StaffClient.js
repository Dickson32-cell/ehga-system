"use client";

import { useEffect, useState } from "react";

const LABELS = {
  MANAGING_DIRECTOR: "Managing Director",
  OPERATIONS_MANAGER: "Operations Manager",
  DISPATCHER: "Dispatcher",
  ACCOUNTANT: "Accountant",
  DRIVER: "Driver",
  RIDER: "Rider",
};

export default function StaffClient({ me, myRole }) {
  const isCEO = myRole === "MANAGING_DIRECTOR";
  // Which roles I may create/edit — the server enforces it; the form mirrors it.
  const creatable = isCEO
    ? ["MANAGING_DIRECTOR", "OPERATIONS_MANAGER", "ACCOUNTANT", "DRIVER", "RIDER"]
    : ["DRIVER", "RIDER"];

  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: "", full_name: "", role: creatable[creatable.length - 1], email: "", password: "" });
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ username: "", full_name: "", email: "" });

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
      setOkMsg(`Created ${json.data.username} (${LABELS[json.data.role]}). Give them the temporary password — they will set their own at first login.`);
      setForm({ username: "", full_name: "", role: creatable[creatable.length - 1], email: "", password: "" });
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
      setOkMsg(payload.password
        ? "Password set. The staff member must change it at their next sign-in."
        : "Staff record updated");
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function deleteUser(u) {
    if (!window.confirm(`DELETE ${u.username} permanently? This cannot be undone and their login stops working immediately.`)) return;
    setBusy(true); setError(""); setOkMsg("");
    try {
      const res = await fetch(`/api/staff/${u.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Delete failed");
      setOkMsg(`${u.username} deleted.`);
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  function startEdit(u) {
    setEditing(u.id);
    setEditForm({ username: u.username, full_name: u.full_name || "", email: u.email || "" });
    setError(""); setOkMsg("");
  }

  async function saveEdit(e) {
    e.preventDefault();
    setBusy(true); setError(""); setOkMsg("");
    try {
      const res = await fetch(`/api/staff/${editing}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Update failed");
      setOkMsg("Staff details saved");
      setEditing(null);
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{isCEO ? "Staff Accounts" : "Field Staff"}</h1>
          <p className="panel-note">
            {isCEO
              ? "You see every account. Add Managing Directors, Operations Managers, Accountants, Drivers and Riders; edit details; issue temporary passwords (staff set their own at first login); deactivate or delete."
              : "You manage Drivers and Riders for field operations. Passwords are issued by the CEO."}
          </p>
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {okMsg ? <div className="form-ok">{okMsg}</div> : null}

      <div className="panel">
        <h2>{isCEO ? "Add staff member" : "Add driver or rider"}</h2>
        <p className="panel-note">
          Set a temporary password here. At their first sign-in the system asks them to create
          their own password — you{isCEO ? "" : " and the CEO"} see who has and hasn&apos;t done it below.
        </p>
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
                {creatable.map((r) => <option key={r} value={r}>{LABELS[r]}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="s-email">Email (optional — can sign in with it)</label>
              <input id="s-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
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
            <tr><th>#</th><th>Username</th><th>Full name</th><th>Role</th><th>Status</th><th>Password</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((u, i) => (
              <tr key={u.id}>
                <td>{i + 1}</td>
                <td><span className="badge code">{u.username}</span></td>
                <td>{u.full_name}{u.email ? <div className="hint">{u.email}</div> : null}</td>
                <td>
                  {isCEO ? (
                    <select
                      value={u.role}
                      disabled={busy}
                      onChange={(e) => patchUser(u.id, { role: e.target.value }, `Change ${u.username} role to ${LABELS[e.target.value]}?`)}
                    >
                      {creatable.map((r) => <option key={r} value={r}>{LABELS[r]}</option>)}
                    </select>
                  ) : (
                    LABELS[u.role]
                  )}
                </td>
                <td>{u.active ? <span className="badge ok">Active</span> : <span className="badge bad">Inactive</span>}</td>
                <td>
                  {u.must_change_password ? (
                    <span className="badge warn" title="Still using the temporary password issued at creation">Temp password</span>
                  ) : u.password_changed_at ? (
                    <span className="badge ok" title={new Date(u.password_changed_at).toLocaleString()}>Own password set</span>
                  ) : (
                    <span className="badge">Original</span>
                  )}
                </td>
                <td>
                  <button className="btn small secondary" disabled={busy} type="button" onClick={() => startEdit(u)}>
                    Edit
                  </button>{" "}
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
                  {isCEO ? (
                    <>
                      <button className="btn small secondary" disabled={busy} type="button"
                        onClick={() => {
                          const pw = window.prompt(`Temporary password for ${u.username} (min 8 characters). They will be asked to change it at next login:`);
                          if (pw) patchUser(u.id, { password: pw });
                        }}>
                        Reset password
                      </button>{" "}
                      {String(u.id) !== String(me.id) ? (
                        <button className="btn small danger" disabled={busy} type="button" onClick={() => deleteUser(u)}>
                          Delete
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="panel">
          <h2>Edit staff member</h2>
          <form onSubmit={saveEdit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="e-username">Username</label>
                <input id="e-username" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="e-fullname">Full name</label>
                <input id="e-fullname" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required />
              </div>
              <div className="field">
                <label htmlFor="e-email">Email (optional sign-in)</label>
                <input id="e-email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
            </div>
            <div className="actions">
              <button className="btn" type="submit" disabled={busy}>Save details</button>
              <button className="btn secondary" type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}