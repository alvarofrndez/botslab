import { Art, Clay, HappyEyes, OpenEyes, type Palette } from "./shared";

/**
 * Meta's Muse: a fluffy plush. The fur is plain geometry (a tufted outline,
 * wisps along the edges and fibres inside) generated once from a fixed seed,
 * so it costs no more to paint than any other shape.
 */

type Pt = [number, number];

const FUR: Palette = { light: "#FFFDF7", base: "#F1E8D5", dark: "#D9CAAC", deep: "#9C8763" };
const SKIN: Palette = { light: "#FDF3EA", base: "#F5E2D0", dark: "#E6C9AF", deep: "#B88E6E" };

function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => n.toFixed(1);

/** Sample a closed Catmull–Rom spline through clockwise control points. */
function spline(pts: Pt[], steps: number): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [pts[(i + n - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const at = (k: 0 | 1) =>
        0.5 *
        (2 * p1[k] +
          (p2[k] - p0[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
          (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t * t * t);
      out.push([at(0), at(1)]);
    }
  }
  return out;
}

function ellipse(cx: number, cy: number, rx: number, ry: number, deg: number, n: number): Pt[] {
  const a = (deg * Math.PI) / 180;
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
  });
}

/** Outward unit normals of a clockwise outline. */
function normals(pts: Pt[]): Pt[] {
  const n = pts.length;
  return pts.map((_, i) => {
    const [ax, ay] = pts[(i + n - 1) % n];
    const [bx, by] = pts[(i + 1) % n];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    return [(by - ay) / len, -(bx - ax) / len];
  });
}

/** A smooth closed path through the points. */
function smooth(pts: Pt[]) {
  const mid = (a: Pt, b: Pt) => `${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)}`;
  const n = pts.length;
  let d = `M${mid(pts[n - 1], pts[0])}`;
  for (let i = 0; i < n; i++) d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${mid(pts[i], pts[(i + 1) % n])}`;
  return `${d}Z`;
}

interface Fur {
  /** The tufted silhouette. */
  outline: string;
  /** Wisps poking out past it, split into lit and shaded strands. */
  light: string;
  dark: string;
}

/** Fluff an outline: soft tufts all round, and a fine fuzz along the edge. */
function fluff(base: Pt[], seed: number, amp = 1): Fur {
  const rnd = random(seed);
  const n = base.length;
  const nm = normals(base);
  const raw = base.map(() => rnd());
  const tuft = raw.map((_, i) => {
    let sum = 0;
    for (let k = -2; k <= 2; k++) sum += raw[(i + k + n) % n] * (3 - Math.abs(k));
    return sum / 9;
  });
  const outline = smooth(base.map((p, i) => [p[0] + nm[i][0] * amp * tuft[i], p[1] + nm[i][1] * amp * tuft[i]]));
  let light = "";
  let dark = "";
  base.forEach(([x, y], i) => {
    if (rnd() < 0.15) return;
    const [nx, ny] = nm[i];
    const len = 0.5 + rnd() * 1.1 + amp * tuft[i];
    const bend = (rnd() - 0.5) * 1.2;
    const tx = x + (nx * Math.cos(bend) - ny * Math.sin(bend)) * len;
    const ty = y + (ny * Math.cos(bend) + nx * Math.sin(bend)) * len;
    const strand = `M${f(x - nx * 1.4)} ${f(y - ny * 1.4)}L${f(tx)} ${f(ty)}`;
    // Strands facing the light (top left) catch it.
    if (nx * -0.6 + ny * -0.8 > -0.25) light += strand;
    else dark += strand;
  });
  return { outline, light, dark };
}

function inside(pts: Pt[], x: number, y: number) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Short fibres scattered over a shape: lit ones up and left, shaded ones down and right. */
function fibres(area: Pt[], seed: number, count: number) {
  const rnd = random(seed);
  const xs = area.map((p) => p[0]);
  const ys = area.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let light = "";
  let dark = "";
  for (let k = 0, tries = 0; k < count && tries < count * 6; tries++) {
    const x = x0 + rnd() * (x1 - x0);
    const y = y0 + rnd() * (y1 - y0);
    if (!inside(area, x, y)) continue;
    k++;
    const a = rnd() * Math.PI * 2;
    const len = 0.5 + rnd() * 0.9;
    const strand = `M${f(x)} ${f(y)}l${f(Math.cos(a) * len)} ${f(Math.sin(a) * len)}`;
    const shade = ((x - x0) / (x1 - x0)) * 0.55 + ((y - y0) / (y1 - y0)) * 0.45;
    if (rnd() > shade) light += strand;
    else dark += strand;
  }
  return { light, dark };
}

// ── Geometry ─────────────────────────────────────────────────────────────────

const BODY_PTS: Pt[] = [
  [0, -46.5],
  [11.5, -45],
  [20, -40],
  [25.5, -31.5],
  [27.5, -21],
  [28, -10],
  [29.5, 3],
  [30, 16],
  [27.5, 27],
  [21, 34.5],
  [10, 37.6],
  [0, 38],
  [-10, 37.6],
  [-21, 34.5],
  [-27.5, 27],
  [-30, 16],
  [-29.5, 3],
  [-28, -10],
  [-27.5, -21],
  [-25.5, -31.5],
  [-20, -40],
  [-11.5, -45],
];

const BODY = spline(BODY_PTS, 12);
const ARM_L = ellipse(-31, 7, 7.4, 19, 12, 110);
const ARM_R = ellipse(31, 7, 7.4, 19, -12, 110);
const LEG_L = ellipse(-12.5, 39.5, 8.2, 7.4, 0, 72);
const LEG_R = ellipse(12.5, 39.5, 8.2, 7.4, 0, 72);

const FUR_BODY = fluff(BODY, 7, 1.1);
const FUR_ARM_L = fluff(ARM_L, 11, 0.9);
const FUR_ARM_R = fluff(ARM_R, 13, 0.9);
const FUR_LEG_L = fluff(LEG_L, 17, 0.8);
const FUR_LEG_R = fluff(LEG_R, 19, 0.8);
const FIBRES = fibres(BODY, 23, 420);
const ARM_FIBRES = [fibres(ARM_L, 29, 60), fibres(ARM_R, 31, 60)];

/** The opening in the hood, with fur spilling over its rim. */
const FACE: Pt[] = spline(
  [
    [0, -40.5],
    [13, -40],
    [20, -34],
    [20.8, -24.5],
    [16.5, -16.4],
    [0, -14.6],
    [-16.5, -16.4],
    [-20.8, -24.5],
    [-20, -34],
    [-13, -40],
  ],
  10,
);
const RIM = (() => {
  const rnd = random(37);
  const nm = normals(FACE);
  let d = "";
  FACE.forEach(([x, y], i) => {
    if (rnd() < 0.2) return;
    const [nx, ny] = nm[i];
    const len = 0.7 + rnd() * 1.1;
    d += `M${f(x + nx * 1.4)} ${f(y + ny * 1.4)}l${f(-nx * len + (rnd() - 0.5) * 0.8)} ${f(-ny * len + (rnd() - 0.5) * 0.8)}`;
  });
  return d;
})();

function Strands({ d, color, opacity, width = 1.25 }: { d: string; color: string; opacity: number; width?: number }) {
  return <path d={d} fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round" />;
}

function Limb({ id, fur, cx, cy, r }: { id: string; fur: Fur; cx: number; cy: number; r: number }) {
  return (
    <>
      <Strands d={fur.dark} color={FUR.dark} opacity={0.75} width={1.1} />
      <Strands d={fur.light} color={FUR.base} opacity={0.85} width={1.1} />
      <Clay id={id} palette={FUR} cx={cx} cy={cy} r={r} gloss={0.3} shape={<path d={fur.outline} />} />
    </>
  );
}

function Fibres({ light, dark }: { light: string; dark: string }) {
  return (
    <>
      <Strands d={light} color="#FFFFFF" opacity={0.2} width={0.8} />
      <Strands d={dark} color={FUR.deep} opacity={0.1} width={0.8} />
    </>
  );
}

export function MuseBody() {
  return (
    <Art>
      <Limb id="muse-leg-l" fur={FUR_LEG_L} cx={-12.5} cy={38} r={10} />
      <Limb id="muse-leg-r" fur={FUR_LEG_R} cx={12.5} cy={38} r={10} />
      <Strands d={FUR_BODY.dark} color={FUR.dark} opacity={0.75} width={1.1} />
      <Strands d={FUR_BODY.light} color={FUR.base} opacity={0.85} width={1.1} />
      <Clay id="muse" palette={FUR} cy={-2} r={42} gloss={0.36} shape={<path d={FUR_BODY.outline} />} />
      <Fibres {...FIBRES} />
      <g className="muse-arm muse-arm--l">
        <Limb id="muse-arm-l" fur={FUR_ARM_L} cx={-31} cy={6} r={18} />
        <Fibres {...ARM_FIBRES[0]} />
      </g>
      <g className="muse-arm muse-arm--r">
        <Limb id="muse-arm-r" fur={FUR_ARM_R} cx={31} cy={6} r={18} />
        <Fibres {...ARM_FIBRES[1]} />
      </g>
    </Art>
  );
}

const EYES = [-10, 10];

export function MuseFace() {
  return (
    <Art>
      <defs>
        <linearGradient id="muse-hood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8C7354" stopOpacity="0.32" />
          <stop offset="0.3" stopColor="#8C7354" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g data-depth="0.45">
        <Clay id="muse-skin" palette={SKIN} cy={-27.5} r={21} gloss={0.5} shape={<path d={smooth(FACE)} />} />
        <path d={smooth(FACE)} fill="url(#muse-hood)" />
        <Strands d={RIM} color={FUR.base} opacity={0.95} width={1.15} />
      </g>
      <g data-depth="0.8" fill="#FF8C8C" opacity="0.3">
        <ellipse cx="-13" cy="-22.5" rx="4.8" ry="2.9" />
        <ellipse cx="13" cy="-22.5" rx="4.8" ry="2.9" />
      </g>
      <g data-depth="1">
        <OpenEyes xs={EYES} y={-28} color="#1C1714" rx={2.5} ry={2.7} />
        <HappyEyes xs={EYES} y={-27.5} color="#1C1714" w={3.6} weight={1.9} />
        <path d="M-3.6-23.4Q0-20.2 3.6-23.4" fill="none" stroke="#2A211B" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </Art>
  );
}
