import { clamp, lerp } from "./math";

/**
 * Grok's eyes are painted on a ball: to look around, the whole ball turns.
 * Each eye is projected from the sphere's surface, so it slides across the
 * face and foreshortens into a sliver as it nears the rim.
 */
export const SPHERE_R = 41;

/** Eyes sit either side of the face, a touch above its equator. */
const EYE_LON = (21 * Math.PI) / 180;
const EYE_LAT = (-4 * Math.PI) / 180;
const MAX_TURN = (58 * Math.PI) / 180;

/** Pills while idle, round dots when looking at you (fractions of the radius). */
const PILL = { w: 0.25, h: 0.62 };
const DOT = { w: 0.46, h: 0.46 };

const f = (n: number) => n.toFixed(2);

export interface SphereState {
  /** Gaze in [−1, 1]. */
  gx: number;
  gy: number;
  /** Eyelid openness, 0 … 1. */
  lid: number;
  /** 0 = pills, 1 = round. */
  round: number;
  /** 0 … 1 squint. */
  happy: number;
  /** Bump reaction: eyes widen. */
  widen: number;
}

/** Write both eyes' geometry. `eyes[0]` is the left eye. */
export function drawSphereEyes(eyes: SVGRectElement[], s: SphereState) {
  const R = SPHERE_R;
  // Facing you, the ball turns less: the round eyes stay on you.
  const turn = MAX_TURN * (1 - 0.5 * s.round);
  const yaw = clamp(s.gx, -1, 1) * turn;
  const pitch = clamp(s.gy, -1, 1) * turn;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const grow = 1 + s.widen;
  const w = lerp(PILL.w, DOT.w, s.round) * R * grow;
  const h = lerp(PILL.h, DOT.h, s.round) * R * grow * Math.max(0.06, s.lid * (1 - 0.55 * s.happy));
  const rx = Math.min(w, h) / 2;

  eyes.forEach((eye, i) => {
    const lon = i === 0 ? -EYE_LON : EYE_LON;
    // Point on the unit sphere (z towards the viewer), turned by yaw then pitch.
    let x = Math.sin(lon) * Math.cos(EYE_LAT);
    let y = Math.sin(EYE_LAT);
    let z = Math.cos(lon) * Math.cos(EYE_LAT);
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    [y, z] = [y * cp + z * sp, -y * sp + z * cp];
    // Foreshortening squeezes the eye along the radius (a little less than
    // true perspective would, like the original); behind the rim it's gone.
    const k = Math.max(0, z) ** 0.6;
    const angle = (Math.atan2(y, x) * 180) / Math.PI;
    eye.setAttribute("x", f(-w / 2));
    eye.setAttribute("y", f(-h / 2));
    eye.setAttribute("width", f(w));
    eye.setAttribute("height", f(h));
    eye.setAttribute("rx", f(rx));
    eye.setAttribute(
      "transform",
      `translate(${f(x * R)} ${f(y * R)}) rotate(${f(angle)}) scale(${k.toFixed(3)} 1) rotate(${f(-angle)})`,
    );
  });
}
