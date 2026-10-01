/**
 * The cast: one agent per company. A company may have several designs; each
 * visit shows one of them, chosen at random (and never the one shown last
 * time, so a reload always brings someone new).
 *
 * Face geometry is expressed in viewBox units of the character art (a 100 × 100
 * box centred on the origin).
 */

export type BehaviorId =
  | "groove" // Iggy — lost in the music, bobbing to the beat
  | "drift" // Felipe — a daydreaming cloud carried by the breeze
  | "hop" // Todd — a frog: hops, and the odd big leap
  | "stroll" // Alfred — composed straight walks, bows to passers-by
  | "cruise" // Jojo — effortlessly cool S-curves, heart beats near company
  | "dash" // Grok — daydreams, winds up, then zips
  | "waddle"; // Muse — waddles over to say hello

export type FaceKind =
  | "dots" // eyes look around, blink, and turn ◠ ◠ when happy
  | "closed" // eyes stay shut until someone says hello
  | "googly" // pupils roll inside big eyeballs
  | "shades" // sunglasses that slide down to peek at you
  | "sphere"; // eyes painted on a ball: looking around turns the ball

export interface FaceSpec {
  kind: FaceKind;
  /** How far the face travels when looking around. */
  range: number;
  /** Googly eyes: how far the pupils travel inside the eyeballs. */
  pupil?: number;
}

export interface BotSpec {
  /** Character id; also selects the art and the CSS. */
  id: string;
  name: string;
  maker: string;
  url: string;
  /** Accent for the name tag. */
  color: string;
  /** Space-separated RGB channels for halos, rings and the cursor aura. */
  glow: string;
  /** Size relative to the base bot size. */
  size: number;
  /** Collision radius as a fraction of half the art box. */
  hit: number;
  mass: number;
  /** Cruise speed in px/s on a ~860px tall viewport. */
  speed: number;
  /** How quickly velocity follows the desired heading (1/s). */
  agility: number;
  /** Heading noise amplitude (rad/s). */
  wobble: number;
  /** Maximum body lean in degrees. */
  tilt: number;
  /** −1 shy … 1 curious: how the bot reacts to a nearby cursor. */
  curiosity: number;
  /** Duration of the ambient glow breathing cycle, in seconds. */
  breathe: number;
  behavior: BehaviorId;
  face: FaceSpec;
  /** Extra CSS custom properties for the art, such as Grok's colour. */
  vars?: Record<`--${string}`, string>;
}

interface Company {
  id: string;
  /** One of these is on stage per visit. */
  designs: BotSpec[];
}

const OPENAI = { maker: "OpenAI", url: "https://openai.com/index/introducing-dots/" } as const;

const iggy: BotSpec = {
  ...OPENAI,
  id: "iggy",
  name: "Iggy",
  color: "#F7899F",
  glow: "247 137 159",
  size: 0.98,
  hit: 0.76,
  mass: 0.9,
  speed: 24,
  agility: 1,
  wobble: 0.9,
  tilt: 5,
  curiosity: 0,
  breathe: 5,
  behavior: "groove",
  face: { kind: "closed", range: 3 },
};

const felipe: BotSpec = {
  ...OPENAI,
  id: "felipe",
  name: "Felipe",
  color: "#3E9BFF",
  glow: "62 155 255",
  size: 1,
  hit: 0.8,
  mass: 1,
  speed: 22,
  agility: 0.6,
  wobble: 0.7,
  tilt: 5,
  curiosity: 0.2,
  breathe: 6.5,
  behavior: "drift",
  face: { kind: "dots", range: 4 },
};

const todd: BotSpec = {
  ...OPENAI,
  id: "todd",
  name: "Todd",
  color: "#A6E04C",
  glow: "166 224 76",
  size: 0.98,
  hit: 0.8,
  mass: 1,
  speed: 22,
  agility: 1.4,
  wobble: 1,
  tilt: 6,
  curiosity: 0.45,
  breathe: 4.6,
  behavior: "hop",
  face: { kind: "googly", range: 1.6, pupil: 3.2 },
};

const alfred: BotSpec = {
  ...OPENAI,
  id: "alfred",
  name: "Alfred",
  color: "#FFC933",
  glow: "255 201 51",
  size: 1,
  hit: 0.8,
  mass: 1.1,
  speed: 30,
  agility: 1.2,
  wobble: 0.35,
  tilt: 4,
  curiosity: 0.3,
  breathe: 6,
  behavior: "stroll",
  face: { kind: "closed", range: 2.6 },
};

const jojo: BotSpec = {
  ...OPENAI,
  id: "jojo",
  name: "Jojo",
  color: "#D35FE0",
  glow: "211 95 224",
  size: 0.96,
  hit: 0.8,
  mass: 1,
  speed: 32,
  agility: 0.9,
  wobble: 0.6,
  tilt: 8,
  curiosity: 0.15,
  breathe: 4.2,
  behavior: "cruise",
  face: { kind: "shades", range: 3 },
};

/** Grok has one design in several colours. */
function grok(color: string, glow: string): BotSpec {
  return {
    id: "grok",
    name: "Grok",
    maker: "xAI",
    url: "https://x.ai/bot",
    color,
    glow,
    size: 0.86,
    hit: 0.84,
    mass: 0.8,
    speed: 26,
    agility: 1,
    wobble: 1.2,
    tilt: 10,
    curiosity: -0.1,
    breathe: 3.8,
    behavior: "dash",
    face: { kind: "sphere", range: 1 },
    vars: { "--grok": color },
  };
}

const muse: BotSpec = {
  id: "muse",
  name: "Muse",
  maker: "Meta",
  url: "https://ai.meta.com/muse/",
  color: "#EFE3CC",
  glow: "245 228 200",
  size: 1.14,
  hit: 0.74,
  mass: 1.3,
  speed: 19,
  agility: 1.1,
  wobble: 0.8,
  tilt: 3,
  curiosity: 0.5,
  breathe: 6,
  behavior: "waddle",
  face: { kind: "dots", range: 2.2 },
};

export const COMPANIES: Company[] = [
  { id: "openai", designs: [iggy, felipe, todd, alfred, jojo] },
  {
    id: "xai",
    designs: [grok("#54B9A6", "84 185 166"), grok("#F19D38", "241 157 56"), grok("#3C82F6", "60 130 246")],
  },
  { id: "meta", designs: [muse] },
];

const STORAGE_KEY = "ai-bots:last-cast";
const keyOf = (b: BotSpec) => `${b.id}:${b.color}`;

function lastCast(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return value && typeof value === "object" ? (value as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Pick tonight's line-up: one design per company, avoiding last visit's. */
export function pickCast(): BotSpec[] {
  const last = lastCast();
  const shown: Record<string, string> = {};
  const cast = COMPANIES.map((c) => {
    const fresh = c.designs.filter((d) => keyOf(d) !== last[c.id]);
    const pool = fresh.length ? fresh : c.designs;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    shown[c.id] = keyOf(pick);
    return pick;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shown));
  } catch {
    /* storage unavailable: every visit is simply random */
  }
  return cast;
}
