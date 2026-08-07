"use client";

import { agent } from "@/config/brand";

// PLS-110. Mara's face.
//
// Five states in the Figma, and comparing the exported SVGs showed they share
// one head and differ only in the eyes and mouth. So this is one component
// with a switch rather than five files: the head, ring and eye positions are
// written once, and a state changes four numbers.
//
// Geometry is taken verbatim from the exported assets on a 64 viewBox:
//   head    cx 32 cy 34 r 26
//   eyes    cx 23.5 / 40.5, r 2.5
//   mouth   x 25 y 43 w 14 h 3 r 1.5
// The idle export at 92px adds a session ring at r 44.5 with a 3px stroke,
// which scales to r 31 here.
//
// Motion is from the Figma's own spec board: 160 to 220ms on
// cubic-bezier(0.2, 0, 0, 1), no spring, no overshoot, and the 4s breathe
// loop on idle. Everything is disabled under prefers-reduced-motion by the
// global rule in globals.css.

export type MaraState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "stumped";

const EYE = {
  // Listening lifts the eyes 2px: the design's way of showing attention
  // without a facial expression that would read as a cartoon.
  listening: { cy: 28.5, rx: 2.5, ry: 2.5 },
  // Thinking flattens them into a squint.
  thinking: { cy: 29.5, rx: 2.5, ry: 1.5 },
  default: { cy: 30.5, rx: 2.5, ry: 2.5 },
} as const;

export function MaraAvatar({
  state = "idle",
  size = 64,
  /** The session ring, drawn on the large identity avatar only. */
  ring = false,
  className = "",
}: {
  state?: MaraState;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const eye =
    state === "listening"
      ? EYE.listening
      : state === "thinking"
        ? EYE.thinking
        : EYE.default;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={`${agent.name}, ${state}`}
      className={`${state === "idle" ? "mara-breathe" : ""} ${className}`}
    >
      {ring ? (
        <circle
          cx="32"
          cy="32"
          r="31"
          stroke="var(--color-mara-ring)"
          strokeWidth="2"
          fill="none"
        />
      ) : null}

      <circle cx="32" cy="34" r="26" fill="var(--color-mara-violet-soft)" />

      <ellipse
        cx="23.5"
        cy={eye.cy}
        rx={eye.rx}
        ry={eye.ry}
        fill="var(--color-mara-violet-deep)"
        // The eyes move between states, so they animate rather than jump.
        style={{ transition: "all 180ms cubic-bezier(0.2, 0, 0, 1)" }}
      />
      <ellipse
        cx="40.5"
        cy={eye.cy}
        rx={eye.rx}
        ry={eye.ry}
        fill="var(--color-mara-violet-deep)"
        style={{ transition: "all 180ms cubic-bezier(0.2, 0, 0, 1)" }}
      />

      {/* Speaking is an open mouth. */}
      {state === "speaking" ? (
        <ellipse cx="32" cy="45" rx="7" ry="5" fill="var(--color-mara-violet)" />
      ) : (
        <rect
          // Listening narrows the mouth to 10px; stumped tilts it 12 degrees.
          x={state === "listening" ? 27 : 25}
          y={state === "stumped" ? 44 : 43}
          width={state === "listening" ? 10 : 14}
          height="3"
          rx="1.5"
          fill="var(--color-mara-violet)"
          transform={state === "stumped" ? "rotate(12 25 44)" : undefined}
          style={{ transition: "all 180ms cubic-bezier(0.2, 0, 0, 1)" }}
        />
      )}

      {/* Thinking adds the three dots above the head, cycling on a 1.2s loop
          exactly as the Figma spec names. */}
      {state === "thinking" ? (
        <>
          <circle cx="24.5" cy="4.5" r="2.5" fill="var(--color-mara-violet)" className="mara-dot" />
          <circle cx="33.5" cy="4.5" r="2.5" fill="var(--color-mara-violet)" className="mara-dot mara-dot-2" />
          <circle cx="42.5" cy="4.5" r="2.5" fill="var(--color-mara-violet)" className="mara-dot mara-dot-3" />
        </>
      ) : null}
    </svg>
  );
}
