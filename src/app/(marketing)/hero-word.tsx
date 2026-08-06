"use client";

import { useEffect, useState } from "react";

// PLS-107. The cycling word in the headline.
//
// "The ATS that keeps your pipeline ALIVE / MOVING / WARM ..." rotating every
// four seconds, from the rebrand.
//
// Two details that matter more than the effect itself:
//
// The container is sized to the LONGEST word using an invisible sizer, so the
// headline never reflows as the word changes. The rebrand does this by
// measuring every word in JS on load and on resize; a grid with all the words
// stacked in one cell gets the same result with no measuring and no resize
// listener, and it is correct before the first paint rather than after it.
//
// prefers-reduced-motion stops the rotation entirely rather than just removing
// the fade. A word silently replacing itself every four seconds is still
// motion, and a person who asked for less of it did not mean "less pretty".

export function HeroWord({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const timer = setInterval(
      () => setIndex((i) => (i + 1) % words.length),
      4000,
    );
    return () => clearInterval(timer);
  }, [words.length]);

  return (
    <span className="relative inline-grid align-bottom">
      {/* Every word stacked in one grid cell. The widest one sets the width;
          the rest are invisible and take no part in layout beyond that. */}
      {words.map((word, i) => (
        <span
          key={word}
          aria-hidden={i !== index}
          className={`col-start-1 row-start-1 text-violet transition-opacity duration-500 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
