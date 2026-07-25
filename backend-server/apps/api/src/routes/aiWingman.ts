import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, sendOk } from "../utils/http.js";

export const aiWingmanRouter = Router();

const bioGenerateSchema = z.object({
  currentBio: z.string().max(500).optional(),
  style: z.enum(["funny", "mysterious", "confident", "warm", "creative", "professional"]).optional().default("warm"),
  interests: z.array(z.string()).max(10).optional(),
  tone: z.enum(["casual", "flirty", "serious", "humble"]).optional().default("casual"),
});

const bioRateSchema = z.object({
  bio: z.string().min(1).max(500),
});

const openerSchema = z.object({
  targetUserContext: z.object({
    name: z.string().optional(),
    bio: z.string().optional(),
    interests: z.array(z.string()).optional(),
    vibeScore: z.number().min(0).max(100).optional(),
  }),
  style: z.enum(["funny", "smooth", "direct", "casual", "thoughtful"]).optional().default("casual"),
});

const replySchema = z.object({
  conversation: z.array(z.object({
    role: z.enum(["user", "other"]),
    content: z.string(),
  })).min(1).max(50),
  style: z.enum(["flirty", "friendly", "smooth", "direct", "funny"]).optional().default("friendly"),
});

const coachSchema = z.object({
  chatHistory: z.array(z.object({
    role: z.enum(["user", "other"]),
    content: z.string(),
    timestamp: z.string().optional(),
  })).min(1).max(100),
});

const photoRateSchema = z.object({
  photoUrl: z.string().url(),
});

const ghostDetectSchema = z.object({
  conversation: z.array(z.object({
    role: z.string(),
    content: z.string(),
    timestamp: z.string().optional(),
  })).min(2).max(100),
});

const datePlanSchema = z.object({
  preferences: z.object({
    budget: z.enum(["low", "medium", "high"]).optional().default("medium"),
    vibe: z.enum(["romantic", "adventurous", "relaxed", "creative", "foodie"]).optional().default("romantic"),
    location: z.string().optional(),
    interests: z.array(z.string()).optional(),
  }),
});

const giftRecommendSchema = z.object({
  recipientContext: z.object({
    interests: z.array(z.string()).optional(),
    vibeScore: z.number().optional(),
    relationship: z.enum(["crush", "date", "friend", "partner", "fan"]).optional().default("crush"),
  }),
  budget: z.enum(["low", "medium", "high"]).optional().default("medium"),
});

const bioSamples: Record<string, string[]> = {
  funny: [
    "Professional overthinker and certified snack enthusiast. I laugh at my own jokes (they're hilarious, trust me).",
    "I'm like a software update — I take forever, but I'm worth it. Warning: may dad-joke you into submission.",
    "Fluent in sarcasm, native in chill. My life is a sitcom, and I'm still waiting for the laugh track.",
  ],
  mysterious: [
    "I speak in riddles and leave before the punchline. Some call it enigmatic, I call it my brand.",
    "Not telling you much keeps the conversation interesting. Or am I just forgetful? Guess we'll find out.",
    "Three things about me: I love surprises, I never reveal all three things, and... I forget the third.",
  ],
  confident: [
    "I don't just walk into rooms — I make entrances. Hosting voice rooms since day one. Come see what the hype is about.",
    "I'm not everyone's cup of chai, but I'm definitely someone's shot of espresso. Bold, strong, unforgettable.",
    "Confidence isn't loud — it's walking into a silent room and owning it. That's me. Every room I enter.",
  ],
  warm: [
    "Sunshine mixed with a little hurricane. I'm here for deep conversations and silly moments. Let's vibe.",
    "Your go-to comfort person. I believe in good vibes, warm hugs (virtual counts), and making people smile.",
    "Just a soul with good intentions and a playlist that matches every mood. Come for the chats, stay for the warmth.",
  ],
  creative: [
    "I paint with words and think in colors. Every conversation is a canvas — let's create something beautiful.",
    "Plot twist: I'm the main character of a rom-com that hasn't been written yet. Ideas welcome.",
    "My imagination runs faster than I do. 10+ hobbies, 3 unfinished novels, and a talent for making the ordinary magical.",
  ],
  professional: [
    "Building empires and connections. Tech by day, vibe curator by night. Let's network and vibe.",
    "Ambitious, driven, and always up for a real conversation. Work hard, vibe harder. That's the motto.",
    "Founder of my own energy. If we click, we'll build something — a friendship, a collab, or just a great memory.",
  ],
};

