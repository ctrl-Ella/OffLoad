import Link from "next/link";
import { ArrowLeft, CalendarCheck2, Check, Clock3, ShieldCheck } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { MiaFigure } from "@/components/mia";

// Calendar-derived demo content. These are the three non-work plans already
// scheduled in the demo week: physiotherapy, English class, and team dinner.
const PROTECTED_PLANS = [
  { day: "Monday", time: "18:30 - 19:30", title: "Physiotherapy", duration: "1h" },
  { day: "Tuesday", time: "18:00 - 19:00", title: "English class", duration: "1h" },
  { day: "Thursday", time: "20:30 - 22:30", title: "Team dinner", duration: "2h" },
];

export default function TimePage() {
  return (
    <main id="content" className="min-h-dvh bg-white text-ink">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-6 py-6 sm:px-10 sm:py-10">
        <header className="flex items-center justify-between">
          <Link
            href="/offload"
            aria-label="Back to Offload"
            title="Back to Offload"
            className="grid h-11 w-11 place-items-center rounded-control border border-border-strong text-ink transition-colors hover:bg-bg"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-strong">
            Your week, protected
          </p>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.08fr_.92fr] lg:gap-16">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-accent-strong">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              Mia has coordinated the details
            </div>

            <h1 className="mt-5 font-display text-5xl font-semibold leading-[0.98] sm:text-6xl">
              Your time is still yours.
            </h1>
            <p className="mt-5 max-w-lg text-pretty text-lg leading-7 text-ink-muted">
              Mia kept the family schedule aligned around the plans already in your calendar, so the moments that matter did not get squeezed out.
            </p>

            <div className="mt-9 flex items-end gap-3 border-y border-border py-6">
              <Clock3 className="mb-2 h-7 w-7 text-accent-strong" aria-hidden="true" />
              <div>
                <p className="font-display text-6xl font-semibold leading-none text-accent-strong sm:text-7xl">
                  4h
                </p>
                <p className="mt-2 text-sm font-medium text-ink-muted">
                  of personal plans protected this week
                </p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm" aria-label="Mia confirms your time is protected">
            <MiaFigure state="quiet" className="relative h-auto w-full" />
            <div className="absolute right-1 top-8 grid h-14 w-14 place-items-center rounded-full bg-accent text-ink shadow-sm">
              <Check className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
            </div>
          </div>
        </section>

        <section aria-labelledby="plans-title" className="border-t border-border pt-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent-strong">
                Kept in place
              </p>
              <h2 id="plans-title" className="mt-2 font-display text-3xl font-semibold">
                Plans that stayed yours.
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-5 text-ink-muted">
              Based on the personal plans already scheduled in this week&apos;s calendar.
            </p>
          </div>

          <ul className="mt-6 grid divide-y divide-border border-y border-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {PROTECTED_PLANS.map((plan) => (
              <li key={plan.title} className="flex items-center gap-4 py-5 lg:px-5 lg:first:pl-0 lg:last:pr-0">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-bg text-accent-strong">
                  <CalendarCheck2 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
                    {plan.day} · {plan.time}
                  </p>
                  <h3 className="mt-1 text-base font-semibold">{plan.title}</h3>
                </div>
                <span className="ml-auto text-sm font-semibold text-accent-strong">{plan.duration}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-9 border-t border-border pt-5">
          <div className="flex items-center gap-3 text-sm leading-5 text-ink-muted">
            <Check className="h-5 w-5 shrink-0 text-accent-strong" aria-hidden="true" />
            <p>Nothing changed without confirmation. Mia coordinated the plan; your family stayed in control.</p>
          </div>
          <div className="mt-5 border-t border-border pt-2">
            <BottomNav variant="light" />
          </div>
        </footer>
      </div>
    </main>
  );
}
