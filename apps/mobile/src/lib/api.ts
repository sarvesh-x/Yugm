import { useAuthStore } from "@/store/auth";
import { apiBaseUrl } from "@/lib/config";

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers
        }
      });
      clearTimeout(timeout);
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.ok === false) {
        throw new ApiError(json.error?.message ?? "Request failed", response.status);
      }
      return json.data as T;
    } catch (err) {
      lastError = err;
      if (err instanceof ApiError && err.status && err.status < 500) throw err;
    }
  }
  throw lastError;
}

export const authApi = {
  requestOtp: (payload: { email?: string; phone?: string }) =>
    api<{ devOtp: string }>("/auth/request-otp", { method: "POST", body: JSON.stringify(payload) }),
  verifyOtp: (payload: { email?: string; phone?: string; otp: string }) =>
    api<{ token: string; user: any }>("/auth/verify-otp", { method: "POST", body: JSON.stringify(payload) }),
  google: (idToken: string) =>
    api<{ token: string; user: any }>("/auth/google", { method: "POST", body: JSON.stringify({ idToken }) }),
  phone: (idToken: string) =>
    api<{ token: string; user: any }>("/auth/phone", { method: "POST", body: JSON.stringify({ idToken }) }),
  updateProfile: (payload: Record<string, unknown>) =>
    api<{ user: any }>("/users/me", { method: "PATCH", body: JSON.stringify(payload) })
};

export const roomsApi = {
  list: (filters: { type?: "VOICE" | "VIDEO"; category?: string } | "VOICE" | "VIDEO" = {}) => {
    const normalized = typeof filters === "string" ? { type: filters } : filters;
    const params = new URLSearchParams();
    if (normalized.type) params.set("type", normalized.type);
    if (normalized.category && normalized.category !== "Trending") params.set("category", normalized.category);
    const query = params.toString();
    return api<{ rooms: any[] }>(`/rooms${query ? `?${query}` : ""}`);
  },
  trending: () => api<{ rooms: any[] }>("/rooms/trending"),
  recommended: () => api<{ rooms: any[] }>("/rooms/recommended"),
  scheduled: () => api<{ rooms: any[] }>("/rooms/scheduled"),
  leaderboard: () => api<{ topRooms: any[]; topHosts: any[] }>("/rooms/leaderboard"),
  detail: (id: string) => api<{ room: any; participants: any[]; speakerRequests?: any[] }>(`/rooms/${id}`),
  create: (payload: Record<string, unknown>) => api<{ room: any }>("/rooms", { method: "POST", body: JSON.stringify(payload) }),
  join: (id: string) => api<{ role: string }>(`/rooms/${id}/join`, { method: "POST" }),
  leave: (id: string) => api<{ left: boolean }>(`/rooms/${id}/leave`, { method: "POST" }),
  message: (id: string, message: string) => api<{ message: any }>(`/rooms/${id}/messages`, { method: "POST", body: JSON.stringify({ message }) }),
  messages: (id: string) => api<{ messages: any[] }>(`/rooms/${id}/messages`),
  activity: (id: string) => api<{ activity: any[] }>(`/rooms/${id}/activity`),
  react: (id: string, type: "heart" | "fire" | "laugh" | "clap" | "wow") => api<{ reaction: any }>(`/rooms/${id}/reactions`, { method: "POST", body: JSON.stringify({ type }) }),
  polls: (id: string) => api<{ polls: any[] }>(`/rooms/${id}/polls`),
  createPoll: (id: string, question: string, options: string[]) => api<{ poll: any }>(`/rooms/${id}/polls`, { method: "POST", body: JSON.stringify({ question, options }) }),
  votePoll: (roomId: string, pollId: string, optionIndex: number) => api<{ poll: any }>(`/rooms/${roomId}/polls/${pollId}/vote`, { method: "POST", body: JSON.stringify({ optionIndex }) }),
  invite: (roomId: string, userId: string) => api<{ invite: any }>(`/rooms/${roomId}/invites`, { method: "POST", body: JSON.stringify({ userId }) }),
  missions: (id: string) => api<{ missions: any[] }>(`/rooms/${id}/missions`),
  directMessage: (roomId: string, message: string, receiverId?: string) => api<{ message: any }>(`/rooms/${roomId}/messages/direct`, { method: "POST", body: JSON.stringify({ message, receiverId }) }),
  requestSpeaker: (id: string) => api<{ request: any }>(`/rooms/${id}/request-speaker`, { method: "POST" }),
  approveSpeaker: (roomId: string, userId: string) => api<{ request: any }>(`/rooms/${roomId}/approve-speaker`, { method: "POST", body: JSON.stringify({ userId }) }),
  rejectSpeaker: (roomId: string, userId: string) => api<{ rejected: boolean }>(`/rooms/${roomId}/reject-speaker`, { method: "POST", body: JSON.stringify({ userId }) }),
  endRoom: (roomId: string) => api<{ room: any }>(`/rooms/${roomId}/end`, { method: "POST" }),
  muteUser: (roomId: string, userId: string) => api<{ success: boolean }>(`/rooms/${roomId}/mute-user`, { method: "POST", body: JSON.stringify({ userId }) }),
  removeUser: (roomId: string, userId: string) => api<{ success: boolean }>(`/rooms/${roomId}/remove-user`, { method: "POST", body: JSON.stringify({ userId }) }),
  reportUser: (roomId: string, targetUserId: string, reason: string) => api<{ report: any }>(`/rooms/${roomId}/report`, { method: "POST", body: JSON.stringify({ targetUserId, reason, roomId }) }),
  searchRooms: (query: string) => api<{ rooms: any[] }>(`/rooms/search?q=${encodeURIComponent(query)}`),
  searchUsers: (query: string) => api<{ users: any[] }>(`/users/search?q=${encodeURIComponent(query)}`)
};

