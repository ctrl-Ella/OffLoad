/**
 * `fetch`, but it gives up after `timeoutMs` instead of waiting forever on a
 * server that accepted the connection and simply never answered. Works the
 * same in the browser and in a server route — `AbortController` isn't
 * environment-specific — so every call in this project that talks to an
 * external service (SLNG, Nebius, Google, this app's own API routes) can
 * share the one implementation instead of each guessing its own.
 *
 * Pass `timeoutMs` per call: a quick status check and a batch job that can
 * legitimately take a minute don't belong to the same default.
 */

const DEFAULT_TIMEOUT_MS = 15_000;

export function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
  });
}
