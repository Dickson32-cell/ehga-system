"use client";

import { useCallback, useEffect, useState } from "react";

const money = (v) =>
  Number(v || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const colLabel = (s) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function RegisterClient({ registerKey, definition }) {
  const def = definition;
  const [rows, setRows] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [kvs, setKvs] = useState({});
  const [editing, setEditing] = useState(null); // null | {} for new | row object for edit
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const dateField = def.fields.find((f) => f.type === "date")?.name || "date";

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/registers/${registerKey}?limit=500`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Load failed");
      const json = await res.json();
      setRows(json.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoaded(true);
    }
  }, [registerKey]);

  useEffect(() => {
    load();
    fetch("/api/registers/fleet?limit=100")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setVehicles((j.data || []).filter((v) => !v.deleted)))
      .catch(() => setVehicles([]));
    fetch("/api/setup")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => {
        const map = {};
        for (const row of j.data || []) map[row.key] = row.value.split("|");
        setKvs(map);
      })
      .catch(() => {});
  }, [load]);

  function startNew() {
    const init = {};
    for (const f of def.fields) {
      if (f.def !== undefined && f.def !== null) init[f.name] = f.def;
      else init[f.name] = "";
    }
    setForm(init);
    setEditing({});
    setError("");
    setOkMsg("");
  }

  function startEdit(row) {
    const init = {};
    for (const f of def.fields) {
      const v = row[f.name];
      init[f.name] = v === null || v === undefined ? "" : v;
    }
    setForm(init);
    setEditing(row);
    setError("");
    setOkMsg("");
  }

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  const idField = def.codeColumn === "vehicle_code" ? "vehicle_code" : "id";

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setOkMsg("");
    try {
      const isNew = !editing || !editing[idField];
      const url = isNew
        ? `/api/registers/${registerKey}`
        : `/api/registers/${registerKey}/${encodeURIComponent(editing[idField])}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Save failed");
      setOkMsg(isNew ? "Record created" + (json.data[def.codeColumn] ? ` (${json.data[def.codeColumn]})` : "") : "Record updated");
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function softDelete(row) {
    if (!window.confirm(`Soft-delete ${row[def.codeColumn] || "record " + row.id}? It will be removed from all lists but kept for audit.`)) return;
    setBusy(true);
    setError("");
    setOkMsg("");
    try {
      const res = await fetch(`/api/registers/${registerKey}/${encodeURIComponent(row[idField])}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Delete failed");
      setOkMsg("Record soft-deleted");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const columns = def.fields.map((f) => f.name).concat(def.computed);

  function renderCell(row, name) {
    const v = row[name];
    if (name === def.codeColumn) return <span className="badge code">{v}</span>;
    if (v === null || v === undefined || v === "") return "-";
    if (typeof v === "boolean") return v ? "Yes" : "No";
    if (/(_revenue|charge|cost|cash|momo|amount|fee|balance|tolls|refunds|receipts|contribution|income|expenses|_value|_paid|variance|reserve|quoted|_price|litres|odometer|kilometres|km_to|opening|current|next_service|collections|expected)/.test(name) && !isNaN(Number(v))) {
      return money(v);
    }
    if (/occupancy|rate/.test(name) && !isNaN(Number(v)) && Number(v) <= 1.01) {
      return (Number(v) * 100).toFixed(1) + "%";
    }
    return String(v);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{def.title}</h1>
          <p className="panel-note">
            Full record list. Create, edit and soft-delete; deleted rows are retained for audit but
            never shown or reused. All money in GHS.
          </p>
        </div>
        <div className="actions" style={{ marginTop: 0 }}>
          {!editing ? (
            <button className="btn" onClick={startNew} type="button">
              New record
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {okMsg ? <div className="form-ok">{okMsg}</div> : null}

      {editing ? (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h2>{editing && editing[idField] ? "Edit record" : "New record"}</h2>
          <form onSubmit={save}>
            <div className="form-grid">
              {def.fields.map((f) => {
                const val = form[f.name] ?? "";
                const common = {
                  id: "f-" + f.name,
                  value: val,
                  onChange: (e) =>
                    setField(f.name, e.target.type === "checkbox" ? e.target.checked : e.target.value),
                  required: f.required,
                };
                let input;
                if (f.type === "select") {
                  const options = f.options || (f.kv && kvs[f.kv]) || [];
                  input = (
                    <select {...common}>
                      <option value="">- select -</option>
                      {options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  );
                } else if (f.type === "vehicle") {
                  input = (
                    <select {...common}>
                      <option value="">- none -</option>
                      {vehicles.map((v) => (
                        <option key={v.vehicle_code} value={v.vehicle_code}>
                          {v.vehicle_code} ({v.model || v.type})
                        </option>
                      ))}
                    </select>
                  );
                } else if (f.type === "bool") {
                  input = (
                    <input type="checkbox" checked={!!val} onChange={(e) => setField(f.name, e.target.checked)} id={"f-" + f.name} />
                  );
                } else if (f.type === "long" || f.long) {
                  input = <textarea {...common} rows={2} />;
                } else {
                  const type = f.type === "number" || f.type === "int" ? "number" : f.type;
                  input = <input {...common} type={type} step={f.type === "number" ? "0.01" : undefined} />;
                }
                return (
                  <div className="field" key={f.name} style={f.type === "bool" ? { display: "flex", alignItems: "center", gap: "0.5rem" } : undefined}>
                    {f.type === "bool" ? (
                      <>
                        <input type="checkbox" id={"f-" + f.name} checked={!!val} onChange={(e) => setField(f.name, e.target.checked)} />
                        <label htmlFor={"f-" + f.name} style={{ marginBottom: 0 }}>{colLabel(f.name)}</label>
                      </>
                    ) : (
                      <>
                        <label htmlFor={"f-" + f.name}>
                          {colLabel(f.name)}
                          {f.required ? " *" : ""}
                        </label>
                        {input}
                      </>
                    )}
                    {f.def !== undefined && f.def !== null && !(editing && editing[idField]) ? (
                      <div className="hint">Default: {String(f.def)}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="actions">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "Saving..." : editing && editing[idField] ? "Save changes" : "Create record"}
              </button>
              <button className="btn secondary" type="button" onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              {def.codeColumn ? <th>Code</th> : null}
              {columns
                .filter((c) => c !== def.codeColumn)
                .map((c) => (
                  <th key={c}>{colLabel(c)}</th>
                ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row[idField]}>
                <td>{i + 1}</td>
                {def.codeColumn ? <td>{renderCell(row, def.codeColumn)}</td> : null}
                {columns
                  .filter((c) => c !== def.codeColumn)
                  .map((c) => (
                    <td
                      key={c}
                      data-label={colLabel(c)}
                      className={/(_revenue|charge|cost|cash|momo|amount|fee|balance|tolls|variance|reserve|contribution|collections|expected)/.test(c) ? "num" : undefined}
                    >
                      {renderCell(row, c)}
                    </td>
                  ))}
                <td>
                  <button className="btn small secondary" type="button" onClick={() => startEdit(row)}>
                    Edit
                  </button>{" "}
                  <button className="btn small danger" type="button" onClick={() => softDelete(row)} disabled={busy}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={columns.length + 3} style={{ textAlign: "center", color: "var(--ink-faint)", padding: "1.4rem" }}>
                  {loaded ? "No records yet. Use New record to add the first entry." : "Loading..."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
