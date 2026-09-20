import { z } from "zod";

/**
 * Rule 3 of the product, kept apart from whoever talks to the model.
 *
 * It lives here and not inside the negotiator for two reasons. Design:
 * deciding what can be claimed to a family is a product rule, and it has to
 * keep holding if tomorrow the model, the provider or the prompt change.
 * Practical: this module imports nothing but Zod, so it can be checked with
 * no credentials, no network and no running application, which is what makes
 * `tests/guardrails.test.ts` possible.
 *
 * Nothing here logs or fires effects. Whoever calls decides what to do with
 * what comes back.
 */

export const DECISIONS = ["propose", "call", "no-way-out"] as const;
export type Decision = (typeof DECISIONS)[number];

/** The value that always exists, so the `person` enum is never empty. */
export const NOBODY = "nobody";

/**
 * The output schema is built with the real names of each case, so the
 * `person` enum only admits people who exist and the model cannot return
 * someone who is in neither circle. Cheaper to prevent in the schema than to
 * detect afterwards.
 */
export function proposalSchema(core: string[], supportNetwork: string[]) {
  // `nobody` first, and not for looks: it is the one value always present, so
  // with it in front the tuple type comes out on its own. The order of an
  // enum means nothing, to the schema or to the model.
  const people: [string, ...string[]] = [NOBODY, ...core, ...supportNetwork];

  return z.object({
    decision: z
      .enum(DECISIONS)
      .describe(
        "propose: alguien del núcleo está libre en toda la franja. " +
          "call: en el núcleo no puede nadie y hay que preguntárselo a la red. " +
          "no-way-out: no hay nadie a quien recurrir.",
      ),
    person: z.enum(people).describe("A quién se le pide. «nobody» cuando no hay salida."),
    reason: z.string().describe("Por qué esa persona y no otra, en una frase corta."),
  });
}

export type Proposal = z.infer<ReturnType<typeof proposalSchema>>;

/**
 * Rule 3, applied with code and not with trust.
 *
 * If the model says "propose" with someone from the support network, it is
 * claiming an availability nobody can know. Not corrected in silence and not
 * let through: downgraded to "call", which is what that same choice really
 * means — it has to be asked. The person and the reason are kept, because
 * choosing them was still a good idea; what was wrong was claiming they could.
 *
 * Not a theoretical precaution: the benchmark measured on 2026-09-18 that a
 * large model tried it one time in six.
 */
export function correctInventedAvailability(
  proposal: Proposal,
  supportNetwork: string[],
): { proposal: Proposal; inventedAvailability: boolean } {
  const inventedAvailability =
    proposal.decision === "propose" && supportNetwork.includes(proposal.person);

  if (!inventedAvailability) {
    return { proposal, inventedAvailability: false };
  }

  return { proposal: { ...proposal, decision: "call" }, inventedAvailability: true };
}
