"use client";

import { AnimatePresence, motion } from "motion/react";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** The only other UI: a live head-count that rolls as bots arrive, and a quiet hint. */
export function Status({ population }: { population: number }) {
  return (
    <footer className="status">
      <p className="status__live" data-obstacle>
        <span className="status__pulse" aria-hidden="true" />
        <span>
          <span className="status__count">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={population}
                initial={{ y: "80%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                exit={{ y: "-80%", opacity: 0 }}
                transition={{ duration: 0.45, ease: EASE_OUT }}
              >
                {population}
              </motion.span>
            </AnimatePresence>
          </span>
          <span>{population === 1 ? "bot" : "bots"} online</span>
        </span>
      </p>
      <p className="status__hint" data-obstacle>
        <span className="hint-hover">
          Hover to meet <span className="status__sep">·</span> Click to visit
        </span>
        <span className="hint-touch">
          Tap to meet <span className="status__sep">·</span> Tap again to visit
        </span>
      </p>
    </footer>
  );
}
