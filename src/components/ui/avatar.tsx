import { initials } from "@/lib/utils";

export function Avatar({
  name,
  color = "#6366f1",
  size = 32,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-medium text-white"
      style={{
        backgroundColor: color,
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
      title={name}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
