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
function flatten(text: string): string {
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