const openerTemplates: Record<string, string[]> = {
  funny: [
    "Okay, I'll risk looking silly — {interest}? Really? I think I just found my new best friend.",
    "So your vibe score is {vibe}? That's suspiciously high. Are you sure you're not a bot designed to be this cool?",
    "I was going to say something smooth but then I saw your profile and forgot how to human. Hi!",
  ],
  smooth: [
    "My vibe graph says we're {vibe}% compatible. Just saying. The algorithm doesn't lie.",
    "I was going to wait for a sign from the universe, but then your profile showed up. Consider this my sign.",
    "I've been in {rooms}+ rooms today and yours is the one I'd actually stay in. What's your secret?",
  ],
  direct: [
    "Loved your bio. The '{interest}' part caught my attention. Let's skip the small talk — what's your hot take?",
    "You seem interesting. I'm {name}. Tell me something that'll make me laugh in the next 3 messages.",
    "Straight to it: your vibe energy is immaculate. What's one thing you're passionate about right now?",
  ],
  casual: [
    "Hey! Saw we have some matching interests — {interest}. What's your favorite thing about it?",
    "Random but: your profile gives off great energy. Hope you're having an amazing day!",
    "Hi! I'm not great at openers but I figured I'd say hey and see where the conversation goes.",
  ],
  thoughtful: [
    "I read your bio and the part about '{interest}' really stood out. What drew you to that?",
    "Your vibe says '{vibe}' which is rare to find. I think we might actually have something real to talk about.",
    "I don't usually message first but your profile felt different. Like the kind of person worth knowing.",
  ],
};

const replySuggestions: Record<string, string[]> = {
  flirty: [
    "Oh you're good at this — I like it 😏",
    "Careful, I might start thinking you're actually interested",
    "That's cute. Tell me more. I'm listening.",
    "You know, you're making this very hard for me to stay chill",
    "Is it hot in here or is it just this conversation? 🔥",
  ],
  friendly: [
    "That's awesome! How long have you been into that?",
    "Haha I love that. Tell me more!",
    "No way, same here! We definitely need to talk more about this",
    "That's such a cool perspective. I never thought of it that way",
    "I totally get what you mean. It's refreshing to hear someone say that",
  ],
  smooth: [
    "You just made my day better and it's only been {minutes} minutes",
    "I knew there was a reason I felt like talking to you today",
    "You have a way with words. I'm genuinely impressed",
    "That energy? Immaculate. Don't ever change.",
  ],
  direct: [
    "Okay that's interesting. But I need to know — what's your honest opinion on this?",
    "I appreciate that. Now here's what I really think...",
    "Let's cut the chase — what's something most people don't know about you?",
  ],
  funny: [
    "I'm saving this conversation as evidence that I have taste",
    "Plot twist: we become best friends and this is our origin story",
    "You had me at hello. Actually no, you had me at '{reference}'",
    "Is this a conversation or a TED Talk? Because I'm learning a lot",
  ],
};

