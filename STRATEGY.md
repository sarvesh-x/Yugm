# Yugm — Complete Product Transformation Strategy

---

## 1. PHASED IMPLEMENTATION ROADMAP

### Phase MVP (4–6 weeks) — "Foundation"
**Goal**: Ship a stable, delightful core experience that proves retention.

| Week | Sprint | Deliverables |
|------|--------|------|
| 1 | **Architecture cleanup** | Split Models.kt → domain modules; split YugmApi.kt → feature delegates; split NavGraph.kt → nested nav graphs; fix all compiler warnings; extract YugmApiParsers into per-feature parsers |
| 2 | **UI refresh — 10 screens** | Login, Onboarding, Discover, Profile Detail, Chat, Room Lobby, Voice Room, Video Room, Wallet, Settings — apply glassmorphism, micro-animations, aurora gradients, depth |
| 3 | **AI Vibe Graph v1** | VibeGraph MongoDB collection; `POST /vibe/init` / `POST /vibe/update` / `GET /vibe/match`; CompatibilityScore card on Profile Detail; "Your vibe improved" toast on conversation |
| 4 | **Room Modes (5)** | Coffee Date, Blind Date, Truth or Dare, Never Have I Ever, Would You Rather — unique UI per mode, animated entry, mode-specific rewards |
| 5 | **Immersive Room v1** | Dynamic backgrounds (6 themes); particle system (Compose Canvas); speaking animations on avatars; ambient sounds; gift explosion effect |
| 6 | **Creator Dashboard v1** | `GET /creator/dashboard` analytics; multi-host calendar; scheduled room creation; income heat map |

### Phase V1 (6–8 weeks) — "Engagement"
**Goal**: Build habit loops, social features, and gamiﬁcation.

| Week | Sprint | Deliverables |
|------|--------|------|
| 7 | **Gamiﬁcation engine** | Daily/Weekly/Monthly missions; XP & Levels; Login streaks (Compose animated streak card); Titles and Achievements; Season Pass backend |
| 8 | **Gift system v2** | 3D gift rendering (Compose Canvas particle eﬀects); Interactive gifts (tap to trigger); Combo gifts (multi-sender bonus); Surprise Boxes; Mystery gifts; Gift inventory UI |
| 9 | **Social features** | Voice Stories; Mood status; Current Activity status; Wave/Nudge/Vibe Ping; Daily Question; Voice Polls; Countdown events |
| 10 | **Communities v1** | Guilds (create/join/war); Fan Clubs; Language Clubs; Gaming Teams — each with voice room, chat, announcements, leaderboard, treasury |
| 11 | **AI Wingman v1** | `POST /ai/wingman/bio`; `POST /ai/wingman/opener`; `POST /ai/wingman/reply`; Conversation coach tab in chat; Proﬁle rating widget |
| 12 | **Discovery v2** | Trending rooms carousel; Mood hubs; Language hubs; Interest hubs; Swipe rooms (Compose AnimatedVisibility with physics); Live room map |
| 13 | **PK Battles v2** | 2v2 mode; Squad battle; Guild battle; Lucky Round; Golden Minute; Combo gifts during PK; AI commentary text overlay; Victory ceremony animation |

### Phase V2 (6–8 weeks) — "Monetization & Creator Economy"
**Goal**: Drive revenue and creator retention.

| Week | Sprint | Deliverables |
|------|--------|------|
| 14 | **Creator system v2** | Mentorship; Creator academy (video lessons); Agencies (manage talent); Referral program with payout; Creator level system |
| 15 | **Economy v2** | Diamonds (premium currency); Cashback engine; Mystery Rewards; Subscription tiers (Free/Plus/Premium/VIP); Marketplace (buy/sell cosmetics); Auction house |
| 16 | **Premium UI v2** | 3D proﬁle cards (Compose Canvas + perspective transform); Liquid transitions (shared element transitions); Elastic animations (spring-based); Animated typography |
| 17 | **AI Moderation** | Real-time toxicity detection (ML model via TensorFlow Lite on-device + server fallback); Spam/scam detection; Voice abuse detection; Trust score algorithm; Shadow banning |
| 18 | **Trust v2** | Face liveness detection; Voice veriﬁcation; Trust levels (1–10); Community reputation score; Safe User badge; Report accuracy scoring |
| 19 | **Room Modes (10 more)** | Debate Arena, Story Time, Open Mic, Poetry Night, Study Together, Gaming Lobby, Language Exchange, Anime Club, Conﬁdential Room, Secret Crush Room |
| 20 | **Festival Events** | Diwali room theme, Holi color party, New Year countdown, Valentine's speed dating, Independence Day quiz — timed events with exclusive gifts |

### Phase V3 (8–10 weeks) — "Scale & Ecosystem"
**Goal**: Global scale, AI personalization, platform independence.

| Week | Sprint | Deliverables |
|------|--------|------|
| 21 | **AI Personalization** | Personal AI Feed (ranking algorithm); AI Notiﬁcations (intelligent timing); AI Friend/Room/Gift/Music/Event suggestions; AI Retention Engine (predict churn → trigger intervention) |
| 22 | **AI Vibe Graph v2** | Real-time graph updates via WebSocket; 20-dimension compatibility (humor, conversation style, energy, gaming, music, movies, language, career, relationship intent, travel, food, personality, attachment style, love language, interests, mood, sleep schedule, learning style); "Your vibe has improved" push notiﬁcations |
| 23 | **Immersive Room v2** | Spatial audio via LiveKit spatial audio; Weather effects (rain, snow, stars, aurora); 15 more room themes (Cyberpunk, Cafe, Temple, Mountain, Space, LoFi, Beach, Festival, Night Club, Library, Gaming Café, Private Villa, Luxury Lounge); Interactive furniture (clickable objects in room); Gift explosions with particle physics |
| 24 | **Creator system v3** | AI-generated clip highlights; Automatic stream highlights; Revenue prediction dashboard; Scheduled Lives calendar; Multi-host co-streaming; Creator badges (veriﬁed, top creator, rising star) |
| 25 | **Economy v3** | Limited edition cosmetics; Gift collections (sets with bonuses); Trading system (peer-to-peer gift trading); Season Store (rotating inventory); VIP subscription with exclusive rooms |
| 26 | **Gamiﬁcation v2** | Battle Pass (seasonal); Collections (complete sets for bonuses); Avatar cosmetics (hats, glasses, masks, outﬁts); Animated borders; Entrance eﬀects; Loot boxes; Treasure chests; Lucky Spin wheel |
| 27 | **Global expansion** | i18n (Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, Urdu + English); Localized content; Regional event themes; CDN optimization; Edge caching; Multi-region deployment |
| 28 | **Performance & Scale** | Horizontal sharding; Read replicas; Redis cluster; CDN for media; Image optimization pipeline; Client-side caching (Room database); Compose optimization (skippable, stable); Pagination audit; Memory proﬁling |

---

## 2. DATABASE SCHEMA CHANGES

### 2.1 New Collections

