const API_BASE = (import.meta.env.VITE_ADMIN_API_URL || "http://127.0.0.1:4000/api/admin").replace(/\/$/, "");

export type Admin = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  permissions: string[];
  isSuperAdmin: boolean;
};

export type Session = {
  admin: Admin;
  accessToken: string;
  refreshToken?: string;
};

type RequestOptions = RequestInit & { token?: string };

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function adminApi<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new ApiError(response.status, payload.error?.message || `Request failed (${response.status})`);
  }
  return payload.data as T;
}

export async function adminApiWithMeta<T>(path: string, options: RequestOptions = {}): Promise<{ data: T; meta: any }> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new ApiError(response.status, payload.error?.message || `Request failed (${response.status})`);
  }
  return { data: payload.data as T, meta: payload.meta || {} };
}

export function login(email: string, password: string) {
  return adminApi<Session>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function refreshAdminSession(refreshToken: string) {
  return adminApi<{ admin: Admin; accessToken: string }>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken })
  });
}

export const formatDate = (value?: string) => {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export const formatNumber = (value: unknown) =>
  new Intl.NumberFormat("en-IN").format(typeof value === "number" ? value : Number(value || 0));
