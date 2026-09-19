"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mia } from "@/components/mia";
import { MIA_LABELS, MIA_STATE_ORDER, type MiaState } from "@/components/mia-states";

/**
 * Mia with switchable states. The grid beside it shows each state at rest;
 * the transitions only exist when something changes, and this is where.
 */
export function MiaLive() {
  const [state, setState] = useState<MiaState>("quiet");

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      {/* Same width as the five above: this page exists to compare. */}
      <div className="w-36 shrink-0">
        <Mia state={state} />
      </div>

      <div className="flex flex-wrap gap-2">
        {MIA_STATE_ORDER.map((next) => (
          <Button
            key={next}
            size="small"
            variant={next === state ? "primary" : "secondary"}
            aria-pressed={next === state}
            onClick={() => setState(next)}
          >
            {MIA_LABELS[next]}
          </Button>
        ))}
      </div>
    </div>
  );
}
