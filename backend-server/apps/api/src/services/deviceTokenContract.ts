import { z } from "zod";

export const deviceTokenSchema = z.object({
  token: z.string().min(20),
  platform: z.enum(["android", "ios", "web"])
});

export const removeDeviceTokenSchema = deviceTokenSchema.pick({ token: true });
