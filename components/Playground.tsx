"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { pickCast, type BotSpec } from "@/lib/cast";
import { Ecosystem } from "@/lib/engine/ecosystem";
import { Backdrop } from "./Backdrop";
import { Bot } from "./Bot";
import { Masthead } from "./Masthead";
import { Status } from "./Status";

type Vars = CSSProperties & Record<`--${string}`, string>;

/**
 * The line-up is drawn once per page load, in the browser: the page itself
 * stays static, yet every reload brings a new cast. The server (and hydration)
 * render an empty stage, and the bots drift in as soon as the cast is known.
 */
let lineup: BotSpec[] | null = null;
const getLineup = () => (lineup ??= pickCast());
const getEmpty = () => null;
const subscribe = () => () => {};

export default function Playground() {
  const cast = useSyncExternalStore(subscribe, getLineup, getEmpty);
  const room = useRef<HTMLElement>(null);
  const stage = useRef<HTMLElement>(null);
  const aura = useRef<HTMLDivElement>(null);
  const [population, setPopulation] = useState(0);

  useEffect(() => {
    if (!cast || !room.current || !stage.current || !aura.current) return;
    const eco = new Ecosystem({
      root: room.current,
      stage: stage.current,
      aura: aura.current,
      cast,
      onPopulation: setPopulation,
    });
    eco.start();
    return () => eco.destroy();
  }, [cast]);

  // The room takes on the colours of whoever is in it tonight.
  const tint = cast ? ({ "--tint-a": cast[0].glow, "--tint-b": cast[1].glow } as Vars) : undefined;

  return (
    <main ref={room} className={cast ? "room has-cast" : "room"} style={tint}>
      <Backdrop />
      <div ref={aura} className="aura" aria-hidden="true" />
      <nav ref={stage} className="stage" aria-label="AI agents">
        {cast?.map((b) => (
          <Bot key={b.id} spec={b} />
        ))}
      </nav>
      <Masthead />
      <Status population={population} />
    </main>
  );
}
