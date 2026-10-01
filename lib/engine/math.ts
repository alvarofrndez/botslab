export const TAU = Math.PI * 2;
export const DEG = 180 / Math.PI;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

export function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent smoothing factor for `x += (target - x) * damp(rate, dt)`. */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** Shortest signed angle from `a` to `b`, in (−π, π]. */
export function angleDiff(a: number, b: number) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d <= -Math.PI) d += TAU;
  return d;
}

/** Rotate angle `a` toward `b` by at most `max` radians. */
export function turnToward(a: number, b: number, max: number) {
  return a + clamp(angleDiff(a, b), -max, max);
}

function hash(i: number) {
  let x = Math.imul(i | 0, 0x27d4eb2d) ^ 0x165667b1;
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) / 4294967295) * 2 - 1;
}

/** Smooth 1D gradient noise, roughly in [−1, 1]. */
export function noise1(x: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  return (hash(i) * f * (1 - u) + hash(i + 1) * (f - 1) * u) * 2;
}

/** Damped harmonic spring, integrated with semi-implicit Euler. */
export class Spring {
  value: number;
  target: number;
  velocity = 0;

  constructor(
    value: number,
    public stiffness: number,
    public damping: number,
  ) {
    this.value = value;
    this.target = value;
  }

  step(dt: number) {
    // Split long frames so stiff springs stay stable at low frame rates.
    const n = dt > 1 / 70 ? 2 : 1;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -this.stiffness * (this.value - this.target) - this.damping * this.velocity;
      this.velocity += a * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  snap(v: number) {
    this.value = this.target = v;
    this.velocity = 0;
  }
}
