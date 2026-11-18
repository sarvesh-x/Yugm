import { FormEvent, useEffect, useRef, useState } from "react";
import { Award } from "lucide-react";
import { adminApi, adminApiMultipart } from "./api";

type Tier = { tier: string; target: number; rewardCoins: number; rewardCosmetic?: string };
type Badge = {
  id: string; title: string; description: string; kind: "ACHIEVEMENT" | "HONOR";
  metric: string; icon: string; order: number; hidden: boolean; imageUrl?: string;
  weeklyTarget?: number; tiers: Tier[];
};
type Catalog = { badges: Badge[]; metrics: string[]; honorMetrics: string[]; tierNames: string[]; icons: string[] };

const activityNames: Record<string, string> = {
  profile_complete: "Profile completion (%)", daily_streak_3: "Check-in streak", follow_10: "Users followed",
  host_3: "Rooms hosted", gift_5: "Gifts sent", chat_25: "Room messages", level_5: "Active level",
  room_join_10: "Distinct rooms joined", game_plays_10: "Games played", gift_received_5: "Gifts received"
};
const newBadge = (): Badge => ({
  id: "", title: "", description: "", kind: "ACHIEVEMENT", metric: "level_5", icon: "trophy",
  order: 100, hidden: false, tiers: [{ tier: "BRONZE", target: 5, rewardCoins: 0 }]
});
const origin = new URL(import.meta.env.VITE_ADMIN_API_URL || "/api/admin", window.location.origin).origin;

