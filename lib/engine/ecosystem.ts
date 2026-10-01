import type { BotSpec } from "../cast";
import { Agent, REST, type Chat } from "./agent";
import { BEHAVIORS, GREETINGS } from "./behaviors";
import { Spring, TAU, angleDiff, clamp, damp, lerp, rand, smoothstep, turnToward } from "./math";

type PointerKind = "mouse" | "pen" | "touch";

interface Press {
  agent: Agent;
  id: number;
  kind: PointerKind;
  x0: number;
  y0: number;
  /** Offset from the pointer to the bot's centre, kept while dragging. */
  ox: number;
  oy: number;
  lastX: number;
  lastY: number;
  lastT: number;
  vx: number;
  vy: number;
  dragging: boolean;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface EcosystemOptions {
  /** The room. Elements marked `[data-obstacle]` inside it are avoided. */
  root: HTMLElement;
  /** Holds one `a[data-bot]` per bot. */
  stage: HTMLElement;
  /** The ring that wraps whichever bot has your attention. */
  aura: HTMLElement;
  /** Tonight's line-up, matching the bots on stage. */
  cast: BotSpec[];
  onPopulation?: (count: number) => void;
}

const sq = (v: number) => v * v;
const UP = -Math.PI / 2;

const kindOf = (e: PointerEvent): PointerKind =>
  e.pointerType === "touch" ? "touch" : e.pointerType === "pen" ? "pen" : "mouse";

function shuffle<T>(list: T[]) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function openExternal(url: string) {
  const win = window.open(url, "_blank");
  if (!win) {
    // A popup blocker got in the way: navigate here instead.
    window.location.assign(url);
    return;
  }
  try {
    win.opener = null;
  } catch {
    /* already cross-origin */
  }
}

/**
 * The living room. Owns the simulation loop, input, and everything that
 * happens between bots. Rendering is done with direct style writes from a
 * single requestAnimationFrame loop — React never re-renders per frame.
 */
export class Ecosystem {
  readonly agents: Agent[];
  t = 0;
  W = 1;
  H = 1;
  /** Global scale for speeds and forces: 1 on a ~860px tall viewport. */
  unit = 1;
  reduced = false;
  readonly pointer = { x: -1e4, y: -1e4, inside: false, kind: "mouse" as PointerKind, movedAt: -1e4 };
  /** The bot that is hovered, dragged, focused, selected or launching. */
  attention: Agent | null = null;

  private base = 80;
  private margin = 80;
  private hovered: Agent | null = null;
  private focused: Agent | null = null;
  private selected: Agent | null = null;
  private launched: Agent | null = null;
  private press: Press | null = null;
  private hoverBlock: { agent: Agent; until: number } | null = null;
  private suppressClickUntil = 0;
  private obstacles: Rect[] = [];
  private chats = 0;
  private population = -1;
  private edge = Math.floor(Math.random() * 4);
  private raf = 0;
  private last = 0;
  private frameAvg = 1 / 60;
  private slowFor = 0;
  private lite = false;
  private cursor = "";
  private selectTimer = 0;
  private readonly live: Agent[] = [];
  private readonly aura = {
    x: new Spring(0, 260, 27),
    y: new Spring(0, 260, 27),
    size: new Spring(8, 210, 23),
    on: false,
    color: "",
    fadeUntil: 0,
  };
  private readonly timers = new Set<number>();
  private readonly cleanups: (() => void)[] = [];

  constructor(private readonly opts: EcosystemOptions) {
    const els = Array.from(opts.stage.querySelectorAll<HTMLAnchorElement>("a[data-bot]"));
    this.agents = els.map((el, i) => {
      const spec = opts.cast.find((b) => b.id === el.dataset.bot);
      if (!spec) throw new Error(`Unknown bot "${el.dataset.bot}"`);
      return new Agent(spec, i, el);
    });
  }

  // ── Lifecycle ───────────────────────────────────────────────

  start() {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => {
      this.reduced = motion.matches;
      for (const a of this.agents) a.calm = this.reduced;
    };
    applyMotion();
    this.on(motion, "change", applyMotion);
    this.on(window, "resize", this.onResize);
    this.on(window, "pointermove", this.onPointerMove, { passive: true });
    this.on(window, "pointerdown", this.onPointerDown);
    this.on(window, "pointerup", this.onPointerUp);
    this.on(window, "pointercancel", this.onPointerCancel);
    this.on(document.documentElement, "pointerleave", this.onPointerLeave);
    this.on(window, "mouseout", (e: MouseEvent) => {
      if (!e.relatedTarget) this.onPointerLeave();
    });
    this.on(window, "blur", this.onPointerLeave);
    this.on(window, "keydown", this.onKeyDown);
    const stage = this.opts.stage;
    this.on(stage, "click", this.onClick);
    this.on(stage, "focusin", this.onFocusIn);
    this.on(stage, "focusout", this.onFocusOut);
    this.on(stage, "dragstart", (e: Event) => e.preventDefault());

    this.measure();
    this.populate();
    // Headline boxes settle once fonts load and their intro animation ends.
    void document.fonts?.ready.then(() => this.measureObstacles());
    this.later(1800, () => this.measureObstacles());

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    window.clearTimeout(this.selectTimer);
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
    for (const off of this.cleanups.splice(0)) off();
  }

