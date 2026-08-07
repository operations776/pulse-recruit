"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// PLS-135. Speak the question instead of typing it.
//
// Browser SpeechRecognition, not an API call. It is free, it needs no key, and
// the audio never leaves the machine in a form we pay for or store. A recruiter
// between calls can hold the mic and talk rather than typing a paragraph.
//
// Chrome and Edge implement it. Safari and Firefox largely do not, so the
// button is absent rather than broken there: a control that does nothing when
// pressed is worse than no control.
//
// Interim results stream into the composer as they arrive, so you can see it
// hearing you. That matters more than it sounds: dictation that shows nothing
// until you stop feels broken every single time.

// The vendor-prefixed constructor, and the shape we actually use. The DOM lib
// does not ship these types in every TS version, so they are declared narrowly
// here rather than pulling in a global augmentation.
type SpeechResultList = {
  length: number;
  item(i: number): { 0: { transcript: string }; isFinal: boolean };
};

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

// The constructor never appears or disappears after load, so there is nothing
// to subscribe to. useSyncExternalStore still wants a subscribe function.
const subscribeNever = () => () => {};

function recognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function DictateButton({
  onTranscript,
  disabled,
}: {
  /**
   * Called with the text so far, replacing any previous interim text.
   *
   * The caller owns the composer value: this hands it what has been heard and
   * lets it decide where that goes, rather than reaching into an input.
   */
  onTranscript: (text: string, final: boolean) => void;
  disabled?: boolean;
}) {
  // Whether the browser can do this is a fact about the browser, not state we
  // own, so it is read as an external store rather than assigned in an effect.
  // The server snapshot is false, which is correct: there is no speech engine
  // during SSR, so the button renders absent and appears on hydration where it
  // is genuinely available.
  const supported = useSyncExternalStore(
    subscribeNever,
    () => recognitionCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  // Stop listening if the component goes away mid-sentence, or the microphone
  // indicator stays on after the UI holding it is gone.
  useEffect(() => {
    return () => recognition.current?.stop();
  }, []);

  if (!supported) return null;

  const start = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;

    const r = new Ctor();
    r.lang = navigator.language || "en-GB";
    // Keep going through the pauses in a spoken sentence rather than cutting
    // off at the first silence.
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (event) => {
      let text = "";
      let final = false;
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results.item(i);
        text += result[0].transcript;
        if (result.isFinal) final = true;
      }
      onTranscript(text.trim(), final);
    };

    r.onerror = (event) => {
      // "no-speech" and "aborted" are what happens when somebody presses the
      // button and changes their mind. Not worth a message.
      if (event.error === "no-speech" || event.error === "aborted") {
        setListening(false);
        return;
      }
      setError(
        event.error === "not-allowed"
          ? "Pulse needs microphone permission to take dictation."
          : "Dictation stopped. Type the question instead.",
      );
      setListening(false);
    };

    r.onend = () => setListening(false);

    recognition.current = r;
    setError(null);
    setListening(true);
    r.start();
  };

  const stop = () => {
    recognition.current?.stop();
    setListening(false);
  };

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? "Stop dictating" : "Ask by voice"}
        title={listening ? "Stop dictating" : "Ask by voice"}
        className={`settle flex size-8 shrink-0 items-center justify-center rounded-control border disabled:opacity-50 ${
          listening
            ? // Teal is on-or-running per DESIGN.md, and a live microphone is
              // exactly a running thing. bg/text rather than the solid fill:
              // there is no `on-teal` token, and both of these flip with the
              // theme, so the icon stays legible in dark mode too.
              "border-teal-edge bg-teal-bg text-teal-text"
            : "border-rule bg-sheet text-ink-2 hover:border-violet hover:text-violet"
        }`}
      >
        {listening ? (
          <Square size={14} strokeWidth={2} aria-hidden />
        ) : (
          <Mic size={16} strokeWidth={1.75} aria-hidden />
        )}
      </button>

      {/* Colour plus word: the teal button never carries the state alone. */}
      {listening ? (
        <span className="meta text-teal-text">LISTENING</span>
      ) : null}
      {error ? <span className="meta text-amber-text">{error}</span> : null}
    </span>
  );
}
