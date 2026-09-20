/**
 * When Mia has something to say.
 *
 * Only once both have said they cannot. While they are working it out
 * between themselves Mia has nothing to add: the one thing she could say is
 * what they just said to each other. What she brings and they do not have is
 * the support network, and that is only needed once nobody at home is left.
 *
 * Deterministic on purpose, and not a third model: the project's thesis is
 * that the model interprets and the workflow decides, and when to speak is a
 * decision. The interpreter would not do either: its seven labels are for a
 * brain dump, and none of them is "I can't".
 *
 * What this does not catch, and it has to be known: a refusal can be said
 * without saying no. "Uf, at that time I'm across town" is a no, and it does
 * not count here.
 *
 * Pure: no network, no clock, no database. What goes in is what was said,
 * what comes out is a decision, so the whole thing can be tested.
 *
 * `isAnInviteCommand` and `matchInvitedPerson` share the file for the same
 * reason: recognising "invita a Rosa" is the same kind of deterministic
 * pattern match as recognising a refusal, and CLAUDE.md rules out a third
 * agent for it (spec 0009).
 */

/** What someone says when they cannot. Spain's Spanish, as it is spoken. */
const REFUSALS = [
  "no puedo",
  "no voy a poder",
  "no llego",
  "no me da tiempo",
  "no me cuadra",
  "imposible",
  "yo no",
  "no hay manera",
  "no tengo forma",
  "que va",
  "ni de broma",
  "estoy liado",
  "estoy liada",
  "tengo otra cosa",
  "tampoco puedo",
  "tampoco",
  "ni yo",
  "yo menos",
];

/** No accents and lower case: whoever transcribes does not always accent the same way. */
export function flatten(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** One line of the call, with who said it. */
export type Utterance = {
  /** The stream it came from. Two people bring two different ones. */
  who: string;
  text: string;
};

/** Is this line someone saying they cannot? */
export function isARefusal(text: string): boolean {
  const flat = flatten(text);

  return REFUSALS.some((mark) => flat.includes(mark));
}

/**
 * Have both ruled it out already?
 *
 * Two different people, not two lines. Someone saying "I can't, I really
 * can't" has said no once, not twice, and with that count Mia would show up
 * halfway through the conversation. That is why the stream each line came
 * from is what tells speakers apart.
 */
export function bothHaveRuledItOut(said: Utterance[]): boolean {
  const whoSaidNo = new Set(said.filter((line) => isARefusal(line.text)).map((line) => line.who));

  return whoSaidNo.size >= 2;
}

/**
 * Asking Mia to bring someone from the support network in. Spain's Spanish,
 * as it is said, and deliberately short: a longer list widens what counts as
 * an invitation, and every false positive here costs a real SMS to a real
 * phone, not just a missed beat in a negotiation.
 */
const INVITE_TRIGGERS = ["invita a", "que se una"];

/**
 * Does this line ask Mia to invite someone at all, regardless of whom? Cheap
 * on purpose: checked on every final caption, before anything reaches the
 * database.
 */
export function isAnInviteCommand(text: string): boolean {
  const flat = flatten(text);

  return INVITE_TRIGGERS.some((trigger) => flat.includes(trigger));
}

/**
 * Which one, out of the support network, the line names.
 *
 * Matched on the LAST word of the stored name, which is how a person is
 * actually said out loud: the demo's own rows are stored role-first —
 * "Abuela Rosa", "Vecina Marta" — and nobody says "invita a Abuela". Matching
 * on every word of the name would let "abuela" alone trigger a match with no
 * name spoken at all.
 *
 * Zero matches and more than one both come back `null`. Either way Mia
 * cannot say a name back with confidence, and the caller's answer is the
 * same in both cases: nothing is sent, and something true is said about not
 * having caught it.
 */
export function matchInvitedPerson<T extends { name: string }>(text: string, network: T[]): T | null {
  const flat = flatten(text);

  const matches = network.filter((person) => {
    const firstName = flatten(person.name).split(" ").filter(Boolean).pop();

    return firstName ? new RegExp(`\\b${firstName}\\b`).test(flat) : false;
  });

  return matches.length === 1 ? matches[0] : null;
}
