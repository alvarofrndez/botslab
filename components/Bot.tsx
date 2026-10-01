import type { CSSProperties } from "react";
import type { BotSpec } from "@/lib/cast";
import { CHARACTERS } from "./characters";

type Vars = CSSProperties & Record<`--${string}`, string>;

/**
 * Static markup for one bot. Everything that moves is driven imperatively by
 * the ecosystem engine through `data-part` hooks; React renders this once.
 */
export function Bot({ spec }: { spec: BotSpec }) {
  const { Body, Face } = CHARACTERS[spec.id];

  return (
    <a
      className={`bot bot--${spec.id} face--${spec.face.kind}`}
      data-bot={spec.id}
      href={spec.url}
      target="_blank"
      rel="noopener noreferrer"
      draggable={false}
      aria-label={`${spec.name}, an agent by ${spec.maker} (opens in a new tab)`}
      style={{ "--c": spec.color, "--glow": spec.glow, "--breathe": `${spec.breathe}s`, ...spec.vars } as Vars}
    >
      <span className="bot__glow" data-part="glow" aria-hidden="true">
        <span className="bot__halo" />
      </span>
      <span className="bot__shadow" data-part="shadow" aria-hidden="true" />
      <span className="bot__ring" data-part="ring" aria-hidden="true" />
      <span className="bot__body" data-part="body" aria-hidden="true">
        <span className="bot__art">
          <Body />
        </span>
        <span className="bot__face">
          <Face />
        </span>
      </span>
      <span className="bot__typing" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="bot__label" data-part="label" aria-hidden="true">
        <span className="bot__dot" />
        <span className="bot__name">{spec.name}</span>
        <span className="bot__maker">{spec.maker}</span>
        <svg className="bot__arrow" viewBox="0 0 12 12">
          <path
            d="M3.5 8.5l5-5M4.6 3.5h3.9v3.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </a>
  );
}
