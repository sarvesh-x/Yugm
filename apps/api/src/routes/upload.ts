import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";

export const uploadRouter = Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${(req as AuthRequest).user!.id}_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Only images (jpg, jpeg, png, gif, webp) allowed"));
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image uploads are allowed"));
    cb(null, true);
  },
});

function hasImageSignature(filePath: string) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(16);
    fs.readSync(fd, buffer, 0, buffer.length, 0);
    const hex = buffer.toString("hex");
    const ascii = buffer.toString("ascii");
    return (
      hex.startsWith("ffd8ff") ||
      hex.startsWith("89504e470d0a1a0a") ||
      ascii.startsWith("GIF87a") ||
      ascii.startsWith("GIF89a") ||
      ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP"
    );
  } finally {
    fs.closeSync(fd);
  }
}

function assertSafeImage(file?: Express.Multer.File) {
  if (!file) throw new HttpError(400, "No file uploaded", ErrorCode.VALIDATION);
  if (!hasImageSignature(file.path)) {
    fs.unlink(file.path, () => {});
    throw new HttpError(400, "Invalid image file", ErrorCode.VALIDATION);
  }
}

uploadRouter.post("/upload/avatar", requireAuth, upload.single("avatar"), asyncHandler(async (req: AuthRequest, res) => {
  assertSafeImage(req.file);
  const file = req.file!;
  const url = `/uploads/${file.filename}`;
  await req.user!.updateOne({ avatar: url });
  sendOk(res, { url });
}));

uploadRouter.post("/upload/cover", requireAuth, upload.single("cover"), asyncHandler(async (req: AuthRequest, res) => {
  assertSafeImage(req.file);
  const file = req.file!;
  const url = `/uploads/${file.filename}`;
  sendOk(res, { url });
}));
