import mongoose, { Schema } from "mongoose";

export interface IWishlistItem extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  giftId: mongoose.Types.ObjectId;
  message?: string;
  isPublic: boolean;
}

const wishlistItemSchema = new Schema<IWishlistItem>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  giftId: { type: Schema.Types.ObjectId, ref: "Gift", required: true },
  message: { type: String, trim: true, maxlength: 200 },
  isPublic: { type: Boolean, default: true },
}, { timestamps: true });

wishlistItemSchema.index({ userId: 1, giftId: 1 }, { unique: true });

export const WishlistItem = mongoose.model<IWishlistItem>("WishlistItem", wishlistItemSchema);