```javascript
// VibeGraph
vibeGraph: {
  _id: ObjectId,
  userId: ObjectId (ref: Users, index: true),
  dimensions: {
    compatibility: { score: Number, updatedAt: Date },
    humor: { score: Number, updatedAt: Date },
    conversationStyle: { score: Number, updatedAt: Date },
    energy: { score: Number, updatedAt: Date },
    gaming: { score: Number, updatedAt: Date },
    music: { score: Number, genres: [String], updatedAt: Date },
    movies: { score: Number, genres: [String], updatedAt: Date },
    language: { score: Number, preferred: [String], updatedAt: Date },
    lateNight: { score: Number, updatedAt: Date },
    career: { score: Number, field: String, updatedAt: Date },
    relationshipIntent: { type: String, enum: ['casual', 'serious', 'friends', 'exploring'], updatedAt: Date },
    travel: { score: Number, preferences: [String], updatedAt: Date },
    food: { score: Number, preferences: [String], updatedAt: Date },
    personalityType: { type: String, enum: MBTI_TYPES, updatedAt: Date },
    attachmentStyle: { type: String, enum: ['secure', 'anxious', 'avoidant', 'fearful'], updatedAt: Date },
    loveLanguage: { type: String, enum: LOVE_LANGUAGES, updatedAt: Date },
    communicationStyle: { type: String, enum: ['direct', 'indirect', 'emotional', 'logical'], updatedAt: Date },
    interestSimilarity: { score: Number, updatedAt: Date },
    mood: { score: Number, current: String, updatedAt: Date },
    sleepSchedule: { score: Number, updatedAt: Date },
    learningStyle: { type: String, enum: ['visual', 'auditory', 'reading', 'kinesthetic'], updatedAt: Date }
  },
  edgeHistory: [{ targetUserId: ObjectId, score: Number, trend: 'up'|'down'|'stable', createdAt: Date }],
  lastCalculated: Date,
  createdAt: Date,
  updatedAt: Date
}

// VibeMatches (pre-computed for performance)
vibeMatches: {
  _id: ObjectId,
  userId: ObjectId,
  matches: [{
    targetUserId: ObjectId,
    overallScore: Number,
    dimensionScores: Object,
    calculatedAt: Date,
    trend: 'up'|'down'|'stable',
    lastInteraction: Date
  }],
  calculatedAt: Date
}

// AIWingman
aiWingman: {
  _id: ObjectId,
  userId: ObjectId,
  conversations: [{
    role: 'user'|'ai',
    content: String,
    context: { type: String, chatPartnerId: ObjectId, messageId: ObjectId },
    createdAt: Date
  }],
  analysisCache: {
    bioScore: Number,
    bioSuggestions: [String],
    profilePhotoScore: Number,
    photoSuggestions: [String],
    lastAnalyzed: Date
  },
  createdAt: Date,
  updatedAt: Date
}

// Missions
missions: {
  _id: ObjectId,
  key: String, // 'daily_voice_10min', 'weekly_gift_5', etc.
  type: 'daily'|'weekly'|'monthly'|'seasonal',
  title: String,
  description: String,
  requirements: {
    action: String, // 'room_join', 'gift_send', 'pk_win', etc.
    target: Number,
    unit: String // 'minutes', 'count', 'coins'
  },
  rewards: {
    xp: Number,
    coins: Number,
    diamonds: Number,
    cosmeticId: ObjectId,
    titleId: String
  },
  badge: { icon: String, color: String },
  seasonId: ObjectId,
  startDate: Date,
  endDate: Date,
  active: Boolean
}

// UserMissions
userMissions: {
  _id: ObjectId,
  userId: ObjectId,
  missionId: ObjectId,
  progress: Number,
  completed: Boolean,
  completedAt: Date,
  claimed: Boolean,
  streakDay: Number,
  createdAt: Date,
  updatedAt: Date
}

// BattlePass
battlePass: {
  _id: ObjectId,
  season: { id: ObjectId, name: String },
  userId: ObjectId,
  tier: 'free'|'premium',
  level: Number,
  xp: Number,
  rewards: [{ tier: Number, claimed: Boolean, rewardId: ObjectId }],
  premium: Boolean,
  expiresAt: Date
}

// Guilds
guilds: {
  _id: ObjectId,
  name: String,
  tag: String,
  description: String,
  icon: String,
  banner: String,
  type: 'guild'|'fanclub'|'language'|'gaming'|'anime'|'book'|'fitness'|'city'|'college'|'company',
  ownerId: ObjectId,
  admins: [ObjectId],
  memberCount: Number,
  maxMembers: Number,
  level: Number,
  xp: Number,
  treasury: {
    coins: Number,
    diamonds: Number,
    gifts: [{ giftId: ObjectId, count: Number }]
  },
  voiceRoomId: ObjectId,
  announcement: String,
  tags: [String],
  city: String,
  language: String,
  joinType: 'open'|'approval'|'invite',
  createdAt: Date,
  updatedAt: Date
}

// GuildMembers
guildMembers: {
  _id: ObjectId,
  guildId: ObjectId,
  userId: ObjectId,
  role: 'member'|'admin'|'owner',
  joinedAt: Date,
  contribution: { xp: Number, coins: Number, gifts: Number }
}

// GuildWars
guildWars: {
  _id: ObjectId,
  guildAId: ObjectId,
  guildBId: ObjectId,
  type: 'xp'|'gifts'|'pk',
  status: 'pending'|'active'|'completed',
  scoreA: Number,
  scoreB: Number,
  startDate: Date,
  endDate: Date,
  winnerId: ObjectId,
  rewards: { guild: { xp: Number, coins: Number }, members: { xp: Number, coins: Number } },
  createdAt: Date
}

// GiftInventory
giftInventory: {
  _id: ObjectId,
  userId: ObjectId,
  giftId: ObjectId,
  quantity: Number,
  source: 'purchased'|'received'|'reward'|'mystery',
  tradable: Boolean,
  createdAt: Date
}

// GiftTransactions
giftTransactions: {
  _id: ObjectId,
  fromUserId: ObjectId,
  toUserId: ObjectId,
  giftId: ObjectId,
  roomId: ObjectId,
  quantity: Number,
  type: 'send'|'combo'|'room_wide'|'trade'|'auction',
  comboCount: Number,
  totalValue: Number,
  effect: String,
  createdAt: Date
}

// Marketplace
marketplace: {
  _id: ObjectId,
  sellerId: ObjectId,
  itemType: 'cosmetic'|'gift'|'title'|'badge',
  itemId: ObjectId,
  price: { currency: 'coins'|'diamonds', amount: Number },
  quantity: Number,
  status: 'listed'|'sold'|'cancelled',
  soldAt: Date,
  createdAt: Date
}

// Auctions
auctions: {
  _id: ObjectId,
  itemType: 'cosmetic'|'gift'|'title',
  itemId: ObjectId,
  startingBid: Number,
  currentBid: Number,
  bidderId: ObjectId,
  minIncrement: Number,
  reservePrice: Number,
  endTime: Date,
  status: 'active'|'ended'|'cancelled',
  winnerId: ObjectId,
  createdAt: Date
}

// ImmersiveThemes
immersiveThemes: {
  _id: ObjectId,
  key: String,
  name: String,
  type: 'room_background'|'profile_theme'|'entrance_effect'|'border',
  category: 'neon'|'cyberpunk'|'cafe'|'temple'|'mountain'|'space'|'lofi'|'beach'|'festival'|'nightclub'|'library'|'gaming'|'villa'|'luxury',
  colors: [String],
  animation: { type: String particles|'gradient'|'weather', config: Object },
  ambientSound: String,
  price: { coins: Number, diamonds: Number },
  premium: Boolean,
  available: Boolean
}

// AIFeedRankings (cached ML output)
aiFeedRankings: {
  _id: ObjectId,
  userId: ObjectId,
  items: [{
    itemType: 'room'|'profile'|'event'|'story'|'gift',
    itemId: ObjectId,
    score: Number,
    reason: String,
    expiresAt: Date
  }],
  calculatedAt: Date
}

// AINotifications
aiNotifications: {
  _id: ObjectId,
  userId: ObjectId,
  type: 'vibe_improved'|'new_match'|'room_suggestion'|'friend_suggestion'|'gift_suggestion'|'event_suggestion'|'reengagement',
  title: String,
  body: String,
  data: Object,
  scheduledFor: Date,
  sent: Boolean,
  clicked: Boolean,
  createdAt: Date
}
```

### 2.2 Existing Collection Modifications

