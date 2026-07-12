import { randomUUID } from "node:crypto";
import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Local disk storage for chat attachments. Bytes are written to a directory
 * that must be a MOUNTED VOLUME in production (so uploads survive container
 * rebuilds) — configured via UPLOADS_DIR, defaulting to <cwd>/uploads for dev.
 */
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "uploads");

/** 12 MB hard cap per file (kept under the 15mb Server Action body limit). */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export type SavedUpload = {
  fileName: string;
  mimeType: string;
  size: number;
  storageKey: string;
};

/** Derive a safe extension from the original name (letters/digits only). */
function safeExt(name: string): string {
  const ext = path.extname(name).slice(1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? `.${ext}` : "";
}

/** Strip control chars from a user-supplied filename and clamp its length. */
function cleanFileName(name: string): string {
  const stripped = Array.from(name)
    .filter((ch) => ch.codePointAt(0)! >= 0x20 && ch.codePointAt(0) !== 0x7f)
    .join("")
    .slice(0, 200)
    .trim();
  return stripped || "file";
}

/** Persist an uploaded File to disk, returning metadata for the DB row. */
export async function saveUpload(file: File): Promise<SavedUpload> {
  if (file.size <= 0) throw new Error("فایل خالی است.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("حجم فایل بیش از حد مجاز است (حداکثر ۱۲ مگابایت).");
  }
  await mkdir(UPLOADS_DIR, { recursive: true });

  const storageKey = `${randomUUID()}${safeExt(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOADS_DIR, storageKey), buffer);

  return {
    fileName: cleanFileName(file.name || "file"),
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    storageKey,
  };
}

/**
 * Resolve a storage key to an absolute path, guarding against path traversal.
 * Returns null if the key escapes the uploads dir or the file is missing.
 */
export async function resolveUploadPath(storageKey: string): Promise<string | null> {
  const resolved = path.resolve(UPLOADS_DIR, storageKey);
  const base = path.resolve(UPLOADS_DIR);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) return null;
  try {
    const s = await stat(resolved);
    if (!s.isFile()) return null;
  } catch {
    return null;
  }
  return resolved;
}
