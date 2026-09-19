// With the extension, so Node can run it outside Next: `npm run mia:say`.
import { requireMiaVoice } from "./env.ts";

/**
 * What Mia says, as a whole clip ready to play.
 *
 * The audio is never written to disk here and no log line carries the text:
 * this speaks to a family about their own house, and the product needs the
 * bytes only for as long as it takes to play them.
 *
 * Three things the SLNG route does that its documentation does not make
 * obvious, all checked against the API on 2026-09-19:
 *   - `model` in the body is the VOICE. The model goes in the URL.
 *   - `encoding`, `sample_rate` and `container` are listed as optional and
 *     the Aura route rejects them with a 400. Without them: WAV at 24 kHz.
 *   - The WAV header declares two gigabytes. That is the unknown-size marker
 *     of a streamed response, not a truncated file.
 */

/** Past this it is not a proposal, it is a speech. */
const MAX_SPOKEN_CHARACTERS = 500;

export async function synthesise(text: string): Promise<ArrayBuffer> {
  const { apiKey, model, voice, base } = requireMiaVoice();

  const response = await fetch(`${base}/v1/tts/${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: voice, text: text.slice(0, MAX_SPOKEN_CHARACTERS) }),
  });

  if (!response.ok) {
    // SLNG's error body says why and carries nothing of the person: it is
    // what tells "the model rejects this option" from "the key is wrong".
    const detail = await response.text().catch(() => "");
    const because = detail === "" ? "" : `: ${detail.slice(0, 200)}`;

    throw new Error(`SLNG answered ${response.status} while synthesising${because}`);
  }

  return response.arrayBuffer();
}
