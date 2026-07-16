import mongoose, { Schema } from "mongoose";

export interface IWatchParty extends mongoose.Document {
  roomId: mongoose.Types.ObjectId;
  hostId: mongoose.Types.ObjectId;
  title: string;
  mediaUrl: string;
  position: number;
  isPlaying: boolean;
}

const watchPartySchema = new Schema<IWatchParty>({
  roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, unique: true },
  hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, trim: true },
  mediaUrl: { type: String, required: true },
  position: { type: Number, default: 0 },
  isPlaying: { type: Boolean, default: false },
}, { timestamps: true });

export const WatchParty = mongoose.model<IWatchParty>("WatchParty", watchPartySchema);
