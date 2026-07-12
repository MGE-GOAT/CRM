import { readFile } from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { getApprovedSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { resolveUploadPath } from "@/lib/storage";

/**
 * Serve a chat attachment's bytes — only to a member of the channel the
 * attachment belongs to. Images render inline; everything else downloads.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getApprovedSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      fileName: true,
      mimeType: true,
      storageKey: true,
      message: { select: { channelId: true, deletedAt: true } },
    },
  });
  if (!attachment || attachment.message.deletedAt) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Authorization: must be a member of the owning channel.
  const member = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: { channelId: attachment.message.channelId, userId: user.id },
    },
    select: { id: true },
  });
  if (!member) return new NextResponse("Forbidden", { status: 403 });

  const filePath = await resolveUploadPath(attachment.storageKey);
  if (!filePath) return new NextResponse("Not found", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch {
    // File vanished between the stat in resolveUploadPath and this read.
    return new NextResponse("Not found", { status: 404 });
  }

  // Only render a strict allowlist of raster image types inline. Everything
  // else — notably SVG (which can carry scripts) and unknown types — is forced
  // to download, so opening an attachment can never execute as same-origin.
  const INLINE_IMAGE_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/avif",
  ]);
  const inline = INLINE_IMAGE_TYPES.has(attachment.mimeType);
  const disposition = inline ? "inline" : "attachment";
  // RFC 5987 encoding so non-ASCII (Persian) filenames survive the header.
  const encodedName = encodeURIComponent(attachment.fileName);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // Neutralize any active content if the file is ever rendered directly.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
