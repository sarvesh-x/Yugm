import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { persistUploadedFile, safeUploadName } from "../services/storage.js";

export const uploadRouter = Router();

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    cb(null, safeUploadName((req as AuthRequest).user!.id, file.originalname));
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

const profileMediaUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".m4v", ".webm"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Only image/video uploads are allowed"));
    if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) return cb(new Error("Only image/video uploads are allowed"));
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

function hasVideoSignature(filePath: string) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(64);
    fs.readSync(fd, buffer, 0, buffer.length, 0);
    const ascii = buffer.toString("ascii");
    return ascii.includes("ftyp") || ascii.includes("webm") || ascii.includes("matroska");
  } finally {
    fs.closeSync(fd);
  }
}

function assertSafeProfileMedia(file?: Express.Multer.File) {
  if (!file) throw new HttpError(400, "No file uploaded", ErrorCode.VALIDATION);
  const isImage = file.mimetype.startsWith("image/");
  const valid = isImage ? hasImageSignature(file.path) : hasVideoSignature(file.path);
  if (!valid) {
    fs.unlink(file.path, () => {});
    throw new HttpError(400, "Invalid media file", ErrorCode.VALIDATION);
  }
  return isImage ? "IMAGE" : "VIDEO";
}

uploadRouter.post("/upload/avatar", requireAuth, upload.single("avatar"), asyncHandler(async (req: AuthRequest, res) => {
  assertSafeImage(req.file);
  const file = req.file!;
  const { url, storage } = await persistUploadedFile(file, "avatars");
  await req.user!.updateOne({ avatar: url });
  sendOk(res, { url, storage });
}));

uploadRouter.post("/upload/cover", requireAuth, upload.single("cover"), asyncHandler(async (req: AuthRequest, res) => {
  assertSafeImage(req.file);
  const file = req.file!;
  const { url, storage } = await persistUploadedFile(file, "covers");
  sendOk(res, { url, storage });
}));

uploadRouter.post("/upload/profile-media", requireAuth, profileMediaUpload.single("media"), asyncHandler(async (req: AuthRequest, res) => {
  const type = assertSafeProfileMedia(req.file);
  const file = req.file!;
  const { url, storage } = await persistUploadedFile(file, "profile-media");
  sendOk(res, { url, type, storage });
}));
