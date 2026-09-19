import type { ReactNode } from "react";

/** Two tones because the palette has two fills, and both carry onyx ink:
 *  11.86:1 on the teal, 6.15:1 on the coral. */
type Tone = "calm" | "alert";

const TONES: Record<Tone, string> = {
  calm: "bg-accent",
  alert: "bg-alert",
};

type Props = {
  tone?: Tone;
  title?: string;
  children: ReactNode;
};

export function Notice({ tone = "calm", title, children }: Props) {
  return (
    <div
      // An alert announces itself on appearing; a calm notice would interrupt
      // whatever the screen reader was saying for no reason.
      role={tone === "alert" ? "alert" : undefined}
      className={`rounded-card px-4 py-3 text-ink ${TONES[tone]}`}
    >
      {title ? <p className="font-display font-semibold">{title}</p> : null}
      <div className="text-[15px]">{children}</div>
    </div>
  );
}