```javascript
// Users — Add fields
users: {
  // ...existing fields...
  vibeGraphId: ObjectId,
  trustScore: { type: Number, default: 0 },
  behaviorScore: { type: Number, default: 100 },
  riskScore: { type: Number, default: 0 },
  trustLevel: { type: Number, default: 0 },
  verifiedBadge: Boolean,
  personalityType: String,
  attachmentStyle: String,
  loveLanguage: String,
  communicationStyle: String,
  learningStyle: String,
  relationshipIntent: String,
  vibeEnergy: Number,
  vibeMood: String,
  wingmanEnabled: Boolean,
  guildIds: [ObjectId],
  battlePass: { season: ObjectId, level: Number, premium: Boolean },
  totalXp: Number,
  level: Number,
  levelTitle: String,
  loginStreak: { current: Number, longest: Number, lastLogin: Date },
  dailyCheckin: { lastDate: Date, count: Number },
  cosmetics: {
    equipped: { frame: String, badge: String, entranceEffect: String, profileTheme: String },
    owned: [{ id: String, acquiredAt: Date }]
  },
  creatorSettings: {
    mentorId: ObjectId,
    agencyId: ObjectId,
    academyProgress: Number,
    totalEarnings: Number,
    payoutMethod: String
  }
}

// Rooms — Add fields
rooms: {
  // ...existing fields...
  mode: { type: String, enum: ROOM_MODES },
  theme: { type: String, enum: ROOM_THEMES },
  backgroundEffect: Object,
  ambientSound: String,
  spatialAudio: Boolean,
  giftHeat: Number, // accumulated gift value this session
  isGuildRoom: Boolean,
  guildId: ObjectId,
  featured: Boolean,
  aiRecommended: Boolean,
  mood: String,
  interestTags: [String],
  scheduledStart: Date,
  scheduledEnd: Date,
  hosts: [ObjectId],
  coHosts: [ObjectId]
}

// Gifts — Add fields
gifts: {
  // ...existing fields...
  effect3d: String,
  interactive: Boolean,
  comboMultiplier: Number,
  category: String, // 'normal'|'premium'|'limited'|'seasonal'|'mythology'|'space'|'dragon'|'luxury'
  theme: String, // 'aurora'|'galaxy'|'meteor'|'castle'|'jet'|etc.
  rarity: 'common'|'rare'|'epic'|'legendary'|'mythic',
  limitedEdition: { active: Boolean, total: Number, remaining: Number },
  collectionId: ObjectId,
  tradable: Boolean,
  upgradeable: Boolean,
  upgradePath: [ObjectId], // gift IDs for upgrades
  achievementGift: Boolean,
  petGift: Boolean,
  vehicleGift: Boolean
}

// Transactions
transactions: {
  // ...existing fields...
  diamondAmount: Number,
  giftId: ObjectId,
  marketplaceId: ObjectId,
  auctionId: ObjectId,
  battlePassId: ObjectId,
  missionId: ObjectId
}
```

---

## 3. API CONTRACTS (New + Modified Endpoints)

### 3.1 AI Vibe Graph

```
POST   /v1/vibe/init                           → { vibeGraph }
POST   /v1/vibe/update                         ← { message, context } → { vibeGraph, delta }
GET    /v1/vibe/matches                        ?page, limit → { matches: [{ user, scores }] }
GET    /v1/vibe/match/:userId                  → { overallScore, dimensionScores, trend }
GET    /v1/vibe/graph                          → { vibeGraph }
GET    /v1/vibe/trend                          → { trend: 'up'|'down'|'stable', history: [{ score, date }] }
GET    /v1/vibe/dimensions                     → { dimensions: [{ name, score, description }] }
POST   /v1/vibe/preferences                   ← { dimensions } → { vibeGraph }
```

### 3.2 AI Wingman

```
POST   /v1/ai/wingman/bio/generate            ← { currentBio, style } → { suggestion }
POST   /v1/ai/wingman/bio/rate                ← { bio } → { score, feedback }
POST   /v1/ai/wingman/opener                  ← { targetUserContext } → { openers: [String] }
POST   /v1/ai/wingman/reply                   ← { conversation: [{ role, content }] } → { suggestions: [String] }
POST   /v1/ai/wingman/coach                   ← { chatHistory } → { analysis, tips, redFlags }
POST   /v1/ai/wingman/photo/rate              ← { photoUrl } → { score, suggestions }
POST   /v1/ai/wingman/ghost/detect            ← { conversation } → { ghosting: Boolean, confidence }
POST   /v1/ai/wingman/date/plan               ← { preferences, budget } → { plan }
POST   /v1/ai/wingman/gift/recommend          ← { recipientContext, budget } → { recommendations: [{ gift, reason }] }
GET    /v1/ai/wingman/analytics               → { totalHelped, conversationsAnalyzed, improvement }
```

### 3.3 Discovery

```
GET    /v1/discover/trending                   ?page, limit → { rooms }
GET    /v1/discover/nearby                     ?lat, lng, radius → { rooms, users }
GET    /v1/discover/hubs                       → { hubs: [{ type, name, count }] }
GET    /v1/discover/hub/:type                  ?page, limit → { items }
GET    /v1/discover/swipe-rooms                → { rooms: [{ room, reason }] }
GET    /v1/discover/online-now                 ?page, limit → { users }
GET    /v1/discover/mutual-interests           → { users }
GET    /v1/discover/heat-map                   ?lat, lng, range → { heatPoints: [{ lat, lng, intensity }] }
GET    /v1/discover/live-map                   → { rooms: [{ room, lat, lng }] }
GET    /v1/discover/recommended                → { rooms, users, events }
```

### 3.4 Room Modes

```
GET    /v1/rooms/modes                        → { modes: [{ key, name, description, icon, minParticipants, maxParticipants }] }
POST   /v1/rooms/:id/mode                     ← { mode } → { room }
GET    /v1/rooms/:id/mode-state               → { mode, round, scores, participants }
POST   /v1/rooms/:id/mode/action              ← { action, data } → { modeState }
POST   /v1/rooms/mode/random                  → { room } // join random mode room
```

### 3.5 Immersive Themes

```
GET    /v1/themes                             → { themes: [{ key, name, type, category, preview, price }] }
POST   /v1/themes/purchase                    ← { themeKey } → { theme }
POST   /v1/rooms/:id/theme                    ← { themeKey } → { room }
GET    /v1/user/themes                        → { owned: [theme], equipped: { room, profile, entrance } }
POST   /v1/user/themes/equip                  ← { slot, themeKey } → { equipped }
```

### 3.6 Gifts v2

```
GET    /v1/gifts/v2                           ?category, rarity, page, limit → { gifts }
GET    /v1/gifts/collections                  → { collections: [{ id, name, gifts, bonus }] }
POST   /v1/gifts/combo                        ← { roomId, giftId, participants } → { comboResult }
POST   /v1/gifts/room-wide                    ← { roomId, giftId } → { effect }
POST   /v1/gifts/surprise-box                 ← { roomId, tier } → { revealedGift }
POST   /v1/gifts/upgrade                      ← { inventoryId } → { upgradedGift }
GET    /v1/inventory                          → { items: [{ id, gift, quantity, tradable }] }
POST   /v1/inventory/trade                    ← { targetUserId, offerItems, requestItems } → { trade }
```

### 3.7 Guilds

```
POST   /v1/guilds                            ← { name, tag, type, description } → { guild }
GET    /v1/guilds                            ?type, page, limit → { guilds }
GET    /v1/guilds/:id                        → { guild, members }
PUT    /v1/guilds/:id                        ← { updates } → { guild }
POST   /v1/guilds/:id/join                   → { membership }
POST   /v1/guilds/:id/leave                  → { success }
POST   /v1/guilds/:id/announcement           ← { message } → { success }
GET    /v1/guilds/:id/leaderboard            → { members: [{ user, contribution }] }
POST   /v1/guilds/:id/war/challenge          ← { targetGuildId } → { guildWar }
GET    /v1/guilds/:id/war/active             → { guildWar }
POST   /v1/guilds/:id/promote                ← { userId } → { success }
POST   /v1/guilds/:id/demote                 ← { userId } → { success }
```

### 3.8 Missions & Battle Pass

```
GET    /v1/missions                          ?type → { missions }
GET    /v1/missions/active                   → { daily, weekly, monthly, seasonal }
POST   /v1/missions/:id/progress             ← { delta } → { mission }
POST   /v1/missions/:id/claim                → { rewards }
GET    /v1/battle-pass                       → { battlePass, season }
POST   /v1/battle-pass/purchase              → { battlePass }
POST   /v1/battle-pass/level-up              → { battlePass, rewards }
```

