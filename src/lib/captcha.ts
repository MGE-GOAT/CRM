// Server-only by construction: imports node:crypto and is only ever imported by
// the "use server" auth actions. Never import this from a client component.
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomInt,
  scryptSync,
} from "crypto";
import { deflateSync } from "zlib";

/**
 * Self-hosted, dependency-free CAPTCHA.
 *
 * The challenge code is rendered INTO an SVG image (returned as a data URI) and
 * its answer is sealed in an AES-256-GCM token. Nothing is fetched from a third
 * party (no Google reCAPTCHA / hCaptcha / Cloudflare), so it works on every
 * Iranian network where those services are blocked or throttled.
 *
 * The token is opaque (encrypted, not just signed) so the answer can't be read
 * out of the hidden form field, and each token is single-use within its TTL to
 * stop an attacker solving once and replaying the token across many password
 * guesses.
 */

const TTL_MS = 5 * 60 * 1000; // a challenge is valid for 5 minutes
const CODE_LENGTH = 5;
// Unambiguous alphabet — no 0/O, 1/I/L to avoid honest-user mistakes.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Derive a stable 32-byte key from the app secret. In production AUTH_SECRET is
// guaranteed (validated at startup in auth.ts); fall back only for local dev.
// scrypt is deliberately expensive, so cache the result — recomputing it on
// every seal/open would be a CPU-amplification vector via the refresh action.
let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret =
    process.env.AUTH_SECRET || "dev-only-insecure-captcha-secret-change-me";
  cachedKey = scryptSync(secret, "nexus-captcha-v1", 32);
  return cachedKey;
}

// Single-use ledger: jti -> expiry. In-memory is consistent with rate-limit.ts
// and adequate for the single-instance Docker deployment.
const consumed = new Map<string, number>();
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [jti, exp] of consumed) if (now > exp) consumed.delete(jti);
  }, TTL_MS).unref?.();
}

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

function seal(code: string): string {
  const iv = randomBytes(12);
  const jti = randomBytes(9).toString("base64url");
  const payload = JSON.stringify({ c: code.toLowerCase(), e: Date.now() + TTL_MS, j: jti });
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

type Sealed = { c: string; e: number; j: string };

function open(token: string): Sealed | null {
  try {
    const [ivB, tagB, dataB] = token.split(".");
    if (!ivB || !tagB || !dataB) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(dec.toString("utf8")) as Sealed;
  } catch {
    return null; // tampered, wrong key, or malformed
  }
}

// 5x7 stroke-font for the alphabet. Glyphs are drawn as <rect> pixels, NOT as
// <text>, so the answer is never present anywhere in the SVG source — a bot
// can't decode the data URI and regex the code out; it has to actually OCR a
// rotated, jittered, noise-covered bitmap.
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11100", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11100", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10101", "10011", "10001", "10001"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00001", "00010", "00110", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
};

// --- Minimal pure-Node PNG encoder (zlib is built in; no dependency) ---
// We rasterize to PNG so the client receives ONLY pixels: no glyph coordinates,
// no rotation transform, no font table — the rotation/jitter/noise are baked
// into the delivered bitmap, so an attacker must actually OCR the image rather
// than parse vector source. (A previous SVG version leaked the answer in source.)

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(w: number, h: number, rgb: Buffer): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  // 10,11,12 = compression/filter/interlace = 0
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Rasterize the code to a noisy, rotated PNG and return it as a base64 data URI. */
function renderImage(code: string): string {
  const PX = 4; // glyph pixel block size
  const GW = 5 * PX;
  const GH = 7 * PX;
  const GAP = 10;
  const PAD_X = 14;
  const PAD_Y = 14;
  const W = PAD_X * 2 + code.length * GW + (code.length - 1) * GAP;
  const H = PAD_Y * 2 + GH;
  const colors = [
    [31, 41, 55],
    [55, 48, 163],
    [124, 45, 18],
    [6, 78, 59],
    [131, 24, 67],
  ];

  // Background #f3f4f6
  const rgb = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    rgb[i * 3] = 0xf3;
    rgb[i * 3 + 1] = 0xf4;
    rgb[i * 3 + 2] = 0xf6;
  }
  const setPx = (x: number, y: number, r: number, g: number, b: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 3;
    rgb[o] = r;
    rgb[o + 1] = g;
    rgb[o + 2] = b;
  };
  const fillBlock = (x: number, y: number, size: number, c: number[]) => {
    for (let dy = 0; dy < size; dy++)
      for (let dx = 0; dx < size; dx++) setPx(x + dx, y + dy, c[0], c[1], c[2]);
  };

  for (let i = 0; i < code.length; i++) {
    const rows = FONT[code[i].toUpperCase()];
    if (!rows) continue;
    const ox = PAD_X + i * (GW + GAP);
    const oy = PAD_Y + randomInt(5) - 2;
    const cx = ox + GW / 2;
    const cy = oy + GH / 2;
    const ang = ((randomInt(37) - 18) * Math.PI) / 180;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const color = colors[randomInt(colors.length)];
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] !== "1") continue;
        // pixel center, with sub-pixel jitter, rotated about the glyph center —
        // the rotation is applied to the actual painted pixels, not a transform.
        const sx = ox + c * PX + PX / 2 + (randomInt(3) - 1);
        const sy = oy + r * PX + PX / 2 + (randomInt(3) - 1);
        const rx = cx + (sx - cx) * cos - (sy - cy) * sin;
        const ry = cy + (sx - cx) * sin + (sy - cy) * cos;
        fillBlock(rx - PX / 2, ry - PX / 2, PX + 1, color);
      }
    }
  }

  // Noise lines (Bresenham) + speckles painted as real pixels — indistinguishable
  // from glyph pixels in the raster, so they can't be filtered out structurally.
  for (let n = 0; n < 6; n++) {
    let x0 = randomInt(W);
    let y0 = randomInt(H);
    const x1 = randomInt(W);
    const y1 = randomInt(H);
    const c = colors[randomInt(colors.length)];
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < W + H; guard++) {
      setPx(x0, y0, c[0], c[1], c[2]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }
  for (let n = 0; n < 130; n++) {
    setPx(randomInt(W), randomInt(H), 120, 120, 130);
  }

  return `data:image/png;base64,${encodePng(W, H, rgb).toString("base64")}`;
}

export type Captcha = { token: string; image: string };

/** Issue a fresh challenge: a sealed token plus its rasterized image (data URI). */
export function generateCaptcha(): Captcha {
  const code = randomCode();
  return { token: seal(code), image: renderImage(code) };
}

/**
 * Verify a user's answer. Returns true only for a valid, unexpired, not-yet-used
 * token whose code matches (case-insensitively). Consumes the token on success
 * AND on a matched-but-replayed attempt so a token can never be reused.
 */
export function verifyCaptcha(token: string, input: string): boolean {
  if (!token || !input) return false;
  const data = open(token);
  if (!data) return false;
  if (Date.now() > data.e) return false;
  if (consumed.has(data.j)) return false; // already used
  consumed.set(data.j, data.e); // burn it regardless of match (single attempt)
  return data.c === input.trim().toLowerCase();
}
