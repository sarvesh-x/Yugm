import { ReactNode } from "react";
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
  Settings,
  Shield,
  SlidersHorizontal,
  Sparkles,
  UserCog,
  Users,
  Wallet
} from "lucide-react";
import { Admin } from "../api";

export type ViewKey =
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
  | "campaigns"
  | "growth"
  | "support"
  | "dmReviews"
  | "referrals"
  | "analytics"
  | "fraud"
  | "config"
  | "audit"
  | "admins"
  | "settings";

export type Notice = { tone: "success" | "error" | "info"; text: string } | null;

export const navItems: Array<{ key: ViewKey; label: string; icon: ReactNode; group: string; requiredPermission?: string }> = [
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
  { key: "campaigns", label: "Campaigns", icon: <Bell />, group: "Operations", requiredPermission: "notifications.send" },
  { key: "growth", label: "Growth OS", icon: <LineChart />, group: "Operations" },
  { key: "referrals", label: "Referrals", icon: <Gift />, group: "Operations" },
  { key: "support", label: "Support", icon: <LifeBuoy />, group: "Operations" },
  { key: "dmReviews", label: "DM Reviews", icon: <Lock />, group: "Safety", requiredPermission: "dm_reviews.review" },
  { key: "analytics", label: "Analytics", icon: <BarChart3 />, group: "Intelligence" },
  { key: "fraud", label: "Fraud radar", icon: <Activity />, group: "Intelligence" },
  { key: "config", label: "App config", icon: <SlidersHorizontal />, group: "System" },
  { key: "audit", label: "Audit logs", icon: <Lock />, group: "System" },
  { key: "admins", label: "Admin users", icon: <UserCog />, group: "System" },
  { key: "settings", label: "Settings", icon: <Settings />, group: "System" }
];

export function Sidebar({ current, onNavigate, admin, onLogout }: { current: ViewKey; onNavigate: (view: ViewKey) => void; admin: Admin; onLogout: () => void }) {
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

export function Topbar({ view, admin, notice, onClearNotice }: { view: ViewKey; admin: Admin; notice: Notice; onClearNotice: () => void }) {
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