  private on<E extends Event>(
    target: EventTarget,
    type: string,
    fn: (e: E) => void,
    options?: AddEventListenerOptions,
  ) {
    const handler = fn as EventListener;
    target.addEventListener(type, handler, options);
    this.cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  later(ms: number, fn: () => void) {
    const id = window.setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const raw = (now - this.last) / 1000;
    this.last = now;
    if (!(raw > 0)) return;
    const dt = Math.min(raw, 1 / 30);
    this.govern(raw);
    this.step(dt);
    this.draw(dt);
  };

  /** If the device can't keep up, drop the most expensive ambience. */
  private govern(raw: number) {
    if (this.lite || raw > 0.25) return;
    this.frameAvg += (raw - this.frameAvg) * 0.05;
    if (this.t > 5 && this.frameAvg > 1 / 36) {
      this.slowFor += raw;
      if (this.slowFor > 3) {
        this.lite = true;
        this.opts.root.classList.add("is-lite");
      }
    } else this.slowFor = 0;
  }

  // ── Space ───────────────────────────────────────────────────

  private onResize = () => this.measure();

  private measure() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    const short = Math.min(this.W, this.H);
    this.unit = clamp(short / 860, 0.62, 1.2);
    // Only three characters on stage, so each one gets room to be seen.
    this.base = clamp(short * 0.185, 96, 188);
    this.margin = clamp(short * 0.1, 36, 110);
    for (const a of this.agents) a.resize(this.base, this.unit);
    this.measureObstacles();
  }

  private measureObstacles() {
    const pad = 10;
    const els = this.opts.root.querySelectorAll<HTMLElement>("[data-obstacle]");
    this.obstacles = Array.from(els, (el) => {
      const r = el.getBoundingClientRect();
      return { x0: r.left - pad, y0: r.top - pad, x1: r.right + pad, y1: r.bottom + pad };
    }).filter((r) => r.x1 - r.x0 > pad * 2 && r.y1 - r.y0 > pad * 2);
  }

  /** Pick a point in the open part of the room. */
  randomPoint(inset: number, from?: Agent, minDist = 0) {
    const { W, H } = this;
    for (let i = 0; i < 14; i++) {
      const x = rand(W * inset, W * (1 - inset));
      const y = rand(H * inset, H * (1 - inset));
      if (from && Math.hypot(x - from.x, y - from.y) < minDist) continue;
      if (this.obstacles.some((o) => x > o.x0 - 70 && x < o.x1 + 70 && y > o.y0 - 70 && y < o.y1 + 70)) {
        continue;
      }
      return { x, y };
    }
    return { x: W / 2, y: H / 2 };
  }

  /** Bend a direction toward the centre when the agent is near the edges. */
  inward(a: Agent, dir: number) {
    const cx = this.W / 2 - a.x;
    const cy = this.H / 2 - a.y;
    const edge = Math.max(Math.abs(cx) / (this.W / 2), Math.abs(cy) / (this.H / 2));
    if (edge < 0.4) return dir;
    const center = Math.atan2(cy, cx);
    const limit = lerp(Math.PI, Math.PI * 0.3, smoothstep(0.4, 0.9, edge));
    return center + clamp(angleDiff(center, dir), -limit, limit);
  }

