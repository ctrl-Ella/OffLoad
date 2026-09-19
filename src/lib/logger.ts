// The one place in the project where `console` is allowed (see the
// `no-console` rule in eslint.config.mjs). Everything else goes through
// here, so a log can be filtered and correlated as JSON instead of as free
// text.

type Level = "info" | "warn" | "error";

function emit(level: Level, message: string, data?: Record<string, unknown>) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  };

  // eslint-disable-next-line no-console -- this module is the exception that proves the rule.
  const write = level === "error" ? console.error : console.log;
  write(JSON.stringify(entry));
}

export const logger = {
  info: (message: string, data?: Record<string, unknown>) =>
    emit("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) =>
    emit("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) =>
    emit("error", message, data),
};
