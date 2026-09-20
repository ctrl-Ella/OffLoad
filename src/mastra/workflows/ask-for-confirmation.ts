import { createStep } from "@mastra/core/workflows";
import { log } from "@/lib/log";
import { caseFileSchema, type CaseFile } from "./case-file";
import { answerSchema, cardSchema, type Card } from "./schemas";

/**
 * Step 5 of the workflow: where Mia waits for a person.
 *
 * A run suspends more than once, which is why this is a factory. In the
 * script's scene there are two: first waiting for the partner, who says no,
 * then waiting for whoever started, who decides whether someone in the
 * network gets called. Two different people answering on two different
 * screens, and the only thing that changes is what is asked.
 *
 * Each instance carries its own `id` instead of reusing one: two suspensions
 * with the same identifier inside a run make resuming by id ambiguous.
 *
 * What this step does not do: check who answers. The route does that, since
 * it has the session. From in here the only thing possible on detecting the
 * wrong person is to kill the run, and a dead run is a worse answer than a 403.
 */

type Confirmation = {
  /** The step's identifier. It is what the run resumes by, so it is unique. */
  id: string;
  /** If this run has to ask, the card. If not, `null` and the step passes through without suspending. */
  card: (data: CaseFile) => Card | null;
};

export function createConfirmationStep({ id, card }: Confirmation) {
  return createStep({
    id,
    inputSchema: caseFileSchema,
    outputSchema: caseFileSchema,
    suspendSchema: cardSchema,
    resumeSchema: answerSchema,
    execute: async ({ inputData, resumeData, suspend, runId }) => {
      // On resume the answer arrives and the step does not ask again.
      if (resumeData) {
        log.info("workflow: someone answered", { runId, step: id, accepts: resumeData.accepts });

        return { ...inputData, answers: { ...inputData.answers, [id]: resumeData.accepts } };
      }

      const pending = card(inputData);

      if (!pending) return inputData;

      // The name stays out: personal data, and this is a log.
      log.info("workflow: waiting for a person", { runId, step: id, recipientId: pending.recipientId });

      await suspend(pending);

      // Mastra cuts execution at `suspend`, so this is never reached. The
      // return exists because the output type demands it.
      return inputData;
    },
  });
}