### 3.9 AI Moderation

```
POST   /v1/moderation/check-text             ← { text } → { toxicity, spam, harassment, scam scores }
POST   /v1/moderation/check-voice            ← { audioUrl } → { abuse, toxicity scores }
POST   /v1/moderation/report                 ← { targetId, reason, evidence } → { report }
POST   /v1/moderation/appeal                 ← { reportId, statement } → { appeal }
GET    /v1/moderation/status                 → { trustScore, riskScore, shadowBanned }
```

### 3.10 Trust

```
POST   /v1/trust/face/verify                 ← { videoUrl } → { liveness, match, trustScore }
POST   /v1/trust/voice/verify                ← { audioUrl } → { voiceprint, trustScore }
GET    /v1/trust/status                      → { faceVerified, voiceVerified, trustLevel, badge }
GET    /v1/trust/leaderboard                 → { users: [{ user, trustScore }] }
```

### 3.11 AI Personalization

```
GET    /v1/ai/feed                           → { feed: [{ type, item, reason }] }
GET    /v1/ai/recommendations/friends        → { users: [{ user, reasons }] }
GET    /v1/ai/recommendations/rooms          → { rooms: [{ room, reason }] }
GET    /v1/ai/recommendations/gifts          → { gifts: [{ gift, reason }] }
GET    /v1/ai/recommendations/events         → { events: [{ event, reason }] }
GET    /v1/ai/notifications                  → { notifications: [{ title, body, priority }] }
```

### 3.12 Creator System v2

```
GET    /v1/creator/dashboard                 → { analytics, recentRooms, topSupporters }
GET    /v1/creator/analytics                 ?from, to → { sessions, earnings, gifts, viewers }
GET    /v1/creator/revenue-prediction        → { predictedRevenue, confidence }
POST   /v1/creator/highlights                ← { roomId } → { clip }
GET    /v1/creator/mentors                   → { mentors }
POST   /v1/creator/mentor/apply              ← { mentorId } → { mentorship }
GET    /v1/creator/academy                   → { courses: [{ id, title, progress }] }
POST   /v1/creator/referral                  ← { inviteeId } → { reward }
```

### 3.13 Economy v3

```
GET    /v1/economy/balance                   → { coins, diamonds }
POST   /v1/economy/purchase                  ← { itemType, itemId, currency } → { receipt }
POST   /v1/economy/cashback                  → { cashbackAmount }
GET    /v1/economy/transactions              ?page, limit → { transactions }
GET    /v1/marketplace                       ?category, rarity, page → { listings }
POST   /v1/marketplace/list                  ← { itemType, itemId, price, quantity } → { listing }
POST   /v1/marketplace/buy                   ← { listingId } → { item }
GET    /v1/auctions                          ?status → { auctions }
POST   /v1/auctions/bid                      ← { auctionId, amount } → { auction }
POST   /v1/auctions/create                   ← { itemType, itemId, startingBid, duration } → { auction }
```

---

## 4. ANDROID ARCHITECTURE UPDATES

### 4.1 Module Restructuring

```yaml
Current:
  yugm-app/ (single module, 50+ files, 5000+ line files)

Target:
  :app                     — DI, navigation, entry points
  :core:api                — YugmHttpClient, base parsers, auth interceptor
  :core:model              — Shared data classes (split into domain files)
  :core:ui                 — Theme, components, Avatar, common composables
  :core:util               — Permissions, extensions, constants
  :feature:auth            — Login, PhoneAuth, OTP, ProfileSetup
  :feature:discover        — Discover, Trending, Hubs, SwipeRooms, LiveMap
  :feature:room            — RoomLobby, VoiceRoom, VideoRoom, CreateRoom, EditRoom
  :feature:room-modes      — CoffeeDate, BlindDate, TruthDare, etc.
  :feature:chat            — ChatList, Chat, GroupChat
  :feature:dating          — DatingDiscovery, Matches, Preferences
  :feature:profile         — ProfileDetail, EditProfile, Settings
  :feature:creator         — CreatorDashboard, Analytics, Academy, Mentorship
  :feature:gift            — GiftCatalog, GiftPanel, Inventory
  :feature:guild           — GuildList, GuildDetail, GuildWar
  :feature:wallet          — Wallet, Transactions, Marketplace, Auctions
  :feature:gamiﬁcation     — Missions, BattlePass, Achievements, Streaks
  :feature:ai              — VibeGraph, Wingman, VibeMatch, Feed
  :feature:trust           — FaceVerification, VoiceVerification, TrustStatus
  :feature:events          — Events, EventCreate, EventDetail, Festival
  :feature:stories         — Stories, StoryViewer, StoryCreate
  :feature:pk              — PKBattle, PKHistory, PKLeaderboard
  :feature:moderation      — Report, Appeal, Status (user-facing)
  :feature:admin           — Moderation tools (if in-app for mods)
  :sync:work               — Background sync, notification scheduling
```

**Migration strategy (no-regression):**
1. Weeks 1–2: Create module structure within existing project (Gradle composite builds)
2. Move `Models.kt` → `:core:model` split by domain
3. Move `YugmApiParsers` → `:core:api:parsers` per domain
4. Move `YugmApi` → individual `:feature:*:api` delegates
5. Move screens → `:feature:*` modules
6. NavGraph → per-feature nested nav graphs + hub `NavGraph.kt`

### 4.2 Performance Architecture

```kotlin
// 1. Paging 3 for all lists
@Composable
fun <T : Any> YugmLazyColumn(
    pagingData: Flow<PagingData<T>>,
    itemContent: @Composable (T) -> Unit
) {
    val lazyItems = pagingData.collectAsLazyPagingItems()
    LazyColumn {
        items(lazyItems.itemCount) { index ->
            val item = lazyItems[index]
            if (item != null) itemContent(item)
        }
    }
}

// 2. Compose optimization annotations
@Stable
data class VibeGraphState(
    val dimensions: ImmutableList<VibeDimension>,
    val overallScore: Int
)

// 3. Immutable lists (Kotlinx ImmutableCollections)
implementation("org.jetbrains.kotlinx:kotlinx-collections-immutable:0.3.7")

// 4. Coil 3.x for images
AsyncImage(
    model = ImageRequest.Builder(context)
        .data(url)
        .memoryCachePolicy(CachePolicy.ENABLED)
        .diskCachePolicy(CachePolicy.ENABLED)
        .crossfade(true)
        .size(500, 500)
        .build(),
    contentDescription = null
)

// 5. DataStore for session (replace SharedPreferences)
val Context.dataStore by preferencesDataStore(name = "yugm_session")

// 6. Room for local cache
@Entity
data class CachedRoom(
    @PrimaryKey val id: String,
    val json: String, // cached JSON for offline
    val cachedAt: Long
)
```

### 4.3 State Architecture (MVVM + MVI)

```kotlin
// Event-based state management
sealed interface RoomAction {
    data class Join(val roomId: String) : RoomAction
    data class SendMessage(val text: String) : RoomAction
    data class SendGift(val giftId: String, val receiverId: String) : RoomAction
    object Leave : RoomAction
}

data class RoomState(
    val room: Room? = null,
    val messages: ImmutableList<ChatMessage> = persistentListOf(),
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class RoomViewModel @Inject constructor(
    private val roomApi: RoomApi,
    private val socketManager: SocketManager,
    savedStateHandle: SavedStateHandle
) : ViewModel() {
    private val roomId: String = savedStateHandle["roomId"] ?: ""
    
    private val _state = MutableStateFlow(RoomState())
    val state: StateFlow<RoomState> = _state.asStateFlow()
    
    init {
        viewModelScope.launch {
            socketManager.roomEvents(roomId).collect { event ->
                _state.update { /* handle real-time events */ }
            }
        }
    }
    
    fun onAction(action: RoomAction) {
        when (action) {
            is RoomAction.Join -> joinRoom()
            is RoomAction.SendMessage -> sendMessage(action.text)
            is RoomAction.SendGift -> sendGift(action.giftId, action.receiverId)
            is RoomAction.Leave -> leaveRoom()
        }
    }
}
```

