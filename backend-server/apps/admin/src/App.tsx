import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  Coins,
  Crown,
  Gauge,
  Gift,
  LineChart,
  LifeBuoy,
  Lock,
  LogOut,
  MessageSquare,
  Palette,
  Radio,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  UserCog,
  Users,
  Wallet
} from "lucide-react";
import { Admin, adminApi, adminApiWithMeta, formatDate, formatNumber, login, refreshAdminSession, Session } from "./api";

type ViewKey =
  | "dashboard"
  | "users"
  | "reports"
  | "queue"
  | "trustVerifications"
  | "creatorKyc"
  | "payoutReviews"
  | "rooms"
  | "pk"
  | "messages"
  | "wallet"
  | "payments"
  | "gifts"
  | "cosmetics"
  | "notifications"
  | "growth"
  | "support"
  | "analytics"
  | "fraud"
  | "config"
  | "audit"
  | "admins"
  | "settings";

type Notice = { tone: "success" | "error" | "info"; text: string } | null;

const navItems: Array<{ key: ViewKey; label: string; icon: ReactNode; group: string; requiredPermission?: string }> = [
  { key: "dashboard", label: "Dashboard", icon: <Gauge />, group: "Control" },
  { key: "users", label: "Users", icon: <Users />, group: "Control" },
  { key: "reports", label: "Reports", icon: <AlertTriangle />, group: "Safety" },
  { key: "queue", label: "Moderation queue", icon: <Shield />, group: "Safety" },
  { key: "trustVerifications", label: "Trust verification", icon: <CheckCircle2 />, group: "Safety", requiredPermission: "trust_verification.read" },
  { key: "rooms", label: "Live rooms", icon: <Radio />, group: "Safety" },
  { key: "pk", label: "PK battles", icon: <Sparkles />, group: "Safety" },
  { key: "messages", label: "Messages", icon: <MessageSquare />, group: "Safety" },
  { key: "wallet", label: "Wallet", icon: <Wallet />, group: "Money" },
  { key: "creatorKyc", label: "Creator payout KYC", icon: <Lock />, group: "Money", requiredPermission: "creator_kyc.read" },
  { key: "payoutReviews", label: "Payout reviews", icon: <Coins />, group: "Money", requiredPermission: "payout_review.read" },
  { key: "payments", label: "Payments", icon: <Coins />, group: "Money" },
  { key: "gifts", label: "Gifts", icon: <Gift />, group: "Money" },
  { key: "cosmetics", label: "Cosmetics", icon: <Palette />, group: "Money" },
  { key: "notifications", label: "Notifications", icon: <Bell />, group: "Operations" },
  { key: "growth", label: "Growth OS", icon: <LineChart />, group: "Operations" },
  { key: "support", label: "Support", icon: <LifeBuoy />, group: "Operations" },
  { key: "analytics", label: "Analytics", icon: <BarChart3 />, group: "Intelligence" },
  { key: "fraud", label: "Fraud radar", icon: <Activity />, group: "Intelligence" },
  { key: "config", label: "App config", icon: <SlidersHorizontal />, group: "System" },
  { key: "audit", label: "Audit logs", icon: <Lock />, group: "System" },
  { key: "admins", label: "Admin users", icon: <UserCog />, group: "System" },
  { key: "settings", label: "Settings", icon: <Settings />, group: "System" }
];

