"use client";

import { useEffect, useState } from "react";

import { useReducedMotionSafe } from "@/lib/motion";

const firstLine = "Menos carga mental.";
const secondLine = "Más tiempo para vivir.";
const headline = firstLine + secondLine;

export function TypingHeadline() {
  const reducedMotion = useReducedMotionSafe();
  // `null` means nobody is typing yet, and it renders the whole headline: it is
  // what the server sends and what a browser without JavaScript keeps showing.
  const [characters, setCharacters] = useState<number | null>(null);

  useEffect(() => {
    if (reducedMotion) return;
    // Clearing the line belongs to the same tick the browser took over on.
    // Waiting for the first interval would show the full headline and blank it.
    queueMicrotask(() => setCharacters(0));
    const timer = window.setInterval(() => {
      setCharacters(count => {
        const next = Math.min((count ?? 0) + 1, headline.length);
        if (next === headline.length) window.clearInterval(timer);
        return next;
      });
    }, 55);
    return () => window.clearInterval(timer);
  }, [reducedMotion]);

  // Read here rather than reset in the effect, so a mid-session change of the
  // preference restores the headline instead of freezing it half-written.
  const visible = reducedMotion ? headline.length : characters ?? headline.length;
  const typing = !reducedMotion && characters !== null && characters < headline.length;

  return (
    <h1 id="presentation-title" className="presentation-typing-title">
      <span className="presentation-title-reserve" aria-hidden="true">{firstLine}<br /><em>{secondLine}</em></span>
      <span className="presentation-title-live" aria-hidden="true">
        {firstLine.slice(0, visible)}
        {visible > firstLine.length && <><br /><em>{secondLine.slice(0, visible - firstLine.length)}</em></>}
        {typing && <span className="presentation-cursor" />}
      </span>
      <span className="sr-only">{firstLine} {secondLine}</span>
    </h1>
  );
}
