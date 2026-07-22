import mongoose, { Schema } from "mongoose";

export interface IDailyQuestion extends mongoose.Document {
  question: string;
  category: string;
  date: Date;
  isActive: boolean;
}

const dailyQuestionSchema = new Schema<IDailyQuestion>(
  {
    question: { type: String, required: true, maxlength: 300 },
    category: { type: String, default: "general" },
    date: { type: Date, required: true, unique: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

dailyQuestionSchema.index({ date: 1 }, { unique: true });
dailyQuestionSchema.index({ isActive: 1, date: -1 });

export interface IUserDailyAnswer extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  answer: string;
  isPublic: boolean;
}

const userDailyAnswerSchema = new Schema<IUserDailyAnswer>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    questionId: { type: Schema.Types.ObjectId, ref: "DailyQuestion", required: true },
    answer: { type: String, required: true, maxlength: 500 },
    isPublic: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userDailyAnswerSchema.index({ userId: 1, questionId: 1 }, { unique: true });
userDailyAnswerSchema.index({ questionId: 1 });

export const DailyQuestion = mongoose.model<IDailyQuestion>("DailyQuestion", dailyQuestionSchema);
export const UserDailyAnswer = mongoose.model<IUserDailyAnswer>("UserDailyAnswer", userDailyAnswerSchema);
