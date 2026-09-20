import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env, requireModel, requireModelKey } from "@/lib/env";

/**
 * The model provider: Nebius Token Factory, through the generic
 * OpenAI-compatible connector pointed at its URL. Mastra accepts a provider
 * instance from the AI SDK as well as a "provider/model" string of its own
 * router; the instance is used because that router does not list Nebius, and
 * an instance of our own does not depend on its catalogue being updated. That
 * is also why the identifier carries no `nebius/` prefix here: the prefix is
 * the router's convention, and this is not the router.
 */
const BASE_URL = `${env.NEBIUS_BASE_URL.replace(/\/$/, "")}/`;

/**
 * Built when used, not when the module is imported: built on import, a
 * missing key would take down every page that drags this file in, including
 * the ones that never talk to a model.
 */
export function createModel(variable: "NEBIUS_MODEL_SMALL" | "NEBIUS_MODEL_LARGE") {
  const nebius = createOpenAICompatible({
    name: "nebius",
    baseURL: BASE_URL,
    apiKey: requireModelKey(),

    // Without this, structured output is not structured output. The generic
    // connector assumes an OpenAI-compatible provider cannot take
    // `response_format: json_schema`, so it does not send it, and the model
    // answers whatever JSON it likes: asked for `{ kind }` it returned
    // `{"intention":"event"}`, and validation failed on twenty-eight of thirty
    // sentences. Nebius serves vLLM and does support it. Measured 2026-09-17.
    supportsStructuredOutputs: true,
  });

  return nebius(requireModel(variable));
}
