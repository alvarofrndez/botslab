import { Art, Clay, ClosedEyes, HappyEyes, INK, OpenEyes, type Palette } from "./shared";

/**
 * OpenAI's Dots: soft, toy-like characters. One of them is on stage per visit.
 */

// ── Iggy · a pink dot with a bow and headphones, lost in the music ───────────

const IGGY: Palette = { light: "#FFD3DC", base: "#F78DA3", dark: "#E2617D", deep: "#B23D5A" };
const IGGY_BOW: Palette = { light: "#FFC2CF", base: "#F27894", dark: "#D9536F", deep: "#A8354F" };

export function IggyBody() {
  return (
    <Art>
      <Clay id="iggy" palette={IGGY} cy={5} r={33} shape={<circle cy="5" r="33" />} />
      {/* The headband hugs the top of her head. */}
      <path d="M-31.4-1.6A32 32 0 0 1 31.4-1.6" fill="none" stroke="#242428" strokeWidth="3.3" strokeLinecap="round" />
      <path
        d="M-27.6-12.4A31 31 0 0 1-12.6-24.6"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.22"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <g className="iggy-bow">
        <Clay
          id="iggy-bow"
          palette={IGGY_BOW}
          cx={-2}
          cy={-30}
          r={11}
          gloss={0.5}
          shape={
            <>
              <ellipse cx="-9" cy="-30.5" rx="7.6" ry="6.2" transform="rotate(-16 -9 -30.5)" />
              <ellipse cx="5" cy="-31.5" rx="7.6" ry="6.2" transform="rotate(16 5 -31.5)" />
              <circle cx="-2" cy="-30" r="3.9" />
            </>
          }
        />
      </g>
      <Clay
        id="iggy-cups"
        palette={INK}
        cy={9}
        r={40}
        gloss={0.25}
        shape={
          <>
            <rect x="-42.5" y="-1" width="10" height="20" rx="5" />
            <rect x="32.5" y="-1" width="10" height="20" rx="5" />
          </>
        }
      />
    </Art>
  );
}

const IGGY_XS = [-12, 12];

export function IggyFace() {
  return (
    <Art>
      <g data-depth="0.7" fill="#FF5A80" opacity="0.26">
        <ellipse cx="-20" cy="14" rx="5.4" ry="3.2" />
        <ellipse cx="20" cy="14" rx="5.4" ry="3.2" />
      </g>
      <g data-depth="1">
        <ClosedEyes xs={IGGY_XS} y={5.5} color="#5A2232" lashes />
        <OpenEyes xs={IGGY_XS} y={5} color="#3B1520" />
        <HappyEyes xs={IGGY_XS} y={5.5} color="#5A2232" />
      </g>
      {/* Music only she can hear. */}
      <g className="notes" fill="#fff" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
        <g transform="translate(40 -15)">
          <g className="note">
            <ellipse rx="2.5" ry="1.9" transform="rotate(-22)" stroke="none" />
            <path d="M2.1-0.9V-9.8c1.3 1.3 3.4 1.9 3.2 4.6" fill="none" strokeWidth="1.15" />
          </g>
        </g>
        <g transform="translate(33 -21)">
          <g className="note note--b">
            <ellipse rx="2.3" ry="1.8" transform="rotate(-22)" stroke="none" />
            <ellipse cx="6.2" cy="-1.5" rx="2.3" ry="1.8" transform="rotate(-22 6.2 -1.5)" stroke="none" />
            <path d="M1.9-0.8V-9.4L8.1-11V-2.3" fill="none" strokeWidth="1.15" />
            <path d="M1.9-9.4L8.1-11" strokeWidth="2.2" />
          </g>
        </g>
      </g>
    </Art>
  );
}

// ── Felipe · a blue cloud in a beret ─────────────────────────────────────────

const FELIPE: Palette = { light: "#B3DBFF", base: "#4AA5FF", dark: "#237AE6", deep: "#1453B0" };

