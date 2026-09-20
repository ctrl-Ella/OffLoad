import { z } from "zod";
import { intentSchema } from "@/mastra/agents/interpreter";
import { conflictSchema, stopSchema } from "./schemas";

/**
 * The run's case file: everything Mia knows about this case.
 *
 * Lives apart from the workflow because both sides need it — the chain of
 * steps and the factory of the step that suspends — and if either declared
 * it the other would have to import it back.
 *
 * Not to be confused with the card. The case file is what the run passes from
 * one step to the next and it never leaves. The card (`cardSchema`) is the
 * only thing a person sees, which is why it carries much less.
 */

export const chosenProposalSchema = z.object({
  decision: z
    .enum(["propose", "call", "no-way-out"])
    .describe("What to do: ask someone in the core, call the network, or nothing"),
  personName: z.string().describe("Whom, as the negotiator said it"),
  personId: z.string().nullable().describe("Their identifier. Null when the negotiator said «nobody»"),
  reason: z.string().describe("Why that person and not another"),
});

export const caseFileSchema = z.object({
  personId: z.string().describe("Who started the run"),
  day: z.string().describe("The day being looked at, YYYY-MM-DD"),
  stops: z.array(stopSchema).describe("The whole core circle's day"),
  visibleCalendars: z
    .array(z.string())
    .describe("Whose calendar could be read. Of whoever is not here, nothing is claimed"),
  /**
   * Everything that was said, including what did not open this run. Still
   * here because the screen shows it as pending, in that word: writing it
   * somewhere would break rule 1, saying it is booked without being so would
   * break rule 4. That Mia heard it and it is pending is true.
   */
  intents: z.array(intentSchema).describe("Everything that was said, typed"),
  conflict: conflictSchema.nullable().describe("The clash, or null if the day fits"),
  proposal: chosenProposalSchema.nullable().describe("Whom it makes sense to ask"),
  /**
   * What each person asked answered, by step. A record and not two named
   * fields because the steps that ask are written with the same factory: if
   * each had its own field, the factory would have to know which is its own,
   * which is exactly the knowledge it must not have.
   */
  answers: z.record(z.string(), z.boolean()).describe("Each asking step's answer, by that step's id"),
  /**
   * The household's names, by identifier. They travel in the case file
   * because the cards are worded inside a step, which is synchronous and
   * cannot go back to the database.
   */
  names: z.record(z.string(), z.string()).describe("Each person's name, by id"),
  supportNetwork: z
    .array(z.string())
    .describe("The support network's names. It can be said they exist; never that they are free"),
});

export type CaseFile = z.infer<typeof caseFileSchema>;
