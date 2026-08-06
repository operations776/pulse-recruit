"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "@/components/shell/theme-script";

// PLS-104. The pill-and-knob switch from the rebrand.
//
// The knob is a violet sun on the left in light mode. In dark it slides right,
// turns cream, and a radial-gradient mask bites a crescent out of it so it
// reads as a moon. That is the rebrand's own trick, kept because it is the one
// piece of ornament in the product that earns its place: the control shows the
// state it is about to produce.
//
// ThemeScript has already set data-theme before paint. This component only
// reads it back so the knob starts on the correct side, and writes the choice
// so it survives the next navigation.

// The theme lives on <html>, not in React state: ThemeScript sets it before
// React exists and the user can only change it here. That makes it an external
// store, so useSyncExternalStore is the honest way to read it. It also takes a
// separate server snapshot, which is what keeps the first render from
// mismatching without needing an effect to correct it afterwards.
const themeStore = {
  subscribe(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  },
  get(): "light" | "dark" {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  },
  // The server cannot know the theme, so it renders the knob on the left.
  // ThemeScript has already set the real value on the client, so the observer
  // corrects it on the first commit with no visible jump.
  server(): "light" | "dark" {
    return "light";
  },
};

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.get,
    themeStore.server,
  );

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    // Writing the attribute is what actually changes the theme; the store
    // observes it and re-renders this button.
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private mode. The theme still applies for this session; it just will
      // not be remembered, which is better than failing the click.
    }
  };

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      className="settle relative h-6 w-[42px] shrink-0 rounded-chip border border-rule bg-well"
    >
      <span
        aria-hidden
        className={`absolute left-[2px] top-[2px] size-[18px] rounded-full transition-transform duration-200 ${
          isDark ? "translate-x-[18px] bg-[#f4ecc9]" : "bg-vermilion"
        }`}
        style={
          isDark
            ? {
                // The crescent. Masking a bite out of the circle is cheaper and
                // sharper than swapping in a moon icon at 18px.
                WebkitMaskImage:
                  "radial-gradient(circle at 68% 30%, transparent 54%, #000 55%)",
                maskImage:
                  "radial-gradient(circle at 68% 30%, transparent 54%, #000 55%)",
                filter: "drop-shadow(0 0 3px rgba(244,236,201,.55))",
              }
            : undefined
        }
      />
    </button>
  );
}