  nearestTo(a: Agent, maxDist: number, ok?: (b: Agent) => boolean) {
    let best: Agent | null = null;
    let bestD = maxDist;
    for (const b of this.agents) {
      if (b === a || b.phase !== "alive" || b.pinned || b === this.attention) continue;
      if (ok && !ok(b)) continue;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  // ── Population ──────────────────────────────────────────────

  /** Everyone arrives one after another, in a random order. */
  private populate() {
    shuffle([...this.agents]).forEach((a, i) => this.spawn(a, 0.25 + i * 0.45 + rand(0, 0.1)));
  }

  /** Schedule an entrance: bots drift in from just outside the room. */
  private spawn(a: Agent, delay: number) {
    a.phase = "waiting";
    a.wake = this.t + delay;
    a.presence = 0;
    a.mem = {};
    a.chat = null;
    a.target = null;
    a.happyUntil = 0;
    a.lift = a.liftTarget = 0;
    a.chatReadyAt = this.t + delay + rand(6, 12);
    a.blinkAt = this.t + delay + rand(0.5, 1.2);
    a.scale.snap(0.55);

    if (this.reduced) {
      const p = this.freeSpot();
      a.x = p.x;
      a.y = p.y;
      a.vx = a.vy = 0;
      return;
    }

    const { W, H } = this;
    const pad = a.r0 + 8;
    const edge = this.edge++ % 4;
    let x: number;
    let y: number;
    let normal: number;
    if (edge === 0) {
      x = W * rand(0.3, 0.85);
      y = -pad;
      normal = Math.PI / 2;
    } else if (edge === 1) {
      x = W + pad;
      y = H * rand(0.18, 0.8);
      normal = Math.PI;
    } else if (edge === 2) {
      x = W * rand(0.25, 0.75);
      y = H + pad;
      normal = -Math.PI / 2;
    } else {
      x = -pad;
      y = H * rand(0.35, 0.8);
      normal = 0;
    }
    const dir = normal + rand(-0.5, 0.5);
    const sp = rand(95, 135) * this.unit;
    a.x = x;
    a.y = y;
    a.vx = Math.cos(dir) * sp;
    a.vy = Math.sin(dir) * sp;
    a.heading = dir;
  }

  private freeSpot() {
    let best = { x: this.W / 2, y: this.H / 2 };
    let bestD = -1;
    for (let i = 0; i < 16; i++) {
      const p = this.randomPoint(0.14);
      let d = Infinity;
      for (const b of this.agents) {
        if (b.phase !== "idle") d = Math.min(d, Math.hypot(b.x - p.x, b.y - p.y));
      }
      if (d > bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private enter(a: Agent) {
    a.phase = "entering";
    a.toggle("is-live", true);
  }

  // ── Simulation ──────────────────────────────────────────────

  private step(dt: number) {
    const t = (this.t += dt);
    const live = this.live;
    live.length = 0;
    let count = 0;
    for (const a of this.agents) {
      if (a.phase === "waiting" && t >= a.wake) this.enter(a);
      if (a.phase === "entering" || a.phase === "alive") live.push(a);
      if (a.live) count++;
    }
    if (count !== this.population) {
      this.population = count;
      this.opts.onPopulation?.(count);
    }

    this.sense();
    const press = this.press;
    const dragged = press?.dragging ? press.agent : null;

    for (const a of live) {
      a.ax = 0;
      a.ay = 0;
      a.look = null;
      a.breath = 0;
      a.sway = 0;
      a.liftTarget = 0;
      a.busy = false;
      a.pinned = false;
      a.agility = a.spec.agility;
      a.glide = Math.max(0, a.glide - dt);
      a.boost *= Math.exp(-dt * 1.3);

      if (a.chat && (a === this.attention || a === dragged || a.launching)) this.endChat(a);

      if (a.phase === "entering") this.steerEntering(a);
      else if (a === dragged) a.pinned = true;
      else if (a === this.attention || a.launching) this.steerAttention(a);
      else if (a.chat) this.steerChat(a, a.chat);
      else {
        BEHAVIORS[a.spec.behavior](a, this, dt);
        if (this.reduced) {
          a.dvx *= 0.35;
          a.dvy *= 0.35;
          a.liftTarget *= 0.3;
          a.sway *= 0.3;
        }
        this.curiosity(a);
      }
    }

    for (const a of live) if (a.phase !== "entering" && !a.pinned) this.contain(a, dt);
    this.interact(dt);
    if (dragged && press) this.follow(dragged, press, dt);
    for (const a of live) if (a !== dragged) this.integrate(a, dt);
    this.collide();
    this.collide();
    for (const a of live) if (a.phase !== "entering") this.confine(a);
    for (const a of live) this.watchdog(a, dt);
  }

  private steerEntering(a: Agent) {
    const sp = a.cruise * 1.8 + 40 * this.unit;
    a.dvx = Math.cos(a.heading) * sp;
    a.dvy = Math.sin(a.heading) * sp;
    a.agility = 0.5;
    const inside = a.x > a.r && a.x < this.W - a.r && a.y > a.r && a.y < this.H - a.r;
    if (inside || this.t - a.wake > 6) a.phase = "alive";
  }

  /** Hovered, focused or selected: stop, and lean in a little toward the cursor. */
  private steerAttention(a: Agent) {
    a.pinned = true;
    a.agility = 6;
    a.dvx = 0;
    a.dvy = 0;
    const p = this.pointer;
    if (a === this.hovered && p.inside) {
      a.dvx = clamp((p.x - a.x) * 1.5, -36, 36) * this.unit;
      a.dvy = clamp((p.y - a.y) * 1.5, -36, 36) * this.unit;
    }
  }

  /** Two bots stop, face each other and take turns "typing". */
  private steerChat(a: Agent, c: Chat) {
    const p = c.partner;
    if (this.t > c.end || !p.live || p.pinned || p.chat?.partner !== a) {
      this.endChat(a);
      return;
    }
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    const k = clamp((d - (a.r + p.r) * 1.35) / (50 * this.unit), -1, 1);
    a.dvx = nx * k * a.cruise * 0.7;
    a.dvy = ny * k * a.cruise * 0.7;
    a.agility = 2.2;
    a.busy = true;
    a.look = { x: nx, y: ny };
    const e = this.t - c.start;
    const span = c.end - c.start;
    const typing = c.lead ? (e > 0.35 && e < 1.25) || (e > 2.25 && e < span - 0.75) : e > 1.35 && e < 2.15;
    a.toggle("is-typing", typing);
    if (e > span - 0.65) a.happyUntil = Math.max(a.happyUntil, this.t + 0.15);
  }

  private canChat(a: Agent) {
    return (
      a.phase === "alive" &&
      !a.chat &&
      !a.pinned &&
      !a.busy &&
      !a.target &&
      a.glide <= 0 &&
      a !== this.attention &&
      this.t > a.chatReadyAt
    );
  }

  /** Strike up a conversation on purpose (rather than by bumping into each other). */
  converse(a: Agent, b: Agent) {
    const free = (x: Agent) => x.phase === "alive" && !x.chat && !x.pinned && x !== this.attention;
    if (this.chats < 1 && free(a) && free(b)) this.startChat(a, b);
  }

  private startChat(a: Agent, b: Agent) {
    const t = this.t;
    const end = t + rand(3.4, 4.4);
    a.chat = { partner: b, start: t, end, lead: true };
    b.chat = { partner: a, start: t, end, lead: false };
    this.chats++;
  }

  private endChat(a: Agent) {
    const c = a.chat;
    if (!c) return;
    const p = c.partner;
    a.chat = null;
    a.toggle("is-typing", false);
    if (p.chat?.partner === a) {
      p.chat = null;
      p.toggle("is-typing", false);
    }
    this.chats = Math.max(0, this.chats - 1);
    a.chatReadyAt = this.t + rand(14, 26);
    p.chatReadyAt = this.t + rand(14, 26);
    // Part ways.
    const dx = a.x - p.x;
    const dy = a.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const push = 36 * this.unit;
    if (!a.pinned) {
      a.kick((dx / d) * push, (dy / d) * push, 0.4);
      a.heading = Math.atan2(dy, dx) + rand(-0.4, 0.4);
    }
    if (!p.pinned) {
      p.kick((-dx / d) * push, (-dy / d) * push, 0.4);
      p.heading = Math.atan2(-dy, -dx) + rand(-0.4, 0.4);
    }
  }

  /**
   * Curious bots drift toward a moving cursor; shy ones drift away. Interest
   * fades once the cursor rests, or when you're already meeting someone else.
   */
  private curiosity(a: Agent) {
    const c = a.spec.curiosity;
    const p = this.pointer;
    if (!c || !p.inside || p.kind === "touch" || this.hovered) return;
    const interest = Math.exp(-(this.t - p.movedAt) / 2.5);
    if (interest < 0.05) return;
    const dx = p.x - a.x;
    const dy = p.y - a.y;
    const d = Math.hypot(dx, dy);
    const reach = 260 * this.unit;
    if (d > reach || d < 1) return;
    const f = c * 28 * this.unit * interest * (1 - d / reach);
    a.ax += (dx / d) * f;
    a.ay += (dy / d) * f;
  }

  /** Soft walls and obstacles: push back, and turn the heading toward open space. */
  private contain(a: Agent, dt: number) {
    const { W, H, margin: m } = this;
    let fx = 0;
    let fy = 0;
    const left = a.x - a.r;
    const right = W - a.x - a.r;
    const top = a.y - a.r;
    const bottom = H - a.y - a.r;
    if (left < m) fx += sq(Math.min(1.6, 1 - left / m));
    if (right < m) fx -= sq(Math.min(1.6, 1 - right / m));
    if (top < m) fy += sq(Math.min(1.6, 1 - top / m));
    if (bottom < m) fy -= sq(Math.min(1.6, 1 - bottom / m));

    const reach = m * 0.55;
    for (const o of this.obstacles) {
      let dx = a.x - clamp(a.x, o.x0, o.x1);
      let dy = a.y - clamp(a.y, o.y0, o.y1);
      let d = Math.hypot(dx, dy);
      const gap = d - a.r;
      if (gap > reach) continue;
      if (d < 0.001) {
        dx = a.x - (o.x0 + o.x1) / 2;
        dy = a.y - (o.y0 + o.y1) / 2;
        d = Math.hypot(dx, dy) || 1;
      }
      const s = sq(Math.min(1.6, 1 - gap / reach));
      fx += (dx / d) * s;
      fy += (dy / d) * s;
    }

    const push = Math.hypot(fx, fy);
    if (push < 1e-4) return;
    const k = 160 * this.unit;
    a.ax += fx * k;
    a.ay += fy * k;
    a.heading = turnToward(a.heading, Math.atan2(fy, fx), Math.min(push, 1.5) * 2.4 * dt);
  }

  /** Neighbour awareness, personal space and the start of conversations. */
  private interact(dt: number) {
    const live = this.live;
    for (const a of live) {
      a.nearest = null;
      a.nearestGap = Infinity;
    }
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const R = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > R * R * 6.25) continue;
        const d = Math.sqrt(d2) || 0.01;
        const nx = dx / d;
        const ny = dy / d;
        const gap = d - R;
        if (gap < a.nearestGap) {
          a.nearestGap = gap;
          a.nearest = b;
        }
        if (gap < b.nearestGap) {
          b.nearestGap = gap;
          b.nearest = a;
        }
        if (a.phase !== "alive" || b.phase !== "alive" || a.chat?.partner === b) continue;

        const space = R * 0.6;
        if (gap < space) {
          const s = sq(1 - Math.max(gap, 0) / space) * 130 * this.unit;
          const share = b.mass / (a.mass + b.mass);
          if (!a.pinned) {
            a.ax -= nx * s * share * 2;
            a.ay -= ny * s * share * 2;
          }
          if (!b.pinned) {
            b.ax += nx * s * (1 - share) * 2;
            b.ay += ny * s * (1 - share) * 2;
          }
          const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (closing < 0) {
            const turn = 1.8 * dt * (1 - Math.max(gap, 0) / space);
            a.heading = turnToward(a.heading, Math.atan2(-ny, -nx), turn);
            b.heading = turnToward(b.heading, Math.atan2(ny, nx), turn);
          }
        }

        if (gap < R * 0.8 && this.chats < 1 && Math.random() < dt * 0.8 && this.canChat(a) && this.canChat(b)) {
          this.startChat(a, b);
        }
      }
    }
  }

  private integrate(a: Agent, dt: number) {
    const k = Math.min(1, (a.glide > 0 ? a.agility * 0.12 : a.agility) * dt);
    a.vx += (a.dvx - a.vx) * k + a.ax * dt;
    a.vy += (a.dvy - a.vy) * k + a.ay * dt;
    const cap = a.cruise * 2.2 + a.boost + 24 * this.unit;
    const sp = Math.hypot(a.vx, a.vy);
    if (sp > cap) {
      a.vx *= cap / sp;
      a.vy *= cap / sp;
    }
    a.x += a.vx * dt;
    a.y += a.vy * dt;
  }

  /** Circle–circle contacts: separate, then exchange momentum. */
  private collide() {
    const live = this.live;
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const R = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;
        const wa = a.pinned ? 0 : 1 / a.mass;
        const wb = b.pinned ? 0 : 1 / b.mass;
        const w = wa + wb;
        if (w === 0) continue;
        let d = Math.sqrt(d2);
        let nx: number;
        let ny: number;
        if (d < 0.001) {
          const ang = rand(0, TAU);
          nx = Math.cos(ang);
          ny = Math.sin(ang);
          d = 0;
        } else {
          nx = dx / d;
          ny = dy / d;
        }
        const overlap = R - d;
        a.x -= nx * overlap * (wa / w);
        a.y -= ny * overlap * (wa / w);
        b.x += nx * overlap * (wb / w);
        b.y += ny * overlap * (wb / w);

        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn >= 0) continue;
        const bonded = a.chat?.partner === b;
        const e = bonded ? 0.1 : 0.72;
        const jn = (-(1 + e) * vn) / w;
        a.vx -= jn * wa * nx;
        a.vy -= jn * wa * ny;
        b.vx += jn * wb * nx;
        b.vy += jn * wb * ny;
        if (!bonded && -vn > 16 * this.unit) this.bump(a, b, nx, ny, -vn);
      }
    }
  }