export const walletApi = {
  gifts: () => api<{ gifts: any[] }>("/gifts"),
  wallet: () => api<{ balance: number }>("/wallet"),
  transactions: () => api<{ transactions: any[] }>("/wallet/transactions"),
  packs: () => api<{ packs: any[] }>("/wallet/packs"),
  purchases: () => api<{ purchases: any[] }>("/wallet/purchases"),
  createRazorpayOrder: (packId: string) => api<{ purchase: any; order: any; checkout: any }>("/wallet/purchases/razorpay/order", {
    method: "POST",
    body: JSON.stringify({ packId, provider: "RAZORPAY" })
  }),
  verifyRazorpay: (payload: { purchaseId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    api<{ purchase: any; balance: number }>("/wallet/purchases/razorpay/verify", { method: "POST", body: JSON.stringify(payload) }),
  verifyGooglePlay: (payload: { packId: string; productId: string; purchaseToken: string; orderId?: string }) =>
    api<{ purchase: any; balance: number }>("/wallet/purchases/google-play/verify", { method: "POST", body: JSON.stringify(payload) }),
  recharge: (amount: number) => api<{ balance: number }>("/wallet/dev-recharge", { method: "POST", body: JSON.stringify({ amount }) }),
  sendGift: (roomId: string, giftId: string, receiverId: string) =>
    api<{ giftTransaction: any }>(`/rooms/${roomId}/send-gift`, { method: "POST", body: JSON.stringify({ giftId, receiverId }) })
};

export const mediaApi = {
  token: (roomId: string) => api<{ token: string; url: string; identity: string; roomName: string; role: string }>("/livekit/token", {
    method: "POST",
    body: JSON.stringify({ roomId })
  })
};

export const notificationsApi = {
  list: () => api<{ notifications: any[] }>("/notifications"),
  markRead: (id: string) => api<{ notification: any }>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => api<{ success: boolean }>("/notifications/read-all", { method: "POST" })
};

export const usersApi = {
  get: (userId: string) => api<{ user: any }>(`/users/${userId}`),
  getUserRooms: (userId: string) => api<{ rooms: any[] }>(`/users/${userId}/rooms`),
  getFollowers: (userId: string) => api<{ users: any[] }>(`/users/${userId}/followers`),
  getFollowing: (userId: string) => api<{ users: any[] }>(`/users/${userId}/following`),
  search: (query: string) => api<{ users: any[] }>(`/users/search?q=${encodeURIComponent(query)}`),
  suggestedHosts: () => api<{ users: any[] }>("/users/hosts/suggested"),
  messages: () => api<{ messages: any[] }>("/users/messages"),
  conversation: (userId: string) => api<{ messages: any[] }>(`/users/messages/${userId}`),
  follow: (userId: string) => api<{ following: boolean }>(`/users/${userId}/follow`, { method: "POST" }),
  unfollow: (userId: string) => api<{ following: boolean }>(`/users/${userId}/follow`, { method: "DELETE" }),
  block: (userId: string) => api<{ blocked: boolean }>(`/users/${userId}/block`, { method: "POST" }),
  unblock: (userId: string) => api<{ blocked: boolean }>(`/users/${userId}/block`, { method: "DELETE" })
};