### 4.4 Socket Architecture Upgrade

```kotlin
// Typed socket events with sealed classes
sealed interface SocketEvent {
    data class Message(val roomId: String, val message: ChatMessage) : SocketEvent
    data class Gift(val roomId: String, val gift: GiftEvent) : SocketEvent
    data class VibeUpdate(val delta: VibeDelta) : SocketEvent
    data class PkUpdate(val battle: PkBatte) : SocketEvent
    data class Presence(val userId: String, val status: PresenceStatus) : SocketEvent
    data class Moderation(val action: ModerationAction) : SocketEvent
    data class Notification(val notification: NotificationPayload) : SocketEvent
}

class SocketManager {
    private val _events = MutableSharedFlow<SocketEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<SocketEvent> = _events.asSharedFlow()
    
    inline fun <reified T : SocketEvent> eventsOfType(): Flow<T> =
        events.filterIsInstance<T>()
}
```

---

## 5. BACKEND ARCHITECTURE UPDATES

### 5.1 Microservices Decomposition

```yaml
Current: Single Express server (apps/api)
Target:
  api-gateway:          Express, rate-limiting, auth, routing → 200 req/s per node
  user-service:         CRUD, search, presence, following     → MongoDB
  room-service:         Rooms, modes, themes, scheduling      → MongoDB + Redis
  chat-service:         Messages, typing, read receipts       → MongoDB (sharded)
  gift-service:         Gifts, transactions, inventory        → MongoDB + double-entry ledger
  wallet-service:       Coins, diamonds, ledger, payouts      → MongoDB + PostgreSQL (ledger)
  pk-service:           Battles, leaderboards, tournaments    → MongoDB + Redis
  guild-service:        Guilds, wars, treasury                → MongoDB
  vibe-service:         VibeGraph, matching, recommendations  → MongoDB + Redis (cached)
  ai-service:           Wingman, moderation, feed, predictions → Node.js + TensorFlow.js / Python sidecar
  moderation-service:   ML inference, report queue, actions   → Python (FastAPI) + TensorFlow
  notification-service: FCM, in-app, scheduling, throttling   → Redis + BullMQ
  event-service:        Events, festivals, ticketing          → MongoDB
  mission-service:      Missions, battle pass, streaks        → MongoDB + Redis
  economy-service:      Marketplace, auctions, cashback       → MongoDB + PostgreSQL
  creator-service:      Dashboard, analytics, academy, mentorship → MongoDB
  admin-service:        Admin operations, analytics, config    → MongoDB
```

**Migration path:**
1. **MVP Phase**: Keep monolith, create route-based feature grouping with service classes
2. **V1 Phase**: Extract gift-service, wallet-service, vibe-service as separate processes
3. **V2 Phase**: Extract room-service, chat-service, ai-service, moderation-service
4. **V3 Phase**: Complete microservices with API gateway

### 5.2 LiveKit Architecture

```yaml
Room topology:
  Voice Room:     LiveKit room (audio only) + Socket.IO chat
  Video Room:     LiveKit room (audio+video) + Socket.IO chat
  Mode Room:      LiveKit room + Socket.IO game state + WebSocket mode sync
  
LiveKit agent architecture:
  yugm-livekit-agent/ (Python - Flask)
    - Audio monitoring (volume, tone, abuse detection)
    - Transcription (speech-to-text, real-time)
    - AI participant (AI wingman voice chat)
    - Recording (Cloud storage)
    - Spatial audio conﬁguration
```

### 5.3 AI Service Architecture

```yaml
ai-service:
  model: Node.js with BullMQ worker queue
  
  ML Models:
    VibeGraph:       Custom collaborative ﬁltering → cosine similarity
    Wingman:         GPT-4 API (OpenAI/Azure) with structured prompts
    Moderation:      TensorFlow.js toxicity model + custom harassment classiﬁer
    Feed:            XGBoost ranking model (ONNX runtime)
    Recommendations: ALS matrix factorization (weekly retraining)
  
  Caching:
    Vibe pre-computation: Redis sorted sets (ZSET), recalculated hourly
    Feed rankings: Redis sorted sets, updated on interaction
    Recommendations: Redis, TTL 1 hour
  
  Queue:
    vibe.update:     BullMQ queue, processed within 5 seconds
    feed.recalculate: BullMQ queue, hourly cron
    moderation.check: BullMQ queue, priority processing
```

### 5.4 Database Indexing Strategy

```javascript
// Critical indexes for scale
db.vibeGraph.createIndex({ userId: 1 }, { unique: true })
db.vibeMatches.createIndex({ userId: 1 }, { unique: true })
db.vibeMatches.createIndex({ 'matches.targetUserId': 1 })
db.guilds.createIndex({ type: 1, memberCount: -1 })
db.guilds.createIndex({ tags: 1 })
db.guildMembers.createIndex({ guildId: 1, userId: 1 }, { unique: true })
db.giftTransactions.createIndex({ toUserId: 1, createdAt: -1 })
db.giftTransactions.createIndex({ roomId: 1, createdAt: -1 })
db.giftTransactions.createIndex({ fromUserId: 1, createdAt: -1 })
db.giftInventory.createIndex({ userId: 1 })
db.giftInventory.createIndex({ tradable: 1, userId: 1 })
db.marketplace.createIndex({ status: 1, createdAt: -1 })
db.marketplace.createIndex({ itemType: 1, price: 1 })
db.auctions.createIndex({ status: 1, endTime: 1 })
db.userMissions.createIndex({ userId: 1, missionId: 1 }, { unique: true })
db.userMissions.createIndex({ userId: 1, type: 1, completed: 1 })
db.battlePass.createIndex({ userId: 1, 'season.id': 1 }, { unique: true })
db.aiFeedRankings.createIndex({ userId: 1 }, { unique: true })
db.aiFeedRankings.createIndex({ 'items.expiresAt': 1 }, { expireAfterSeconds: 0 })
db.aiNotifications.createIndex({ userId: 1, sent: 1, scheduledFor: 1 })
db.rooms.createIndex({ mode: 1, status: 1, participantCount: -1 })
db.rooms.createIndex({ mood: 1, interestTags: 1, status: 1 })
db.rooms.createIndex({ 'host.id': 1, scheduledStart: 1 })
db.rooms.createIndex({ featured: 1, status: 1, participantCount: -1 })
```

---

## 6. ADMIN PANEL ADDITIONS

```yaml
New admin pages:

Dashboard v2:
  - Real-time active rooms map
  - DAU/MAU chart with 7-day forecast (AI)
  - Revenue heat map (hourly/daily)
  - Top gifts by volume/value
  - PK battle activity
  - Vibe graph health (avg compatibility score)
  - Moderation queue depth
  - Guild activity metrics

User Management v2:
  - Trust score breakdown
  - Vibe graph visualizer (radar chart of dimensions)
  - Mission completion rates
  - Battle pass adoption
  - Marketplace activity
  - Report history timeline

Room Management v2:
  - Active rooms by mode (pie chart)
  - Theme distribution
  - Room heat map (geographic)
  - Mode performance analytics (avg duration, participant count)
  - AI room recommendations quality feedback

Gift Management v2:
  - Gift usage analytics
  - Collection completion rates
  - Marketplace pricing analytics
  - Auction performance
  - Limited edition inventory management
  - Combo gift effectiveness

Guild Management:
  - Guild list with member count, level, treasury
  - Guild war history
  - Guild leaderboards
  - Guild moderation (reports, toxic members)

Creator Management:
  - Creator leaderboard (earnings, followers, session time)
  - Payout processing dashboard
  - Academy progress tracking
  - Mentorship relationships
  - Agency management

AI Management:
  - Vibe match quality scores
  - Wingman usage analytics
  - Moderation model accuracy
  - Feed ranking CTR
  - Recommendation diversity metrics
  - Model retraining controls

Festival/Event Management:
  - Event calendar
  - Event analytics (participation, gifting, retention)
  - Festival gift inventory
  - Timed offer management

Economy Management:
  - Currency supply monitoring
  - Inflation metrics
  - VIP subscription analytics
  - Cashback effectiveness
  - Mystery box drop rates
  - Auction house controls

Moderation v2:
  - Real-time moderation dashboard (WebSocket feed)
  - AI moderation decisions review
  - Shadow banned users list
  - Appeal queue
  - Trust score override
  - Bulk moderation actions
  - Evidence timeline viewer
```

