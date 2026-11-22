import mongoose, { Schema, type Document } from "mongoose";

export interface MediaQuotaReservationDocument extends Document<string> {
  _id: string;
  /** Bytes held by this user's unexpired PENDING/PROCESSING upload sessions. */
  bytes: number;
  updatedAt: Date;
}

const mediaQuotaReservationSchema = new Schema<MediaQuotaReservationDocument>(
  {
    _id: { type: String, required: true },
    bytes: { type: Number, required: true, default: 0, min: 0 }
  },
  { timestamps: { createdAt: false, updatedAt: true }, _id: false }
);

export const MediaQuotaReservation = mongoose.model<MediaQuotaReservationDocument>(
  "MediaQuotaReservation",
  mediaQuotaReservationSchema
);
