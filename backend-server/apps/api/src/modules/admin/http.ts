import type { Response } from "express";

export function adminOk(res: Response, data: unknown, meta: Record<string, unknown> = {}, status = 200) {
  res.status(status).json({ success: true, data, meta });
}

export function pageParams(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginationMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