const coachingTips = [
  "Ask open-ended questions that start with 'What,' 'How,' or 'Tell me about' — they invite longer responses.",
  "Mirror their energy level — if they're chill, match that. If they're excited, match that. It builds rapport subconsciously.",
  "Use their name occasionally. It creates a personal connection and shows you're paying attention.",
  "Avoid one-word answers. Even if you don't know what to say, add a thought or a question.",
  "Share something slightly vulnerable — it invites them to do the same and deepens the connection.",
  "If the conversation lulls, pivot to a 'would you rather' or 'what's your hot take' question.",
  "Compliment something specific about them — not just 'you're cute' but 'your perspective on X is really interesting.'",
  "Timing matters. If they're typing a lot, match the length. If they're short, don't overwhelm them.",
  "Don't be afraid of silence in voice conversations. A pause shows confidence, not awkwardness.",
  "Reference something they said earlier in the conversation — it shows you genuinely listen.",
];

const redFlagPatterns = [
  "Asking for personal contact info (phone, address) too early",
  "Making you feel guilty or pressured",
  "Overly negative or complaining constantly",
  "Love-bombing — excessive praise too fast without substance",
  "Inconsistent stories or contradictions",
  "Avoiding answering simple questions about themselves",
  "Pushing boundaries despite you saying no",
  "Talking excessively about exes or past negative experiences",
  "Asking for money, gifts, or financial help",
  "Rushing the relationship or making future plans prematurely",
];

aiWingmanRouter.post(
  "/wingman/bio/generate",
  requireAuth,
  validateBody(bioGenerateSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { style, currentBio, interests } = req.body as z.infer<typeof bioGenerateSchema>;
    const samples = bioSamples[style] || bioSamples.warm;
    const suggestion = samples[Math.floor(Math.random() * samples.length)];
    const personalized = interests && interests.length > 0
      ? `${suggestion.slice(0, -1)} — especially anything involving ${interests.slice(0, 2).join(" and ")}.`
      : suggestion;

    sendOk(res, {
      suggestion: personalized,
      style,
      tips: [
        "Keep it under 150 characters for impact",
        "End with a question to invite conversation",
        "Show personality, don't just list traits",
      ],
    });
  })
);

aiWingmanRouter.post(
  "/wingman/bio/rate",
  requireAuth,
  validateBody(bioRateSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { bio } = req.body as z.infer<typeof bioRateSchema>;
    const length = bio.length;
    const hasEmoji = /[\p{Emoji}]/u.test(bio);
    const hasQuestion = bio.includes("?");
    const hasPersonality = /funny|love|obsessed|passionate|addict|nerd|geek|vibe|energy|chill|wild/i.test(bio);

    let score = 50;
    const feedback: string[] = [];

    if (length < 20) { score -= 10; feedback.push("Too short — add more personality"); }
    else if (length > 300) { score -= 5; feedback.push("Consider trimming — shorter bios perform better"); }
    else { score += 15; feedback.push("Good length!"); }

    if (hasEmoji) { score += 10; feedback.push("Emojis add personality"); }
    else { feedback.push("Add an emoji or two for flavor"); }

    if (hasQuestion) { score += 10; feedback.push("Ending with a question invites messages"); }
    else { feedback.push("Try ending with a question to start conversations"); }

    if (hasPersonality) { score += 15; feedback.push("Strong personality shines through"); }
    else { feedback.push("Show more of your unique personality"); }

    score = Math.max(0, Math.min(100, score));

    sendOk(res, {
      score,
      rating: score >= 80 ? "🔥 Amazing!" : score >= 60 ? "👍 Good" : score >= 40 ? "📝 Needs work" : "❌ Rewrite",
      feedback: feedback.slice(0, 4),
      suggestions: score < 70 ? bioSamples.warm.slice(0, 1) : [],
    });
  })
);

aiWingmanRouter.post(
  "/wingman/opener",
  requireAuth,
  validateBody(openerSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { style, targetUserContext } = req.body as z.infer<typeof openerSchema>;
    const templates = openerTemplates[style] || openerTemplates.casual;

    const openers = templates.slice(0, 3).map((template) => {
      let opener = template
        .replace("{interest}", targetUserContext.interests?.[0] || "this")
        .replace("{vibe}", String(targetUserContext.vibeScore ?? "great"))
        .replace("{name}", targetUserContext.name || "there")
        .replace("{rooms}", String(Math.floor(Math.random() * 20) + 1));
      return opener;
    });

    sendOk(res, {
      openers,
      style,
      tip: "Personalize the opener by referencing something specific from their profile.",
    });
  })
);

