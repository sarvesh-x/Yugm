import { useEffect, useState } from "react";
import { adminApi, adminApiMultipart, adminApiWithMeta, ApiError } from "./api";

type AssetVariant = { name: string; url: string; contentType: string; width?: number; height?: number };
type Asset = {
  id: string;
  ownerType: "cosmetic" | "badge" | "gift";
  ownerId: string;
  status: "staging" | "published" | "archived";
  version: number;
  originalName: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  publicUrl?: string;
  variants: AssetVariant[];
  createdAt: string;
};

type Notice = { tone: "success" | "error" | "info"; text: string } | null;

const ownerTypes = ["cosmetic", "badge", "gift"] as const;

export function AssetsPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ownerType, setOwnerType] = useState<(typeof ownerTypes)[number]>("cosmetic");
  const [ownerId, setOwnerId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filter, setFilter] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "100" });
      if (ownerType) query.set("ownerType", ownerType);
      if (filter.trim()) query.set("ownerId", filter.trim());
      const { data } = await adminApiWithMeta<{ assets: Asset[] }>(`/assets?${query.toString()}`, { token });
      setAssets(data.assets ?? []);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : "Could not load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [token, ownerType, filter]);

  const stage = async () => {
    if (!file) {
      setNotice({ tone: "error", text: "Choose an image first." });
      return;
    }
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(ownerId.trim())) {
      setNotice({ tone: "error", text: "Owner ID must be 1–64 letters, digits, _ or -." });
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("asset", file);
      body.append("ownerType", ownerType);
      body.append("ownerId", ownerId.trim());
      body.append("originalName", file.name);
      const result = await adminApiMultipart<{ asset: Asset }>("/assets", token, body);
      setNotice({ tone: "success", text: `Staged v${result.asset.version}. Publish it from this list when ready.` });
      setFile(null);
      await load();
    } catch (failure) {
      setNotice({ tone: "error", text: failure instanceof ApiError ? failure.message : "Upload failed" });
    } finally {
      setBusy(false);
    }
  };

  const publish = async (asset: Asset) => {
    setBusy(true);
    try {
      const result = await adminApi<{ asset: Asset }>(`/assets/${asset.id}/publish`, { token, method: "POST" });
      setNotice({ tone: "success", text: `Published v${result.asset.version}.` });
      await load();
    } catch (failure) {
      setNotice({ tone: "error", text: failure instanceof ApiError ? failure.message : "Publish failed" });
    } finally {
      setBusy(false);
    }
  };

  const archive = async (asset: Asset) => {
    if (!window.confirm(`Archive v${asset.version} of ${asset.ownerId}? Its stored files will be removed.`)) return;
    setBusy(true);
    try {
      await adminApi(`/assets/${asset.id}`, { token, method: "DELETE" });
      setNotice({ tone: "success", text: `Archived v${asset.version}.` });
      await load();
    } catch (failure) {
      setNotice({ tone: "error", text: failure instanceof ApiError ? failure.message : "Archive failed" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-grid">
      <div className="section-heading">
        <div>
          <h3>Managed Assets</h3>
          <p>Stage image art privately, publish immutable versioned variants, then reference it from a catalog item.</p>
        </div>
      </div>

      <div className="panel">
        <h3>Stage new art</h3>
        <div className="form-grid">
          <label>
            Owner type
            <select value={ownerType} onChange={(event) => setOwnerType(event.target.value as (typeof ownerTypes)[number])}>
              {ownerTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Owner ID
            <input value={ownerId} onChange={(event) => setOwnerId(event.target.value)} placeholder="cosmetic id, badge id or gift id" />
          </label>
          <label className="full">
            Image (JPEG, PNG, WebP or GIF, up to 8 MB)
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="action-row">
          <button className="primary-action compact" disabled={busy} onClick={() => void stage()}>Stage upload</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Asset registry</h3>
          <div className="action-row">
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter by owner ID" />
            <button className="ghost-button" onClick={() => void load()}>Refresh</button>
          </div>
        </div>
        {loading ? <p>Loading assets…</p> : error ? <p className="form-error">{error}</p> : assets.length === 0 ? (
          <p>No assets yet. Stage an image above to begin.</p>
        ) : (
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Image</th>
                  <th>Published URL</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>{asset.ownerType}: {asset.ownerId}</td>
                    <td>v{asset.version}</td>
                    <td>{asset.status}</td>
                    <td>{asset.width}×{asset.height} · {Math.round(asset.bytes / 1024)} KB</td>
                    <td>
                      {asset.publicUrl ? (
                        <a href={asset.publicUrl} target="_blank" rel="noreferrer">Open variant</a>
                      ) : "—"}
                    </td>
                    <td>
                      <div className="action-row">
                        {asset.status === "staging" && (
                          <button className="primary-action compact" disabled={busy} onClick={() => void publish(asset)}>Publish</button>
                        )}
                        {asset.status !== "archived" && (
                          <button className="soft danger" disabled={busy} onClick={() => void archive(asset)}>Archive</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
