import type { BehaviorId } from "../cast";
import type { Agent } from "./agent";
import type { Ecosystem } from "./ecosystem";
import { TAU, clamp, noise1, rand } from "./math";

/**
 * A behaviour sets the agent's desired velocity (`dvx`, `dvy`) and may tweak
 * its steering, gaze, lean and height. Physics, walls and collisions are
 * applied after. Behaviours keep their own state in `a.mem` (numbers, 0 = unset).
 */
type Behavior = (a: Agent, eco: Ecosystem, dt: number) => void;

/** Default locomotion: a heading that drifts on smooth noise, at a breathing pace. */
export function wander(a: Agent, eco: Ecosystem, dt: number, turn = 1, speed = 1) {
  a.heading += noise1(a.seed + eco.t * 0.21) * a.spec.wobble * turn * dt;
  const sp = a.cruise * speed * (0.8 + 0.3 * noise1(a.seed * 1.37 + eco.t * 0.13));
  a.dvx = Math.cos(a.heading) * sp;
  a.dvy = Math.sin(a.heading) * sp;
}

function toward(a: Agent, b: Agent) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d, d };
}

/** Where Grok's eyes rest while it daydreams: up and to the right. */
const DAYDREAM = { x: 0.62, y: -0.6 };
const UP = -Math.PI / 2;