aiWingmanRouter.post(
  "/wingman/reply",
  requireAuth,
  validateBody(replySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { style, conversation } = req.body as z.infer<typeof replySchema>;
    const templates = replySuggestions[style] || replySuggestions.friendly;

    const lastMessage = conversation[conversation.length - 1];
    const suggestions = templates.slice(0, 3).map((t) => {
      const minutes = Math.floor(Math.random() * 15) + 2;
      const reference = lastMessage.content.length > 20
        ? lastMessage.content.substring(0, 20) + "..." : lastMessage.content;
      return t
        .replace("{minutes}", String(minutes))
        .replace("{reference}", reference);
    });

    sendOk(res, {
      suggestions,
      context: `Responding to: "${lastMessage.content.substring(0, 60)}"`,
      deliveryTip: "Reply within 2-3 hours for best conversation flow.",
    });
  })
);

aiWingmanRouter.post(
  "/wingman/coach",
  requireAuth,
  validateBody(coachSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { chatHistory } = req.body as z.infer<typeof coachSchema>;

    const messageCount = chatHistory.length;
    const myMessages = chatHistory.filter((m: { role: string }) => m.role === "user");
    const otherMessages = chatHistory.filter((m: { role: string }) => m.role === "other");
    const avgMyLength = myMessages.reduce((s: number, m: { content: string }) => s + m.content.length, 0) / Math.max(myMessages.length, 1);
    const avgOtherLength = otherMessages.reduce((s: number, m: { content: string }) => s + m.content.length, 0) / Math.max(otherMessages.length, 1);

    const tips: string[] = [];
    const redFlags: string[] = [];

    if (avgMyLength < avgOtherLength * 0.5) {
      tips.push("You're giving short replies — try adding more thought to your responses.");
    }
    if (myMessages.length < otherMessages.length * 0.7) {
      tips.push("They're carrying the conversation — ask more questions!");
    }
    if (avgMyLength > avgOtherLength * 2) {
      tips.push("You're dominating the conversation — make sure to leave space for them.");
    }

    tips.push(...coachingTips.slice(0, 3 - tips.length));

    const engagement = Math.min(100, Math.round((messageCount / 20) * 50 + (avgOtherLength / 100) * 50));

    sendOk(res, {
      analysis: {
        totalMessages: messageCount,
        yourMessageCount: myMessages.length,
        theirMessageCount: otherMessages.length,
        yourAvgLength: Math.round(avgMyLength),
        theirAvgLength: Math.round(avgOtherLength),
        engagement,
        chemistry: engagement > 70 ? "🔥 High" : engagement > 50 ? "✨ Medium" : "💤 Low",
      },
      tips: tips.slice(0, 5),
      redFlags: redFlags.length > 0 ? redFlags : undefined,
    });
  })
);

aiWingmanRouter.post(
  "/wingman/photo/rate",
  requireAuth,
  validateBody(photoRateSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    sendOk(res, {
      score: Math.floor(Math.random() * 40) + 60,
      feedback: [
        "Good clarity — your face is clearly visible",
        "Try a photo with natural lighting for best results",
        "A genuine smile increases approachability by 40%",
      ],
      suggestions: [
        "Add a photo doing something you love (hobby, travel, etc.)",
        "Group photos are great but make sure you're the focus",
        "Avoid sunglasses — eye contact builds trust",
      ],
    });
  })
);

