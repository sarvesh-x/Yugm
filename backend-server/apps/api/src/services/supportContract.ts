import { z } from "zod";

const CATEGORIES = [
  "General", "Account", "Payment", "Technical", "Report", "Content", "Other"
] as const;

export const createTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(2000),
  category: z.enum(CATEGORIES).default("General"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM")
});

export const addMessageSchema = z.object({
  message: z.string().min(1).max(2000)
});

export const publicRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  username: z.string().trim().max(32).refine(value => value.length === 0 || value.length >= 2).optional(),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
  requestType: z.enum(["ACCOUNT_DELETION", "PRIVACY", "SUPPORT"])
});
