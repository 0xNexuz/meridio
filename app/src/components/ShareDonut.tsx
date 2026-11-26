// The Meridio donut: one ring, split by what happened to each student's share.
// Used live on collection pages and as the centrepiece of the home-page artwork.

export const SHARE_COLORS = {
  collected: "#3b3561", // paid to the vendor
  held: "#8088d9", // paid in, waiting in the vault
  refunded: "#7dbbff", // went back to the payer
  now: "#f2851c", // being collected right now (artwork only)
} as const;

/** Polar to cartesian. Angles are degrees, clockwise from 12 o'clock. */
export function pol(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

/** A ring segment between two radii and two angles. */
export function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const end = Math.min(a1, a0 + 359.99);
  const large = end - a0 > 180 ? 1 : 0;
  const [x0, y0] = pol(cx, cy, r1, a0);
  const [x1, y1] = pol(cx, cy, r1, end);
  const [x2, y2] = pol(cx, cy, r0, end);
  const [x3, y3] = pol(cx, cy, r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
}

export function ShareDonut({
  collected,
  held,
  refunded,
  centerValue,
  centerLabel,
  className,
}: {
  collected: number;
  held: number;
  refunded: number;
  centerValue: string;
  centerLabel: string;
  className?: string;
}) {
  const total = collected + held + refunded;
  const parts = [
    { key: "collected", n: collected, color: SHARE_COLORS.collected },
    { key: "refunded", n: refunded, color: SHARE_COLORS.refunded },
    { key: "held", n: held, color: SHARE_COLORS.held },
  ];
  let angle = 0;
  const cx = 120;
  const cy = 120;
  return (
    <svg viewBox="0 0 240 240" className={className} role="img"
      aria-label={`${collected} collected, ${held} held in the vault, ${refunded} refunded`}>
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={82} fill="none" stroke="var(--rule)" strokeWidth={34} strokeDasharray="3 6" />
      ) : (
        parts
          .filter((p) => p.n > 0)
          .map((p) => {
            const sweep = (p.n / total) * 360;
            const d = arcPath(cx, cy, 64, 100, angle, angle + sweep);
            angle += sweep;
            return <path key={p.key} d={d} fill={p.color} stroke="var(--paper)" strokeWidth={2.5} />;
          })
      )}
      <circle cx={cx} cy={cy} r={110} fill="none" stroke={SHARE_COLORS.refunded} strokeWidth={1} opacity={0.7} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={34} className="font-display" fill="var(--ink)">
        {centerValue}
      </text>
      <text x={cx} y={cy + 24} textAnchor="middle" fontSize={11} fill="var(--muted)">
        {centerLabel}
      </text>
    </svg>
  );
}

export function DonutLegend({ collected, held, refunded }: { collected: number; held: number; refunded: number }) {
  const rows = [
    ["Paid to the vendor", collected, SHARE_COLORS.collected],
    ["Held in the vault", held, SHARE_COLORS.held],
    ["Refunded", refunded, SHARE_COLORS.refunded],
  ] as const;
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map(([label, n, color]) => (
        <li key={label} className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: color }} />
          <span className="text-muted">{label}</span>
          <span className="tabular ml-auto pl-4 font-medium">{n}</span>
        </li>
      ))}
    </ul>
  );
}