---

## 7. UI/UX IMPROVEMENTS

### 7.1 Premium Design System

```yaml
Color Palette Evolution:
  Current:      Dark (#060714), Panel (#0F1119), Primary (#E91E63)
  Target:       Same base + Aurora gradients + dynamic lighting
  
  Aurora gradients:
    - Sunrise:   #FF6B35 → #F7C59F → #EFEFBB
    - Sunset:    #FF512F → #DD2475 → #E94057
    - Northern:  #00F2FE → #4FACFE → #A18CD1
    - Ocean:     #0BDEFF → #2AF598 → #00F260
    - Cosmos:    #1A2980 → #26D0CE → #00E1FD
    - Fire:      #F12711 → #F5AF19 → #FFE000
    - Royal:     #141E30 → #E100FF → #4A00E0
    - Neon:      #00F2FE → #F20000 → #FEAC5E
  
  Glassmorphism:
    background: rgba(15, 17, 25, 0.6)
    border: rgba(255, 255, 255, 0.08)
    blur: 20px
    All cards, sheets, modals
  
  Depth system:
    z-index 0:   Background
    z-index 1:   Cards, panels
    z-index 2:   Sheets, dialogs
    z-index 3:   Modals, full-screen
    z-index 4:   Toasts, alerts
    z-index 5:   Premium effects (gifts, entrance)

Typography:
  Display:      Uncut Sans / Satoshi (variable font)
    - 72px Black for hero
    - 48px Black for screen titles
    - 32px Bold for section headers
  Body:         Inter
    - 16px Regular/Medium for body
    - 14px Regular for secondary
    - 12px Medium for captions
  Timer/Monospace: JetBrains Mono
    - PK countdowns, OTP, levels
  
Animation system:
  Duration:     200ms (micro) / 400ms (standard) / 800ms (hero) / 1200ms (celebratory)
  Easing:       cubic-bezier(0.16, 1, 0.3, 1) — "emphasized decelerate"
  Spring:       dampingRatio = 0.7, stiffness = 300 (elastic)
  Physics:      friction = 8, density = 1 (swipe, drag)

Iconography:
  Style:        Dual-tone gradient icons (linear gradient stroke)
  Set:          Custom Yugm icon set (200+ icons)
  Size:         24dp (standard), 32dp (action), 48dp (hero)
```

### 7.2 Compose Animation Architecture

```kotlin
// Animation primitives
object YugmAnim {
    val spring = spring<Float>(
        dampingRatio = 0.7f,
        stiffness = 300f
    )
    
    val emphasizedDecelerate = tween<Float>(
        durationMillis = 400,
        easing = FastOutSlowInEasing
    )
    
    val heroEnter = tween<Float>(
        durationMillis = 800,
        easing = CubicBezierEasing(0.16f, 1f, 0.3f, 1f)
    )
}

// Shared element transition (custom)
@ExperimentalSharedTransitionApi
@Composable
fun SharedTransitionScope.YugmSharedContent(
    key: Any,
    content: @Composable () -> Unit
) {
    SharedContent(
        state = rememberSharedContentState(key = key),
        animatedVisibilityScope = this,
        content = content
    )
}

// Particle system
@Composable
fun ParticleEffect(
    particleCount: Int = 50,
    colors: List<Color>,
    lifetime: Long = 2000,
    modifier: Modifier = Modifier
) {
    val particles = remember { MutableList(particleCount) { Particle.create() } }
    // Animate particles using Compose Canvas with recomposition
    Canvas(modifier = modifier.fillMaxSize()) {
        val now = System.currentTimeMillis()
        particles.forEach { particle ->
            particle.update(now)
            drawCircle(
                color = colors.random(),
                radius = particle.size,
                center = Offset(particle.x * size.width, particle.y * size.height),
                alpha = particle.alpha
            )
        }
    }
}

// Liquid swipe transition
@Composable
fun LiquidSwipeCard(
    onSwipeLeft: () -> Unit,
    onSwipeRight: () -> Unit,
    content: @Composable () -> Unit
) {
    val offsetX = remember { Animatable(0f) }
    val dismissProgress = offsetX.value / 300f
    
    Box(
        modifier = Modifier
            .pointerInput(Unit) {
                detectHorizontalDragGestures(
                    onDragEnd = {
                        if (abs(offsetX.value) > 150) {
                            // Trigger dismiss animation
                        } else {
                            offsetX.animateTo(0f, spring())
                        }
                    }
                ) { change, amount ->
                    change.consume()
                    scope.launch {
                        offsetX.snapTo((offsetX.value + amount).coerceIn(-300f, 300f))
                    }
                }
            }
            .graphicsLayer {
                translationX = offsetX.value
                rotationZ = offsetX.value * 0.1f
                // Liquid distortion shader effect via RenderEffect
            }
    ) {
        content()
    }
}
```

### 7.3 Screen-by-Screen UI Overhaul

```yaml
Splash:
  - Animated logo: neon gradient pulse → morph into wordmark
  - Particle background
  - 0 → 100% loading bar with Vibe quote
  - "Match the Vibe" with elastic entrance

Login:
  - Aurora gradient background (animated)
  - Glassmorphism card for form
  - Animated floating orbs
  - Elastic button press
  - Google/Phone buttons with hover glow

Discover:
  - Full-screen vertical swipe of room cards (like TikTok)
  - Each card: room preview, animated background, participant avatars orbiting
  - Swipe left → next room, swipe right → join
  - Top hubs as horizontal pill carousel with elastic scroll
  - Live map button (mini map overlay)
  - Bottom nav with premium glassmorphism

Room Lobby:
  - Room theme applied as full-screen background
  - Host avatar with animated glow ring (speaking detection)
  - Participant grid with floating avatars
  - Room background music (theme-dependent)
  - Interactive elements (furniture, ambient particles)
  - Mode-specific UI overlay

Voice/Video Room:
  - Spatial audio visualization
  - Participant circles orbiting in 3D space (perspective)
  - Speaking participant pulses toward center
  - Gift animations (full-screen particle explosions)
  - PK battle bar with live progress
  - Audience reaction emoji rain
  - AI wingman bot participant (optional)

Chat:
  - Bubble design with gradient backgrounds
  - Typing indicator with elastic dots
  - Gift card inline rendering
  - Voice message waveform
  - AI coach button (opens wingman panel)
  - Profile photo with speaking pulse

Profile:
  - 3D profile card (parallax on tilt)
  - Vibe graph radar chart (interactive)
  - Level progress with animated fill
  - Cosmetics showcase (animated frames, badges)
  - Trust badge with animated shield glow
  - Photo gallery with liquid swipe

Creator Dashboard:
  - Real-time income counter (animated number ticker)
  - Session heat map (interactive calendar)
  - Top supporters with animated gift leaderboard
  - Revenue prediction chart with confidence bands
  - AI highlights carousel

Gift Catalog:
  - 3D gift preview (Compose Canvas rendering)
  - Category filters with animated transitions
  - Rarity badges with particle effects
  - Collection view with progress rings
  - Limited edition countdown timer

Wallet:
  - Animated coin/diamond balance
  - Transaction list with category icons
  - Cashback progress ring
  - VIP subscription card with gradient
  - Withdraw flow with glassmorphism
```

---

## 8. MONETIZATION STRATEGY

### 8.1 Currency System

