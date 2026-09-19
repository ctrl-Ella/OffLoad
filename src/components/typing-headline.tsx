"use client";

import { useEffect, useState } from "react";

const firstLine = "Menos carga mental.";
const secondLine = "Más tiempo para vivir.";
const headline = firstLine + secondLine;

export function TypingHeadline() {
  const [characters, setCharacters] = useState<number | null>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    queueMicrotask(() => setCharacters(0));
    const timer = window.setInterval(() => {
      setCharacters(count => {
        const next = Math.min((count ?? 0) + 1, headline.length);
        if (next === headline.length) window.clearInterval(timer);
        return next;
      });
    }, 55);
    return () => window.clearInterval(timer);
  }, []);

  const visible = characters ?? headline.length;

  return (
    <h1 id="presentation-title" className="presentation-typing-title">
      <span className="presentation-title-reserve" aria-hidden="true">{firstLine}<br /><em>{secondLine}</em></span>
      <span className="presentation-title-live" aria-hidden="true">
        {firstLine.slice(0, visible)}
        {visible > firstLine.length && <><br /><em>{secondLine.slice(0, visible - firstLine.length)}</em></>}
        {characters !== null && characters < headline.length && <span className="presentation-cursor" />}
      </span>
      <span className="sr-only">{firstLine} {secondLine}</span>
    </h1>
  );
}