  private bump(a: Agent, b: Agent, nx: number, ny: number, hit: number) {
    const s = clamp(hit / (300 * this.unit), 0.035, 0.15);
    const ang = Math.atan2(ny, nx);
    a.stretch(ang, -s);
    b.stretch(ang, -s);
    a.widen.velocity += s * 14;
    b.widen.velocity += s * 14;
    if (hit > 50 * this.unit) {
      a.blink();
      b.blink();
    }
    // Carry on in the direction of the bounce instead of steering straight back.
    if (!a.pinned && a.phase === "alive") a.heading = Math.atan2(a.vy, a.vx);
    if (!b.pinned && b.phase === "alive") b.heading = Math.atan2(b.vy, b.vx);
  }

  /** Hard walls, as a last resort behind the soft ones. */
  private confine(a: Agent) {
    const { W, H } = this;
    const r = a.r;
    let hit = 0;
    let normal = 0;
    if (a.x < r) {
      a.x = r;
      if (a.vx < 0) {
        hit = -a.vx;
        normal = 0;
        a.vx *= -0.5;
      }
    } else if (a.x > W - r) {
      a.x = W - r;
      if (a.vx > 0) {
        hit = a.vx;
        normal = Math.PI;
        a.vx *= -0.5;
      }
    }
    if (a.y < r) {
      a.y = r;
      if (a.vy < 0) {
        hit = Math.max(hit, -a.vy);
        normal = Math.PI / 2;
        a.vy *= -0.5;
      }
    } else if (a.y > H - r) {
      a.y = H - r;
      if (a.vy > 0) {
        hit = Math.max(hit, a.vy);
        normal = -Math.PI / 2;
        a.vy *= -0.5;
      }
    }
    if (hit > 80 * this.unit && a !== this.attention) {
      a.stretch(normal, -clamp(hit / (900 * this.unit), 0.04, 0.16));
      a.heading = Math.atan2(a.vy, a.vx);
      if (hit > 220 * this.unit) a.blink();
    }
  }

