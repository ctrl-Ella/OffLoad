import type { ReactNode } from "react";

/**
 * Three tones, because an instruction and a failure are not the same thing and
 * were reading as the same coral block on screen.
 *
 * Both fills carry onyx ink — 11.86:1 on the teal, 6.15:1 on the coral — and
 * `quiet` leans on the border so a standing instruction does not shout over
 * the heading it sits under.
 */
type Tone = "quiet" | "good" | "alert";

const TONES: Record<Tone, string> = {
  quiet: "bg-white border border-border-strong",
  good: "bg-accent",
  alert: "bg-alert",
};

type Props = {
  tone?: Tone;
  title?: string;
  children: ReactNode;
};

export function Notice({ tone = "quiet", title, children }: Readonly<Props>) {
  return (
    <div
      // Only a failure interrupts a screen reader. A standing instruction has
      // nothing urgent to announce.
      role={tone === "alert" ? "alert" : undefined}
      className={`rounded-card px-4 py-3 text-ink ${TONES[tone]}`}
    >
      {title ? <p className="font-display font-semibold">{title}</p> : null}
      <div className="text-[15px]">{children}</div>
    </div>
  );
}
