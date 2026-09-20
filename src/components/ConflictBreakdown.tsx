import { Clock } from "lucide-react";
import { ZONE } from "@/lib/clock";
import type { Conflict } from "@/lib/conflicts";

/**
 * Why two stops do not fit: what you leave, the gap, what you do not reach.
 *
 * The stretch in the middle is where the problem lives — not in what is left
 * behind nor in what is missed, but in the gap between them — and that is
 * why it is the one line drawn in the alert colour.
 *
 * Presentational and stateless. `src/app/conflict/page.tsx` decides which
 * clash this is; `/system` shows it with declared examples.
 */

const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONE,
});

/**
 * Each figure with its origin in front. The gap is exact arithmetic. The trip
 * is a straight-line estimate and says it is: rule 6 asks that no figure be
 * shown without saying where it comes from.
 */
export function whyItDoesNotFit(conflict: Conflict): string {
  if (conflict.reason === "overlap") {
    return `They overlap by ${Math.abs(Math.round(conflict.gapMin))} minutes.`;
  }

  return (
    `You have ${Math.round(conflict.gapMin)} min and the trip takes about ` +
    `${conflict.travelMin}, estimated in a straight line.`
  );
}

export function ConflictBreakdown({ conflict }: Readonly<{ conflict: Conflict }>) {
  return (
    <div className="presentation-panel">
      <ol className="grid gap-4">
        <li className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-ink"
          >
            <Clock className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-ink">{conflict.previous.title}</span>
            <span className="block font-mono text-sm text-ink-muted">
              you leave at {TIME.format(conflict.previous.endsAt)}
            </span>
          </span>
        </li>

        <li className="ml-[18px] border-l-2 border-dashed border-alert-strong py-1 pl-6 text-sm text-alert-strong">
          {whyItDoesNotFit(conflict)}
        </li>

        <li className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-alert text-ink"
          >
            <Clock className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-ink">{conflict.next.title}</span>
            <span className="block font-mono text-sm text-ink-muted">
              starts at {TIME.format(conflict.next.startsAt)}
            </span>
          </span>
        </li>
      </ol>
    </div>
  );
}