  /** Nobody stays stuck: a bot that has stalled for a while gets a nudge. */
  private watchdog(a: Agent, dt: number) {
    if (a.phase !== "alive" || a.pinned || a.busy || a.chat) {
      a.stillFor = 0;
      return;
    }
    a.stillFor = Math.hypot(a.vx, a.vy) < 5 * this.unit ? a.stillFor + dt : 0;
    if (a.stillFor > 4.5) {
      a.stillFor = 0;
      const ang = Math.atan2(this.H / 2 - a.y, this.W / 2 - a.x) + rand(-0.6, 0.6);
      a.heading = ang;
      a.kick(Math.cos(ang) * 50 * this.unit, Math.sin(ang) * 50 * this.unit, 0.6);
    }
  }

  // ── Gestures ────────────────────────────────────────────────

  /** A courteous bow: dip, and look down for a moment. */
  bow(a: Agent) {
    a.nodUntil = this.t + 0.75;
    a.stretch(UP, -0.07);
  }

  /** Lub-dub. */
  heartbeat(a: Agent, strength = 1) {
    if (a.calm) return;
    a.pulse.velocity += 1.5 * strength;
    this.later(170, () => {
      a.pulse.velocity += 1 * strength;
    });
  }

  wave(a: Agent) {
    if (a.calm || a.has("is-waving")) return;
    a.toggle("is-waving", true);
    this.later(1550, () => a.toggle("is-waving", false));
  }

  // ── Input ───────────────────────────────────────────────────

