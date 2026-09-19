import { writeFileSync } from "node:fs";
import { synthesise } from "../src/lib/slng.ts";
import { log, reason } from "../src/lib/log.ts";

/**
 * Hear Mia from the command line: `npm run mia:say -- "<text>" <file.wav>`.
 *
 * A command and not a route on purpose. A synthesis route that takes free
 * text is an open relay to a paid API on a public URL; this runs where the
 * key is. The phrase itself is never logged.
 */

const [text, file] = process.argv.slice(2);

if (!text || !file) {
  log.error("mia:say needs a phrase and an output file", {
    usage: 'npm run mia:say -- "<text>" <file.wav>',
  });
  process.exit(1);
}

try {
  const audio = await synthesise(text);
  writeFileSync(file, Buffer.from(audio));
  log.info("mia:say wrote the clip", { file, bytes: audio.byteLength });
} catch (error) {
  log.error("mia:say could not synthesise", { reason: reason(error) });
  process.exit(1);
}
