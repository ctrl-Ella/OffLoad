type Level = "info" | "warn" | "error";

/**
 * Flat values only, and never personal data. This product reads family
 * calendars: whatever lands here is written to the log provider, outside our
 * control and with no deletion date.
 */
type Context = Record<string, string | number | boolean | null | undefined>;

// `process.stdout.write` and not `console`, so ESLint can ban `console` outright
// without an exception someone copies.
function emit(level: Level, message: string, context?: Context): void {
  process.stdout.write(
    `${JSON.stringify({ level, message, at: new Date().toISOString(), ...context })}\n`,
  );
}

/**
 * One JSON line per event, to stdout. On Railway the logs are the only
 * debugging surface, and free text cannot be filtered or correlated.
 */
export const log = {
  info: (message: string, context?: Context) => emit("info", message, context),
  warn: (message: string, context?: Context) => emit("warn", message, context),
  error: (message: string, context?: Context) => emit("error", message, context),
};

/**
 * An error's message, without dragging along the stack or the object: a
 * database driver's error carries host, user and sometimes the password.
 */
export function reason(error: unknown): string {
  return error instanceof Error ? error.message : "unknown";
}
