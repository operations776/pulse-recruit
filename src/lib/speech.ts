"use client";

// Dictation, where the browser has it.
//
// The Web Speech API is Chrome and Safari only; Firefox ships no
// implementation at all. So this reports support honestly and the caller hides
// the mic rather than rendering a button that does nothing, which is the
// failure mode that teaches people not to trust a control.
//
// Whisper would work everywhere and transcribe better, but it is a second
// provider, a new rate in pricing.ts and audio upload plumbing. Deliberately
// not in this batch.

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function constructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  return constructor() !== null;
}

/**
 * Start dictating. Returns a stop function, or null when unsupported.
 *
 * `onText` receives finalised phrases only. Interim results flicker as the
 * engine changes its mind mid-word, which in a textarea reads as the box
 * fighting the user.
 */
export function startDictation({
  onText,
  onEnd,
  onError,
}: {
  onText: (text: string) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}): (() => void) | null {
  const Recognition = constructor();
  if (!Recognition) return null;

  const recognition = new Recognition();
  recognition.lang = navigator.language || "en-GB";
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) onText(result[0].transcript);
    }
  };

  recognition.onerror = (event) => {
    // "no-speech" and "aborted" are ordinary: the user paused, or stopped it.
    // Reporting those as failures would be noise.
    if (event.error === "no-speech" || event.error === "aborted") return;
    onError?.(
      event.error === "not-allowed"
        ? "Microphone access was refused, so nothing was dictated."
        : "Dictation stopped. Type instead, or try again.",
    );
  };

  recognition.onend = () => onEnd?.();

  try {
    recognition.start();
  } catch {
    // Calling start twice throws. Treat it as already running.
  }

  return () => recognition.stop();
}