export function FelipeBody() {
  return (
    <Art>
      <Clay
        id="felipe"
        palette={FELIPE}
        cy={3}
        r={38}
        shape={
          <>
            <circle cx="-15" cy="-9" r="18.5" />
            <circle cx="10" cy="-13" r="18" />
            <circle cx="25" cy="3" r="15.5" />
            <circle cx="15" cy="20" r="16.5" />
            <circle cx="-9" cy="22" r="16" />
            <circle cx="-26" cy="6" r="14.5" />
            <circle cx="0" cy="4" r="24" />
          </>
        }
      />
      <g className="felipe-beret">
        <Clay
          id="felipe-beret"
          palette={INK}
          cx={-13}
          cy={-27}
          r={20}
          gloss={0.3}
          shape={
            <>
              <ellipse cx="-13" cy="-26" rx="21" ry="8.6" transform="rotate(-15 -13 -26)" />
              <ellipse cx="-15" cy="-30" rx="15" ry="7.5" transform="rotate(-15 -15 -30)" />
              <rect x="-17.6" y="-41.5" width="3.6" height="6" rx="1.8" transform="rotate(-15 -15.8 -38.5)" />
            </>
          }
        />
      </g>
    </Art>
  );
}

const FELIPE_XS = [-4, 9];

export function FelipeFace() {
  return (
    <Art>
      <g data-depth="1">
        <OpenEyes xs={FELIPE_XS} y={6} color="#0D1B33" rx={2.5} ry={3.5} />
        <HappyEyes xs={FELIPE_XS} y={6} color="#0D1B33" w={4} weight={2} />
      </g>
    </Art>
  );
}

// ── Todd · a green frog, headphones round his neck ───────────────────────────

const TODD: Palette = { light: "#E6FAB0", base: "#A9E24E", dark: "#7FC22A", deep: "#4F8A12" };

export function ToddBody() {
  return (
    <Art>
      <Clay
        id="todd"
        palette={TODD}
        cy={4}
        r={38}
        shape={
          <>
            <ellipse cx="0" cy="9" rx="37" ry="29" />
            <circle cx="-16" cy="-17" r="14" />
            <circle cx="16" cy="-17" r="14" />
          </>
        }
      />
      {/* Headphones round his neck: the band runs behind, the cups rest on his chest. */}
      <path d="M-25 21Q-32 15-35.4 5M25 21Q32 15 35.4 5" fill="none" stroke="#242428" strokeWidth="3.3" strokeLinecap="round" />
      {[-19, 19].map((x) => (
        <g key={x}>
          <Clay id={`todd-cup${x}`} palette={INK} cx={x} cy={25} r={8.4} gloss={0.32} shape={<circle cx={x} cy="25" r="8.4" />} />
          <circle cx={x} cy="25" r="4.6" fill="none" stroke="#fff" strokeOpacity="0.1" strokeWidth="1.2" />
        </g>
      ))}
    </Art>
  );
}

export function ToddFace() {
  return (
    <Art>
      <defs>
        <radialGradient id="todd-sclera" cx="-0.15" cy="-0.3" r="1.1">
          <stop offset="0.55" stopColor="#fff" />
          <stop offset="1" stopColor="#D9E4DD" />
        </radialGradient>
      </defs>
      <g className="eyes-open">
        {[-16, 16].map((x) => (
          <g key={x} data-blink>
            <circle cx={x} cy="-18" r="10.2" fill="url(#todd-sclera)" stroke="#2F4F12" strokeOpacity="0.35" strokeWidth="1" />
            <g data-pupil>
              <circle cx={x} cy="-18" r="5.4" fill="#121212" />
              <circle cx={x + 1.9} cy="-20.1" r="1.5" fill="#fff" />
            </g>
          </g>
        ))}
      </g>
      <HappyEyes xs={[-16, 16]} y={-17} color="#355E10" w={6} weight={2.6} />
      <g data-depth="1">
        <path d="M-13 9Q0 16.5 13 9" fill="none" stroke="#3E6A14" strokeWidth="2" strokeLinecap="round" />
      </g>
    </Art>
  );
}

// ── Alfred · a yellow pear with round glasses and a bow tie ──────────────────

const ALFRED: Palette = { light: "#FFF0A8", base: "#FFCB38", dark: "#F2A20E", deep: "#C77A00" };

const PEAR =
  "M0-40C8-40 13.5-35.5 17.5-28C24-16 33 2 37.5 14C41 23 37 36 25 38.5C15 40.5-15 40.5-25 38.5C-37 36-41 23-37.5 14C-33 2-24-16-17.5-28C-13.5-35.5-8-40 0-40Z";

