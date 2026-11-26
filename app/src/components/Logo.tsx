import { arcPath, SHARE_COLORS as C } from "./ShareDonut";

/** The Meridio mark: a ring cut into three shares. */
export function Logo({ size = 28 }: { size?: number }) {
  const parts = [
    { from: 4, to: 150, color: C.collected },
    { from: 156, to: 204, color: C.refunded },
    { from: 210, to: 356, color: C.held },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      {parts.map((p) => (
        <path key={p.from} d={arcPath(20, 20, 8.5, 18, p.from, p.to)} fill={p.color} />
      ))}
    </svg>
  );
}