const storedSession = () => {
  try {
    localStorage.removeItem("yugm.admin.session");
    const raw = sessionStorage.getItem("yugm.admin.session");
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
};

export function App() {
  const [session, setSession] = useState<Session | null>(storedSession);
  const [view, setView] = useState<ViewKey>("dashboard");
  const [notice, setNotice] = useState<Notice>(null);

  const saveSession = (next: Session | null) => {
    setSession(next);
    if (next) sessionStorage.setItem("yugm.admin.session", JSON.stringify(next));
    else sessionStorage.removeItem("yugm.admin.session");
  };

  useEffect(() => {
    if (!session?.refreshToken) return;
    const refresh = async () => {
      try {
        const next = await refreshAdminSession(session.refreshToken!);
        saveSession({ ...session, admin: next.admin, accessToken: next.accessToken });
      } catch {
        saveSession(null);
      }
    };
    const timer = window.setInterval(refresh, 12 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [session?.refreshToken]);

  if (!session) return <LoginScreen onLogin={saveSession} />;

  return (
    <div className="app-shell">
      <Sidebar current={view} onNavigate={setView} admin={session.admin} onLogout={() => saveSession(null)} />
      <main className="workspace">
        <Topbar view={view} admin={session.admin} notice={notice} onClearNotice={() => setNotice(null)} />
        <ViewRenderer view={view} session={session} setNotice={setNotice} onLogout={() => saveSession(null)} />
      </main>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("admin@yugm.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      onLogin(await login(email, password));
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

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

function Sidebar({ current, onNavigate, admin, onLogout }: { current: ViewKey; onNavigate: (view: ViewKey) => void; admin: Admin; onLogout: () => void }) {
  const visibleItems = navItems.filter((item) => !item.requiredPermission || admin.isSuperAdmin || admin.permissions.includes(item.requiredPermission));
  const groups = visibleItems.reduce<Record<string, typeof navItems>>((acc, item) => {
    acc[item.group] = [...(acc[item.group] || []), item];
    return acc;
  }, {});

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo-mark small">Y</div>
        <div>
          <strong>Yugm</strong>
          <span>Admin OS</span>
        </div>
      </div>
      <nav>
        {Object.entries(groups).map(([group, items]) => (
          <div className="nav-group" key={group}>
            <div className="nav-label">{group}</div>
            {items.map((item) => (
              <button key={item.key} className={`nav-item ${current === item.key ? "active" : ""}`} onClick={() => onNavigate(item.key)}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-user">
        <div className="avatar">{admin.displayName?.[0] || "A"}</div>
        <div>
          <strong>{admin.displayName}</strong>
          <span>{admin.role}</span>
        </div>
        <button className="icon-button" onClick={onLogout} title="Log out"><LogOut /></button>
      </div>
    </aside>
  );
}

function Topbar({ view, admin, notice, onClearNotice }: { view: ViewKey; admin: Admin; notice: Notice; onClearNotice: () => void }) {
  const item = navItems.find((entry) => entry.key === view);
  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">{item?.group || "Admin"}</div>
        <h2>{item?.label || "Dashboard"}</h2>
      </div>
      {notice && <button className={`notice ${notice.tone}`} onClick={onClearNotice}>{notice.text}</button>}
      <div className="topbar-admin">
        <Crown />
        <span>{admin.email}</span>
      </div>
    </header>
  );
}

function ViewRenderer({ view, session, setNotice, onLogout }: { view: ViewKey; session: Session; setNotice: (notice: Notice) => void; onLogout: () => void }) {
  if (view === "dashboard") return <Dashboard token={session.accessToken} />;
  if (view === "users") return <UsersPage token={session.accessToken} setNotice={setNotice} />;
  if (view === "reports") return <ReportsPage token={session.accessToken} setNotice={setNotice} />;
  if (view === "queue") return <SimpleResource token={session.accessToken} title="Moderation Queue" endpoint="/moderation/queue" columns={queueColumns} />;
  if (view === "trustVerifications") return <VerificationQueuePage kind="trust" token={session.accessToken} admin={session.admin} setNotice={setNotice} />;
  if (view === "creatorKyc") return <VerificationQueuePage kind="creator" token={session.accessToken} admin={session.admin} setNotice={setNotice} />;
  if (view === "payoutReviews") return <VerificationQueuePage kind="payout" token={session.accessToken} admin={session.admin} setNotice={setNotice} />;
  if (view === "rooms") return <RoomsPage token={session.accessToken} setNotice={setNotice} />;
  if (view === "pk") return <PkBattlesPage token={session.accessToken} setNotice={setNotice} />;
  if (view === "messages") return <SimpleResource token={session.accessToken} title="Room Messages" endpoint="/messages" columns={messageColumns} searchPlaceholder="Search keyword" searchParam="containsKeyword" />;
  if (view === "wallet") return <WalletPage token={session.accessToken} setNotice={setNotice} />;
  if (view === "payments") return <SimpleResource token={session.accessToken} title="Recharges" endpoint="/payments/recharges" columns={paymentColumns} />;
  if (view === "gifts") return <GiftsPage token={session.accessToken} setNotice={setNotice} />;
  if (view === "cosmetics") return <CosmeticsPage token={session.accessToken} setNotice={setNotice} />;
  if (view === "notifications") return <NotificationsPage token={session.accessToken} setNotice={setNotice} />;
  if (view === "growth") return <GrowthPage token={session.accessToken} />;
  if (view === "support") return <SupportPage token={session.accessToken} setNotice={setNotice} />;
  if (view === "analytics") return <AnalyticsPage token={session.accessToken} />;
  if (view === "fraud") return <FraudPage token={session.accessToken} />;
  if (view === "config") return <ConfigPage token={session.accessToken} setNotice={setNotice} />;
  if (view === "audit") return <SimpleResource token={session.accessToken} title="Audit Logs" endpoint="/audit-logs" columns={auditColumns} searchPlaceholder="Filter action" searchParam="action" />;
  if (view === "admins") return <AdminUsersPage token={session.accessToken} setNotice={setNotice} />;
  return <SettingsPage admin={session.admin} onLogout={onLogout} />;
}

function Dashboard({ token }: { token: string }) {
  const { data, loading, error, refresh } = useResource<any>("/dashboard/overview", token);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const cards = [
    ["Total users", data?.users?.total, "New today " + formatNumber(data?.users?.newToday), <Users />],
    ["Live rooms", data?.rooms?.liveNow, `${data?.rooms?.voiceLive || 0} voice / ${data?.rooms?.videoLive || 0} video`, <Radio />],
    ["Pending reports", data?.moderation?.pendingReports, `${data?.moderation?.criticalReports || 0} critical`, <Shield />],
    ["Coins spent", data?.wallet?.coinsSpentToday, `Gift value ${formatNumber(data?.wallet?.giftValueToday)}`, <Coins />],
    ["Revenue today", data?.revenue?.grossToday, `Month ${formatNumber(data?.revenue?.grossMonth)}`, <BarChart3 />],
    ["Suspended", data?.users?.suspended, `Banned ${formatNumber(data?.users?.banned)}`, <AlertTriangle />]
  ];

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Real-time control</div>
          <h1>Safety and operations, in one calm cockpit.</h1>
          <p>Review live rooms, money movement, user risk, and moderation pressure without losing the plot.</p>
        </div>
        <Sparkles className="hero-icon" />
      </section>
      <div className="stats-grid">
        {cards.map(([label, value, sub, icon]) => (
          <StatsCard key={String(label)} label={String(label)} value={formatNumber(value)} sub={String(sub)} icon={icon as ReactNode} />
        ))}
      </div>
      <DashboardStrips token={token} />
    </div>
  );
}

function DashboardStrips({ token }: { token: string }) {
  const live = useResource<any[]>("/dashboard/live-rooms", token);
  const moderation = useResource<any>("/dashboard/moderation", token);

  return (
    <div className="split-grid">
      <Panel title="Live rooms under watch" action="Open rooms">
        {(live.data || []).slice(0, 5).map((room: any) => (
          <div className="list-row" key={room._id}>
            <div>
              <strong>{room.title}</strong>
              <span>{room.type} / {room.participantCount || 0} live / {room.hostId?.username || "host"}</span>
            </div>
            <StatusBadge value={room.status} />
          </div>
        ))}
        {!live.loading && !(live.data || []).length && <EmptyState text="No live rooms right now." />}
      </Panel>
      <Panel title="Moderation pressure" action="Review queue">
        {(moderation.data?.reports || []).map((item: any) => (
          <div className="list-row" key={item._id || "unknown"}>
            <div>
              <strong>{item._id || "UNKNOWN"}</strong>
              <span>{formatNumber(item.count)} reports</span>
            </div>
            <RiskBadge value={item._id === "PENDING" ? "HIGH" : "LOW"} />
          </div>
        ))}
        {!moderation.loading && !(moderation.data?.reports || []).length && <EmptyState text="No report pressure." />}
      </Panel>
    </div>
  );
}

function StatsCard({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: ReactNode }) {
  return (
    <article className="stats-card">
      <div className="stats-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </article>
  );
}

function UsersPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [selected, setSelected] = useState<any>(null);
  const [reason, setReason] = useState("Community guidelines violation");
  const resource = useResourceWithMeta<any[]>("/users", token);

  const act = async (action: "warn" | "suspend" | "ban" | "unban") => {
    if (!selected) return;
    try {
      await adminApi(`/users/${selected._id || selected.id}/${action}`, {
        token,
        method: "POST",
        body: JSON.stringify(action === "unban" ? { reason } : { reason, durationHours: 24 })
      });
      setNotice({ tone: "success", text: `User ${action} complete` });
      setSelected(null);
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  const safetyAct = async (action: "shadow-ban" | "remove-shadow-ban" | "restrict-chat" | "restrict-rooms" | "freeze-wallet" | "unfreeze-wallet") => {
    if (!selected) return;
    try {
      await adminApi(`/users/${selected._id || selected.id}/${action}`, {
        token,
        method: "POST",
        body: JSON.stringify({ reason })
      });
      setNotice({ tone: "success", text: `${action} complete` });
      setSelected(null);
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  return (
    <ResourceFrame title="Users" subtitle="Search, inspect, and moderate user accounts." loading={resource.loading} error={resource.error} onRetry={resource.refresh}>
      <DataTable
        rows={resource.data || []}
        columns={userColumns}
        onRowClick={setSelected}
        actions={(row) => <button className="ghost-button" onClick={() => setSelected(row)}>Review</button>}
      />
      <Drawer open={Boolean(selected)} title={selected?.name || "User review"} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <ProfileSummary user={selected} />
            <label className="stacked-field">Action reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <div className="action-grid">
              <button onClick={() => act("warn")}>Warn</button>
              <button onClick={() => act("suspend")}>Suspend 24h</button>
              <button className="danger" onClick={() => act("ban")}>Ban</button>
              <button className="soft" onClick={() => act("unban")}>Unban</button>
            </div>
            <details style={{ marginTop: "12px" }}>
              <summary style={{ cursor: "pointer", fontSize: "13px", opacity: 0.7 }}>Safety controls</summary>
              <div className="action-grid" style={{ marginTop: "8px" }}>
                {selected.isShadowBanned
                  ? <button className="soft" onClick={() => safetyAct("remove-shadow-ban")}>Remove shadow ban</button>
                  : <button onClick={() => safetyAct("shadow-ban")}>Shadow ban</button>}
                {selected.isChatRestricted
                  ? <button className="soft" onClick={() => safetyAct("restrict-chat")}>Unrestrict chat</button>
                  : <button onClick={() => safetyAct("restrict-chat")}>Restrict chat</button>}
                {selected.isRoomRestricted
                  ? <button className="soft" onClick={() => safetyAct("restrict-rooms")}>Unrestrict rooms</button>
                  : <button onClick={() => safetyAct("restrict-rooms")}>Restrict rooms</button>}
                {selected.walletFrozen
                  ? <button className="soft" onClick={() => safetyAct("unfreeze-wallet")}>Unfreeze wallet</button>
                  : <button className="danger" onClick={() => safetyAct("freeze-wallet")}>Freeze wallet</button>}
              </div>
            </details>
          </>
        )}
      </Drawer>
    </ResourceFrame>
  );
}

function ReportsPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [selected, setSelected] = useState<any>(null);
  const [reason, setReason] = useState("Reviewed by admin");
  const resource = useResourceWithMeta<any[]>("/reports", token);

  const act = async (action: string) => {
    if (!selected) return;
    try {
      await adminApi(`/reports/${selected._id}/action`, {
        token,
        method: "POST",
        body: JSON.stringify({ action, reason, durationHours: 24 })
      });
      setNotice({ tone: "success", text: `Report action: ${action}` });
      setSelected(null);
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  return (
    <ResourceFrame title="Reports" subtitle="Review user, room, and content reports with audit-safe actions." loading={resource.loading} error={resource.error} onRetry={resource.refresh}>
      <DataTable rows={resource.data || []} columns={reportColumns} onRowClick={setSelected} actions={(row) => <button className="ghost-button" onClick={() => setSelected(row)}>Resolve</button>} />
      <Drawer open={Boolean(selected)} title="Report review" onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className="detail-card">
              <strong>{selected.reason}</strong>
              <p>{selected.description || "No description provided."}</p>
              <StatusBadge value={selected.status} />
            </div>
            <label className="stacked-field">Moderator note<textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <div className="action-grid">
              <button onClick={() => act("NO_ACTION")}>Dismiss</button>
              <button onClick={() => act("WARNING")}>Warn</button>
              <button onClick={() => act("SUSPEND_USER")}>Suspend</button>
              <button className="danger" onClick={() => act("BAN_USER")}>Ban</button>
              <button onClick={() => act("END_ROOM")}>End room</button>
              <button className="soft" onClick={() => act("ESCALATE")}>Escalate</button>
            </div>
          </>
        )}
      </Drawer>
    </ResourceFrame>
  );
}

function SupportPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [statusFilter, setStatusFilter] = useState("");
  const path = statusFilter ? `/support/tickets?status=${statusFilter}` : "/support/tickets";
  const resource = useResourceWithMeta<any[]>("/support/tickets", token);
  const [selected, setSelected] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      await adminApi(`/support/tickets/${selected._id}/respond`, {
        token, method: "POST", body: JSON.stringify({ message: reply })
      });
      setNotice({ tone: "success", text: "Reply sent" });
      setReply("");
      resource.refresh();
      setSelected(null);
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
    setSending(false);
  };

  const updateStatus = async (ticketId: string, status: string) => {
    try {
      await adminApi(`/support/tickets/${ticketId}/status`, {
        token, method: "PATCH", body: JSON.stringify({ status })
      });
      setNotice({ tone: "success", text: `Ticket ${status}` });
      resource.refresh();
      setSelected(null);
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  const [ticketDetail, setTicketDetail] = useState<any>(null);

  const loadTicketDetail = async (ticketId: string) => {
    try {
      const data = await adminApi<any>(`/support/tickets/${ticketId}`, { token });
      setTicketDetail(data.ticket);
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  useEffect(() => {
    if (selected) {
      loadTicketDetail(selected._id);
    } else {
      setTicketDetail(null);
    }
  }, [selected]);

  return (
    <ResourceFrame title="Support Tickets" subtitle="Respond to user support requests and manage ticket lifecycle." loading={resource.loading} error={resource.error} onRetry={resource.refresh}>
      <div className="filter-bar">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resource.refresh(); }}>
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>
      <DataTable rows={resource.data || []} columns={supportColumns} onRowClick={setSelected} />
      <Drawer open={Boolean(selected)} title={selected?.subject || "Ticket"} onClose={() => setSelected(null)}>
        {ticketDetail && (
          <>
            <div className="detail-card">
              <div className="detail-row"><strong>Subject:</strong> <span>{ticketDetail.subject}</span></div>
              <div className="detail-row"><strong>Category:</strong> <span>{ticketDetail.category}</span></div>
              <div className="detail-row"><strong>Priority:</strong> <RiskBadge value={ticketDetail.priority} /></div>
              <div className="detail-row"><strong>Status:</strong> <StatusBadge value={ticketDetail.status} /></div>
              {ticketDetail.userId && (
                <div className="detail-row"><strong>User:</strong> <span>{ticketDetail.userId?.username || ticketDetail.userId?.displayName || ticketDetail.userId?._id}</span></div>
              )}
            </div>

            <div className="detail-card">
              <strong>Conversation</strong>
              <div className="message-thread">
                <div className="message-bubble user">
                  <small>You</small>
                  <p>{ticketDetail.message}</p>
                  <small className="time">{formatDate(ticketDetail.createdAt)}</small>
                </div>
                {(ticketDetail.messages || []).map((msg: any, i: number) => (
                  <div key={i} className={`message-bubble ${msg.senderRole === "ADMIN" ? "admin" : "user"}`}>
                    <small>{msg.senderRole === "ADMIN" ? "Support Agent" : "User"}</small>
                    <p>{msg.message}</p>
                    <small className="time">{formatDate(msg.createdAt)}</small>
                  </div>
                ))}
              </div>
            </div>

            {ticketDetail.status !== "CLOSED" && (
              <div className="reply-section">
                <label className="stacked-field">
                  Reply
                  <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Type your response..." />
                </label>
                <div className="action-grid">
                  <button className="primary-action compact" disabled={sending || !reply.trim()} onClick={sendReply}>
                    {sending ? "Sending..." : "Send Reply"}
                  </button>
                  {ticketDetail.status === "OPEN" && (
                    <button className="ghost-button" onClick={() => updateStatus(ticketDetail._id, "RESOLVED")}>Resolve</button>
                  )}
                  {ticketDetail.status === "IN_PROGRESS" && (
                    <button className="ghost-button" onClick={() => updateStatus(ticketDetail._id, "RESOLVED")}>Resolve</button>
                  )}
                  {ticketDetail.status !== "CLOSED" && (
                    <button className="soft" onClick={() => updateStatus(ticketDetail._id, "CLOSED")}>Close</button>
                  )}
                </div>
              </div>
            )}

            {ticketDetail.status === "CLOSED" && (
              <button className="ghost-button" onClick={() => updateStatus(ticketDetail._id, "OPEN")}>Reopen</button>
            )}
          </>
        )}
      </Drawer>
    </ResourceFrame>
  );
}

function RoomsPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [selected, setSelected] = useState<any>(null);
  const resource = useResourceWithMeta<any[]>("/rooms/live", token);

  const endRoom = async () => {
    if (!selected) return;
    try {
      await adminApi(`/rooms/${selected._id}/end`, { token, method: "POST", body: JSON.stringify({ reason: "Ended by admin" }) });
      setNotice({ tone: "success", text: "Room ended" });
      setSelected(null);
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  return (
    <ResourceFrame title="Live Rooms" subtitle="Watch active voice/video rooms and intervene quickly." loading={resource.loading} error={resource.error} onRetry={resource.refresh}>
      <div className="room-grid">
        {(resource.data || []).map((room) => (
          <button className="room-card" key={room._id} onClick={() => setSelected(room)}>
            <div className="room-orb"><Radio /></div>
            <strong>{room.title}</strong>
            <span>{room.type} / {room.participantCount || 0} participants</span>
            <small>{room.hostId?.username || "unknown host"}</small>
          </button>
        ))}
      </div>
      <Drawer open={Boolean(selected)} title={selected?.title || "Room"} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className="detail-card">
              <StatusBadge value={selected.status} />
              <p>{selected.description || "No description."}</p>
              <p>{selected.category} / {selected.language} / max {selected.maxSpeakers} speakers</p>
            </div>
            <div className="action-grid">
              <button className="danger" onClick={endRoom}>End room</button>
              <button className="soft" onClick={() => setNotice({ tone: "info", text: "Room warning endpoint is ready from API." })}>Send warning</button>
            </div>
          </>
        )}
      </Drawer>
    </ResourceFrame>
  );
}

function PkBattlesPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [selected, setSelected] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [reason, setReason] = useState("Moderation review");
  const resource = useResource<any[]>("/pk/battles/live", token);

  useEffect(() => {
    if (!selected?.id) {
      setEvents([]);
      return;
    }
    adminApi<any[]>(`/pk/battles/${selected.id}/events`, { token })
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [selected?.id, token]);

  const endBattle = async () => {
    if (!selected) return;
    try {
      await adminApi(`/pk/battles/${selected.id}/end`, { token, method: "POST", body: JSON.stringify({ reason }) });
      setNotice({ tone: "success", text: "PK battle ended" });
      setSelected(null);
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  const flagBattle = async () => {
    if (!selected) return;
    try {
      await adminApi(`/pk/battles/${selected.id}/flag`, { token, method: "POST", body: JSON.stringify({ reason }) });
      setNotice({ tone: "success", text: "PK battle flagged" });
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  return (
    <ResourceFrame title="PK Battles" subtitle="Monitor live PK scores, event trails, and moderation actions." loading={resource.loading} error={resource.error} onRetry={resource.refresh}>
      <DataTable rows={resource.data || []} columns={pkColumns} onRowClick={setSelected} actions={(row) => <button className="ghost-button" onClick={() => setSelected(row)}>Inspect</button>} />
      <Drawer open={Boolean(selected)} title={selected?.title || selected?.battleCode || "PK battle"} onClose={() => setSelected(null)}>
        {selected && (
          <>
            <div className="detail-card">
              <StatusBadge value={selected.status} />
              <strong>{selected.left?.hostName} vs {selected.right?.hostName}</strong>
              <p>{formatNumber(selected.left?.score)} - {formatNumber(selected.right?.score)} / {selected.remainingSeconds || 0}s left</p>
              <p>{selected.battleType} / {selected.mode} / leader {selected.leader || "DRAW"}</p>
            </div>
            <label className="stacked-field">Moderation note<textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <div className="action-grid">
              <button className="danger" onClick={endBattle}>Force end PK</button>
              <button className="soft" onClick={flagBattle}>Flag for review</button>
            </div>
            <Panel title="Event trail" action={`${events.length} events`}>
              {events.slice(0, 12).map((event) => (
                <div className="list-row" key={event._id || event.id}>
                  <div>
                    <strong>{event.eventType}</strong>
                    <span>{event.side || "BATTLE"} / +{formatNumber(event.points)} / {formatDate(event.createdAt)}</span>
                  </div>
                  <StatusBadge value={event.side || "PK"} />
                </div>
              ))}
              {!events.length && <EmptyState text="No events recorded yet." />}
            </Panel>
          </>
        )}
      </Drawer>
    </ResourceFrame>
  );
}

function WalletPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState(100);
  const [reason, setReason] = useState("Admin adjustment");
  const resource = useResourceWithMeta<any[]>("/wallet/transactions", token);

  const adjust = async (type: "CREDIT" | "DEBIT") => {
    try {
      await adminApi(`/wallet/users/${userId}/adjust`, {
        token,
        method: "POST",
        body: JSON.stringify({ type, amount, reason })
      });
      setNotice({ tone: "success", text: `${type} adjustment created` });
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  return (
    <div className="page-grid">
      <Panel title="Manual ledger adjustment" action="Finance only">
        <div className="form-grid">
          <label>User ID<input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Mongo user id" /></label>
          <label>Amount<input type="number" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label>
          <label className="full">Reason<input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        </div>
        <div className="action-row">
          <button onClick={() => adjust("CREDIT")}>Credit</button>
          <button className="danger" onClick={() => adjust("DEBIT")}>Debit</button>
        </div>
      </Panel>
      <SimpleResource token={token} title="Wallet Transactions" endpoint="/wallet/transactions" columns={walletColumns} />
    </div>
  );
}

function GiftsPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🎁");
  const [coinPrice, setCoinPrice] = useState(99);
  const resource = useResource<any[]>("/gifts", token);

  const createGift = async () => {
    try {
      await adminApi("/gifts", { token, method: "POST", body: JSON.stringify({ name, icon, coinPrice, isActive: true }) });
      setName("");
      setNotice({ tone: "success", text: "Gift created" });
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  return (
    <div className="page-grid">
      <Panel title="Create gift" action="Catalog">
        <div className="form-grid">
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Icon<input value={icon} onChange={(event) => setIcon(event.target.value)} /></label>
          <label>Coin price<input type="number" value={coinPrice} onChange={(event) => setCoinPrice(Number(event.target.value))} /></label>
        </div>
        <button className="primary-action compact" onClick={createGift}>Create gift</button>
      </Panel>
      <ResourceFrame title="Gift Catalog" loading={resource.loading} error={resource.error} onRetry={resource.refresh}>
        <DataTable rows={resource.data || []} columns={giftColumns} />
      </ResourceFrame>
    </div>
  );
}

function CosmeticsPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [selected, setSelected] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const resource = useResource<any>("/cosmetics", token);
  const cosmetics = resource.data?.data ?? [];

  const [form, setForm] = useState({
    id: "",
    type: "AVATAR_FRAME",
    name: "",
    coinPrice: 100,
    rarity: "COMMON",
    preview: "",
    isActive: true,
    assetKind: "",
    assetUrl: ""
  });

  const openNew = () => {
    setForm({ id: "", type: "AVATAR_FRAME", name: "", coinPrice: 100, rarity: "COMMON", preview: "", isActive: true, assetKind: "", assetUrl: "" });
    setEditMode(true);
    setSelected(null);
  };

  const openEdit = (cosmetic: any) => {
    setForm({
      id: cosmetic._id || cosmetic.id,
      type: cosmetic.type,
      name: cosmetic.name,
      coinPrice: cosmetic.coinPrice,
      rarity: cosmetic.rarity,
      preview: cosmetic.preview || "",
      isActive: cosmetic.isActive !== false,
      assetKind: cosmetic.assetKind || "",
      assetUrl: cosmetic.assetUrl || ""
    });
    setEditMode(true);
    setSelected(cosmetic);
  };

  const save = async () => {
    try {
      if (selected) {
        const { id, ...body } = form;
        await adminApi(`/cosmetics/${selected._id || selected.id}`, { token, method: "PUT", body: JSON.stringify(body) });
        setNotice({ tone: "success", text: "Cosmetic updated" });
      } else {
        await adminApi("/cosmetics", { token, method: "POST", body: JSON.stringify(form) });
        setNotice({ tone: "success", text: "Cosmetic created" });
      }
      setEditMode(false);
      setSelected(null);
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  const remove = async (cosmetic: any) => {
    if (!window.confirm(`Delete "${cosmetic.name}"? This cannot be undone.`)) return;
    try {
      await adminApi(`/cosmetics/${cosmetic._id || cosmetic.id}`, { token, method: "DELETE" });
      setNotice({ tone: "success", text: "Cosmetic deleted" });
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  const seedFromCode = async () => {
    if (!window.confirm("Seed all code-defined cosmetics into the database? Only works if empty.")) return;
    try {
      const result = await adminApi<any>("/cosmetics/seed", { token, method: "POST" });
      setNotice({ tone: "success", text: `Seeded ${result.data?.seeded || 0} cosmetics` });
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  const types = ["AVATAR_ASSET", "AVATAR_FRAME", "SPEAKING_WAVE", "PROFILE_THEME", "ENTRANCE_EFFECT", "PROFILE_BADGE", "NAME_STYLE", "ROOM_ENTRY", "MOOD_STATUS", "PROFILE_MUSIC", "VOICE_BADGE", "ROOM_THEME", "AVATAR_DECORATION", "REACTION_PACK", "PROFILE_LAYOUT", "INTRO_CARD", "COLLECTIBLE_TITLE", "GIFT_SHELF", "CHAT_BUBBLE", "SEASONAL_EVENT", "CALL_SCREEN", "ROOM_BADGE", "ROOM_AMBIENCE"];

  return (
    <div className="page-grid">
      <div className="section-heading">
        <div>
          <h3>Cosmetics Catalog</h3>
          <p>Create, edit, and manage profile cosmetics that users can purchase in the store.</p>
        </div>
        <div className="action-row">
          <button className="ghost-button" onClick={seedFromCode}>Seed from code</button>
          <button className="primary-action compact" onClick={openNew}>New cosmetic</button>
        </div>
      </div>
      <ResourceFrame title="" loading={resource.loading} error={resource.error} onRetry={resource.refresh}>
        <DataTable
          rows={cosmetics}
          columns={[
            { key: "_id", label: "ID" },
            { key: "name", label: "Name" },
            { key: "type", label: "Type", render: (row) => <StatusBadge value={row.type} /> },
            { key: "rarity", label: "Rarity", render: (row) => <RiskBadge value={row.rarity} /> },
            { key: "coinPrice", label: "Price", render: (row) => formatNumber(row.coinPrice) },
            { key: "isActive", label: "Active", render: (row) => <StatusBadge value={row.isActive ? "ACTIVE" : "DISABLED"} /> },
            { key: "createdAt", label: "Created" }
          ]}
          actions={(row) => (
            <div className="action-row">
              <button className="ghost-button" onClick={() => openEdit(row)}>Edit</button>
              <button className="soft danger" onClick={() => remove(row)}>Delete</button>
            </div>
          )}
        />
      </ResourceFrame>

      <Drawer open={editMode} title={selected ? "Edit cosmetic" : "New cosmetic"} onClose={() => { setEditMode(false); setSelected(null); }}>
        <div className="form-grid">
          {!selected && (
            <label>ID<input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="unique_cosmetic_id" /></label>
          )}
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
          <label>Price<input type="number" value={form.coinPrice} onChange={(e) => setForm({ ...form, coinPrice: Number(e.target.value) })} /></label>
          <label>Rarity<select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })}><option>COMMON</option><option>RARE</option><option>EPIC</option><option>LEGENDARY</option></select></label>
          <label>Preview<input value={form.preview} onChange={(e) => setForm({ ...form, preview: e.target.value })} placeholder="Short preview text or image hint" /></label>
          <label>Active<select value={String(form.isActive)} onChange={(e) => setForm({ ...form, isActive: e.target.value === "true" })}><option value="true">Yes</option><option value="false">No</option></select></label>
          <label>Asset kind<input value={form.assetKind} onChange={(e) => setForm({ ...form, assetKind: e.target.value })} placeholder="STATIC, ANIMATED" /></label>
          <label className="full">Asset URL<input value={form.assetUrl} onChange={(e) => setForm({ ...form, assetUrl: e.target.value })} placeholder="https://..." /></label>
        </div>
        <button className="primary-action compact" onClick={save} style={{ marginTop: "12px" }}>{selected ? "Update" : "Create"}</button>
      </Drawer>
    </div>
  );
}

function NotificationsPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState("all_users");

  const send = async () => {
    try {
      const endpoint = segment === "all_users" ? "/notifications/send-all" : "/notifications/send-segment";
      await adminApi(endpoint, { token, method: "POST", body: JSON.stringify({ title, body, type: "SYSTEM", segment }) });
      setNotice({ tone: "success", text: "Notification sent" });
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  return (
    <Panel title="Notification Composer" action="Campaigns">
      <div className="composer-card">
        <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Late Night Talks is live" /></label>
        <label>Body<textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Join rooms matching your vibe now." /></label>
        <label>Segment<select value={segment} onChange={(event) => setSegment(event.target.value)}><option value="all_users">All users</option><option value="hosts">Hosts</option><option value="city">City</option></select></label>
        <button className="primary-action compact" onClick={send}>Send notification</button>
      </div>
    </Panel>
  );
}

function GrowthPage({ token }: { token: string }) {
  const { data, loading, error, refresh } = useResource<any>("/dashboard/experience", token);
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  const adoption = data?.adoption || {};
  const economy = data?.creatorEconomy || {};
  const leaders = data?.gamification?.levelLeaders || [];
  const creators = economy.topCreators || [];

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Experience growth</div>
          <h1>Creator, retention, and safety signals</h1>
          <p>One operating view for the new social graph, scheduled rooms, creator earnings, missions, notifications, and safety load.</p>
        </div>
        <div className="hero-grid compact">
          <MiniSignal label="Gift coins" value={formatNumber(economy.giftCoins)} />
          <MiniSignal label="Gift events" value={formatNumber(economy.giftCount)} />
          <MiniSignal label="Est. INR" value={formatNumber(economy.estimatedInr)} />
          <MiniSignal label="Window" value={`${data?.windowDays || 30} days`} />
        </div>
      </section>

      <div className="stats-grid">
        <StatsCard label="Scheduled rooms" value={formatNumber(adoption.scheduledRooms)} sub="Upcoming creator sessions" icon={<Radio />} />
        <StatsCard label="Private rooms" value={formatNumber(adoption.privateRooms)} sub="Locked or invite-led spaces" icon={<Lock />} />
        <StatsCard label="Speaker requests" value={formatNumber(adoption.speakerRequests)} sub="Audience to stage intent" icon={<MessageSquare />} />
        <StatsCard label="Room invites" value={formatNumber(adoption.invites)} sub="Social graph activation" icon={<Users />} />
        <StatsCard label="New follows" value={formatNumber(adoption.follows)} sub="30-day graph growth" icon={<Sparkles />} />
        <StatsCard label="Safety queue" value={formatNumber(adoption.pendingModeration)} sub="Open moderation work" icon={<Shield />} />
      </div>

      <div className="split-grid">
        <Panel title="Top creators" action="Gift income">
          <DataTable
            rows={creators}
            columns={[
              { key: "creator.name", label: "Creator" },
              { key: "coins", label: "Coins" },
              { key: "gifts", label: "Gifts" }
            ]}
          />
        </Panel>
        <Panel title="Level leaders" action="Gamification">
          <DataTable
            rows={leaders}
            columns={[
              { key: "name", label: "User" },
              { key: "level", label: "Level" },
              { key: "xp", label: "XP" },
              { key: "followersCount", label: "Followers" }
            ]}
          />
        </Panel>
      </div>

      <Panel title="Recommendations" action="Next moves">
        <div className="signal-list">
          {(data?.recommendations || []).map((item: string) => (
            <div className="signal-row" key={item}>
              <CheckCircle2 />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AnalyticsPage({ token }: { token: string }) {
  const [metric, setMetric] = useState("users");
  const resource = useResource<any>(`/analytics/${metric}`, token);

  return (
    <div className="page-grid">
      <div className="tab-strip">
        {["users", "rooms", "messages", "wallet", "gifts", "reports", "revenue"].map((item) => (
          <button key={item} className={metric === item ? "active" : ""} onClick={() => setMetric(item)}>{item}</button>
        ))}
      </div>
      <Panel title={`${metric} analytics`} action="30 day window">
        {resource.loading ? <LoadingState /> : <pre className="json-panel">{JSON.stringify(resource.data, null, 2)}</pre>}
      </Panel>
    </div>
  );
}

function FraudPage({ token }: { token: string }) {
  return (
    <div className="split-grid">
      <SimpleResource token={token} title="Suspicious Users" endpoint="/fraud/suspicious-users" columns={fraudColumns} />
      <SimpleResource token={token} title="Suspicious Wallets" endpoint="/fraud/suspicious-wallets" columns={fraudColumns} />
    </div>
  );
}

function ConfigPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [key, setKey] = useState("maintenance_mode");
  const [value, setValue] = useState("false");
  const resource = useResource<any[]>("/config", token);

  const save = async () => {
    try {
      const parsed = value === "true" ? true : value === "false" ? false : Number.isFinite(Number(value)) ? Number(value) : value;
      await adminApi(`/config/${key}`, { token, method: "PUT", body: JSON.stringify({ value: parsed }) });
      setNotice({ tone: "success", text: "Config saved" });
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  return (
    <div className="page-grid">
      <Panel title="Config editor" action="Settings">
        <div className="form-grid">
          <label>Key<input value={key} onChange={(event) => setKey(event.target.value)} /></label>
          <label>Value<input value={value} onChange={(event) => setValue(event.target.value)} /></label>
        </div>
        <button className="primary-action compact" onClick={save}>Save config</button>
      </Panel>
      <ResourceFrame title="App Config" loading={resource.loading} error={resource.error} onRetry={resource.refresh}>
        <DataTable rows={resource.data || []} columns={configColumns} />
      </ResourceFrame>
    </div>
  );
}

function AdminUsersPage({ token, setNotice }: { token: string; setNotice: (notice: Notice) => void }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("MODERATOR");
  const [invitationToken, setInvitationToken] = useState("");
  const resource = useResource<any[]>("/admin-users", token);

  const invite = async () => {
    try {
      const result = await adminApi<any>("/auth/invite", { token, method: "POST", body: JSON.stringify({ email, displayName, role }) });
      setInvitationToken(result.invitationToken ?? "");
      setNotice({ tone: "success", text: "Admin invited" });
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message });
    }
  };

  return (
    <div className="page-grid">
      <Panel title="Invite admin" action="RBAC">
        <div className="form-grid">
          <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
          <label>Role<select value={role} onChange={(event) => setRole(event.target.value)}><option>MODERATOR</option><option>FINANCE_MANAGER</option><option>SUPPORT_AGENT</option><option>CONTENT_REVIEWER</option><option>ANALYST</option><option>ADMIN</option></select></label>
        </div>
        <button className="primary-action compact" onClick={invite}>Invite</button>
        {invitationToken && <div className="detail-card"><strong>One-time invitation token</strong><p>Send this through a secure channel. It expires in 72 hours and cannot be recovered later.</p><input value={invitationToken} readOnly onFocus={(event) => event.currentTarget.select()} /></div>}
      </Panel>
      <ResourceFrame title="Admin Users" loading={resource.loading} error={resource.error} onRetry={resource.refresh}>
        <DataTable rows={resource.data || []} columns={adminColumns} />
      </ResourceFrame>
    </div>
  );
}

function SettingsPage({ admin, onLogout }: { admin: Admin; onLogout: () => void }) {
  return (
    <Panel title="Session and Security" action="Admin">
      <div className="settings-grid">
        <div className="detail-card"><strong>{admin.displayName}</strong><p>{admin.email}</p><StatusBadge value={admin.role} /></div>
        <div className="detail-card"><strong>Permissions</strong><p>{admin.permissions.length} permissions available.</p></div>
        <button className="danger" onClick={onLogout}>Log out</button>
      </div>
    </Panel>
  );
}

function VerificationQueuePage({ kind, token, admin, setNotice }: { kind: "trust" | "creator" | "payout"; token: string; admin: Admin; setNotice: (notice: Notice) => void }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const config = kind === "trust" ? {
    title: "Yugm Trust Verification",
    subtitle: "Face, voice, consent, and liveness review for platform trust. This is not payout KYC.",
    endpoint: "/trust-verifications",
    key: "trustVerifications",
    statuses: ["INCOMPLETE", "PENDING_REVIEW", "VERIFIED", "REJECTED", "NEEDS_RETRY", "SUSPENDED"],
    columns: trustVerificationColumns
  } : kind === "creator" ? {
    title: "Creator Payout KYC",
    subtitle: "Finance-only payout eligibility review. PAN, UPI, and bank identifiers remain masked in browser responses.",
    endpoint: "/creator-kyc",
    key: "creatorKyc",
    statuses: ["NOT_SUBMITTED", "PENDING", "VERIFIED", "REJECTED", "NEEDS_RETRY", "EXPIRED", "MANUAL_REVIEW"],
    columns: creatorKycColumns
  } : {
    title: "Payout Reviews",
    subtitle: "Combined trust, KYC, wallet, reports, and fraud decision queue.",
    endpoint: "/payout-reviews",
    key: "payoutReviews",
    statuses: ["PENDING", "APPROVED", "REJECTED", "NEEDS_MANUAL_REVIEW", "BLOCKED", "PAID"],
    columns: payoutReviewColumns
  };

  const path = `${config.endpoint}${status ? `?status=${encodeURIComponent(status)}` : ""}`;
  const resource = useResourceWithMeta<any>(path, token);
  const rows = resource.data?.[config.key] ?? [];

  const hasPermission = (...permissions: string[]) => admin.isSuperAdmin || permissions.some((permission) => admin.permissions.includes(permission));
  const runAction = async (row: any, action: string, body: Record<string, string | undefined> = {}) => {
    const id = kind === "creator" ? (row.user?._id || row.user?.id || row.userId) : (row.id || row._id);
    const actionKey = `${id}:${action}`;
    setBusy(actionKey);
    try {
      await adminApi(`${config.endpoint}/${id}/${action}`, { token, method: "POST", body: JSON.stringify(body) });
      setNotice({ tone: "success", text: `${config.title}: ${action.split("-").join(" ")} complete` });
      setSelected(null);
      resource.refresh();
    } catch (err: any) {
      setNotice({ tone: "error", text: err.message || "Review action failed" });
    } finally {
      setBusy("");
    }
  };

  const promptNotes = () => window.prompt("Optional internal notes", "") ?? undefined;
  const actionsFor = (row: any) => {
    const id = kind === "creator" ? (row.user?._id || row.user?.id || row.userId) : (row.id || row._id);
    const actionButton = (action: string, label: string, getBody: () => Record<string, string | undefined>, className = "ghost-button") => (
      <button className={className} disabled={Boolean(busy)} onClick={() => runAction(row, action, getBody())}>{busy === `${id}:${action}` ? "Working…" : label}</button>
    );

    if (kind === "creator") {
      const reviewable = ["PENDING", "MANUAL_REVIEW", "NEEDS_RETRY", "REJECTED"].includes(row.kycStatus);
      return <div className="action-row">
        {reviewable && hasPermission("creator_kyc.approve") ? actionButton("approve", "Approve", () => ({ adminNotes: promptNotes() })) : null}
        {reviewable && hasPermission("creator_kyc.reject") ? <button className="danger" disabled={Boolean(busy)} onClick={() => {
          const reason = window.prompt("Rejection reason");
          if (reason?.trim()) runAction(row, "reject", { rejectionReason: reason.trim(), adminNotes: promptNotes() });
        }}>Reject</button> : null}
        {reviewable && hasPermission("creator_kyc.review") ? <button className="soft" disabled={Boolean(busy)} onClick={() => runAction(row, "request-retry", { rejectionReason: window.prompt("What should the creator correct?") ?? undefined })}>Retry</button> : null}
        {row.payoutStatus === "ENABLED" && hasPermission("creator_kyc.review") ? actionButton("freeze-payout", "Freeze", () => ({ adminNotes: promptNotes() }), "danger") : null}
        {row.kycStatus === "VERIFIED" && row.payoutStatus !== "ENABLED" && hasPermission("creator_kyc.approve") ? actionButton("enable-payout", "Enable", () => ({ adminNotes: promptNotes() })) : null}
      </div>;
    }

    if (kind === "payout") {
      const pending = row.status === "PENDING" || row.status === "NEEDS_MANUAL_REVIEW";
      return <div className="action-row">
        {pending && hasPermission("payout_review.approve", "withdrawals.approve") ? actionButton("approve", "Approve", () => ({ adminNotes: promptNotes() })) : null}
        {pending && hasPermission("payout_review.reject", "withdrawals.reject") ? <button className="danger" disabled={Boolean(busy)} onClick={() => {
          const reason = window.prompt("Rejection reason");
          if (reason?.trim()) runAction(row, "reject", { rejectionReason: reason.trim(), adminNotes: promptNotes() });
        }}>Reject</button> : null}
        {row.status === "PENDING" && hasPermission("payout_review.read") ? actionButton("manual-review", "Manual", () => ({ adminNotes: promptNotes() }), "soft") : null}
        {row.status === "APPROVED" && hasPermission("payout_review.approve", "withdrawals.approve") ? <button className="ghost-button" disabled={Boolean(busy)} onClick={() => {
          const payoutReference = window.prompt("Payout transaction reference");
          if (payoutReference?.trim()) runAction(row, "mark-paid", { payoutReference: payoutReference.trim(), adminNotes: promptNotes() });
        }}>Mark paid</button> : null}
      </div>;
    }

    return null;
  };

  return (
    <ResourceFrame title={config.title} subtitle={config.subtitle} loading={resource.loading} error={resource.error} onRetry={resource.refresh}>
      <div className="filter-bar">
        <Shield />
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {config.statuses.map((item) => <option key={item} value={item}>{item.split("_").join(" ")}</option>)}
        </select>
        <span>{formatNumber(resource.meta?.pagination?.total ?? rows.length)} records</span>
      </div>
      <DataTable rows={rows} columns={config.columns} onRowClick={kind === "creator" || kind === "payout" ? setSelected : undefined} actions={kind === "creator" || kind === "payout" ? actionsFor : undefined} />
      <Drawer open={Boolean(selected)} title={kind === "creator" ? "Creator payout profile" : "Payout review detail"} onClose={() => setSelected(null)}>
        {selected && kind === "creator" ? (
          <>
            <div className="review-hero">
              <div className="avatar">{selected.user?.name?.[0] || selected.legalFullName?.[0] || "C"}</div>
              <div><div className="eyebrow">Creator KYC</div><h3>{selected.user?.name || selected.legalFullName || "Creator"}</h3><p>@{selected.user?.username || "unknown"}</p></div>
              <StatusBadge value={selected.kycStatus} />
            </div>
            <div className="verification-detail-grid">
              <ReviewDetail label="Legal name" value={selected.legalFullName} />
              <ReviewDetail label="Payout status" value={selected.payoutStatus} status />
              <ReviewDetail label="PAN" value={selected.panLast4 ? `••••${selected.panLast4}` : null} />
              <ReviewDetail label="UPI" value={selected.upiIdMasked} />
              <ReviewDetail label="Bank" value={selected.bankAccountLast4 ? `••••${selected.bankAccountLast4}` : null} />
              <ReviewDetail label="IFSC" value={selected.bankIfsc} />
              <ReviewDetail label="Submitted" value={formatDate(selected.submittedAt)} />
              <ReviewDetail label="Sensitive fields" value="Masked in all browser responses" />
            </div>
            {selected.rejectionReason && <div className="review-warning"><strong>Previous review note</strong><p>{selected.rejectionReason}</p></div>}
            <div className="drawer-action-section"><strong>Finance actions</strong>{actionsFor(selected)}</div>
          </>
        ) : selected && kind === "payout" ? (
          <>
            <div className="review-hero">
              <div className="avatar">{selected.user?.name?.[0] || "P"}</div>
              <div><div className="eyebrow">Settlement review</div><h3>{selected.user?.name || selected.user?.username || "Creator"}</h3><p>{formatNumber(selected.withdrawal?.amountCoins)} coins · ₹{Number(selected.withdrawal?.amountInr || 0).toFixed(2)}</p></div>
              <StatusBadge value={selected.status} />
            </div>
            <div className="verification-detail-grid">
              <ReviewDetail label="Trust verified" value={selected.trustVerified ? "Yes" : "No"} status />
              <ReviewDetail label="KYC verified" value={selected.kycVerified ? "Yes" : "No"} status />
              <ReviewDetail label="Wallet safe" value={selected.walletSafe ? "Yes" : "No"} status />
              <ReviewDetail label="Reports safe" value={selected.reportsSafe ? "Yes" : "No"} status />
              <ReviewDetail label="Fraud safe" value={selected.fraudSafe ? "Yes" : "No"} status />
              <ReviewDetail label="Risk score" value={String(selected.riskScore ?? 0)} />
              <ReviewDetail label="Requested" value={formatDate(selected.createdAt)} />
              <ReviewDetail label="Review ID" value={selected.id || selected._id} />
            </div>
            <div className="review-warning risk"><strong>Risk signals</strong><p>{selected.riskFlags?.length ? selected.riskFlags.join(" · ") : "No automated risk flags."}</p></div>
            <div className="drawer-action-section"><strong>Settlement actions</strong>{actionsFor(selected)}</div>
          </>
        ) : null}
      </Drawer>
    </ResourceFrame>
  );
}

function ReviewDetail({ label, value, status }: { label: string; value: ReactNode; status?: boolean }) {
  return <div className="review-detail"><span>{label}</span>{status ? <StatusBadge value={String(value || "Unknown")} /> : <strong>{value || "—"}</strong>}</div>;
}

function SimpleResource({ token, title, endpoint, columns, searchPlaceholder, searchParam }: { token: string; title: string; endpoint: string; columns: ColumnDef[]; searchPlaceholder?: string; searchParam?: string }) {
  const [search, setSearch] = useState("");
  const path = search && searchParam ? `${endpoint}?${searchParam}=${encodeURIComponent(search)}` : endpoint;
  const resource = useResourceWithMeta<any[]>(path, token);

  return (
    <ResourceFrame title={title} loading={resource.loading} error={resource.error} onRetry={resource.refresh}>
      {searchParam && (
        <div className="filter-bar">
          <Search />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder || "Search"} />
        </div>
      )}
      <DataTable rows={resource.data || []} columns={columns} />
    </ResourceFrame>
  );
}

function ResourceFrame({ title, subtitle, loading, error, onRetry, children }: { title: string; subtitle?: string; loading?: boolean; error?: string; onRetry?: () => void; children: ReactNode }) {
  return (
    <section className="resource-frame">
      <div className="section-heading">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {onRetry && <button className="ghost-button" onClick={onRetry}>Refresh</button>}
      </div>
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={onRetry} /> : children}
    </section>
  );
}

type ColumnDef = { key: string; label: string; render?: (row: any) => ReactNode };

function DataTable({ rows, columns, actions, onRowClick }: { rows: any[]; columns: ColumnDef[]; actions?: (row: any) => ReactNode; onRowClick?: (row: any) => void }) {
  if (!rows.length) return <EmptyState text="Nothing to show yet." />;
  return (
    <div className="table-shell">
      <table>
        <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}{actions && <th />}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row._id || row.id || index} onClick={() => onRowClick?.(row)}>
              {columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : valueAt(row, column.key)}</td>)}
              {actions && <td className="actions-cell" onClick={(event) => event.stopPropagation()}>{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function valueAt(row: any, key: string) {
  const value = key.split(".").reduce((acc, part) => acc?.[part], row);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (key.toLowerCase().includes("at")) return formatDate(value);
  if (value && typeof value === "object") return value.name || value.username || value.email || value._id || JSON.stringify(value);
  return value ?? "—";
}

function Panel({ title, action, children }: { title: string; action?: string; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{title}</h3>
        {action && <span>{action}</span>}
      </div>
      {children}
    </section>
  );
}

function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header"><h3>{title}</h3><button onClick={onClose}>Close</button></div>
        {children}
      </aside>
    </div>
  );
}

function ProfileSummary({ user }: { user: any }) {
  return (
    <div className="profile-summary">
      <div className="avatar large">{user.name?.[0] || "U"}</div>
      <div>
        <strong>{user.name}</strong>
        <span>@{user.username}</span>
        <p>{user.bio || "No bio"}</p>
      </div>
      <RiskBadge value={user.isBlocked ? "CRITICAL" : user.suspendedUntil ? "HIGH" : "LOW"} />
    </div>
  );
}

function StatusBadge({ value }: { value?: string }) {
  const text = String(value || "UNKNOWN");
  return <span className={`status-badge ${text.toLowerCase()}`}>{text}</span>;
}

function RiskBadge({ value }: { value?: string }) {
  const text = String(value || "LOW");
  return <span className={`risk-badge ${text.toLowerCase()}`}>{text}</span>;
}

function LoadingState() {
  return <div className="loading-state"><div className="spinner" />Loading data...</div>;
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div className="error-state"><strong>{message}</strong>{onRetry && <button onClick={onRetry}>Retry</button>}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function useResource<T>(path: string, token: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    adminApi<T>(path, { token })
      .then((value) => { if (!cancelled) setData(value); })
      .catch((err) => { if (!cancelled) setError(err.message || "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, token, version]);

  return { data, loading, error, refresh: () => setVersion((value) => value + 1) };
}

function useResourceWithMeta<T>(path: string, token: string) {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    adminApiWithMeta<T>(path, { token })
      .then((value) => { if (!cancelled) { setData(value.data); setMeta(value.meta); } })
      .catch((err) => { if (!cancelled) setError(err.message || "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [path, token, version]);

  return { data, meta, loading, error, refresh: () => setVersion((value) => value + 1) };
}

const userColumns: ColumnDef[] = [
  { key: "name", label: "Name", render: (row) => <div className="person-cell"><span className="avatar mini">{row.name?.[0] || "U"}</span><div><strong>{row.name}</strong><span>@{row.username}</span></div></div> },
  { key: "city", label: "City" },
  { key: "role", label: "Role" },
  { key: "walletBalance", label: "Wallet", render: (row) => formatNumber(row.walletBalance) },
  { key: "isBlocked", label: "Status", render: (row) => <StatusBadge value={row.isBlocked ? "BANNED" : row.suspendedUntil ? "SUSPENDED" : "ACTIVE"} /> },
  { key: "createdAt", label: "Joined" }
];

const reportColumns: ColumnDef[] = [
  { key: "reason", label: "Reason" },
  { key: "reporterId.username", label: "Reporter" },
  { key: "targetUserId.username", label: "Target" },
  { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  { key: "riskScore", label: "Risk", render: (row) => <RiskBadge value={row.riskScore >= 80 ? "CRITICAL" : row.riskScore >= 50 ? "HIGH" : "MEDIUM"} /> },
  { key: "createdAt", label: "Created" }
];

const queueColumns: ColumnDef[] = [
  { key: "targetType", label: "Target" },
  { key: "priority", label: "Priority", render: (row) => <RiskBadge value={row.priority} /> },
  { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  { key: "reason", label: "Reason" },
  { key: "createdAt", label: "Created" }
];

const messageColumns: ColumnDef[] = [
  { key: "senderId.username", label: "Sender" },
  { key: "message", label: "Message" },
  { key: "roomId.title", label: "Room" },
  { key: "createdAt", label: "Sent" }
];

const pkColumns: ColumnDef[] = [
  { key: "battleCode", label: "Code" },
  { key: "left.hostName", label: "Left host" },
  { key: "right.hostName", label: "Right host" },
  { key: "score", label: "Score", render: (row) => `${formatNumber(row.left?.score)} - ${formatNumber(row.right?.score)}` },
  { key: "remainingSeconds", label: "Time", render: (row) => `${row.remainingSeconds || 0}s` },
  { key: "leader", label: "Leader", render: (row) => <StatusBadge value={row.leader || "DRAW"} /> },
  { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> }
];

const trustVerificationColumns: ColumnDef[] = [
  { key: "user.username", label: "User" },
  { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  { key: "faceStatus", label: "Face", render: (row) => <StatusBadge value={row.faceStatus} /> },
  { key: "voiceStatus", label: "Voice", render: (row) => <StatusBadge value={row.voiceStatus} /> },
  { key: "verificationScore", label: "Score" },
  { key: "submittedAt", label: "Submitted" }
];

const creatorKycColumns: ColumnDef[] = [
  { key: "user.username", label: "Creator" },
  { key: "kycStatus", label: "KYC", render: (row) => <StatusBadge value={row.kycStatus} /> },
  { key: "payoutStatus", label: "Payout", render: (row) => <StatusBadge value={row.payoutStatus} /> },
  { key: "panLast4", label: "PAN", render: (row) => row.panLast4 ? `••••${row.panLast4}` : "—" },
  { key: "upiIdMasked", label: "UPI" },
  { key: "bankAccountLast4", label: "Bank", render: (row) => row.bankAccountLast4 ? `••••${row.bankAccountLast4}` : "—" },
  { key: "submittedAt", label: "Submitted" }
];

const payoutReviewColumns: ColumnDef[] = [
  { key: "user.username", label: "Creator" },
  { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  { key: "withdrawal.amountCoins", label: "Coins", render: (row) => formatNumber(row.withdrawal?.amountCoins) },
  { key: "withdrawal.amountInr", label: "INR", render: (row) => `₹${Number(row.withdrawal?.amountInr || 0).toFixed(2)}` },
  { key: "trustVerified", label: "Trust" },
  { key: "kycVerified", label: "KYC" },
  { key: "fraudSafe", label: "Fraud" },
  { key: "riskScore", label: "Risk", render: (row) => <RiskBadge value={(row.riskScore ?? 0) >= 70 ? "HIGH" : (row.riskScore ?? 0) >= 35 ? "MEDIUM" : "LOW"} /> },
  { key: "createdAt", label: "Created" }
];

const walletColumns: ColumnDef[] = [
  { key: "userId.username", label: "User" },
  { key: "type", label: "Type", render: (row) => <StatusBadge value={row.type} /> },
  { key: "source", label: "Source" },
  { key: "amount", label: "Amount", render: (row) => formatNumber(row.amount) },
  { key: "balanceAfter", label: "After", render: (row) => formatNumber(row.balanceAfter) },
  { key: "createdAt", label: "Created" }
];

const paymentColumns: ColumnDef[] = [
  { key: "userId.username", label: "User" },
  { key: "provider", label: "Provider" },
  { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  { key: "coinAmount", label: "Coins", render: (row) => formatNumber(row.coinAmount) },
  { key: "amountInr", label: "INR", render: (row) => formatNumber(row.amountInr) },
  { key: "createdAt", label: "Created" }
];

const giftColumns: ColumnDef[] = [
  { key: "name", label: "Name" },
  { key: "icon", label: "Icon" },
  { key: "coinPrice", label: "Price", render: (row) => formatNumber(row.coinPrice) },
  { key: "isActive", label: "Status", render: (row) => <StatusBadge value={row.isActive ? "ACTIVE" : "DISABLED"} /> }
];

const supportColumns: ColumnDef[] = [
  { key: "userId.username", label: "User" },
  { key: "subject", label: "Subject" },
  { key: "category", label: "Category" },
  { key: "priority", label: "Priority", render: (row) => <RiskBadge value={row.priority} /> },
  { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  { key: "updatedAt", label: "Updated" }
];

const fraudColumns: ColumnDef[] = [
  { key: "userId.username", label: "User" },
  { key: "trustScore", label: "Trust", render: (row) => formatNumber(row.trustScore) },
  { key: "riskLevel", label: "Risk", render: (row) => <RiskBadge value={row.riskLevel} /> },
  { key: "reportCount", label: "Reports" },
  { key: "updatedAt", label: "Updated" }
];

const configColumns: ColumnDef[] = [
  { key: "key", label: "Key" },
  { key: "value", label: "Value", render: (row) => JSON.stringify(row.value) },
  { key: "description", label: "Description" },
  { key: "updatedAt", label: "Updated" }
];

const auditColumns: ColumnDef[] = [
  { key: "action", label: "Action" },
  { key: "adminId.email", label: "Admin" },
  { key: "entityType", label: "Entity" },
  { key: "targetUserId", label: "Target" },
  { key: "createdAt", label: "Time" }
];

const adminColumns: ColumnDef[] = [
  { key: "displayName", label: "Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status", render: (row) => <StatusBadge value={row.status} /> },
  { key: "lastLoginAt", label: "Last login" }
];