export const BEHAVIORS: Record<BehaviorId, Behavior> = {
  /** Iggy: lost in the music. Bobs on every beat, sways, and now and then twirls. */
  groove(a, eco, dt) {
    const m = a.mem;
    const t = eco.t;
    wander(a, eco, dt, 0.8, 0.75);
    if (a.calm) return;
    const beats = (t + a.seed) * (100 / 60);
    const beat = Math.floor(beats);
    if (beat !== m.beat) {
      m.beat = beat;
      a.stretch(UP, -0.035);
    }
    a.liftTarget = Math.sin((beats - beat) * Math.PI) * 4 * eco.unit;
    a.sway = Math.sin(beats * Math.PI) * 6;
    if (!m.next) m.next = t + rand(8, 13);
    if (t > m.next) {
      m.next = t + rand(12, 18);
      a.turn.target += 360;
    }
  },

  /** Felipe: a daydreaming cloud. Floats above his shadow, carried by the breeze. */
  drift(a, eco, dt) {
    const m = a.mem;
    const t = eco.t;
    if (!m.next) {
      m.next = t + rand(2, 4);
      m.wind = rand(0, TAU);
    }
    m.wind += noise1(a.seed + t * 0.07) * 0.5 * dt;
    wander(a, eco, dt, 0.5, 0.65);
    a.liftTarget = (6 + 3.5 * Math.sin(t * 1.15 + a.seed)) * eco.unit;
    a.breath = 0.016 * Math.sin(t * 1.7 + a.seed);
    if (t > m.next && !a.calm) {
      m.next = t + rand(5, 9);
      const dir = eco.inward(a, m.wind + rand(-0.5, 0.5));
      const power = rand(50, 75) * eco.unit;
      m.wind = dir;
      a.kick(Math.cos(dir) * power, Math.sin(dir) * power, 1.4);
      a.stretch(dir, 0.05);
      a.heading = dir;
    }
  },

  /** Todd: a frog. Sits, looks about, hops, and every so often takes a big leap. */
  hop(a, eco, dt) {
    const m = a.mem;
    const t = eco.t;
    wander(a, eco, dt, 0.9, 0.12);
    if (!m.next) m.next = t + rand(1, 2);
    if (m.land) {
      const k = clamp((t - m.from) / (m.land - m.from), 0, 1);
      a.liftTarget = Math.sin(k * Math.PI) * m.height;
      if (k >= 1) {
        m.land = 0;
        a.stretch(UP, -0.1);
      }
      return;
    }
    if (t > m.next && !a.calm) {
      m.count = (m.count || 0) + 1;
      const big = m.count % 5 === 0;
      m.next = t + (m.count % 3 === 0 ? rand(2.4, 4) : rand(0.8, 1.1));
      const dir = eco.inward(a, a.heading + rand(-0.6, 0.6));
      const p = (big ? rand(120, 150) : rand(60, 80)) * eco.unit;
      a.kick(Math.cos(dir) * p, Math.sin(dir) * p, big ? 0.6 : 0.42);
      a.stretch(UP, big ? 0.13 : 0.09);
      a.heading = dir;
      m.from = t;
      m.land = t + (big ? 0.55 : 0.38);
      m.height = (big ? 28 : 14) * eco.unit;
    }
  },

  /** Alfred: composed and courteous. Long straight walks, a pause to look about, a bow for passers-by. */
  stroll(a, eco, dt) {
    const m = a.mem;
    const t = eco.t;
    if (!m.next) m.next = t + rand(5, 8);
    if (m.pause > t) {
      a.dvx = 0;
      a.dvy = 0;
      a.agility = 1.6;
      a.busy = true;
      a.look = { x: Math.sin((t - m.from) * 1.3) * 0.7, y: 0.05 };
      return;
    }
    wander(a, eco, dt, 0.35, 0.95);
    if (t > m.next) {
      m.from = t;
      m.pause = t + rand(1.6, 2.6);
      m.next = m.pause + rand(6, 10);
    }
    const n = a.nearest;
    if (n && a.nearestGap < a.r * 0.8 && t > (m.bowAt || 0)) {
      m.bowAt = t + 9;
      eco.bow(a);
    }
  },

  /** Jojo: effortlessly cool long S-curves. His heart beats faster with company. */
  cruise(a, eco, dt) {
    const m = a.mem;
    const t = eco.t;
    wander(a, eco, dt, 0.5, 1);
    const sp = Math.hypot(a.dvx, a.dvy);
    const h = a.heading + 0.75 * Math.sin(t * 0.55 + a.seed);
    a.dvx = Math.cos(h) * sp;
    a.dvy = Math.sin(h) * sp;
    const close = a.nearest !== null && a.nearestGap < a.r * 1.5;
    if (!m.beat) m.beat = t + rand(1, 2);
    if (t > m.beat) {
      m.beat = t + (close ? rand(0.55, 0.7) : rand(2.2, 3));
      eco.heartbeat(a, close ? 1.3 : 1);
    }
  },

  /** Grok: restless. It daydreams, looks around, then winds up and zips off. */
  dash(a, eco, dt) {
    const m = a.mem;
    const t = eco.t;
    if (!m.next) {
      m.next = t + rand(3, 5);
      m.glance = t + rand(4, 7);
    }
    if (m.windup) {
      a.busy = true;
      a.dvx = 0;
      a.dvy = 0;
      a.agility = 2.8;
      a.look = { x: Math.cos(m.dir), y: Math.sin(m.dir) };
      if (t > m.windup) {
        m.windup = 0;
        const power = rand(170, 230) * eco.unit;
        a.kick(Math.cos(m.dir) * power, Math.sin(m.dir) * power, 1.1);
        a.stretch(m.dir, 0.12);
        a.heading = m.dir;
        m.next = t + rand(5, 9);
        m.zoom = t + 1;
      }
      return;
    }
    wander(a, eco, dt, 1.2, 0.5);
    const sp = Math.hypot(a.vx, a.vy);
    if (m.zoom > t && sp > 1) a.look = { x: (a.vx / sp) * 0.9, y: (a.vy / sp) * 0.9 };
    else if (m.around > t) a.look = { x: m.lx, y: m.ly };
    else a.look = DAYDREAM;
    if (t > m.glance) {
      m.glance = t + rand(6, 10);
      m.around = t + rand(1.8, 2.8);
      m.lx = rand(-0.5, 0.3);
      m.ly = rand(0.35, 0.7);
    }
    if (t > m.next && a.glide <= 0 && !a.calm) {
      const p = eco.randomPoint(0.22, a, 220 * eco.unit);
      m.dir = Math.atan2(p.y - a.y, p.x - a.x);
      m.windup = t + 0.45;
      a.stretch(m.dir, -0.05);
    }
  },

  /** Muse: a cuddly plush. Waddles over to say hello to the others, then potters about. */
  waddle(a, eco, dt) {
    const m = a.mem;
    const t = eco.t;
    const stride = Math.min(1, Math.hypot(a.vx, a.vy) / (a.cruise + 1));
    m.step = (m.step || 0) + dt * (0.9 + 1.5 * stride);
    a.sway = Math.sin(m.step * Math.PI) * 4.5 * stride;
    a.liftTarget = Math.abs(Math.sin(m.step * Math.PI)) * 2.2 * stride * eco.unit;

    const f = a.target;
    const lost = !f || !f.live || f.pinned || f.chat !== null;
    if (m.mode && (lost || (m.mode === 1 && t > m.until))) {
      // The friend got busy, or was never reached: try again later.
      a.target = null;
      m.mode = 0;
      m.next = t + rand(4, 7);
    } else if (f && m.mode === 1) {
      const n = toward(a, f);
      a.busy = true;
      a.look = { x: n.x, y: n.y };
      if (n.d > (a.r + f.r) * 1.3) {
        a.heading = Math.atan2(n.y, n.x);
        a.dvx = n.x * a.cruise * 1.15;
        a.dvy = n.y * a.cruise * 1.15;
        a.agility = 1.4;
        return;
      }
      // Made it: say hello, and stay for a chat if the friend has a moment.
      m.mode = 2;
      m.until = t + rand(1.8, 2.6);
      a.happyUntil = t + 2;
      f.happyUntil = Math.max(f.happyUntil, t + 1.4);
      eco.wave(a);
      eco.later(900, () => eco.converse(a, f));
    }
    if (f && m.mode === 2) {
      const n = toward(a, f);
      a.busy = true;
      a.dvx = 0;
      a.dvy = 0;
      a.agility = 2;
      a.look = { x: n.x, y: n.y };
      if (t > m.until) {
        a.target = null;
        m.mode = 0;
        m.next = t + rand(10, 16);
        a.heading = Math.atan2(-n.y, -n.x) + rand(-0.6, 0.6);
      }
      return;
    }
    wander(a, eco, dt, 0.7, 0.75);
    if (!m.next) m.next = t + rand(5, 9);
    if (t > m.next) {
      const g = eco.nearestTo(a, Infinity, (b) => !b.chat && !b.busy);
      if (g) {
        a.target = g;
        m.mode = 1;
        m.until = t + 9;
      } else m.next = t + rand(2, 4);
    }
  },
};

/** What each character does when you come to say hello. */
export const GREETINGS: Record<BehaviorId, (a: Agent, eco: Ecosystem) => void> = {
  // Her eyes open (CSS) with a little start.
  groove: (a) => {
    a.pulse.velocity += 1.6;
  },
  // He tips his beret (CSS) and settles.
  drift: (a) => {
    a.pulse.velocity += 1.2;
  },
  // Boing.
  hop: (a) => {
    a.stretch(UP, 0.1);
    a.pulse.velocity += 1.4;
  },
  // At your service.
  stroll: (a, eco) => eco.bow(a),
  // Shades down (CSS), heart racing.
  cruise: (a, eco) => {
    eco.heartbeat(a, 1.2);
    eco.later(430, () => eco.heartbeat(a, 1.2));
  },
  // Its eyes turn to look right at you; a blink sells it.
  dash: (a) => {
    a.blink();
    a.pulse.velocity += 1;
  },
  waddle: (a, eco) => {
    a.happyUntil = eco.t + 1.2;
    eco.wave(a);
  },
};
