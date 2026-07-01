import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next({
        status: 422,
        message: "Validation failed",
        errors: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
    }
    req.body = parsed.data;
    next();
  };
}
