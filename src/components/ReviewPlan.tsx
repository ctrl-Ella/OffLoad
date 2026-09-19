import { ArrowLeft, CalendarDays, SquareCheck, TriangleAlert } from "lucide-react";
import type { ComponentType } from "react";
import { BottomNav } from "@/components/BottomNav";
import { ListeningOrb } from "@/components/ListeningOrb";
import { Button } from "@/components/ui/button";

/**
 * One row of the structured plan `/api/structure-plan` returns. `detail` is
 * already formatted for display — a time range, a deadline, or a conflict's
 * own description — this component doesn't compute or reformat it.
 */
export type PlanItem = {
  title: string;
  detail: string;
  type: "event" | "task" | "conflict";
};

const ICON: Record<PlanItem["type"], ComponentType<{ className?: string }>> = {
  event: CalendarDays,
  task: SquareCheck,
  conflict: TriangleAlert,
};

// This screen's chrome stays English, same deliberate exception as the rest
// of the voice flow (see ListeningScreen). `title` and `detail` are the
// person's own words, already in Spanish, and are never touched here.
const TYPE_LABEL: Record<PlanItem["type"], string> = {
  event: "Event",
  task: "Task",
  conflict: "Conflict",
};

function itemCountLabel(count: number): string {
  return count === 1 ? "1 thing, sorted." : `${count} things, sorted.`;
}

/**
 * The voice flow's third and final state: what Mia made of the transcript,
 * one card per event, task or conflict.
 *
 * Presentational and stateless, same as `ListeningScreen`. `src/app/offload/page.tsx`
 * decides where `items` comes from — today, `/api/structure-plan` — and what
 * "Review the plan" does next.
 */
export function ReviewPlan({
  items,
  onBack,
  onReview,
}: {
  items: PlanItem[];
  onBack: () => void;
  onReview: () => void;
}) {
  return (
    <div
      data-theme="immersive"
      className="relative flex min-h-dvh flex-col overflow-x-hidden bg-surface-immersive text-ink-immersive"
    >
      {/* Same ambient glow as the other two states of this flow. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent-immersive opacity-20 blur-3xl"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-6 sm:max-w-lg sm:pb-10">
        <header className="pt-[max(1rem,env(safe-area-inset-top))]">
          <Button
            variant="primary"
            onClick={onBack}
            icon={<ArrowLeft className="h-5 w-5" aria-hidden="true" />}
            label="Back"
          />
        </header>

        <main id="content" className="flex flex-1 flex-col gap-6 py-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <ListeningOrb state="success" />

            <div>
              <h1 className="font-display text-2xl font-semibold sm:text-3xl">
                I&apos;ve got it.
              </h1>
              <p className="mt-1 text-pretty text-ink-muted-immersive">
                {itemCountLabel(items.length)}
              </p>
            </div>
          </div>

          <ul className="flex flex-col gap-2.5">
            {items.map((item, index) => {
              const Icon = ICON[item.type];
              const isConflict = item.type === "conflict";

              return (
                <li
                  key={`${item.title}-${index}`}
                  className={`flex min-h-[4.5rem] items-center gap-3 rounded-card px-4 py-3 ${
                    isConflict ? "bg-alert-surface-immersive" : "bg-card-immersive"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${
                      isConflict
                        ? "bg-alert text-surface-immersive"
                        : "bg-chip-immersive text-accent-immersive"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h2 className="text-pretty break-words text-[15px] font-semibold text-ink-immersive">
                      {item.title}
                    </h2>
                    <p className="mt-0.5 text-pretty break-words text-sm text-ink-muted-immersive">
                      {item.detail}
                    </p>
                  </div>

                  <span className="shrink-0 text-xs text-ink-muted-immersive">
                    {TYPE_LABEL[item.type]}
                  </span>
                </li>
              );
            })}
          </ul>
        </main>

        <footer className="flex flex-col items-center gap-5">
          <Button
            variant="primary"
            onClick={onReview}
            className="h-14 w-full text-base"
            style={{ borderRadius: "9999px" }}
          >
            Review the plan
          </Button>

          <hr className="w-full border-t border-border-immersive" />

          <BottomNav />
        </footer>
      </div>
    </div>
  );
}