export function BadgesPage({ token }: { token: string }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Badge>(() => newBadge());
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [assetInput, setAssetInput] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const editor = useRef<HTMLFormElement>(null);
  const refresh = () => adminApi<Catalog>("/badges", { token }).then(setCatalog);

  useEffect(() => {
    let cancelled = false;
    adminApi<Catalog>("/badges", { token }).then(result => {
      if (!cancelled) setCatalog(result);
    }).catch(failure => { if (!cancelled) setError(failure.message); });
    return () => { cancelled = true; };
  }, [token]);

  function edit(badge?: Badge) {
    setEditId(badge?.id ?? null);
    setForm(badge ?? newBadge());
    setImage(null);
    setRemoveImage(false);
    setAssetInput(value => value + 1);
  }
  function change<K extends keyof Badge>(key: K, value: Badge[K]) {
    setForm(previous => ({ ...previous, [key]: value }));
  }
  function openEditor(badge?: Badge) {
    edit(badge);
    requestAnimationFrame(() => editor.current?.scrollIntoView({ block: "start" }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      body.set("definition", JSON.stringify({ ...form, removeImage }));
      if (image) body.set("image", image);
      await adminApiMultipart(editId ? `/badges/${editId}` : "/badges", token, body, editId ? "PUT" : "POST");
      await refresh();
      edit();
      setMessage("Badge saved.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the badge.");
    } finally { setBusy(false); }
  }

  async function archive(badge: Badge) {
    if (!window.confirm(`Remove ${badge.title} from the badge collection and profiles?`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await adminApi(`/badges/${badge.id}`, { token, method: "DELETE" });
      await refresh();
      if (editId === badge.id) edit();
      setMessage("Badge removed from the collection.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not remove the badge.");
    } finally { setBusy(false); }
  }

  const isHonor = form.kind === "HONOR";
  return (
    <section className="panel">
      <div className="panel-header">
        <div><h2>Badges</h2><p>Manage achievements, weekly honors, and their artwork.</p></div>
        <button type="button" onClick={() => openEditor()} disabled={busy || !catalog}>New badge</button>
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {catalog && <>
        <div className="table-shell">
          <table>
            <thead><tr><th>Badge</th><th>Collection</th><th>Requirement</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{catalog.badges.map(badge => <tr key={badge.id}>
              <td><span className="badge-admin-image">{badge.imageUrl && !badge.hidden ? <img src={new URL(badge.imageUrl, origin).href} alt="" /> : <Award size={20} />}</span>{badge.title}</td>
              <td>{badge.kind === "HONOR" ? "Honor" : "Achievement"}</td>
              <td>{activityNames[badge.metric] ?? badge.metric}{badge.kind === "HONOR" ? ` · ${badge.weeklyTarget} per week` : ` · ${badge.tiers.length} levels`}</td>
              <td>{badge.hidden ? "Archived" : "Active"}</td>
              <td><button type="button" disabled={busy} onClick={() => openEditor(badge)}>Edit</button>{" "}
                {!badge.hidden && <button type="button" disabled={busy} onClick={() => void archive(badge)}>Remove</button>}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <h3>{editId ? `Edit ${form.title}` : "Create a badge"}</h3>
        <form className="form-grid" onSubmit={save} ref={editor}>
          <label>Badge ID<input value={form.id} onChange={e => change("id", e.target.value)} readOnly={!!editId} pattern="[a-z0-9_-]{1,64}" required /></label>
          <label>Title<input value={form.title} onChange={e => change("title", e.target.value)} maxLength={60} required /></label>
          <label className="full">Description<textarea value={form.description} onChange={e => change("description", e.target.value)} maxLength={240} required /></label>
          <label>Collection<select value={form.kind} disabled={!!editId} onChange={e => {
            const honor = e.target.value === "HONOR";
            setForm(previous => ({ ...previous, kind: honor ? "HONOR" : "ACHIEVEMENT", metric: honor ? catalog.honorMetrics[0] : "level_5",
              weeklyTarget: honor ? 5 : undefined, tiers: honor ? [] : newBadge().tiers }));
          }}><option value="ACHIEVEMENT">Achievement</option><option value="HONOR">Honor</option></select></label>
          <label>Activity<select value={form.metric} onChange={e => change("metric", e.target.value)}>
            {(isHonor ? catalog.honorMetrics : catalog.metrics).map(metric => <option key={metric} value={metric}>{activityNames[metric] ?? metric}</option>)}
          </select></label>
          <label>Default icon<select value={form.icon} onChange={e => change("icon", e.target.value)}>
            {catalog.icons.map(icon => <option key={icon}>{icon}</option>)}
          </select></label>
          <label>Sort order<input type="number" value={form.order} min={0} max={10000} required onChange={e => change("order", e.target.valueAsNumber)} /></label>
          <label>Image (PNG, JPEG, or WebP, up to 512 KB)<input key={assetInput} type="file" accept="image/png,image/jpeg,image/webp"
            onChange={e => { setImage(e.target.files?.[0] ?? null); setRemoveImage(false); }} /></label>
          {form.imageUrl && <label><span><input type="checkbox" checked={removeImage} onChange={e => setRemoveImage(e.target.checked)} /> Remove custom image</span></label>}
          {form.hidden && <label><span><input type="checkbox" checked={form.hidden} onChange={e => change("hidden", e.target.checked)} /> Archived</span></label>}
          {isHonor ? (
            <label>Weekly target<input type="number" min={1} max={1000000} value={form.weeklyTarget ?? 1} required
              onChange={e => change("weeklyTarget", e.target.valueAsNumber)} /></label>
          ) : (
            <fieldset className="full badge-tier-editor">
              <legend>Achievement levels</legend>
              {form.tiers.map((tier, index) => <div className="badge-tier-editor-row" key={tier.tier}>
                <strong>{tier.tier}</strong>
                <label>Target<input type="number" min={(form.tiers[index - 1]?.target ?? 0) + 1} max={1000000} required value={tier.target}
                  onChange={e => change("tiers", form.tiers.map((row, i) => i === index ? { ...row, target: e.target.valueAsNumber } : row))} /></label>
                <label>Coin reward<input type="number" min={0} max={1000000} required value={tier.rewardCoins}
                  onChange={e => change("tiers", form.tiers.map((row, i) => i === index ? { ...row, rewardCoins: e.target.valueAsNumber } : row))} /></label>
              </div>)}
              <button type="button" disabled={form.tiers.length >= catalog.tierNames.length} onClick={() =>
                change("tiers", [...form.tiers, { tier: catalog.tierNames[form.tiers.length], target: (form.tiers.at(-1)?.target ?? 0) + 1, rewardCoins: 0 }])
              }>Add level</button>{" "}
              <button type="button" disabled={form.tiers.length <= 1} onClick={() => change("tiers", form.tiers.slice(0, -1))}>Remove last level</button>
            </fieldset>
          )}
          <div className="full"><button type="submit" disabled={busy}>{busy ? "Saving…" : "Save badge"}</button></div>
        </form>
      </>}
    </section>
  );
}
