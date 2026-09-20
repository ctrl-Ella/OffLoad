import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Lets Node run a file from `src/` outside Next. Two things Next resolves and
 * plain `node --experimental-strip-types` does not: the `@/` alias, and a
 * relative import with no extension. Both are tried against `.ts` and `.tsx`.
 * Registered by `with-alias.mjs`, and used only by the scripts.
 */

const SRC = pathToFileURL(`${process.cwd()}/src/`).href;
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts"];

function firstExisting(base) {
  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`;

    if (existsSync(new URL(candidate))) return candidate;
  }

  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const found = firstExisting(`${SRC}${specifier.slice(2)}`);

    if (found) return next(found, context);
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const found = firstExisting(new URL(specifier, context.parentURL).href);

    if (found) return next(found, context);
  }

  return next(specifier, context);
}
