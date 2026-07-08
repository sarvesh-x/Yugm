import mongoose, { Schema } from "mongoose";

const appConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    description: String,
    updatedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" }
  },
  { timestamps: true }
);

export const AppConfig = mongoose.model("AppConfig", appConfigSchema);
