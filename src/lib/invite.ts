import { env, requireGuestLinkSecret, requireSmsCredentials } from "@/lib/env";
import { signGuestLinkToken } from "@/lib/guest-link";
import { log, reason } from "@/lib/log";
import { sendSmsWith } from "@/lib/sms";
import { sendSignal } from "@/lib/video";

/**
 * Texting someone in the support network a link into the call, and telling
 * the room about it — but only once it is true. Rule 4: Mia announces
 * nothing that is not true yet, so the confirmation is sent from here, after
 * Vonage has actually accepted the message, never from wherever the command
 * was heard.
 *
 * This is the impure edge `src/lib/sms.ts` and `src/lib/guest-link.ts` are
 * kept apart from: it is the one place that reads `src/lib/env.ts`'s real
 * credentials and secret, so those two files can stay pure and directly
 * unit-tested.
 */

export type InvitablePerson = { id: string; name: string; phone: string | null };

/**
 * Who was texted in the last minute. Two callers meet the same duplicate:
 * a spoken "invita a Rosa" reaches `/api/room/heard` once per browser
 * subscribed to the speaker's stream, and a pressed name can be pressed
 * twice. Keyed by who is invited, which is the one thing both share.
 */
const RECENTLY_INVITED = new Map<string, number>();

const INVITE_COOLDOWN_MS = 60_000;

/**
 * Mia's message, in her voice. Fixed, not generated: there is nothing here
 * for a model to interpret, and the support network is three people, not a
 * catalogue that needs a sentence built per case. Never states anyone's
 * availability — rule 3 — because it makes no claim about the invited
 * person at all, only about what the two people on the call asked for.
 */
function inviteText(name: string, link: string): string {
  return `${name}, soy Mia, de Elvia y Carlos. Te necesitan en la videollamada: ${link}`;
}

export async function inviteToCall(sessionId: string, person: InvitablePerson): Promise<void> {
  if (!person.phone) {
    // Decision 0003: the support network's phone is written once, when the
    // household adds them. A missing one is a real gap, not a stumble to retry.
    log.warn("invite: no phone on file", { personId: person.id });
    await sendSignal(sessionId, "invite", JSON.stringify({ status: "failed", name: person.name }));

    return;
  }

  // Silently: the first send already told the room, and a second line
  // seconds later would read as a second text.
  if (Date.now() - (RECENTLY_INVITED.get(person.id) ?? 0) < INVITE_COOLDOWN_MS) return;

  RECENTLY_INVITED.set(person.id, Date.now());

  try {
    const token = signGuestLinkToken(person.id, sessionId, requireGuestLinkSecret());
    const link = `${env.PUBLIC_URL ?? ""}/join/${token}`;

    await sendSmsWith(requireSmsCredentials(), person.phone, inviteText(person.name, link));

    log.info("invite: sent", { personId: person.id });
    await sendSignal(sessionId, "invite", JSON.stringify({ status: "sent", name: person.name }));
  } catch (error) {
    log.warn("invite: could not send", { personId: person.id, reason: reason(error) });
    await sendSignal(sessionId, "invite", JSON.stringify({ status: "failed", name: person.name }));
  }
}
