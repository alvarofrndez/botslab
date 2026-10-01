import { SPHERE_R } from "@/lib/engine/faces";
import { Art } from "./shared";

/**
 * xAI's Grok: a ball with two eyes painted on it. One design, several colours
 * (`--grok`). The eyes are drawn by the engine; see `lib/engine/faces.ts`.
 */
export function GrokBody() {
  return (
    <Art>
      <defs>
        <radialGradient id="grok-light" cx="-15" cy="-18" r="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="grok-shade" cx="-6" cy="-8" r="54" gradientUnits="userSpaceOnUse">
          <stop offset="0.62" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </radialGradient>
      </defs>
      <circle r={SPHERE_R} style={{ fill: "var(--grok)" }} />
      <circle r={SPHERE_R} fill="url(#grok-light)" />
      <circle r={SPHERE_R} fill="url(#grok-shade)" />
    </Art>
  );
}

export function GrokFace() {
  return (
    <Art>
      <defs>
        <clipPath id="grok-clip">
          <circle r={SPHERE_R} />
        </clipPath>
      </defs>
      <g clipPath="url(#grok-clip)" fill="#fff">
        <rect data-sphere-eye="" x="-13.5" y="-13" width="10" height="25" rx="5" />
        <rect data-sphere-eye="" x="3.5" y="-13" width="10" height="25" rx="5" />
      </g>
    </Art>
  );
}
