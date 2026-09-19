// With the extension, so Node can run it outside Next: `npm run demo:seed`.
import { requireGoogleCredentials } from "./env.ts";

/**
 * Google OAuth by hand, no SDK. `googleapis` is several megabytes and what is
 * needed here is three HTTP calls. Nothing leaves the server: the client secret
 * and the refresh token never reach the browser.
 */

const AUTHORISE = "https://accounts.google.com/o/oauth2/v2/auth";
const EXCHANGE = "https://oauth2.googleapis.com/token";
const WHO = "https://www.googleapis.com/oauth2/v3/userinfo";

/**
 * What Mia needs and not one permission more. `calendar` and `tasks` are
 * sensitive, which is what forces every account onto the test user list while
 * the application is unverified. Asking for more costs no code — it costs
 * someone reading Google's screen and deciding not to.
 */
const SCOPE = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/tasks",
].join(" ");

/** Has to be registered in the panel, spelled exactly like this. */
export function returnUrl(publicUrl: string): string {
  return `${publicUrl}/api/auth/callback/google`;
}

/**
 * `access_type=offline` with `prompt=consent` is what makes Google send a
 * refresh token. Without both, only a one-hour access token arrives, and Mia
 * has to be able to read the calendar tomorrow without asking again.
 */
export function consentUrl(state: string): string {
  const { clientId, publicUrl } = requireGoogleCredentials();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: returnUrl(publicUrl),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `${AUTHORISE}?${params.toString()}`;
}

/**
 * Turns a stored refresh token into an access token, which is what every call
 * to Calendar and Tasks needs.
 *
 * Nothing is cached: an access token lasts an hour and caching it means
 * deciding where, which is a question for the tool that ends up calling this on
 * every run, not for the first caller.
 */
export async function accessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = requireGoogleCredentials();

  const response = await fetch(EXCHANGE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  const tokens = (await response.json()) as TokenResponse;

  if (!response.ok || !tokens.access_token) {
    // `invalid_grant` is the one that matters: the permission was revoked, or
    // the app is still in testing and Google expired the token after a week.
    // Either way the person has to connect Google again.
    throw new Error(
      `Google refused the refresh token: ${tokens.error ?? response.status}` +
        (tokens.error_description ? ` · ${tokens.error_description}` : ""),
    );
  }

  return tokens.access_token;
}

export type GrantedPermission = {
  email: string;
  /** `null` when Google does not send one, which happens if a grant was live. */
  refreshToken: string | null;
  scope: string;
};

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

/**
 * The address comes from `userinfo` rather than the `id_token`: verifying that
 * JWT's signature by hand is cryptography that adds nothing here, because the
 * answer arrives over TLS from Google in the same request.
 */
export async function exchangeCode(code: string): Promise<GrantedPermission> {
  const { clientId, clientSecret, publicUrl } = requireGoogleCredentials();

  const response = await fetch(EXCHANGE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: returnUrl(publicUrl),
      grant_type: "authorization_code",
    }),
  });

  const tokens = (await response.json()) as TokenResponse;

  if (!response.ok || !tokens.access_token) {
    // Google's own message is worth logging and names nobody:
    // `redirect_uri_mismatch` is the one that shows up when the tunnel moved.
    throw new Error(
      `Google refused the code: ${tokens.error ?? response.status}` +
        (tokens.error_description ? ` · ${tokens.error_description}` : ""),
    );
  }

  const who = await fetch(WHO, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!who.ok) throw new Error(`Google did not say whose account it is: ${who.status}`);

  const { email } = (await who.json()) as { email?: string };

  if (!email) {
    throw new Error(
      "Google returned no address. Without it there is no telling which person " +
        "this account belongs to, so nothing is stored.",
    );
  }

  return {
    email: email.toLowerCase(),
    refreshToken: tokens.refresh_token ?? null,
    scope: tokens.scope ?? "",
  };
}
