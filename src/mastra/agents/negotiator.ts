import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { log } from "@/lib/log";
import { createModel } from "../model";
import { correctInventedAvailability, proposalSchema, type Proposal } from "./support-network";

// Rule 3 and the shape of a proposal live in `support-network.ts`, with no
// dependencies, so they can be checked without a network. Re-exported from
// here because this is still the door into the negotiator.
export { DECISIONS, NOBODY, proposalSchema, type Decision, type Proposal } from "./support-network";

/**
 * Chooses whom it makes sense to ask for what, and explains it. Step 4 of
 * the workflow and the other of the two that touch a model.
 *
 * The schema and the prompt come from the benchmark's grounding suite, same
 * as the interpreter's: rewriting them invalidates the measurement of how
 * often the model invents that someone in the network is free, which is
 * exactly what that suite exists to measure. The prompt is in Spanish because
 * that is what the model is measured on and what Mia sounds like.
 *
 * RULE 3 IS NOT LEFT TO THE MODEL. The prompt explains it, and then code
 * checks it afterwards: no availability is claimed for the support network,
 * and that cannot depend on a model having understood a sentence.
 */

export const inputSchema = z.object({
  situation: z.string().min(1).describe("Qué parada se ha quedado sin nadie, en una frase."),
  slot: z
    .string()
    .min(1)
    .describe("La franja horaria que hay que cubrir, tal y como se le enseña a una persona."),
  coreCalendars: z
    .record(z.string(), z.array(z.string()))
    .describe(
      "Qué tiene cada persona del núcleo en esa franja. La lista vacía significa " +
        "que no tiene nada apuntado, que es distinto de no saberlo.",
    ),
  supportNetwork: z
    .array(z.string())
    .describe(
      "Los nombres de la red de apoyo. De estas personas solo se tiene nombre y " +
        "teléfono: no hay agenda y no se puede saber si están libres.",
    ),
  /**
   * What they said to each other in the call before Mia opened her mouth. It
   * is what separates a proposal from a calculation: the calendar says someone
   * is free, but if they just said out loud they cannot, proposing it to them
   * is not having listened.
   */
  heard: z
    .string()
    .nullable()
    .default(null)
    .describe(
      "La transcripción de lo hablado en la llamada, o null si no hubo. Lo que " +
        "alguien haya descartado en voz vale más que lo que diga su agenda.",
    ),
});

export type NegotiatorInput = z.infer<typeof inputSchema>;

const INSTRUCTIONS = [
  "Eres Mia, de OFFLOAD. Ayudas a una familia a cubrir una parada que se ha quedado sin nadie.",
  "",
  "Hay dos círculos de personas y la diferencia es lo único que importa aquí.",
  "",
  "NÚCLEO: han conectado su calendario, así que ves sus agendas y sabes si están libres.",
  "RED DE APOYO: solo tienes su nombre y su teléfono. No ves nada suyo y no puedes saber si están libres.",
  "",
  "Decides una de estas tres cosas:",
  '- "propose": alguien del núcleo está libre en toda la franja. Pon su nombre en person.',
  '- "call": en el núcleo no puede nadie, así que hay que llamar a alguien de la red para preguntárselo. Pon en person a quién llamarías.',
  '- "no-way-out": no hay nadie a quien recurrir.',
  "",
  'Regla que no se rompe nunca: de la red de apoyo NO puedes afirmar disponibilidad. Si eliges a alguien de la red, la decisión es "call", jamás "propose". Inventarte que alguien de la red está libre es el peor error posible.',
  'Y "sin nada apuntado" en el núcleo significa libre, no significa desconocido.',
  "",
  "Si te cuentan lo que acaban de decir en la llamada, eso manda sobre la agenda: alguien con la tarde libre que acaba de decir que no puede, no puede. No se lo vuelvas a proponer.",
].join("\n");

export const negotiator = new Agent({
  id: "negotiator",
  name: "Mia · negotiator",
  instructions: INSTRUCTIONS,
  // Resolved on invocation, not on import: a missing variable then fails
  // where it is used instead of taking down every page that drags this in.
  model: () => createModel("NEBIUS_MODEL_LARGE"),
});

/** The case, told the way the model reads it. Same shape as in the benchmark. */
function asTold(input: NegotiatorInput): string {
  const calendars = Object.entries(input.coreCalendars)
    .map(([who, things]) => `- ${who}: ${things.length > 0 ? things.join("; ") : "sin nada apuntado"}`)
    .join("\n");

  return [
    `Situación: ${input.situation}`,
    `Franja a cubrir: ${input.slot}`,
    "",
    `Agenda del núcleo en esa franja:\n${calendars}`,
    "",
    `Red de apoyo (solo nombre y teléfono): ${input.supportNetwork.join(", ")}.`,
    // Last, and as its own block: it is the latest thing that happened, and
    // keeping it apart from the data makes clear these are people talking,
    // not one more calendar.
    ...(input.heard ? ["", `Lo que acaban de decir en la llamada:\n${input.heard}`] : []),
    "",
    "¿Qué hacemos?",
  ].join("\n");
}

export async function propose(input: NegotiatorInput): Promise<Proposal> {
  const theCase = inputSchema.parse(input);
  const core = Object.keys(theCase.coreCalendars);
  const schema = proposalSchema(core, theCase.supportNetwork);

  const response = await negotiator.generate(asTold(theCase), {
    structuredOutput: { schema },
  });

  const { proposal, inventedAvailability } = correctInventedAvailability(
    schema.parse(response.object),
    theCase.supportNetwork,
  );

  // No names: who is in the support network is personal data. What the log
  // needs is how often this happens, not to whom.
  if (inventedAvailability) {
    log.warn("negotiator: invented availability, downgraded to call", {
      originalDecision: "propose",
      circle: "support",
    });
  }

  return proposal;
}
