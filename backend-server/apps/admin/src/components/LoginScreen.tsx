import { FormEvent, useState } from "react";
import { adminApi, login, Session } from "../api";

export function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("admin@yugm.local");
  const [password, setPassword] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [twoFactorAdminId, setTwoFactorAdminId] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorEmail, setTwoFactorEmail] = useState("");
  const [twoFactorName, setTwoFactorName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await login(email, password);
      if ((result as any).twoFactorRequired) {
        setTwoFactorToken((result as any).twoFactorToken);
        setTwoFactorAdminId((result as any).adminId);
        setTwoFactorEmail((result as any).email || email);
        setTwoFactorName((result as any).displayName || "");
        return;
      }
      onLogin(result as Session);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const submit2FA = async () => {
    if (!twoFactorCode.trim() || twoFactorCode.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const result = await adminApi<Session>("/auth/2fa/login", {
        method: "POST",
        body: JSON.stringify({ twoFactorToken, token: twoFactorCode.trim(), adminId: twoFactorAdminId })
      });
      onLogin(result);
    } catch (err: any) {
      setError(err.message || "2FA verification failed");
      setTwoFactorCode("");
    }
    setLoading(false);
  };

  if (twoFactorToken) {
    return (
      <div className="login-page">
        <section className="login-hero">
          <div className="brand-lockup">
            <div className="logo-mark">Y</div>
            <div>
              <h1>Yugm Admin</h1>
              <p>Two-factor authentication required.</p>
            </div>
          </div>
        </section>
        <form className="login-card" onSubmit={(e) => { e.preventDefault(); submit2FA(); }}>
          <div className="eyebrow">Security verification</div>
          <h2>Enter 2FA code</h2>
          <p>Open your authenticator app and enter the 6-digit code for {twoFactorEmail}.</p>
          <label>
            Authentication code
            <input value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder="000000" maxLength={6} autoFocus />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-action" disabled={loading || twoFactorCode.length !== 6}>
            {loading ? "Verifying..." : "Verify & sign in"}
          </button>
          <button type="button" className="ghost-button" style={{ marginTop: "8px", width: "100%" }} onClick={() => { setTwoFactorToken(""); setTwoFactorCode(""); setError(""); }}>
            Back to login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="brand-lockup">
          <div className="logo-mark">Y</div>
          <div>
            <h1>Yugm Admin</h1>
            <p>Trust, safety, wallet, and live-room control center.</p>
          </div>
        </div>
        <div className="hero-grid">
          <MiniSignal label="Live safety" value="Room watch" />
          <MiniSignal label="Wallet guard" value="Ledger only" />
          <MiniSignal label="Privacy" value="Audited reads" />
          <MiniSignal label="Roles" value="Granular RBAC" />
        </div>
      </section>
      <form className="login-card" onSubmit={submit}>
        <div className="eyebrow">Internal access</div>
        <h2>Sign in to command</h2>
        <p>Use an admin account seeded or invited through the backend.</p>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Enter admin password" />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button className="primary-action" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
      </form>
    </div>
  );
}

function MiniSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-signal">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
