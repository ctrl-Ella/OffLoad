/**
 * The attempt as the browser remembers it, so coming back after the jump to
 * the carrier lands on the code and not back at the start. The cookie is the
 * one that counts — this is only what the screen needs to paint.
 *
 * `sessionStorage` and not `localStorage`: an attempt belongs to this tab and
 * expires in fifteen minutes, so it has no business outliving the window.
 */

const KEY = "offload_attempt";

export function pendingAttempt(): string | null {
  // Server rendering has no sessionStorage, and a private window can throw.
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberAttemptInBrowser(requestId: string): void {
  try {
    window.sessionStorage.setItem(KEY, requestId);
  } catch {
    // Not being able to remember is survivable: the cookie still holds it.
  }
}

export function forgetAttemptInBrowser(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to do, and nothing that should stop the screen working.
  }
}