```yaml
Coins (soft currency — earnable):
  Sources:    Daily check-in, missions, room participation, PK wins, guild wars, leveling, login streaks
  Uses:       Basic gifts, room creation, cosmetics, profile boosts
  Earning rate: ~100–500 coins/day (active user)

Diamonds (hard currency — purchasable):
  Sources:    IAP purchases, cashback, mystery rewards, marketplace sales
  Uses:       Premium gifts, limited cosmetics, VIP subscription, battle pass, auction bids, room themes
  Pricing:    
    - Starter:     50 diamonds  → $0.99
    - Popular:     300 diamonds → $4.99
    - Premium:     800 diamonds → $9.99
    - Elite:       2000 diamonds → $19.99
    - Ultra:       5000 diamonds → $49.99
    - Legendary:   12000 diamonds → $99.99
```

### 8.2 Subscription Tiers

```yaml
Free:
  - Basic profile
  - Join up to 10 rooms/day
  - Send up to 5 gifts/day
  - Basic cosmetics
  - Standard matching
  ———— Retention hook: generous free tier

Plus ($4.99/month):
  - Unlimited room joins
  - Unlimited gifts
  - Premium cosmetics
  - Ad-free
  - Priority matching
  - AI wingman (basic)
  - Vibe graph insights
  - ———— Target: casual users who want more

Premium ($9.99/month):
  - All Plus features
  - Exclusive rooms (VIP lounge)
  - Creator analytics
  - AI wingman (advanced)
  - Priority support
  - Monthly diamond stipend (200)
  - Exclusive cosmetics
  - ———— Target: power users, creators

VIP ($19.99/month):
  - All Premium features
  - Guest appearance on trending
  - Verified badge
  - Profile boost
  - Personal AI concierge
  - Unlimited battle pass
  - Exclusive VIP room themes
  - Priority gifting (animated effects)
  - ———— Target: high-value users, aspiring creators
```

### 8.3 Revenue Drivers

```yaml
Gifts (60% of revenue):
  - Normal gifts:     1–50 diamonds
  - Premium gifts:    50–500 diamonds
  - Limited edition:  100–1000 diamonds  
  - Mythic gifts:     1000–10000 diamonds
  - Room-wide gifts:  200–5000 diamonds
  - Combo gifts:      pricing based on combo size
  Creator commission: 70% to creator, 30% to platform

Subscriptions (20% of revenue):
  - Monthly recurring revenue
  - Estimated conversion: 5–8% of DAU

Marketplace (10% of revenue):
  - Listing fee: 5% of sale price
  - Auction fee: 10% of final bid
  - Featured listing: 50 diamonds

Cosmetics (10% of revenue):
  - Profile themes:  50–200 diamonds
  - Entrance effects: 100–500 diamonds
  - Animated borders: 50–300 diamonds
  - Avatar items:    30–200 diamonds
  - Room themes:     100–1000 diamonds

Projection at 1M MAU:
  - 5% paying users = 50,000 payers
  - Avg revenue per paying user = $15/month
  - Monthly revenue = $750,000
  - Annual run rate = $9M
```

---

## 9. GROWTH STRATEGY

### 9.1 User Acquisition

```yaml
Tier 1 — Organic (40%):
  - Referral program: Invite friend → both get 100 coins + 10 diamonds
  - Guild recruitment: Guild leaders incentivized to grow
  - Creator referrals: Creators bring audience from other platforms
  - Content virality: Highlight clips shareable to Instagram/WhatsApp
  - ASO: Keyword-optimized store listing ("live chat", "voice rooms", "dating", "make friends")

Tier 2 — Paid (30%):
  - Meta Ads: Video ads showing room experiences, PK battles
  - TikTok Ads: Creator testimonials, gift reaction videos
  - Google UAC: Install campaigns optimized for retention
  - Influencer: Partner with Indian Gen-Z creators (10K–100K followers)
  - CPI target: $0.30–$0.50 (India market)

Tier 3 — Viral (30%):
  - Shareable moments: PK victory replays, gift explosions → share as video
  - Wave/Nudge: "X sent you a wave on Yugm" push notification
  - Room invites: "Join my room on Yugm" → deep link
  - Guild wars: "Your guild is under attack!" → re-engagement
  - Outcome-based sharing: "We're 93% vibe compatible! Find your vibe on Yugm"
```

### 9.2 Retention Loops

```yaml
Daily habits:
  - Daily check-in reward (streak-based): Day 1=50, Day 7=500, Day 30=2000 coins
  - Daily missions (3 per day, 15 min total)
  - Vibe ping from matches: "Your vibe improved after talking to X"
  - "Someone viewed your profile" push
  - Daily question → sparks conversation

Weekly habits:
  - Weekly missions (5 per week)
  - Guild war (weekend event)
  - PK tournament (Saturday)
  - Weekly leaderboard reset (Monday)
  - "Your weekly vibe report" (Sunday push)

Monthly habits:
  - Season pass reset
  - Monthly missions
  - Festival event (monthly themed)
  - "People you might vibe with" recalculated
  - Creator payouts (motivates creators)

Re-engagement:
  - Inactive 3 days: "Your vibe match X is waiting" push
  - Inactive 7 days: "You missed 500 coins from streak" push
  - Inactive 14 days: "X new people near you" email
  - Inactive 30 days: "Come back for 1000 bonus coins" push + email
  - Churn prediction: ML model triggers intervention before churn
```

---

## 10. PERFORMANCE OPTIMIZATION PLAN

### 10.1 Android Client

```yaml
Compose Optimization:
  - Audit all composables for skippability (add @Stable, @Immutable)
  - Replace mutable state hoisting with immutability patterns
  - Use `derivedStateOf` for computed values
  - Replace `remember { mutableStateOf() }` with `StateFlow` in ViewModels
  - LazyColumn: use `key`, `contentType`, `stickyHeaders`
  - Avoid recomposition outside visible area (LazyLayout)
  - Profile with Compose Compiler Metrics

Image Optimization:
  - Coil 3.x with disk cache (250MB) + memory cache (64MB)
  - Image pipeline: WebP (lossy) for profile, HLS for video thumbnails
  - Preload images on idle (LaunchedEffect + ImageLoader.enqueue)
  - BlurHash for loading placeholders
  - Responsive images by device density

Network Optimization:
  - GraphQL for complex queries (vibe graph, feed)
  - HTTP/2 multiplexing
  - Response compression (gzip)
  - Keep-alive connections
  - Connection pooling (5 per host)
  - Timeout: connect 10s, read 30s, write 30s
  - Retry: exponential backoff (1s, 2s, 4s, 8s, max 3 retries)
  - Offline queue for non-critical requests

Memory Optimization:
  - LeakCanary for detection
  - Avoid holding Activity/Context references
  - Use WeakReference for callbacks
  - ViewModel scoping for async work
  - Resource cleanup in onCleared()
  - Profile heap dumps for leak detection

Startup Optimization:
  - Baseline profiles (Cloud Profile Installer)
  - Lazy initialization for non-critical features
  - Splash screen with pre-warming
  - Defer heavy operations to post-Draw
  - Startup tracing (Android Studio CPU profiler)
```

### 10.2 Backend

```yaml
API Gateway:
  - Rate limiting: 100 req/min per user, 1000 req/min per IP
  - Response caching: Redis TTL 5s for discovery, 60s for static data
  - CDN caching: CloudFront for images, 7-day TTL
  - Compression: Brotli for JSON responses

Database:
  - MongoDB read replicas for queries
  - Redis cache for session, presence, leaderboards
  - Shard user data by userId (hash-based)
  - TTL indexes for ephemeral data (presence, sessions)
  - Aggregation pipeline optimization ($match first, $lookup last)
  - Connection pooling: 100 connections per node

Real-time:
  - Socket.IO with Redis adapter (horizontal scaling)
  - Room sharding by roomId across nodes
  - Presence via Redis pub/sub
  - LiveKit region routing (lowest latency node)
  - Message batching (batch DB writes every 100ms)

Background Jobs (BullMQ):
  - Vibe graph recalculation: hourly, priority low
  - Feed generation: on interaction, priority medium
  - Notification dispatch: real-time, priority high
  - Moderation queue: FIFO, priority critical
  - Analytics aggregation: every 15 minutes
  - Leaderboard calculation: every 5 minutes
```

