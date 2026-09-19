import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary";
type Size = "normal" | "small";

const VARIANTS: Record<Variant, string> = {
  // The teal is a fill, so the ink on it is the onyx: 11.86:1.
  primary: "bg-accent text-ink hover:brightness-95",
  secondary: "bg-transparent text-ink border border-border-strong hover:bg-white",
};

const SIZES: Record<Size, string> = {
  normal: "min-h-11 px-4 text-[15px]", // 44px is the comfortable touch target
  small: "min-h-9 px-3 text-sm",
};

type Common = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  className?: string;
};

/** An icon-only button must pass `label`: the type turns the most broken
 *  accessibility rule there is into a compile error. */
type Props =
  | (Common & { children: ReactNode; label?: string })
  | (Common & { children?: never; label: string });

export function Button({
  variant = "primary",
  size = "normal",
  loading = false,
  icon,
  label,
  children,
  className = "",
  disabled,
  ...rest
}: Props) {
  return (
    <button
      // A <button> inside a <form> defaults to submit, which sends it by
      // accident. Declared every time.
      type="button"
      aria-label={label}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-control",
        "font-medium transition-[filter,background-color] duration-150",
        "disabled:cursor-not-allowed disabled:opacity-55",
        children ? "" : "min-w-11 px-0",
        VARIANTS[variant],
        SIZES[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? (
        <Loader2 className="size-4.5 animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
