import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { interpreter } from "./agents/interpreter";
import { negotiator } from "./agents/negotiator";
import { storage } from "./storage";
import { resolveConflict } from "./workflows/resolve-conflict";

/**
 * The one Mastra instance. Two agents and there is no third; one workflow.
 *
 * The agents are registered even though the workflow calls them through
 * their functions: registering is what gives them the logger, the store and
 * the instance's tracing. The logger is structured JSON on purpose, same as
 * the rest of the server.
 */
export const mastra = new Mastra({
  agents: { interpreter, negotiator },
  workflows: { resolveConflict },
  storage,
  logger: new PinoLogger({
    name: "offload",
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  }),
});
