"use client";

import { useEffect, useMemo, useState } from "react";

const PHRASES = ["website", "product", "startup", "brand", "app"];

export function TypingPhrase() {
  const longest = useMemo(
    () => PHRASES.reduce((winner, phrase) => (phrase.length > winner.length ? phrase : winner)),
    []
  );
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const phrase = PHRASES[phraseIndex];
    const atEnd = charCount === phrase.length;
    const atStart = charCount === 0;

    const delay = atEnd && !deleting ? 1050 : atStart && deleting ? 180 : deleting ? 42 : 72;
    const timer = window.setTimeout(() => {
      if (!deleting && atEnd) { setDeleting(true); return; }
      if (deleting && atStart) {
        setDeleting(false);
        setPhraseIndex((index) => (index + 1) % PHRASES.length);
        return;
      }
      setCharCount((count) => count + (deleting ? -1 : 1));
    }, delay);

    return () => window.clearTimeout(timer);
  }, [charCount, deleting, phraseIndex]);

  const text = PHRASES[phraseIndex].slice(0, charCount);

  return (
    <span className="inline-grid min-w-0 align-baseline text-accent" aria-hidden="true">
      <span className="invisible col-start-1 row-start-1">{longest}</span>
      <span className="col-start-1 row-start-1 whitespace-nowrap">
        {text}
        <span className="typing-caret ml-0.5 inline-block h-[0.9em] w-px translate-y-0.5 bg-accent" />
      </span>
    </span>
  );
}