  private pick(x: number, y: number) {
    let best: Agent | null = null;
    let bestK = 1;
    for (const a of this.agents) {
      if (!a.live || a.presence < 0.35) continue;
      const k = Math.hypot(x - a.x, y - (a.y - a.lift)) / a.r;
      if (k < bestK) {
        bestK = k;
        best = a;
      }
    }
    return best;
  }

  /** Resolve hover (by hit-testing every frame, so drifting bots are caught too). */
  private sense() {
    const p = this.pointer;
    const press = this.press;
    let hovered: Agent | null = null;
    if (press?.dragging) hovered = press.agent;
    else if (p.inside && p.kind !== "touch") {
      // A resting cursor shouldn't trap whoever drifts underneath it: hovering
      // starts only after recent movement, and lets go after a long idle.
      const idle = this.t - p.movedAt;
      const current = this.hovered;
      if (current && current.live && current.contains(p.x, p.y, 1.18) && idle < 8) hovered = current;
      else if (idle < 1.2) hovered = this.pick(p.x, p.y);
      const block = this.hoverBlock;
      if (block) {
        if (this.t > block.until && !block.agent.contains(p.x, p.y, 1.3)) this.hoverBlock = null;
        else if (hovered === block.agent) hovered = null;
      }
    }
    this.hovered = hovered;
    this.setCursor(press?.dragging ? "grabbing" : hovered ? "pointing" : "");

    const next =
      (press?.dragging ? press.agent : null) ?? this.launched ?? this.hovered ?? this.focused ?? this.selected;
    if (next !== this.attention) {
      this.attention?.toggle("is-active", false);
      if (next) {
        next.labelW = 0;
        next.toggle("is-active", true);
        GREETINGS[next.spec.behavior](next, this);
      }
      this.attention = next;
    }
    if (this.attention) this.placeLabel(this.attention);
  }

  /** Keep the name tag on screen: flip it below near the top, slide it near the sides. */
  private placeLabel(a: Agent) {
    a.toggle("label-below", a.y - (a.box / 2) * a.scale.value < 58);
    if (!a.labelW) a.labelW = a.label.offsetWidth;
    const half = a.labelW / 2 + 14;
    a.setLabelShift(clamp(a.x, half, Math.max(half, this.W - half)) - a.x);
  }

  private setCursor(c: string) {
    if (c === this.cursor) return;
    this.cursor = c;
    const cl = this.opts.stage.classList;
    cl.toggle("is-pointing", c === "pointing");
    cl.toggle("is-grabbing", c === "grabbing");
  }

