import type { ReactNode } from "react";

/**
 * Every character is drawn in one coordinate system: a 100 × 100 box centred
 * on the origin. The body is static; the face sits on top and is animated by
 * the engine through data attributes:
 *
 * - `data-depth="k"`  moves with the gaze, k × the face's range (parallax)
 * - `data-blink`      squashes shut on every blink
 * - `data-pupil`      rolls around inside an eyeball
 */
export function Art({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="-50 -50 100 100" aria-hidden="true">
      {children}
    </svg>
  );
}

export interface Palette {
  light: string;
  base: string;
  dark: string;
  /** Edge shading. */
  deep: string;
}

/** Soft black for accessories: berets, headphones, bow ties. */
export const INK: Palette = { light: "#6A6A72", base: "#303036", dark: "#1B1B1F", deep: "#050506" };

interface ClayProps {
  id: string;
  /** Shape elements only (no groups); overlapping parts merge into one volume. */
  shape: ReactNode;
  palette: Palette;
  /** Rough centre and radius of the volume, for its lighting. */
  cx?: number;
  cy?: number;
  r?: number;
  gloss?: number;
}

/**
 * A soft, matte volume like a vinyl toy: lit from the top left, rolling off
 * into shade at the edges, with a gentle highlight.
 */
export function Clay({ id, shape, palette, cx = 0, cy = 0, r = 40, gloss = 0.42 }: ClayProps) {
  const lx = cx - r * 0.36;
  const ly = cy - r * 0.46;
  const box = { x: cx - r * 1.6, y: cy - r * 1.6, width: r * 3.2, height: r * 3.2 };
  return (
    <>
      <defs>
        <clipPath id={`${id}-clip`}>{shape}</clipPath>
        <radialGradient id={`${id}-fill`} cx={lx} cy={ly} r={r * 1.85} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={palette.light} />
          <stop offset="0.4" stopColor={palette.base} />
          <stop offset="1" stopColor={palette.dark} />
        </radialGradient>
        <radialGradient id={`${id}-edge`} cx={cx} cy={cy - r * 0.14} r={r * 1.1} gradientUnits="userSpaceOnUse">
          <stop offset="0.66" stopColor={palette.deep} stopOpacity="0" />
          <stop offset="1" stopColor={palette.deep} stopOpacity="0.42" />
        </radialGradient>
        <radialGradient id={`${id}-gloss`} cx={lx} cy={ly} r={r * 0.6} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity={gloss} />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <rect {...box} fill={`url(#${id}-fill)`} />
        <rect {...box} fill={`url(#${id}-edge)`} />
        <rect {...box} fill={`url(#${id}-gloss)`} />
      </g>
    </>
  );
}

// ── Eyes ─────────────────────────────────────────────────────────────────────

interface EyeRow {
  /** Horizontal centres. */
  xs: number[];
  y: number;
  color: string;
}

/** Open eyes: dark ovals with a catch-light. They blink. */
export function OpenEyes({ xs, y, color, rx = 2.6, ry = 3.5 }: EyeRow & { rx?: number; ry?: number }) {
  return (
    <g className="eyes-open">
      {xs.map((x) => (
        <g key={x} data-blink>
          <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={color} />
          <circle cx={x + rx * 0.32} cy={y - ry * 0.38} r={Math.min(rx, ry) * 0.36} fill="#fff" opacity="0.9" />
        </g>
      ))}
    </g>
  );
}

/** Happy eyes: ◠ ◠ */
export function HappyEyes({ xs, y, color, w = 5.5, weight = 2.2 }: EyeRow & { w?: number; weight?: number }) {
  return (
    <g className="eyes-happy" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round">
      {xs.map((x) => (
        <path key={x} d={`M${x - w} ${y + 1.8}Q${x} ${y - 4.2} ${x + w} ${y + 1.8}`} />
      ))}
    </g>
  );
}

/** Peacefully shut: ‿ ‿, optionally with lashes at the outer corners. */
export function ClosedEyes({ xs, y, color, w = 6, lashes = false }: EyeRow & { w?: number; lashes?: boolean }) {
  return (
    <g className="eyes-closed" fill="none" stroke={color} strokeWidth="2.1" strokeLinecap="round">
      {xs.map((x) => {
        const out = x < 0 ? -1 : 1;
        const end = x + out * w;
        return (
          <g key={x}>
            <path d={`M${x - w} ${y}Q${x} ${y + 5} ${x + w} ${y}`} />
            {lashes && <path strokeWidth="1.7" d={`M${end} ${y}l${out * 2.3} -1.9`} />}
          </g>
        );
      })}
    </g>
  );
}