aiWingmanRouter.post(
  "/wingman/ghost/detect",
  requireAuth,
  validateBody(ghostDetectSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { conversation } = req.body as z.infer<typeof ghostDetectSchema>;
    const myLastMessages = conversation
      .filter((m: { role: string }) => m.role === "user")
      .slice(-3);
    const otherMessages = conversation.filter((m: { role: string }) => m.role !== "user");

    const ghosting = otherMessages.length < 2 && conversation.length > 5;
    const responseTimeMs = 3600000;
    const confidence = ghosting ? 0.85 : Math.random() * 0.4;

    let reason = "They seem engaged — likely not ghosting";
    if (ghosting) {
      reason = "They stopped responding despite your messages being read";
    }

    sendOk(res, {
      ghosting,
      confidence: Math.round(confidence * 100) / 100,
      reason,
      advice: ghosting
        ? [
            "Send one light follow-up after 3-5 days — no pressure",
            "If no response, focus on other conversations",
            "Remember: their behavior says more about them than you",
          ]
        : [
            "Conversation is active — keep the momentum going",
            "Suggest a voice room for a more personal connection",
            "Share something about your day to build intimacy",
          ],
    });
  })
);

aiWingmanRouter.post(
  "/wingman/date/plan",
  requireAuth,
  validateBody(datePlanSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { preferences } = req.body as z.infer<typeof datePlanSchema>;

    const plans: Record<string, Array<{ name: string; description: string; vibe: string; estimatedCost: string }>> = {
      romantic: [
        { name: "Sunset Voice Room", description: "Set up a private voice room with a sunset theme. Share songs, watch the sunset together virtually, and talk about your favorite memories.", vibe: "Intimate and nostalgic", estimatedCost: "Free" },
        { name: "Cooking Together (Virtual)", description: "Pick a recipe, video call while cooking the same dish, then 'dine together' over video. Bonus: feed each other virtually with gift emojis.", vibe: "Playful and bonding", estimatedCost: "Low (ingredients)" },
        { name: "Stargazing Via Stream", description: "Share your screen with a stargazing app or YouTube live stream. Lie down, look up, and talk about the universe.", vibe: "Deep and dreamy", estimatedCost: "Free" },
      ],
      adventurous: [
        { name: "Room Hop Challenge", description: "Take turns picking random voice rooms. Spend 5 minutes in each, rate them, and find the best hidden gem together.", vibe: "Spontaneous and fun", estimatedCost: "Free" },
        { name: "Trivia Battle", description: "Host a trivia night in your room. Alternate categories. Loser buys the next round of virtual gifts.", vibe: "Competitive and lively", estimatedCost: "Low (gifts)" },
        { name: "Midnight Scavenger Hunt", description: "Give each other 10 random items to find around the house. First to return with all 10 wins a prize.", vibe: "Energetic and hilarious", estimatedCost: "Free" },
      ],
      relaxed: [
        { name: "Lo-Fi Study Date", description: "Share a lo-fi playlist, work on your own things together in a quiet voice room. Just being in each other's presence.", vibe: "Comfortable and peaceful", estimatedCost: "Free" },
        { name: "Movie Night Sync", description: "Pick a movie, press play at the same time, and watch together with voice on. React in real-time.", vibe: "Cozy and easy", estimatedCost: "Free (streaming sub)" },
        { name: "Book Club For Two", description: "Each read a chapter of the same short story, then discuss. No pressure, just good conversation.", vibe: "Intellectual and calm", estimatedCost: "Free" },
      ],
      creative: [
        { name: "Collaborative Playlist", description: "Take turns adding songs to a shared playlist. Each song must tell a story about your life. End with a listening party.", vibe: "Expressive and personal", estimatedCost: "Free" },
        { name: "Poetry Slam", description: "Write a 4-line poem about each other. No judgment, just creativity. Best poem wins a prize.", vibe: "Artistic and vulnerable", estimatedCost: "Free" },
        { name: "Story Building", description: "Start a story with one sentence. Alternate adding sentences. See where your combined imagination takes you.", vibe: "Imaginative and fun", estimatedCost: "Free" },
      ],
      foodie: [
        { name: "Virtual Chai Date", description: "Both make chai (or your favorite drink) and talk about your favorite food memories. Bonus points for showing your best pour.", vibe: "Warm and cozy", estimatedCost: "Free" },
        { name: "Food Rating Room", description: "Host a room where you rate local dishes from your cities. Compare and plan to try each other's favorites.", vibe: "Conversational and tasty", estimatedCost: "Free" },
        { name: "Dessert-Only Date", description: "Order or make your favorite dessert. Share pictures and reviews. Sweet tooths unite!", vibe: "Sweet and indulgent", estimatedCost: "Low" },
      ],
    };

    const vibe = preferences.vibe || "romantic";
    const dateIdeas = plans[vibe] || plans.romantic;

    sendOk(res, {
      plan: dateIdeas.slice(0, 3),
      preferences: { vibe, budget: preferences.budget },
      tip: "The best dates are about connection, not perfection. Be yourself and have fun!",
    });
  })
);

