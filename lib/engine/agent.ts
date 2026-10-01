import type { BotSpec } from "../cast";
import { drawSphereEyes } from "./faces";
import { DEG, Spring, TAU } from "./math";

export type Phase = "idle" | "waiting" | "entering" | "alive";

export interface Chat {
  partner: Agent;
  start: number;
  end: number;
  /** The lead speaks first (and last). */
  lead: boolean;
}

/**
 * Resting body scale. The art is drawn at its hovered size and scaled down at
 * rest, so it never has to be upscaled (and blurred) when a bot is focused.
 */
export const REST = 0.88;

interface Part {
  el: SVGElement;
  depth: number;
  last: string;
}

/**
 * One bot: its physical body, its behavioural memory and its visual state.
 * The Ecosystem drives it; the agent only knows how to render itself.
 */
export class Agent {
  readonly el: HTMLAnchorElement;
  readonly body: HTMLElement;
  readonly glow: HTMLElement;
  readonly shadow: HTMLElement;
  readonly ring: HTMLElement;
  readonly label: HTMLElement;

  // ── Simulation ──────────────────────────────────────────────
  x = -999;
  y = -999;
  vx = 0;
  vy = 0;
  /** Accumulated accelerations for this frame (px/s²). */
  ax = 0;
  ay = 0;
  /** Desired velocity, followed at `agility`. */
  dvx = 0;
  dvy = 0;
  agility = 1;
  heading = Math.random() * TAU;
  readonly seed = Math.random() * 1000;
  readonly mass: number;
  box = 80;
  /** Resting collision radius. */
  r0 = 30;
  /** Live collision radius (grows with the body when focused). */
  r = 30;
  cruise = 30;
  /** Temporary extra speed allowance after an impulse; decays. */
  boost = 0;
  /** Seconds during which steering is relaxed so momentum carries. */
  glide = 0;
  /** Immovable in collisions (focused, dragged, launching). */
  pinned = false;
  /** Doing something deliberate; don't interrupt with chats or nudges. */
  busy = false;
  /** Reduced motion: no impulses, no squash. */
  calm = false;

  // ── Lifecycle ───────────────────────────────────────────────
  phase: Phase = "idle";
  presence = 0;
  wake = 0;

  // ── Behaviour memory ────────────────────────────────────────
  mem: Record<string, number> = {};
  target: Agent | null = null;
  chat: Chat | null = null;
  chatReadyAt = 0;
  nearest: Agent | null = null;
  nearestGap = Infinity;
  look: { x: number; y: number } | null = null;
  stillFor = 0;
  launching = false;

  // ── Visual state ────────────────────────────────────────────
  readonly scale = new Spring(0.5, 170, 15);
  readonly squash = new Spring(0, 380, 11);
  squashAngle = 0;
  readonly tilt = new Spring(0, 60, 10);
  /** Whole-body turns, such as a twirl. Degrees. */
  readonly turn = new Spring(0, 70, 11);
  /** Body "pop" impulses (heartbeats, greetings). */
  readonly pulse = new Spring(0, 240, 10);
  readonly widen = new Spring(0, 260, 14);
  /** Sphere faces: 0 = pill eyes, 1 = round eyes looking at you. */
  readonly round = new Spring(0, 90, 15);
  readonly happy = new Spring(0, 120, 16);
  breath = 0;
  /** Height above the floor, in px. The shadow stays put. */
  lift = 0;
  liftTarget = 0;
  /** Behaviour-driven lean (grooving, waddling), degrees. */
  sway = 0;
  /** Gaze, roughly in [−1, 1]. */
  gx = 0;
  gy = 0;
  glanceX = 0;
  glanceY = 0;
  nextGlance = 0;
  /** Last gaze target, to blink on big eye movements like people do. */
  aimX = 0;
  aimY = 0;
  saccadeAt = 0;
  /** Looking down for a bow until then. */
  nodUntil = 0;
  blinkAt = 0;
  blinkT = -1;
  blinkTwice = false;
  lid = 1;
  happyUntil = 0;
  labelW = 0;

  private readonly parts: Part[];
  private readonly lids: SVGElement[];
  private readonly pupils: SVGElement[];
  private readonly sphere: SVGRectElement[];
  private readonly flags = new Map<string, boolean>();
  private readonly cache: string[] = [];

  constructor(
    readonly spec: BotSpec,
    readonly index: number,
    el: HTMLAnchorElement,
  ) {
    const part = (name: string) => {
      const found = el.querySelector<HTMLElement>(`[data-part="${name}"]`);
      if (!found) throw new Error(`Bot "${spec.id}" is missing its ${name}`);
      return found;
    };
    this.el = el;
    this.body = part("body");
    this.glow = part("glow");
    this.shadow = part("shadow");
    this.ring = part("ring");
    this.label = part("label");
    this.parts = Array.from(el.querySelectorAll<SVGElement>("[data-depth]"), (node) => ({
      el: node,
      depth: Number(node.dataset.depth),
      last: "",
    }));
    this.lids = Array.from(el.querySelectorAll<SVGElement>("[data-blink]"));
    this.pupils = Array.from(el.querySelectorAll<SVGElement>("[data-pupil]"));
    this.sphere = Array.from(el.querySelectorAll<SVGRectElement>("[data-sphere-eye]"));
    this.mass = spec.mass;
  }

