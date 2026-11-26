import { arcPath, pol, SHARE_COLORS as C } from "./ShareDonut";

// Home-page artwork:
//  - a ring split into shares (the pot, divided);
//  - a fan of rays out of it, one per student, coloured by what happened to that share.
// Numbers are an illustrative class of 7 sharing an 84 USDC order, not live data.

const CX = 600;
const CY = 430;
const R_OUT = 150;
const R_IN = 96;

type Ray = "collected" | "held" | "now" | "refunded";
const RAYS: Ray[] = ["collected", "held", "collected", "now", "held", "refunded", "collected"];

const RAY_STOPS: Record<Ray, [string, string]> = {
  collected: ["#c9c6ee", "#3b3561"],
  held: ["#dfe2fa", "#7a83d6"],
  refunded: ["#e7f2ff", "#6fb3fb"],
  now: ["#ffe2bd", "#f2851c"],
};

const FAN_FROM = -62;
const FAN_TO = 62;
const GAP = 3.4;
const WEDGE = (FAN_TO - FAN_FROM - GAP * (RAYS.length - 1)) / RAYS.length;
const RAY_R0 = 200;
const RAY_R1 = 405;

function wedge(i: number) {
  const a0 = FAN_FROM + i * (WEDGE + GAP);
  const a1 = a0 + WEDGE;
  const pts = [pol(CX, CY, RAY_R0, a0), pol(CX, CY, RAY_R1, a0), pol(CX, CY, RAY_R1, a1), pol(CX, CY, RAY_R0, a1)];
  return { points: pts.map((p) => p.join(",")).join(" "), mid: (a0 + a1) / 2 };
}

// 3 collected, 1 refunded, 3 held: clockwise from 12 o'clock.
const SEGMENTS = [
  { key: "collected", from: 0, to: (3 / 7) * 360, color: C.collected },
  { key: "refunded", from: (3 / 7) * 360, to: (4 / 7) * 360, color: C.refunded },
  { key: "held", from: (4 / 7) * 360, to: 360, color: C.held },
];

export function HeroArt({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Ring />
    </div>
  );
}

function Ring() {
  const [cDotX, cDotY] = pol(CX, CY, 123, 77);
  const [hDotX, hDotY] = pol(CX, CY, 123, 283);
  const [rDotX, rDotY] = pol(CX, CY, 123, 180);

  return (
    <svg
      viewBox="0 0 1200 760"
      className="block h-auto w-full"
      role="img"
      aria-label="A ring showing a class order split into seven student shares, with one ray per student."
    >
      <defs>
        {(Object.keys(RAY_STOPS) as Ray[]).map((k) => (
          <radialGradient key={k} id={`ray-${k}`} gradientUnits="userSpaceOnUse" cx={CX} cy={CY} r={RAY_R1}>
            <stop offset={RAY_R0 / RAY_R1} stopColor={RAY_STOPS[k][0]} />
            <stop offset="1" stopColor={RAY_STOPS[k][1]} />
          </radialGradient>
        ))}
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.09  0 0 0 0 0.08  0 0 0 0 0.12  0 0 0 0.9 -0.32" result="speck" />
          <feComposite in="speck" in2="SourceGraphic" operator="in" result="g" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="g" />
          </feMerge>
        </filter>
      </defs>

      {/* the fan: one ray per student's share */}
      <g filter="url(#grain)">
        {RAYS.map((k, i) => (
          <polygon key={i} points={wedge(i).points} fill={`url(#ray-${k})`} />
        ))}
      </g>
      {RAYS.map((_, i) => {
        const [x, y] = pol(CX, CY, RAY_R1 - 26, wedge(i).mid);
        return (
          <text key={i} x={x} y={y + 5} textAnchor="middle" fontSize={15} fill="#fffdf8" className="font-display" opacity={0.95}>
            {String(i + 1).padStart(2, "0")}
          </text>
        );
      })}

      {/* orbit lines */}
      <g fill="none" stroke={C.refunded} strokeLinecap="round">
        <circle cx={CX} cy={CY} r={172} strokeWidth={1.2} opacity={0.8} />
        <path d={arcPath(CX, CY, 189, 190, 18, 98)} strokeWidth={1.2} fill={C.refunded} stroke="none" opacity={0.9} />
        <path d={arcPath(CX, CY, 205, 206, 214, 252)} strokeWidth={1.2} fill={C.refunded} stroke="none" opacity={0.9} />
        <path d={arcPath(CX, CY, 189, 206, 96, 98)} fill={C.refunded} stroke="none" opacity={0.9} />
      </g>
      <g fill={C.refunded}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} cx={330 + i * 26} cy={526} r={2.6} />
        ))}
      </g>

      {/* the ring */}
      <circle cx={CX} cy={CY} r={R_OUT + 14} fill="#f5f0e7" opacity={0.0} />
      {SEGMENTS.map((s) => (
        <path key={s.key} d={arcPath(CX, CY, R_IN, R_OUT, s.from, s.to)} fill={s.color} stroke="#f5f0e7" strokeWidth={3} />
      ))}
      <circle cx={CX} cy={CY} r={R_IN - 14} fill="#f9f5ee" />

      <g className="font-display" textAnchor="middle" fill="#17151f">
        <text x={CX - 40} y={CY - 6} fontSize={26}>$</text>
        <text x={CX + 8} y={CY + 10} fontSize={70} fontWeight={500}>84</text>
      </g>
      <g className="max-sm:hidden" textAnchor="middle" fontSize={12.5} fill="#6c6879">
        <text x={CX} y={CY + 34}>USDC pooled by</text>
        <text x={CX} y={CY + 50}>7 students</text>
      </g>

      {/* leader labels (hidden on small screens, where they would be too small to read) */}
      <g className="max-sm:hidden" stroke="#17151f" strokeWidth={1} fill="none">
        <path d={`M${cDotX} ${cDotY}L810 372H850`} />
        <path d={`M${hDotX} ${hDotY}L420 468H350`} />
        <path d={`M${rDotX} ${rDotY}V606`} />
      </g>
      <g className="max-sm:hidden" fill="#17151f">
        <circle cx={cDotX} cy={cDotY} r={3.6} />
        <circle cx={hDotX} cy={hDotY} r={3.6} />
        <circle cx={rDotX} cy={rDotY} r={3.6} />
      </g>
      <g className="max-sm:hidden">
        <text x={860} y={372} fontSize={26} className="font-display" fill="#17151f">36 USDC</text>
        <text x={860} y={392} fontSize={13} fill="#6c6879">paid to the vendor</text>
        <text x={340} y={468} fontSize={26} textAnchor="end" className="font-display" fill="#17151f">36 USDC</text>
        <text x={340} y={488} fontSize={13} textAnchor="end" fill="#6c6879">held in the vault</text>
        <text x={CX} y={638} fontSize={26} textAnchor="middle" className="font-display" fill="#17151f">12 USDC</text>
        <text x={CX} y={658} fontSize={13} textAnchor="middle" fill="#6c6879">back to the payer</text>
      </g>

      {/* the orange line, in the spirit of a poster */}
      <g fill={C.now} stroke={C.now} strokeWidth={1.1} className="font-outline">
        <text x={40} y={604} fontSize={56}>PAID ON</text>
        <text x={40} y={664} fontSize={56}>PICKUP,</text>
      </g>
      <g className="max-sm:hidden" fontSize={15} fill="#17151f">
        <text x={42} y={704}>Your share waits in the vault.</text>
        <text x={42} y={724}>The vendor is paid when you collect.</text>
      </g>

    </svg>
  );
}
