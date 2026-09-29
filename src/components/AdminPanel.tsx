"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { jsonFetch, type CatalogCard } from "@/lib/client";

type Session = { enabled: boolean; authenticated: boolean };
type SettingRow = { key: string; value: string; updatedAt: string };

const EMPTY_CARD: CatalogCard = {
  name: "",
  qty: 1,
  img: "",
  colors: "",
  rarity: "common",
  type: "",
  colorIdentity: "",
};

const TEXT_FIELDS: { key: keyof CatalogCard; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "colorIdentity", label: "Identity" },
  { key: "colors", label: "Colors" },
  { key: "rarity", label: "Rarity" },
  { key: "type", label: "Type" },
  { key: "img", label: "Image URL" },
];

export function AdminPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const [catalog, setCatalog] = useState<CatalogCard[]>([]);
  const [catalogText, setCatalogText] = useState("");
  const [draft, setDraft] = useState<CatalogCard>({ ...EMPTY_CARD });
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const loadSession = useCallback(async () => {
    try {
      const data = await jsonFetch<Session>("/api/admin/session");
      setSession(data);
      return data;
    } catch {
      setSession({ enabled: false, authenticated: false });
      return null;
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([
        jsonFetch<{ catalog: CatalogCard[] }>("/api/admin/catalog"),
        jsonFetch<{ settings: SettingRow[] }>("/api/admin/settings"),
      ]);
      setCatalog(c.catalog);
      setCatalogText(JSON.stringify(c.catalog, null, 2));
      setSettings(s.settings);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load admin data.");
    }
  }, []);

  useEffect(() => {
    void loadSession().then((s) => {
      if (s?.authenticated) void loadData();
    });
  }, [loadSession, loadData]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    try {
      await jsonFetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setPassword("");
      const s = await loadSession();
      if (s?.authenticated) await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Login failed.");
    }
  }

  async function logout() {
    await jsonFetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    setCatalog([]);
    setCatalogText("");
    setSettings([]);
    await loadSession();
  }

  // ---- Catalog: per-row CRUD -------------------------------------------------

  async function createCard(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    try {
      await jsonFetch("/api/admin/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setStatus(`Added "${draft.name}".`);
      setDraft({ ...EMPTY_CARD });
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add card.");
    }
  }

  async function saveCard(originalName: string, card: CatalogCard) {
    setError("");
    setStatus("");
    try {
      await jsonFetch(`/api/admin/catalog/${encodeURIComponent(originalName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(card),
      });
      setStatus(`Saved "${card.name}".`);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save card.");
    }
  }

  async function deleteCard(name: string) {
    setError("");
    setStatus("");
    try {
      await jsonFetch(`/api/admin/catalog/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      setStatus(`Deleted "${name}".`);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete card.");
    }
  }

  function editRow(index: number, patch: Partial<CatalogCard>) {
    setCatalog((prev) =>
      prev.map((card, i) => (i === index ? { ...card, ...patch } : card)),
    );
  }

  // ---- Catalog: bulk replace + seed -----------------------------------------

  async function saveBulk(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(catalogText);
    } catch {
      setError("Catalog is not valid JSON.");
      return;
    }
    try {
      const res = await jsonFetch<{ count: number }>("/api/admin/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalog: parsed }),
      });
      setStatus(`Replaced catalog with ${res.count} cards.`);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save catalog.");
    }
  }

  async function seed() {
    setError("");
    setStatus("");
    try {
      const res = await jsonFetch<{ count: number }>("/api/admin/catalog/seed", {
        method: "POST",
      });
      setStatus(`Seeded ${res.count} cards from the bundled catalog.`);
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not seed catalog.");
    }
  }

  // ---- Settings --------------------------------------------------------------

  async function saveSetting(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!newKey.trim()) {
      setError("Setting key is required.");
      return;
    }
    try {
      await jsonFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { [newKey.trim()]: newValue } }),
      });
      setNewKey("");
      setNewValue("");
      setStatus("Setting saved.");
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save setting.");
    }
  }

  async function updateSetting(key: string, value: string) {
    setError("");
    try {
      await jsonFetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { [key]: value } }),
      });
      setStatus(`Saved "${key}".`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save setting.");
    }
  }

  // ---- Render ----------------------------------------------------------------

  if (session === null) {
    return (
      <main className="admin">
        <p>Loading…</p>
      </main>
    );
  }

  if (!session.enabled) {
    return (
      <main className="admin">
        <h1>Admin panel</h1>
        <p className="error">
          The admin panel is disabled. Set the <code>ADMIN_PASSWORD</code> environment
          variable to a real value (the empty string and the placeholder{" "}
          <code>change-me</code> are rejected).
        </p>
        <p>
          <Link href="/">← Back to league</Link>
        </p>
      </main>
    );
  }

  if (!session.authenticated) {
    return (
      <main className="admin">
        <h1>Admin panel</h1>
        <form onSubmit={login} className="admin-login">
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="submit">Sign in</button>
        </form>
        {error && <p className="error">{error}</p>}
        <p>
          <Link href="/">← Back to league</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="admin">
      <header className="admin-header">
        <h1>Admin panel</h1>
        <div>
          <Link href="/">← Back to league</Link>
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {status && <p className="status">{status}</p>}

      <section className="admin-section">
        <h2>Card catalog ({catalog.length})</h2>
        <p>The catalog lives in the database. Add, edit, or remove individual cards below.</p>

        <form onSubmit={createCard} className="admin-card-form">
          {TEXT_FIELDS.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <input
                value={String(draft[field.key] ?? "")}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
              />
            </label>
          ))}
          <label>
            <span>Qty</span>
            <input
              type="number"
              min={0}
              value={draft.qty}
              onChange={(e) => setDraft({ ...draft, qty: Number(e.target.value) })}
            />
          </label>
          <button type="submit">Add card</button>
        </form>

        <div className="admin-table-scroll">
          <table className="admin-catalog">
            <thead>
              <tr>
                {TEXT_FIELDS.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th>Qty</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {catalog.map((card, index) => (
                <tr key={card.name}>
                  {TEXT_FIELDS.map((field) => (
                    <td key={field.key}>
                      <input
                        value={String(card[field.key] ?? "")}
                        aria-label={`${field.label} for ${card.name}`}
                        onChange={(e) => editRow(index, { [field.key]: e.target.value })}
                      />
                    </td>
                  ))}
                  <td>
                    <input
                      type="number"
                      min={0}
                      value={card.qty}
                      aria-label={`Qty for ${card.name}`}
                      onChange={(e) => editRow(index, { qty: Number(e.target.value) })}
                    />
                  </td>
                  <td className="admin-row-actions">
                    <button type="button" onClick={() => saveCard(card.name, card)}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => deleteCard(card.name)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!catalog.length && (
                <tr>
                  <td colSpan={TEXT_FIELDS.length + 2}>
                    Catalog is empty. Add a card above or seed from the bundled dataset.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <details className="admin-bulk">
          <summary>Bulk edit / seed</summary>
          <div className="admin-actions">
            <button type="button" onClick={seed}>
              Reseed from bundled catalog
            </button>
          </div>
          <form onSubmit={saveBulk}>
            <textarea
              className="admin-json"
              value={catalogText}
              onChange={(e) => setCatalogText(e.target.value)}
              spellCheck={false}
              rows={16}
              aria-label="Catalog JSON"
            />
            <div className="admin-actions">
              <button type="submit">Replace entire catalog</button>
            </div>
          </form>
        </details>
      </section>

      <section className="admin-section">
        <h2>Site settings</h2>
        <table className="admin-settings">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((row) => (
              <tr key={row.key}>
                <td>
                  <code>{row.key}</code>
                </td>
                <td>
                  <input
                    defaultValue={row.value}
                    aria-label={`Value for ${row.key}`}
                    onBlur={(e) => {
                      if (e.target.value !== row.value) {
                        void updateSetting(row.key, e.target.value);
                      }
                    }}
                  />
                </td>
                <td>{row.updatedAt}</td>
              </tr>
            ))}
            {!settings.length && (
              <tr>
                <td colSpan={3}>No settings yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        <form onSubmit={saveSetting} className="admin-new-setting">
          <input
            placeholder="key"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            aria-label="New setting key"
          />
          <input
            placeholder="value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            aria-label="New setting value"
          />
          <button type="submit">Add / update setting</button>
        </form>
      </section>
    </main>
  );
}
