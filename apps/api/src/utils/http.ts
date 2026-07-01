import type { NextFunction, Request, Response } from "express";

export enum ErrorCode {
  VALIDATION = "VALIDATION",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
  CONFLICT = "CONFLICT",
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  INTERNAL = "INTERNAL",
  RATE_LIMITED = "RATE_LIMITED",
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: ErrorCode,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: T, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function sendOk(res: Response, data: unknown, status = 200) {
  res.status(status).json({ ok: true, data });
}

export function sanitizeText(value: string) {
  return value.replace(/[<>&"'\\]/g, "").trim().slice(0, 500);
}
