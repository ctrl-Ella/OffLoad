"use client";

import type { InputHTMLAttributes } from "react";
import { useId } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  /** A real, visible label. A placeholder is not a label: it disappears as
   *  soon as you type, and whoever gets distracted loses the reference. */
  label: string;
  hint?: string;
  error?: string;
  className?: string;
};

/**
 * Label, hint and error tied together with `aria-describedby`, which is what
 * makes a screen reader say "Your phone, with the country code and no spaces,
 * error: that number is not valid" instead of just "Your phone".
 */
export function Field({ label, hint, error, required, className = "", ...rest }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? (
          <>
            {" "}
            {/* An asterisk on its own says nothing to whoever cannot see it. */}
            <span className="text-alert-strong" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        ) : null}
      </label>

      {hint ? (
        <p id={hintId} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}

      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={[
          "min-h-11 rounded-control border bg-white px-3 text-[15px] text-ink",
          "placeholder:text-ink-muted",
          error ? "border-alert-strong" : "border-border-strong",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      />

      {/* role="alert" announces it as it appears, without waiting for submit. */}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-alert-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
