import { useAuthStore } from "@/store/auth";
import { apiBaseUrl } from "@/lib/config";

export class ApiError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const method = (options.method ?? "GET").toUpperCase();
  const canRetry = method === "GET" || method === "HEAD" || method === "OPTIONS";
  const maxAttempts = canRetry ? 3 : 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers
        }
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.ok === false) {
        if (response.status === 401 && token) {
          if (useAuthStore.getState().token === token) {
            await useAuthStore.getState().logout().catch(() => undefined);
          }
        }
        throw new ApiError(
          json.error?.message ?? (response.status === 401 ? "Your session has expired. Please sign in again." : "Request failed"),
          response.status,
          json.error?.code
        );
      }
      return json.data as T;
    } catch (err) {
      lastError = err instanceof Error && err.name === "AbortError"
        ? new ApiError("The request took too long. Please check your connection and try again.")
        : err instanceof TypeError
          ? new ApiError("Unable to reach Yugm. Check your internet connection and try again.")
          : err;
      if (err instanceof ApiError && err.status && err.status < 500) throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

export function absoluteMediaUrl(url: string) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const base = apiBaseUrl.replace(/\/api\/?$/, "");
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function uploadProfileMedia(file: { uri: string; name?: string; type?: string }) {
  const token = useAuthStore.getState().token;
  const formData = new FormData();
  formData.append("media", {
    uri: file.uri,
    name: file.name ?? `profile-media-${Date.now()}`,
    type: file.type ?? "image/jpeg"
  } as any);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(`${apiBaseUrl}/upload/profile-media`, {
      method: "POST",
      signal: controller.signal,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.ok === false) throw new ApiError(json.error?.message ?? "Upload failed", response.status);
    const data = json.data as { url: string; type: "IMAGE" | "VIDEO" };
    return { ...data, url: absoluteMediaUrl(data.url) };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("The upload took too long. Try a smaller file or a stronger connection.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
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
  directMessage: (roomId: string, message: string, receiverId?: string) => api<{ message: any; relationship?: any }>(`/rooms/${roomId}/messages/direct`, { method: "POST", body: JSON.stringify({ message, receiverId }) }),
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
  wallet: () => api<{ balance: number; vip?: any; level?: any; cosmetics?: any }>("/wallet"),
  transactions: () => api<{ transactions: any[] }>("/wallet/transactions"),
  packs: () => api<{ packs: any[] }>("/wallet/packs"),
  purchases: () => api<{ purchases: any[] }>("/wallet/purchases"),
  cosmetics: () => api<{ cosmetics: any[]; ownedCosmeticIds: string[]; activeCosmetics: any }>("/wallet/cosmetics"),
  purchaseCosmetic: (cosmeticId: string) => api<{ cosmetic: any; balance: number; ownedCosmeticIds: string[]; activeCosmetics: any; level?: any }>("/wallet/cosmetics/purchase", {
    method: "POST",
    body: JSON.stringify({ cosmeticId })
  }),
  equipCosmetic: (cosmeticId: string | null, type: string) => api<{ balance: number; ownedCosmeticIds: string[]; activeCosmetics: any }>("/wallet/cosmetics/equip", {
    method: "POST",
    body: JSON.stringify({ cosmeticId, type })
  }),
  vipPlans: () => api<{ plans: any[]; vip?: any }>("/wallet/vip/plans"),
  activateVip: (planId: string) => api<{ balance: number; vip: any; level?: any; plan: any }>("/wallet/vip/activate", {
    method: "POST",
    body: JSON.stringify({ planId })
  }),
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
    api<{ giftTransaction: any }>(`/rooms/${roomId}/send-gift`, { method: "POST", body: JSON.stringify({ giftId, receiverId }) }),
  sendGiftDirect: (giftId: string, receiverId: string) =>
    api<{ giftTransaction: any; message: any; relationship?: any }>("/wallet/direct-send-gift", { method: "POST", body: JSON.stringify({ giftId, receiverId }) })
};

export const mediaApi = {
  token: (roomId: string) => api<{ token: string; url: string; identity: string; roomName: string; role: string }>("/livekit/token", {
    method: "POST",
    body: JSON.stringify({ roomId })
  })
};

export const notificationsApi = {
  list: () => api<{ notifications: any[] }>("/notifications"),
  registerDeviceToken: (token: string, platform: "android" | "ios" | "web") =>
    api<{ token: any }>("/notifications/device-token", { method: "POST", body: JSON.stringify({ token, platform }) }),
  markRead: (id: string) => api<{ notification: any }>(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => api<{ success: boolean }>("/notifications/read-all", { method: "POST" })
};

export const experienceApi = {
  home: () => api<{
    user: any;
    profileCompletion: any;
    level: any;
    achievements: any[];
    feed: any[];
    rooms: { live: any[]; scheduled: any[]; following: any[] };
    people: { suggestedHosts: any[] };
    notifications: { unreadCount: number; recent: any[] };
    invites: any[];
    quickActions: any[];
  }>("/experience/home"),
  creatorDashboard: () => api<{
    windowDays: number;
    summary: { giftCoins: number; giftCount: number; uniqueSupporters: number; hostedRooms: number; participants: number; uniqueParticipants: number; averageParticipants: number; estimatedInr: number };
    rooms: any[];
    scheduledRooms: any[];
    gifts: any[];
    topSupporters: Array<{ _id: string; coins: number; gifts: number; user?: any }>;
    nextSteps: string[];
  }>("/experience/creator-dashboard"),
  safetyCenter: () => api<{
    trust: any;
    checklist: any[];
    blockedUsers: any[];
  }>("/experience/safety-center"),
  notificationPreferences: () => api<{ preferences: Record<string, boolean> }>("/experience/notification-preferences"),
  updateNotificationPreferences: (preferences: Record<string, boolean>) =>
    api<{ preferences: Record<string, boolean> }>("/experience/notification-preferences", {
      method: "PUT",
      body: JSON.stringify(preferences)
    })
};

export type CreatorPayoutKyc = {
  id?: string;
  legalFullName?: string | null;
  dateOfBirth?: string | null;
  panLast4?: string | null;
  panVerified: boolean;
  upiIdMasked?: string | null;
  bankAccountLast4?: string | null;
  bankIfsc?: string | null;
  bankHolderName?: string | null;
  kycStatus: "NOT_SUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED" | "NEEDS_RETRY" | "EXPIRED" | "MANUAL_REVIEW";
  payoutStatus: "DISABLED" | "ENABLED" | "FROZEN" | "MANUAL_REVIEW";
  rejectionReason?: string | null;
  submittedAt?: string | null;
  verifiedAt?: string | null;
};

export type CreatorEarningBalance = {
  earnedCoins: number;
  lockedCoins: number;
  withdrawnCoins: number;
  availableCoins: number;
};

export type CreatorWithdrawal = {
  id: string;
  amountCoins: number;
  amountInr: number;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "PAID" | "CANCELLED" | "BLOCKED";
  rejectionReason?: string | null;
  payoutReference?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
};

export const creatorApi = {
  payoutKyc: () => api<{ title: string; tagline: string; kyc: CreatorPayoutKyc }>("/creator/payout-kyc"),
  submitPayoutKyc: (payload: {
    legalFullName: string;
    dateOfBirth?: string;
    panNumber: string;
    upiId?: string;
    bankAccount?: string;
    bankIfsc?: string;
    bankHolderName?: string;
    declarationsAccepted: boolean;
  }) => api<{ kyc: CreatorPayoutKyc }>("/creator/payout-kyc/submit", {
    method: "POST",
    body: JSON.stringify(payload)
  }),
  eligibility: () => api<{
    balance: CreatorEarningBalance;
    payoutKyc: CreatorPayoutKyc;
    coinToInrRate: number;
    requirements: {
      creatorAccount: boolean;
      trustVerified: boolean;
      creatorTrustEnabled: boolean;
      payoutKycVerified: boolean;
      payoutEnabled: boolean;
    };
  }>("/creator/withdrawals/eligibility"),
  withdrawals: () => api<{ withdrawals: CreatorWithdrawal[]; balance: CreatorEarningBalance }>("/creator/withdrawals"),
  requestWithdrawal: (amountCoins: number) => api<{
    message: string;
    withdrawal: CreatorWithdrawal;
    balance: CreatorEarningBalance;
  }>("/creator/withdrawals", { method: "POST", body: JSON.stringify({ amountCoins }) })
};

export const gamesApi = {
  catalog: () => api<{ games: any[]; recent: any[] }>("/games/catalog"),
  missions: () => api<{ date: string; missions: any[] }>("/games/missions"),
  leaderboard: (gameId: string) => api<{ gameId: string; leaderboard: any[]; personalBest?: any }>(`/games/leaderboard?gameId=${encodeURIComponent(gameId)}`),
  challenges: () => api<{ incoming: any[]; outgoing: any[]; clan: any[] }>("/games/challenges"),
  submitScore: (payload: { gameId: string; score: number; durationMs?: number; rounds?: number; metadata?: Record<string, unknown> }) =>
    api<{ score: any; isPersonalBest: boolean; personalBest: any; reward?: any }>("/games/scores", { method: "POST", body: JSON.stringify(payload) }),
  challenge: (payload: { gameId: string; score: number; scoreId?: string; targetUserId?: string; clanId?: string; message?: string }) =>
    api<{ challenge: any }>("/games/challenges", { method: "POST", body: JSON.stringify(payload) }),
  shareScore: (scoreId: string, targetUserId: string) =>
    api<{ message: any }>(`/games/scores/${scoreId}/share`, { method: "POST", body: JSON.stringify({ targetUserId }) })
};

export const usersApi = {
  get: (userId: string) => api<{ user: any }>(`/users/${userId}`),
  level: () => api<{ level: any }>("/users/me/level"),
  checkIn: () => api<{ alreadyClaimed: boolean; xpAwarded?: number; levelUpReward?: number; levelsGained?: number[]; level: any; walletBalance?: number; balance?: number }>("/users/me/check-in", { method: "POST" }),
  closeFriends: () => api<{ users: any[] }>("/users/me/close-friends"),
  addProfileMedia: (payload: { url: string; type?: "IMAGE" | "VIDEO"; caption?: string }) =>
    api<{ user: any; media: any }>("/users/me/profile-media", { method: "POST", body: JSON.stringify(payload) }),
  removeProfileMedia: (mediaId: string) =>
    api<{ user: any }>(`/users/me/profile-media/${mediaId}`, { method: "DELETE" }),
  sendFeedback: (payload: { category?: string; subject: string; message: string }) =>
    api<{ ticket: any; message: any }>("/users/me/feedback", { method: "POST", body: JSON.stringify(payload) }),
  getUserRooms: (userId: string) => api<{ rooms: any[] }>(`/users/${userId}/rooms`),
  getFollowers: (userId: string) => api<{ users: any[] }>(`/users/${userId}/followers`),
  getFollowing: (userId: string) => api<{ users: any[] }>(`/users/${userId}/following`),
  search: (query: string) => api<{ users: any[] }>(`/users/search?q=${encodeURIComponent(query)}`),
  suggestedHosts: () => api<{ users: any[] }>("/users/hosts/suggested"),
  messages: () => api<{ messages: any[] }>("/users/messages"),
  conversation: (userId: string) => api<{ messages: any[]; relationship?: any }>(`/users/messages/${userId}`),
  sendMessage: (userId: string, message: string) => api<{ message: any; relationship?: any }>(`/users/messages/${userId}`, { method: "POST", body: JSON.stringify({ message }) }),
  reactToMessage: (userId: string, messageId: string, type: "heart" | "fire" | "laugh" | "clap" | "wow") =>
    api<{ message: any }>(`/users/messages/${userId}/${messageId}/reactions`, { method: "POST", body: JSON.stringify({ type }) }),
  startPrivateCall: (userId: string, type: "VOICE" | "VIDEO") =>
    api<{ room: any; message: any }>(`/users/messages/${userId}/call`, { method: "POST", body: JSON.stringify({ type }) }),
  follow: (userId: string) => api<{ following: boolean }>(`/users/${userId}/follow`, { method: "POST" }),
  unfollow: (userId: string) => api<{ following: boolean }>(`/users/${userId}/follow`, { method: "DELETE" }),
  addCloseFriend: (userId: string) => api<{ closeFriend: boolean }>(`/users/${userId}/close-friend`, { method: "POST" }),
  removeCloseFriend: (userId: string) => api<{ closeFriend: boolean }>(`/users/${userId}/close-friend`, { method: "DELETE" }),
  block: (userId: string) => api<{ blocked: boolean }>(`/users/${userId}/block`, { method: "POST" }),
  unblock: (userId: string) => api<{ blocked: boolean }>(`/users/${userId}/block`, { method: "DELETE" }),
  getBlocked: () => api<{ users: any[] }>("/users/me/blocked"),
  report: (targetUserId: string, reason: string) =>
    api<{ report: any }>("/reports", { method: "POST", body: JSON.stringify({ targetUserId, reason }) })
};

export const clansApi = {
  list: (query = "") => api<{ clans: any[] }>(`/clans${query ? `?q=${encodeURIComponent(query)}` : ""}`),
  mine: () => api<{ clan: any | null }>("/clans/me"),
  detail: (clanId: string) => api<{ clan: any }>(`/clans/${clanId}`),
  messages: (clanId: string) => api<{ messages: any[] }>(`/clans/${clanId}/messages`),
  sendMessage: (clanId: string, message: string) => api<{ message: any }>(`/clans/${clanId}/messages`, { method: "POST", body: JSON.stringify({ message }) }),
  reactToMessage: (clanId: string, messageId: string, type: "heart" | "fire" | "laugh" | "clap" | "wow") =>
    api<{ message: any }>(`/clans/${clanId}/messages/${messageId}/reactions`, { method: "POST", body: JSON.stringify({ type }) }),
  deleteMessage: (clanId: string, messageId: string) => api<{ deleted: boolean }>(`/clans/${clanId}/messages/${messageId}`, { method: "DELETE" }),
  reportMessage: (clanId: string, messageId: string, reason: string, description?: string) =>
    api<{ report: any }>(`/clans/${clanId}/messages/${messageId}/report`, { method: "POST", body: JSON.stringify({ reason, description }) }),
  create: (payload: { name: string; description?: string; avatar?: string; privacy?: "PUBLIC" | "PRIVATE"; familyLabel?: string }) =>
    api<{ clan: any }>("/clans", { method: "POST", body: JSON.stringify(payload) }),
  join: (clanId: string) => api<{ clan: any }>(`/clans/${clanId}/join`, { method: "POST" }),
  leave: (clanId: string) => api<{ clan: any | null }>(`/clans/${clanId}/leave`, { method: "POST" })
};

export const datingApi = {
  preferences: () => api<{ preferences: { interestedIn: "Everyone" | "Women" | "Men" | "Non-binary"; lookingFor: "Friendship" | "Dating" | "Relationship" | "Networking"; datingAgeMin: number; datingAgeMax: number; verifiedOnly: boolean } }>("/dating/preferences"),
  updatePreferences: (preferences: { interestedIn: "Everyone" | "Women" | "Men" | "Non-binary"; lookingFor: "Friendship" | "Dating" | "Relationship" | "Networking"; datingAgeMin: number; datingAgeMax: number; verifiedOnly: boolean }) =>
    api<{ preferences: any }>("/dating/preferences", { method: "PUT", body: JSON.stringify(preferences) }),
  explore: () => api<{ candidates: any[] }>("/dating/explore"),
  like: (likedId: string, type: "LIKE" | "SUPER_LIKE" | "PASS" = "LIKE") =>
    api<{ like: any; isMatch: boolean; match: any }>("/dating/like", {
      method: "POST",
      body: JSON.stringify({ likedId, type })
    }),
  pass: (likedId: string) =>
    api<{ pass: any }>("/dating/pass", {
      method: "POST",
      body: JSON.stringify({ likedId })
    }),
  matches: () => api<{ matches: any[] }>("/dating/matches")
};
