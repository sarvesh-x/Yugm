import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { deleteStoredFile, managedAvatarKeyFromUrl, persistUploadedFile, safeUploadName } from "../services/storage.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";

export const uploadRouter = Router();

// Workers provide only request-scoped temporary disk; persisted files must be
// copied to durable storage before the request ends. Keep the staging limit
// conservative until large uploads are moved to a streaming/chunked design.
const UPLOAD_DIR = env.YUGM_RUNTIME === "cloudflare" ? "/tmp/yugm-uploads" : path.join(process.cwd(), "uploads");
const TRUST_UPLOAD_DIR = env.YUGM_RUNTIME === "cloudflare" ? "/tmp/yugm-trust-uploads" : path.join(process.cwd(), "private-uploads", "trust-verification");
const workerUploadLimit = 10 * 1024 * 1024;
const uploadLimit = (bytes: number) => env.YUGM_RUNTIME === "cloudflare" ? Math.min(bytes, workerUploadLimit) : bytes;

function uploadDestination(directory: string, cb: (error: Error | null, destination: string) => void) {
  try {
    fs.mkdirSync(directory, { recursive: true });
    cb(null, directory);
  } catch (error) {
    cb(error instanceof Error ? error : new Error(String(error)), directory);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => uploadDestination(UPLOAD_DIR, cb),
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
  limits: { fileSize: uploadLimit(25 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".m4v", ".webm"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Only image/video uploads are allowed"));
    if (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) return cb(new Error("Only image/video uploads are allowed"));
    cb(null, true);
  },
});

const trustStorage = multer.diskStorage({
  destination: (_req, _file, cb) => uploadDestination(TRUST_UPLOAD_DIR, cb),
  filename: (req, file, cb) => cb(null, safeUploadName((req as AuthRequest).user!.id, file.originalname))
});

const trustVerificationUpload = multer({
  storage: trustStorage,
  limits: { fileSize: uploadLimit(30 * 1024 * 1024) },
  fileFilter: (req, file, cb) => {
    const purpose = String(req.body.purpose || "").toUpperCase();
    const ext = path.extname(file.originalname).toLowerCase();
    const faceAllowed = [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".m4v", ".webm"];
    const voiceAllowed = [".mp3", ".m4a", ".aac", ".wav", ".webm", ".ogg"];
    if (purpose === "VOICE") {
      if (!voiceAllowed.includes(ext) || !file.mimetype.startsWith("audio/") && file.mimetype !== "video/webm") {
        return cb(new Error("Only audio uploads are allowed for voice verification"));
      }
      return cb(null, true);
    }
    if (!["FACE", "LIVENESS"].includes(purpose)) return cb(new Error("Invalid trust verification upload purpose"));
    if (!faceAllowed.includes(ext) || !file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) {
      return cb(new Error("Only image/video uploads are allowed for face and liveness verification"));
    }
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

function hasAudioSignature(filePath: string) {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(64);
    fs.readSync(fd, buffer, 0, buffer.length, 0);
    const hex = buffer.toString("hex");
    const ascii = buffer.toString("ascii");
    return (
      ascii.startsWith("ID3") ||
      hex.startsWith("fff") ||
      ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE" ||
      ascii.includes("ftypM4A") ||
      ascii.includes("OggS") ||
      ascii.includes("webm")
    );
  } finally {
    fs.closeSync(fd);
  }
}

function assertSafeTrustMedia(file: Express.Multer.File | undefined, purpose: string) {
  if (!file) throw new HttpError(400, "No file uploaded", ErrorCode.VALIDATION);
  const normalizedPurpose = purpose.toUpperCase();
  const valid = normalizedPurpose === "VOICE"
    ? hasAudioSignature(file.path) || hasVideoSignature(file.path)
    : file.mimetype.startsWith("image/")
      ? hasImageSignature(file.path)
      : hasVideoSignature(file.path);
  if (!valid) {
    fs.unlink(file.path, () => {});
    throw new HttpError(400, "Invalid verification media file", ErrorCode.VALIDATION);
  }
  return normalizedPurpose;
}

const AVATAR_MAX_BYTES = 220 * 1024;

async function discardStoredAvatar(stored?: { url: string; key?: string }) {
  if (!stored) return;
  const reference = stored.key ?? path.basename(stored.url);
  await deleteStoredFile("avatars", reference).catch((error) => {
    console.warn("[upload/avatar] failed to remove stored avatar object", error);
  });
}

uploadRouter.post("/upload/avatar", requireAuth, upload.single("avatar"), asyncHandler(async (req: AuthRequest, res) => {
  assertSafeImage(req.file);
  const file = req.file!;
  const previousAvatar = req.user!.avatar;
  let stored: Awaited<ReturnType<typeof persistUploadedFile>> | undefined;
  try {
    if (file.size > AVATAR_MAX_BYTES) {
      throw new HttpError(400, "Avatar image is too large. Please choose or crop a smaller image.", ErrorCode.VALIDATION);
    }

    stored = await persistUploadedFile(file, "avatars");
    await User.updateOne(
      { _id: req.user!._id },
      { $set: { avatar: stored.url, "activeCosmetics.avatarAsset": "" } }
    );

    const previousKey = managedAvatarKeyFromUrl(previousAvatar);
    if (previousKey && previousKey !== stored.key) {
      await deleteStoredFile("avatars", previousKey).catch((error) => {
        console.warn("[upload/avatar] failed to remove the previous avatar object", error);
      });
    }

    sendOk(res, { url: stored.url, storage: stored.storage });
  } catch (error) {
    await discardStoredAvatar(stored);
    throw error;
  } finally {
    // The local driver keeps the staged file as the stored object.
    if (!stored || env.STORAGE_DRIVER !== "local") {
      await fsp.unlink(file.path).catch(() => {});
    }
  }
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

uploadRouter.post("/upload/trust-verification", requireAuth, trustVerificationUpload.single("media"), asyncHandler(async (req: AuthRequest, res) => {
  const purpose = assertSafeTrustMedia(req.file, String(req.body.purpose || ""));
  const file = req.file!;
  const { url, storage } = await persistUploadedFile(file, "trust-verification");
  sendOk(res, { url, purpose, storage });
}));

uploadRouter.post("/upload/story", requireAuth, profileMediaUpload.single("media"), asyncHandler(async (req: AuthRequest, res) => {
  const type = assertSafeProfileMedia(req.file);
  const file = req.file!;
  const { url, storage } = await persistUploadedFile(file, "stories");
  sendOk(res, { url, type, storage });
}));

const voiceNoteUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".mp3", ".m4a", ".aac", ".wav", ".webm", ".ogg"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Only audio files are allowed"));
    if (!file.mimetype.startsWith("audio/") && file.mimetype !== "video/webm") return cb(new Error("Only audio uploads are allowed"));
    cb(null, true);
  },
});

uploadRouter.post("/upload/voice-note", requireAuth, voiceNoteUpload.single("media"), asyncHandler(async (req: AuthRequest, res) => {
  const file = req.file!;
  const { url, storage } = await persistUploadedFile(file, "voice-notes");
  sendOk(res, { url, type: "AUDIO", storage });
}));

const recordingUpload = multer({
  storage,
  limits: { fileSize: uploadLimit(200 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    const allowed = [".mp3", ".m4a", ".aac", ".wav", ".webm", ".ogg", ".mp4", ".mov", ".m4v"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error("Only audio/video recording files are allowed"));
    if (!file.mimetype.startsWith("audio/") && !file.mimetype.startsWith("video/")) {
      return cb(new Error("Only audio/video uploads are allowed"));
    }
    cb(null, true);
  },
});

uploadRouter.post("/upload/recording", requireAuth, recordingUpload.single("media"), asyncHandler(async (req: AuthRequest, res) => {
  const file = req.file!;
  const { url, storage } = await persistUploadedFile(file, "recordings");
  sendOk(res, { url, type: file.mimetype.startsWith("audio/") ? "AUDIO" : "VIDEO", storage });
}));