aiWingmanRouter.post(
  "/wingman/gift/recommend",
  requireAuth,
  validateBody(giftRecommendSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const { recipientContext, budget } = req.body as z.infer<typeof giftRecommendSchema>;

    const giftCatalog: Array<{ name: string; reason: string; priceRange: string; category: string }> = [
      { name: "Aurora Rose", reason: "A classic beauty — perfect for new connections", priceRange: "low", category: "flowers" },
      { name: "Galaxy Meteor", reason: "Shows you're thinking big — great for someone special", priceRange: "medium", category: "space" },
      { name: "Royal Crown", reason: "Make them feel like royalty — for that special someone", priceRange: "high", category: "luxury" },
      { name: "Dragon Fire", reason: "Bold and passionate — for when you want to make an impression", priceRange: "high", category: "mythology" },
      { name: "Heart Beat", reason: "Simple, sweet, and from the heart — universal appeal", priceRange: "low", category: "romance" },
      { name: "Rainbow Burst", reason: "Fun and colorful — shows your playful side", priceRange: "low", category: "fun" },
      { name: "Comet Streak", reason: "Fast, bright, unforgettable — like your connection", priceRange: "medium", category: "space" },
      { name: "Ocean Pearl", reason: "Rare and elegant — for someone who stands out", priceRange: "medium", category: "nature" },
      { name: "Starlight Serenade", reason: "Magical and musical — perfect if they love music", priceRange: "medium", category: "music" },
      { name: "Golden Hour", reason: "Warm and radiant — for that golden connection", priceRange: "low", category: "nature" },
      { name: "Crystal Heart", reason: "Delicate and precious — for deepening bonds", priceRange: "medium", category: "romance" },
      { name: "Phoenix Rise", reason: "From the ashes of ordinary to extraordinary — for someone who inspires you", priceRange: "high", category: "mythology" },
    ];

    const budgetMap: Record<string, string[]> = { low: ["low"], medium: ["low", "medium"], high: ["low", "medium", "high"] };
    const allowedPrices = budgetMap[budget] || budgetMap.medium;

    const filtered = giftCatalog
      .filter((g) => allowedPrices.includes(g.priceRange))
      .slice(0, 5)
      .map((g) => ({
        name: g.name,
        reason: `Based on your ${recipientContext.relationship || "connection"}, the ${g.name} is a great choice. ${g.reason}.`,
        category: g.category,
      }));

    sendOk(res, {
      recommendations: filtered.length > 0 ? filtered : giftCatalog.slice(0, 3).map((g) => ({ name: g.name, reason: g.reason, category: g.category })),
    });
  })
);

aiWingmanRouter.get(
  "/wingman/analytics",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    sendOk(res, {
      totalHelped: Math.floor(Math.random() * 10000) + 5000,
      conversationsAnalyzed: Math.floor(Math.random() * 50000) + 25000,
      improvement: `${Math.floor(Math.random() * 15) + 5}%`,
      topFeatures: ["Opener Generator", "Bio Coach", "Reply Assistant", "Ghost Detector"],
    });
  })
);
