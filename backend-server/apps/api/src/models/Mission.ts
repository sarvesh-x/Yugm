import mongoose, { Schema } from "mongoose";

export interface IMission extends mongoose.Document {
  key: string;
  type: "daily" | "weekly" | "monthly" | "seasonal";
  title: string;
  description: string;
  requirements: {
    action: string;
    target: number;
    unit: string;
  };
  rewards: {
    xp: number;
    coins: number;
    diamonds: number;
    cosmeticId?: string;
    titleId?: string;
  };
  badge?: { icon: string; color: string };
  seasonId?: mongoose.Types.ObjectId;
  startDate?: Date;
  endDate?: Date;
  active: boolean;
}

const missionSchema = new Schema<IMission>(
  {
    key: { type: String, required: true, unique: true },
    type: { type: String, enum: ["daily", "weekly", "monthly", "seasonal"], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    requirements: {
      action: { type: String, required: true },
      target: { type: Number, required: true },
      unit: { type: String, default: "count" }
    },
    rewards: {
      xp: { type: Number, default: 0 },
      coins: { type: Number, default: 0 },
      diamonds: { type: Number, default: 0 },
      cosmeticId: String,
      titleId: String
    },
    badge: { icon: String, color: String },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season" },
    startDate: Date,
    endDate: Date,
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Mission = mongoose.model<IMission>("Mission", missionSchema);

export const missionSeeds: {
  key: string; type: IMission["type"]; title: string; description: string;
  requirements: { action: string; target: number; unit: string };
  rewards: { xp: number; coins: number; diamonds: number };
  badge?: { icon: string; color: string };
}[] = [
  { key: "daily_voice_10", type: "daily", title: "Voice Chat", description: "Spend 10 minutes in a voice room", requirements: { action: "room_duration", target: 10, unit: "minutes" }, rewards: { xp: 50, coins: 25, diamonds: 0 }, badge: { icon: "mic", color: "#00F2FE" } },
  { key: "daily_gift_1", type: "daily", title: "Gift Giver", description: "Send 1 gift to anyone", requirements: { action: "gift_send", target: 1, unit: "count" }, rewards: { xp: 30, coins: 15, diamonds: 0 }, badge: { icon: "gift", color: "#FF6B35" } },
  { key: "daily_chat_10", type: "daily", title: "Chatter", description: "Send 10 chat messages", requirements: { action: "chat_message", target: 10, unit: "count" }, rewards: { xp: 40, coins: 20, diamonds: 0 }, badge: { icon: "chat", color: "#4FACFE" } },
  { key: "daily_react_3", type: "daily", title: "React Master", description: "React to 3 room moments", requirements: { action: "room_reaction", target: 3, unit: "count" }, rewards: { xp: 25, coins: 10, diamonds: 0 }, badge: { icon: "heart", color: "#DD2475" } },
  { key: "daily_pk_1", type: "daily", title: "PK Battle", description: "Join 1 PK battle", requirements: { action: "pk_join", target: 1, unit: "count" }, rewards: { xp: 60, coins: 30, diamonds: 0 }, badge: { icon: "swords", color: "#E100FF" } },
  { key: "weekly_gift_5", type: "weekly", title: "Generous Heart", description: "Send 5 gifts over the week", requirements: { action: "gift_send", target: 5, unit: "count" }, rewards: { xp: 200, coins: 100, diamonds: 5 }, badge: { icon: "crown", color: "#FFD700" } },
  { key: "weekly_room_5", type: "weekly", title: "Room Hopper", description: "Join 5 different rooms", requirements: { action: "room_join", target: 5, unit: "count" }, rewards: { xp: 150, coins: 75, diamonds: 3 }, badge: { icon: "door", color: "#2AF598" } },
  { key: "weekly_host_2", type: "weekly", title: "Host Life", description: "Host or co-host 2 rooms", requirements: { action: "room_host", target: 2, unit: "count" }, rewards: { xp: 250, coins: 125, diamonds: 10 }, badge: { icon: "star", color: "#E94057" } },
  { key: "weekly_pk_3", type: "weekly", title: "Warrior", description: "Win 3 PK battles", requirements: { action: "pk_win", target: 3, unit: "count" }, rewards: { xp: 300, coins: 150, diamonds: 15 }, badge: { icon: "trophy", color: "#FF512F" } },
  { key: "weekly_chat_50", type: "weekly", title: "Social Butterfly", description: "Send 50 chat messages", requirements: { action: "chat_message", target: 50, unit: "count" }, rewards: { xp: 180, coins: 90, diamonds: 5 }, badge: { icon: "message", color: "#A18CD1" } },
  { key: "monthly_gift_30", type: "monthly", title: "Top Gifter", description: "Send 30 gifts this month", requirements: { action: "gift_send", target: 30, unit: "count" }, rewards: { xp: 800, coins: 400, diamonds: 50 }, badge: { icon: "diamond", color: "#00E1FD" } },
  { key: "monthly_room_20", type: "monthly", title: "Room Legend", description: "Spend 20 hours in rooms", requirements: { action: "room_duration", target: 1200, unit: "minutes" }, rewards: { xp: 1000, coins: 500, diamonds: 75 }, badge: { icon: "clock", color: "#26D0CE" } },
  { key: "monthly_host_10", type: "monthly", title: "Host Extraordinaire", description: "Host 10 rooms this month", requirements: { action: "room_host", target: 10, unit: "count" }, rewards: { xp: 1200, coins: 600, diamonds: 100 }, badge: { icon: "crown", color: "#E100FF" } },
  { key: "monthly_pk_15", type: "monthly", title: "PK Champion", description: "Win 15 PK battles", requirements: { action: "pk_win", target: 15, unit: "count" }, rewards: { xp: 1500, coins: 750, diamonds: 150 }, badge: { icon: "swords", color: "#FF00FF" } },
];