  private select(a: Agent | null) {
    this.selected = a;
    window.clearTimeout(this.selectTimer);
    if (a) {
      this.selectTimer = window.setTimeout(() => {
        if (this.selected === a) this.selected = null;
      }, 6500);
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    const p = this.pointer;
    p.x = e.clientX;
    p.y = e.clientY;
    p.kind = kindOf(e);
    p.inside = p.kind !== "touch" || this.press !== null;
    p.movedAt = this.t;
    const press = this.press;
    if (!press || e.pointerId !== press.id) return;
    const now = e.timeStamp / 1000;
    if (!press.dragging) {
      const moved = Math.hypot(e.clientX - press.x0, e.clientY - press.y0);
      if (moved > (press.kind === "touch" ? 10 : 5)) this.beginDrag(press);
    }
    if (press.dragging) {
      const dt = Math.max(0.004, now - press.lastT);
      press.vx = lerp(press.vx, (e.clientX - press.lastX) / dt, 0.45);
      press.vy = lerp(press.vy, (e.clientY - press.lastY) / dt, 0.45);
      press.lastX = e.clientX;
      press.lastY = e.clientY;
      press.lastT = now;
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    const kind = kindOf(e);
    const p = this.pointer;
    p.x = e.clientX;
    p.y = e.clientY;
    p.kind = kind;
    p.movedAt = this.t;
    p.inside = true;
    const a = this.pick(e.clientX, e.clientY);
    if (!a) {
      if (this.selected) this.select(null);
      return;
    }
    // Modified and non-primary clicks keep the browser's own link behaviour.
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const now = e.timeStamp / 1000;
    this.press = {
      agent: a,
      id: e.pointerId,
      kind,
      x0: e.clientX,
      y0: e.clientY,
      ox: a.x - e.clientX,
      oy: a.y - e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: now,
      vx: 0,
      vy: 0,
      dragging: false,
    };
    try {
      a.el.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer may already be gone */
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") this.pointer.inside = false;
    const press = this.press;
    if (!press || e.pointerId !== press.id) return;
    this.press = null;
    this.suppressClickUntil = performance.now() + 600;
    const a = press.agent;
    if (press.dragging) {
      this.endDrag(press, e.timeStamp / 1000);
      return;
    }
    if (!a.live) return;
    // Mouse: hovering already introduced the bot, so a click visits.
    // Touch (and pens that can't hover): the first tap introduces, the second visits.
    if (press.kind === "mouse" || a === this.hovered || a === this.selected) this.launch(a);
    else this.select(a);
  };

  private onPointerCancel = (e: PointerEvent) => {
    if (e.pointerType === "touch") this.pointer.inside = false;
    const press = this.press;
    if (!press || e.pointerId !== press.id) return;
    this.press = null;
    if (press.dragging) this.endDrag(press, e.timeStamp / 1000);
  };

  private onPointerLeave = () => {
    if (!this.press) this.pointer.inside = false;
  };

  private onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest("a[data-bot]");
    if (!el) return;
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    // Pointer clicks were already handled on pointerup; this is keyboard activation.
    if (performance.now() < this.suppressClickUntil) return;
    const a = this.agents.find((b) => b.el === el);
    if (a) this.launch(a);
  };

  private onFocusIn = (e: FocusEvent) => {
    const el = (e.target as Element | null)?.closest("a[data-bot]");
    const a = this.agents.find((b) => b.el === el);
    if (a && a.el.matches(":focus-visible")) this.focused = a;
  };

  private onFocusOut = (e: FocusEvent) => {
    if (this.focused && this.focused.el === e.target) this.focused = null;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    this.select(null);
    this.focused?.el.blur();
  };

  private beginDrag(press: Press) {
    press.dragging = true;
    const a = press.agent;
    if (a.chat) this.endChat(a);
    if (this.selected === a) this.select(null);
    a.widen.velocity += 2.5;
  }

  private follow(a: Agent, press: Press, dt: number) {
    const tx = clamp(this.pointer.x + press.ox, a.r, this.W - a.r);
    const ty = clamp(this.pointer.y + press.oy, a.r, this.H - a.r);
    const k = damp(30, dt);
    const nx = a.x + (tx - a.x) * k;
    const ny = a.y + (ty - a.y) * k;
    a.vx = (nx - a.x) / dt;
    a.vy = (ny - a.y) / dt;
    a.x = nx;
    a.y = ny;
  }

  /** Let go: the bot keeps the throw's momentum and rejoins the room. */
  private endDrag(press: Press, now: number) {
    const a = press.agent;
    let vx = press.vx;
    let vy = press.vy;
    if (now - press.lastT > 0.08) vx = vy = 0; // it was held still before release
    const max = 1100 * this.unit;
    const sp = Math.hypot(vx, vy);
    if (sp > max) {
      vx *= max / sp;
      vy *= max / sp;
    }
    a.vx = vx;
    a.vy = vy;
    if (sp > 40) {
      a.heading = Math.atan2(vy, vx);
      a.boost = Math.max(a.boost, Math.min(sp, max));
      a.glide = 1.3;
      a.stretch(a.heading, clamp(sp / 4000, 0.03, 0.14));
      this.hoverBlock = { agent: a, until: this.t + 0.5 };
    }
  }

  /** Visit a bot's home: a short, deliberate send-off, then open its site. */
  launch(a: Agent) {
    if (!a.live || a.launching) return;
    a.launching = true;
    this.launched = a;
    a.toggle("is-launching", true);
    a.happyUntil = this.t + 1.4;
    a.scale.velocity -= 2.4;
    a.pulse.velocity += 2.6;
    a.ring.animate(
      [
        { transform: "scale(0.85)", opacity: 0.85 },
        { transform: "scale(2.3)", opacity: 0 },
      ],
      { duration: 760, easing: "cubic-bezier(.16,1,.3,1)" },
    );
    this.flare(a, 1);
    const url = a.spec.url;
    this.later(this.reduced ? 60 : 320, () => openExternal(url));
    this.later(1100, () => {
      a.launching = false;
      a.toggle("is-launching", false);
      if (this.launched === a) this.launched = null;
      if (this.selected === a) this.select(null);
    });
  }

  /** A brief swell of the bot's ambient light. */
  flare(a: Agent, strength = 0.6) {
    if (this.lite) return;
    a.glow.animate([{ offset: 0, opacity: 1, transform: `scale(${(1 + strength * 0.16).toFixed(3)})` }], {
      duration: 1300,
      easing: "cubic-bezier(.2,.7,.2,1)",
    });
  }

  // ── Rendering ───────────────────────────────────────────────

  private draw(dt: number) {
    for (const a of this.agents) {
      if (a.phase === "idle" || a.phase === "waiting") continue;
      this.animate(a, dt);
      a.render();
    }
    this.drawAura(dt);
  }

  private animate(a: Agent, dt: number) {
    const t = this.t;
    if (a.live) a.presence = Math.min(1, a.presence + dt / 0.9);
    const dragged = this.press?.dragging === true && this.press.agent === a;
    const focused = a === this.attention;

    a.scale.target = a.launching ? 1.05 : dragged ? 1.04 : focused ? 1 : REST;
    a.scale.step(dt);
    a.r = a.r0 * clamp(a.scale.value / REST, 0.7, 1.2);

    const lean =
      clamp((a.vx / (a.cruise * 2.2 + 10)) * a.spec.tilt, -a.spec.tilt, a.spec.tilt) +
      Math.sin(t * 0.8 + a.seed) * 1.2 +
      a.sway;
    a.tilt.target = focused ? lean * 0.25 : lean;
    a.widen.target = dragged ? 0.14 : 0;
    a.round.target = focused ? 1 : 0;
    a.happy.target = t < a.happyUntil ? 1 : 0;
    a.lift += (a.liftTarget - a.lift) * damp(18, dt);

    a.tilt.step(dt);
    a.squash.step(dt);
    a.turn.step(dt);
    a.pulse.step(dt);
    a.widen.step(dt);
    a.round.step(dt);
    a.happy.step(dt);
    if (Math.abs(a.turn.target) > 7200) {
      const wrap = 360 * Math.trunc(a.turn.target / 360);
      a.turn.target -= wrap;
      a.turn.value -= wrap;
    }
    if (a.calm) {
      // Reduced motion: twirls and pops settle instantly instead of springing.
      a.turn.snap(a.turn.target);
      a.pulse.snap(0);
    }

    this.gaze(a, dt);
    this.blink(a, dt);
    a.toggle("is-happy", t < a.happyUntil);
  }

  /** Where the eyes go: you, a conversation partner, a neighbour, or the road ahead. */
  private gaze(a: Agent, dt: number) {
    const p = this.pointer;
    const mouse = p.inside && p.kind !== "touch";
    let tx = 0;
    let ty = 0;
    let rate = 12;
    const lookAt = (x: number, y: number, k: number) => {
      const dx = x - a.x;
      const dy = y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      tx = (dx / d) * k;
      ty = (dy / d) * k;
    };
    const cursor = mouse ? Math.hypot(p.x - a.x, p.y - a.y) : Infinity;

    if (a === this.attention && a === this.hovered && mouse) {
      tx = clamp((p.x - a.x) / (a.r * 1.2), -1, 1);
      ty = clamp((p.y - a.y) / (a.r * 1.2), -1, 1);
      rate = 20;
    } else if (a === this.attention) {
      ty = 0.12; // focused from the keyboard or a tap: look at the viewer
    } else if (a.chat) lookAt(a.chat.partner.x, a.chat.partner.y, 0.95);
    else if (a.look) {
      tx = a.look.x;
      ty = a.look.y;
    } else if (cursor < 300 * this.unit && a.spec.curiosity > -0.3) lookAt(p.x, p.y, 0.9);
    else if (cursor < 220 * this.unit) lookAt(p.x, p.y, -0.7); // shy: looks away
    else if (a.nearest && a.nearestGap < a.r * 1.2) lookAt(a.nearest.x, a.nearest.y, 0.85);
    else {
      const sp = Math.hypot(a.vx, a.vy);
      if (sp > 1) {
        const k = Math.min(1, sp / (a.cruise * 1.5 + 1)) * 0.7;
        tx = (a.vx / sp) * k;
        ty = (a.vy / sp) * k;
      }
      if (this.t > a.nextGlance) {
        a.glanceX = rand(-0.45, 0.45);
        a.glanceY = rand(-0.35, 0.35);
        a.nextGlance = this.t + rand(1.2, 3.8);
      }
      tx += a.glanceX;
      ty += a.glanceY;
    }
    if (this.t < a.nodUntil) {
      tx *= 0.3;
      ty = 0.95;
    }

    const m = Math.hypot(tx, ty);
    if (m > 1) {
      tx /= m;
      ty /= m;
    }
    // Big eye movements come with a blink, as they do for people.
    if (Math.hypot(tx - a.aimX, ty - a.aimY) > 0.95 && this.t > a.saccadeAt) {
      a.blink();
      a.saccadeAt = this.t + 2.5;
    }
    a.aimX = tx;
    a.aimY = ty;
    const k = damp(rate, dt);
    a.gx += (tx - a.gx) * k;
    a.gy += (ty - a.gy) * k;
  }

  private blink(a: Agent, dt: number) {
    const t = this.t;
    if (a.blinkT < 0 && t >= a.blinkAt) a.blinkT = 0;
    if (a.blinkT < 0) return;
    a.blinkT += dt;
    const k = a.blinkT / 0.17;
    a.lid = 1 - 0.92 * Math.sin(Math.PI * Math.min(1, k));
    if (k < 1) return;
    a.blinkT = -1;
    a.lid = 1;
    if (a.blinkTwice) {
      a.blinkTwice = false;
      a.blinkAt = t + 0.12;
    } else {
      a.blinkAt = t + rand(2.2, 6.5);
      a.blinkTwice = Math.random() < 0.2;
    }
  }

  /** The cursor ring blooms out of the pointer and wraps the bot you're looking at. */
  private drawAura(dt: number) {
    const a = this.attention;
    const p = this.pointer;
    const au = this.aura;
    const mouse = p.inside && p.kind !== "touch";
    if (a && !au.on) {
      const fromPointer = mouse && a === this.hovered;
      au.x.snap(fromPointer ? p.x : a.x);
      au.y.snap(fromPointer ? p.y : a.y);
      au.size.snap(fromPointer ? 8 : a.box * 0.7);
    }
    if (a) {
      au.x.target = a.x;
      au.y.target = a.y - a.lift;
      au.size.target = a.box * a.scale.value + 22;
    } else {
      if (mouse) {
        au.x.target = p.x;
        au.y.target = p.y;
      }
      au.size.target = 8;
    }
    const on = a !== null;
    const el = this.opts.aura;
    if (on !== au.on) {
      au.on = on;
      el.classList.toggle("is-on", on);
      if (!on) au.fadeUntil = this.t + 0.5;
    }
    if (!on && this.t > au.fadeUntil) return;
    au.x.step(dt);
    au.y.step(dt);
    au.size.step(dt);
    if (a && a.spec.glow !== au.color) {
      au.color = a.spec.glow;
      el.style.setProperty("--aura", au.color);
    }
    const s = Math.max(0, au.size.value);
    el.style.transform = `translate3d(${(au.x.value - s / 2).toFixed(1)}px,${(au.y.value - s / 2).toFixed(1)}px,0)`;
    el.style.width = el.style.height = `${s.toFixed(1)}px`;
  }
}