export function AlfredBody() {
  return (
    <Art>
      <Clay id="alfred" palette={ALFRED} cy={4} r={38} shape={<path d={PEAR} />} />
      <Clay
        id="alfred-tie"
        palette={INK}
        cy={33}
        r={16}
        gloss={0.3}
        shape={
          <>
            <path d="M-2 33L-15.5 26Q-18.5 33-15.5 40Z" />
            <path d="M2 33L15.5 26Q18.5 33 15.5 40Z" />
            <rect x="-3.6" y="29.6" width="7.2" height="6.8" rx="2.4" />
          </>
        }
      />
    </Art>
  );
}

const ALFRED_XS = [-10.5, 10.5];

export function AlfredFace() {
  return (
    <Art>
      <g data-depth="1">
        <ClosedEyes xs={ALFRED_XS} y={5} color="#5A3A00" w={4.6} />
        <OpenEyes xs={ALFRED_XS} y={5} color="#2B1D00" rx={2.2} ry={3} />
        <HappyEyes xs={ALFRED_XS} y={5.5} color="#5A3A00" w={4.4} weight={2} />
      </g>
      <g data-depth="1.08" fill="none" stroke="#2E2A24" strokeLinecap="round">
        <circle cx="-10.5" cy="4.5" r="9.2" strokeWidth="2.4" fill="#fff" fillOpacity="0.14" />
        <circle cx="10.5" cy="4.5" r="9.2" strokeWidth="2.4" fill="#fff" fillOpacity="0.14" />
        <path d="M-1.5 3.6Q0 1.8 1.5 3.6" strokeWidth="2" />
        <path d="M-19.6 3L-23.5 2M19.6 3L23.5 2" strokeWidth="2" />
        <path d="M-15.8 0.4A6.4 6.4 0 0 1-11.6-1.6M5.2 0.4A6.4 6.4 0 0 1 9.4-1.6" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.3" />
      </g>
    </Art>
  );
}

// ── Jojo · a purple heart in sunglasses ──────────────────────────────────────

const JOJO: Palette = { light: "#F6B8FA", base: "#D663E2", dark: "#AE3AC4", deep: "#7C1F94" };

const HEART =
  "M0-20C-5-32-17-37.5-27-33C-38-28-40.5-12-34.5 0C-29 11-14 24-4.5 33Q0 37 4.5 33C14 24 29 11 34.5 0C40.5-12 38-28 27-33C17-37.5 5-32 0-20Z";

export function JojoBody() {
  return (
    <Art>
      <Clay id="jojo" palette={JOJO} cy={0} r={38} shape={<path d={HEART} />} />
    </Art>
  );
}

const JOJO_XS = [-11, 11];

export function JojoFace() {
  return (
    <Art>
      <defs>
        <linearGradient id="jojo-lens" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#3A2A40" />
          <stop offset="0.55" stopColor="#141016" />
          <stop offset="1" stopColor="#0A080B" />
        </linearGradient>
      </defs>
      {/* Behind the shades: only seen when they slide down. */}
      <g data-depth="1">
        <OpenEyes xs={JOJO_XS} y={-9.5} color="#2E0B36" rx={2.5} ry={3.3} />
        <HappyEyes xs={JOJO_XS} y={-9} color="#4A1257" w={4.4} weight={2} />
      </g>
      <g data-depth="1.08">
        <g className="shades">
          <circle cx="-11" cy="-5" r="9.8" fill="url(#jojo-lens)" />
          <circle cx="11" cy="-5" r="9.8" fill="url(#jojo-lens)" />
          <g fill="none" stroke="#141016" strokeLinecap="round">
            <path d="M-1.6-6.6Q0-8.8 1.6-6.6" strokeWidth="1.8" />
            <path d="M-20.6-6.2L-24.6-7.6M20.6-6.2L24.6-7.6" strokeWidth="1.8" />
            <path
              d="M-16.4-8.6A6.6 6.6 0 0 1-11.6-11.2M5.6-8.6A6.6 6.6 0 0 1 10.4-11.2"
              stroke="#fff"
              strokeOpacity="0.55"
              strokeWidth="1.4"
            />
          </g>
        </g>
      </g>
    </Art>
  );
}