  /** Present on stage and taking part in the simulation's social life. */
  get live() {
    return this.phase === "entering" || this.phase === "alive";
  }

  resize(base: number, unit: number) {
    this.box = Math.round(base * this.spec.size);
    this.r0 = (this.box / 2) * this.spec.hit * REST;
    this.r = this.r0;
    this.cruise = this.spec.speed * unit;
    this.labelW = 0;
    const s = this.el.style;
    s.setProperty("--box", `${this.box}px`);
    s.setProperty("--r", `${this.r0.toFixed(2)}px`);
    s.setProperty("--lift", `${(this.box / 2 - this.r0 + 12).toFixed(1)}px`);
  }

  /** Hit-test against the body as drawn, which floats `lift` above its footprint. */
  contains(x: number, y: number, k = 1) {
    const dx = x - this.x;
    const dy = y - (this.y - this.lift);
    const r = this.r * k;
    return dx * dx + dy * dy < r * r;
  }

  /** Add an impulse (px/s) and let momentum carry it for `glide` seconds. */
  kick(vx: number, vy: number, glide: number) {
    if (this.calm) return;
    this.vx += vx;
    this.vy += vy;
    this.boost = Math.max(this.boost, Math.hypot(vx, vy));
    this.glide = Math.max(this.glide, glide);
  }

  /** Stretch (positive) or squash (negative) the body along an angle. */
  stretch(angle: number, amount: number) {
    if (this.calm) return;
    this.squashAngle = angle;
    this.squash.velocity += amount * 28;
  }

  blink() {
    if (this.blinkT < 0) this.blinkAt = 0;
  }

  toggle(cls: string, on: boolean) {
    if (this.flags.get(cls) === on) return;
    this.flags.set(cls, on);
    this.el.classList.toggle(cls, on);
  }

  has(cls: string) {
    return this.flags.get(cls) === true;
  }

  setLabelShift(px: number) {
    this.write(5, this.label, "--shift", `${px.toFixed(1)}px`);
  }

  /** Push the current state to the DOM. Only changed values are written. */
  render() {
    this.write(
      0,
      this.el,
      "transform",
      `translate3d(${(this.x - this.r0).toFixed(1)}px,${(this.y - this.r0).toFixed(1)}px,0)`,
    );
    this.write(1, this.el, "opacity", this.presence >= 0.995 ? "" : this.presence.toFixed(3));

    const s = this.scale.value * (1 + this.breath + this.pulse.value);
    const q = this.calm ? 0 : this.squash.value;
    let body = this.lift > 0.05 ? `translate(0,${(-this.lift).toFixed(1)}px) ` : "";
    if (Math.abs(q) > 0.002) {
      const a = this.squashAngle * DEG;
      body += `rotate(${a.toFixed(1)}deg) scale(${(1 + q).toFixed(3)},${(1 - q).toFixed(3)}) rotate(${(-a).toFixed(1)}deg) `;
    }
    body += `rotate(${(this.tilt.value + this.turn.value).toFixed(2)}deg) scale(${s.toFixed(3)})`;
    this.write(2, this.body, "transform", body);

    // The higher a bot floats, the smaller and fainter its shadow.
    const up = Math.min(1, this.lift / (this.box * 0.5));
    this.write(3, this.shadow, "transform", `scale(${(this.scale.value * (1 - up * 0.45)).toFixed(3)})`);
    this.write(4, this.shadow, "opacity", (1 - up * 0.6).toFixed(2));

    this.renderFace();
  }

  private renderFace() {
    const { face } = this.spec;
    const fx = this.gx * face.range;
    const fy = this.gy * face.range;
    for (const p of this.parts) {
      const v = `translate(${(fx * p.depth).toFixed(2)}px,${(fy * p.depth).toFixed(2)}px)`;
      if (v !== p.last) {
        p.last = v;
        p.el.style.transform = v;
      }
    }

    const w = 1 + this.widen.value;
    const lid = `scale(${w.toFixed(3)},${(w * this.lid).toFixed(3)})`;
    if (lid !== this.cache[6]) {
      this.cache[6] = lid;
      for (const e of this.lids) e.style.transform = lid;
    }

    if (this.pupils.length) {
      const k = face.pupil ?? 0;
      const v = `translate(${(this.gx * k).toFixed(2)}px,${(this.gy * k).toFixed(2)}px)`;
      if (v !== this.cache[7]) {
        this.cache[7] = v;
        for (const e of this.pupils) e.style.transform = v;
      }
    }

    if (this.sphere.length) {
      const state = {
        gx: this.gx,
        gy: this.gy,
        lid: this.lid,
        round: this.round.value,
        happy: this.happy.value,
        widen: this.widen.value,
      };
      const key = Object.values(state)
        .map((v) => v.toFixed(3))
        .join();
      if (key !== this.cache[8]) {
        this.cache[8] = key;
        drawSphereEyes(this.sphere, state);
      }
    }
  }

  private write(slot: number, el: HTMLElement, prop: string, value: string) {
    if (this.cache[slot] === value) return;
    this.cache[slot] = value;
    el.style.setProperty(prop, value);
  }
}