---

## 11. SECURITY CHECKLIST

```yaml
Authentication:
  - [ ] JWT with short expiry (15 min) + refresh tokens (7 day)
  - [ ] Firebase ID token verification on every auth endpoint
  - [ ] Rate limit on login/signup (5 attempts/min)
  - [ ] Device fingerprint for suspicious login detection
  - [ ] Session invalidation on password change

API Security:
  - [ ] HTTPS only (HSTS header)
  - [ ] CORS whitelist (production origins only)
  - [ ] Request validation (JSON Schema / Zod)
  - [ ] SQL/NoSQL injection prevention (parameterized queries)
  - [ ] API key rotation for internal services
  - [ ] Request size limits (1MB for API, 10MB for uploads)

Data Protection:
  - [ ] PII encryption at rest (AES-256)
  - [ ] KYC data encryption with separate key
  - [ ] GDPR compliance (data deletion, export)
  - [ ] Data retention policies (30 day auto-delete for ephemeral)
  - [ ] Audit logs for sensitive operations (wallet, admin)

Anti-Abuse:
  - [ ] Rate limiting per endpoint category
  - [ ] Device fingerprinting for ban evasion detection
  - [ ] Phone number verification (Firebase)
  - [ ] Face verification for creator payouts
  - [ ] Shadow banning for repeat offenders
  - [ ] Content moderation pipeline (AI + human review)

Payment Security:
  - [ ] Razorpay/GPay server-side verification
  - [ ] Double-entry ledger for all transactions
  - [ ] Withdrawal limits (daily: $100, monthly: $1000)
  - [ ] Payout KYC verification
  - [ ] Fraud detection (velocity checks, pattern analysis)

Infrastructure:
  - [ ] Secrets management (environment variables, not code)
  - [ ] Dependency scanning (npm audit, Snyk)
  - [ ] Container vulnerability scanning
  - [ ] WAF for DDoS protection
  - [ ] Regular security audits
  - [ ] Incident response plan
```

---

## 12. TESTING STRATEGY

```yaml
Unit Tests (80% coverage target):
  - ViewModels: State transitions, action handling
  - Repositories: Error mapping, data transformation
  - Parsers: JSON → model with edge cases (null, missing fields, malformed)
  - Utils: Extensions, formatters, validators
  - Framework: JUnit 5 + MockK + Turbine (Flow testing)

Integration Tests:
  - API client: MockWebServer (OkHttp) for each endpoint
  - Socket events: Test event emission/reception
  - Navigation: Test route generation, argument encoding
  - Database: Room DAO operations
  - DI: Component graph validation

UI Tests:
  - Critical paths: Login → Discover → Join Room → Send Gift → Leave
  - Compose: `createComposeRule()` with `semantics` assertions
  - Screenshot tests for premium UI regression
  - Accessibility checks (contentDescription, touch targets)
  - Framework: Compose UI Test + Paparazzi (screenshot)

E2E Tests:
  - User registration → profile setup → discover → room → gift → logout
  - PK battle creation → joining → gifting → scoring → result
  - Wallet top-up → purchase → withdrawal
  - Multi-user scenarios (Detox / Maestro)
  - Framework: Maestro (cross-platform) + Detox (iOS/Android)

Performance Tests:
  - Compose recomposition count (Compose Compiler Metrics)
  - Frame rate (Profile GPU rendering)
  - Cold/warm start time
  - APK size
  - Network request count per screen
  - Memory allocation per session
  - Battery impact (per hour of room usage)

Load Tests:
  - API gateway: 1000 concurrent users
  - WebSocket: 500 concurrent connections
  - LiveKit: 50 concurrent rooms, 500 participants
  - Chat: 1000 messages/second
  - Gifting: 100 transactions/second
  - Framework: k6 (API), Artillery (WebSocket)
```

---

## 13. DEPLOYMENT CHECKLIST

```yaml
Pre-deployment:
  - [ ] Feature flags for new modules
  - [ ] Database migration scripts ready
  - [ ] Rollback plan documented
  - [ ] Monitoring dashboards updated
  - [ ] Alert thresholds configured
  - [ ] Load test results within acceptable range
  - [ ] Security scan passed
  - [ ] Dependency vulnerabilities checked
  - [ ] Environment variables configured
  - [ ] SSL certificates valid

Deployment Steps:
  1. Database: Run migrations (backup first)
  2. Redis: Flush cache (if schema changed)
  3. Backend: Deploy API servers (rolling update, 2 at a time)
  4. Workers: Deploy BullMQ workers (drain old queue first)
  5. LiveKit: Deploy agent (if new features)
  6. Android: Rollout to Play Store (staged: 10% → 50% → 100%)
  7. Admin: Deploy admin panel
  8. Monitor: Watch dashboards for 15 minutes

Rollback:
  - Database: Restore from backup (≤15 min RTO)
  - Backend: Revert to previous image
  - Android: Halt staged rollout, revert to previous version
  - Feature flags: Disable problematic feature

Post-deployment:
  - [ ] Verify critical user journeys
  - [ ] Check error rates (target < 0.1%)
  - [ ] Monitor latency (p95 < 500ms)
  - [ ] Verify analytics events firing
  - [ ] Check crash-free rate (target > 99.5%)
  - [ ] Review logs for anomalies
  - [ ] Confirm revenue metrics
```

---

## 14. PRODUCTION READINESS CHECKLIST

```yaml
Reliability:
  - [ ] Uptime SLA: 99.9% (8.7 hours downtime/year max)
  - [ ] Auto-scaling: +2 nodes when CPU > 70%, -1 when < 30%
  - [ ] Health checks: /health endpoint (every 30s)
  - [ ] Graceful degradation: Non-critical features degrade instead of crash
  - [ ] Circuit breakers: External service failures → cached fallback
  - [ ] Bulkheads: Separate thread pools per service

Monitoring:
  - [ ] APM: Datadog/New Relic (request tracing, DB query profiling)
  - [ ] Logs: Structured JSON logging (ELK stack)
  - [ ] Metrics: Prometheus + Grafana dashboards
  - [ ] Alerts: PagerDuty/Opsgenie integration
  - [ ] Uptime: Pingdom/Checkly synthetic monitoring
  - [ ] Crash reporting: Firebase Crashlytics + Sentry (backend)

Scalability:
  - [ ] Stateless API servers (horizontal scale)
  - [ ] Database read replicas (3 minimum)
  - [ ] Redis cluster (6 nodes minimum, 3 master + 3 replica)
  - [ ] CDN: CloudFront/Cloudflare for static assets
  - [ ] Image transformation: Server-side (imgix/Cloudinary)
  - [ ] Content delivery: Edge caching for API responses

Disaster Recovery:
  - [ ] Daily database backups (point-in-time recovery)
  - [ ] Multi-region failover (primary: ap-south-1, secondary: ap-southeast-1)
  - [ ] RTO: 30 minutes (API), 2 hours (full recovery)
  - [ ] RPO: 5 minutes (database), 1 hour (media)
  - [ ] Disaster recovery drill: Quarterly
  - [ ] Runbook: Documented recovery procedures

Compliance:
  - [ ] IT Act 2000 (India) compliance
  - [ ] Information Technology (Intermediary Guidelines) Rules, 2021
  - [ ] GDPR (if EU users)
  - [ ] COPPA (no under-13 users)
  - [ ] Age verification mechanism (minimum age 18 for dating features)
  - [ ] Content moderation as per Indian IT Rules
  - [ ] Grievance officer contact information
  - [ ] Monthly compliance report generation

Documentation:
  - [ ] API documentation (OpenAPI 3.0)
  - [ ] Architecture decision records (ADR)
  - [ ] Onboarding guide for developers
  - [ ] Runbook for operations team
  - [ ] Incident response playbook
  - [ ] Database schema documentation
  - [ ] Environment configuration guide
```

---

*This strategy document should be treated as a living document. Each phase should be reassessed based on metrics, user feedback, and market conditions. The goal is not to build everything, but to build the RIGHT things that drive retention, revenue, and user delight.*
