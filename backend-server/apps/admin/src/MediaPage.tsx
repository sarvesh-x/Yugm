import { useCallback, useEffect, useState } from "react";
import { adminApiWithMeta, ApiError, formatDate, formatNumber } from "./api";

type MediaItem = {
  id: string;
  ownerType: string;
  ownerId: string;
  mediaType: string;
  category: string;
  bucket: string;
  storageKey: string;
  checksum: string;
  bytes: number;
  visibility: string;
  processingStatus: string;
  moderationStatus: string;
  version: number;
  variantCount: number;
  deletedAt: string | null;
  createdAt: string | null;
};

type MediaSession = {
  id: string;
  userId: string;
  category: string;
  status: string;
  expectedBytes: number;
  ownerType: string;
  ownerId: string;
  expiresAt: string | null;
  quotaReserved: boolean;
};

type QuotaRow = { userId: string; bytes: number; updatedAt: string | null };

type QuotaReconciliationRow = {
  userId: string;
  counterBytes: number;
  expectedBytes: number;
  deltaBytes: number;
  status: "OK" | "OVER_RESERVED" | "UNDER_RESERVED" | "MISSING_COUNTER";
};

type QuotaReconciliation = {
  generatedAt: string;
  counterCount: number;
  driftCount: number;
  staleSessions: number;
  rows: QuotaReconciliationRow[];
};

type Notice = { tone: "success" | "error" | "info"; text: string } | null;

function message(failure: unknown, fallback: string) {
  return failure instanceof ApiError ? failure.message : fallback;
}

export function MediaPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [sessions, setSessions] = useState<MediaSession[]>([]);
  const [quotas, setQuotas] = useState<QuotaRow[]>([]);
  const [reconciliation, setReconciliation] = useState<QuotaReconciliation | null>(null);
  const [category, setCategory] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const mediaQuery = new URLSearchParams({ limit: "100" });
      if (category.trim()) mediaQuery.set("category", category.trim().toUpperCase());
      if (ownerId.trim()) mediaQuery.set("ownerId", ownerId.trim());
      const [mediaResult, sessionResult, quotaResult, reconciliationResult] = await Promise.all([
        adminApiWithMeta<{ media: MediaItem[] }>(`/media?${mediaQuery.toString()}`, { token }),
        adminApiWithMeta<{ sessions: MediaSession[] }>("/media/sessions?limit=100", { token }),
        adminApiWithMeta<{ quotas: QuotaRow[] }>("/media/quotas?limit=100", { token }),
        adminApiWithMeta<{ reconciliation: QuotaReconciliation }>("/media/quota-reconciliation", { token }),
      ]);
      setMedia(mediaResult.data.media ?? []);
      setSessions(sessionResult.data.sessions ?? []);
      setQuotas(quotaResult.data.quotas ?? []);
      setReconciliation(reconciliationResult.data.reconciliation ?? null);
    } catch (failure) {
      setError(message(failure, "Could not load media registry"));
      setNotice({ tone: "error", text: message(failure, "Could not load media registry") });
    } finally {
      setLoading(false);
    }
  }, [token, category, ownerId, setNotice]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="page-grid">
      <div className="section-heading">
        <div>
          <h3>Media registry</h3>
          <p>Read-only view of published objects, upload sessions and quota reservations. No signed URLs are shown.</p>
        </div>
        <button onClick={() => void load()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button>
      </div>

      {error && <div className="error-state">{error}</div>}

      <section className="panel">
        <div className="panel-header"><h3>Filters</h3></div>
        <div className="form-grid">
          <label>Category<input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="AVATAR" /></label>
          <label>Owner ID<input value={ownerId} onChange={(event) => setOwnerId(event.target.value)} placeholder="user or room id" /></label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h3>Objects</h3><span>{formatNumber(media.length)} shown</span></div>
        <div className="table-shell">
          <table>
            <thead><tr><th>Owner</th><th>Category</th><th>Bucket</th><th>Bytes</th><th>Visibility</th><th>Status</th><th>Version</th><th>Created</th></tr></thead>
            <tbody>
              {media.map((item) => (
                <tr key={item.id}>
                  <td>{item.ownerType}:{item.ownerId}</td>
                  <td>{item.category}</td>
                  <td>{item.bucket}</td>
                  <td>{formatNumber(item.bytes)}</td>
                  <td>{item.visibility}</td>
                  <td>{item.processingStatus}/{item.moderationStatus}</td>
                  <td>v{item.version}</td>
                  <td>{formatDate(item.createdAt ?? undefined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h3>Upload sessions</h3><span>{formatNumber(sessions.length)} shown</span></div>
        <div className="table-shell">
          <table>
            <thead><tr><th>User</th><th>Category</th><th>Status</th><th>Bytes</th><th>Quota held</th><th>Expires</th></tr></thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.userId}</td>
                  <td>{session.category}</td>
                  <td>{session.status}</td>
                  <td>{formatNumber(session.expectedBytes)}</td>
                  <td>{session.quotaReserved ? "Yes" : "No"}</td>
                  <td>{formatDate(session.expiresAt ?? undefined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><h3>Quota reservations</h3><span>{formatNumber(quotas.length)} shown</span></div>
        <div className="table-shell">
          <table>
            <thead><tr><th>User</th><th>Reserved bytes</th><th>Updated</th></tr></thead>
            <tbody>
              {quotas.map((quota) => (
                <tr key={quota.userId}>
                  <td>{quota.userId}</td>
                  <td>{formatNumber(quota.bytes)}</td>
                  <td>{formatDate(quota.updatedAt ?? undefined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h3>Quota reconciliation</h3>
          <span>
            {formatNumber(reconciliation?.driftCount ?? 0)} drift / {formatNumber(reconciliation?.staleSessions ?? 0)} stale sessions
          </span>
        </div>
        <div className="table-shell">
          <table>
            <thead><tr><th>User</th><th>Counter</th><th>Live sessions</th><th>Delta</th><th>Status</th></tr></thead>
            <tbody>
              {(reconciliation?.rows ?? []).map((row) => (
                <tr key={row.userId}>
                  <td>{row.userId}</td>
                  <td>{formatNumber(row.counterBytes)}</td>
                  <td>{formatNumber(row.expectedBytes)}</td>
                  <td>{formatNumber(row.deltaBytes)}</td>
                  <td>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
