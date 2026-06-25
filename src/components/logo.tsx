import Image from "next/image";

const RATIO = 229 / 524; // trimmed logo aspect

/** Spun Holding gold logo (transparent PNG). Works on light or dark backgrounds. */
export function Logo({ width = 150 }: { width?: number }) {
  return (
    <Image
      src="/brand/spun-logo-trim.png"
      alt="اسپان هلدینگ"
      width={width}
      height={Math.round(width * RATIO)}
      priority
    />
  );
}
