// Earthy "material" palette for صنف pills — leather, textile, walnut, steel…
// A dense repeating column of these reads calm and premium (not candy-colored),
// and each صنف gets a stable hue via a hash. Text stays theme-neutral; the hue
// lives in the dot + translucent tint, so pills read on both light and dark.
const MATERIAL = [
  { tint: "rgba(169,114,47,0.14)", dot: "#a9722f" }, // leather brown
  { tint: "rgba(160,85,99,0.14)", dot: "#a05563" }, // textile berry
  { tint: "rgba(138,106,58,0.14)", dot: "#8a6a3a" }, // walnut
  { tint: "rgba(91,113,134,0.15)", dot: "#5b7186" }, // steel
  { tint: "rgba(111,122,58,0.15)", dot: "#6f7a3a" }, // olive
  { tint: "rgba(63,143,125,0.15)", dot: "#3f8f7d" }, // teal
  { tint: "rgba(176,105,63,0.15)", dot: "#b0693f" }, // clay
  { tint: "rgba(125,91,138,0.15)", dot: "#7d5b8a" }, // plum
];

export function senfColor(s: string): { tint: string; dot: string } {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return MATERIAL[h % MATERIAL.length];
}
