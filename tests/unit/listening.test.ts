import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bothHaveRuledItOut, isARefusal } from "../../src/mastra/listening.ts";

/**
 * When Mia has something to say, tested for real. It exists because this is
 * what makes asking for the floor mean something, and it is the question
 * anyone watching the demo will ask: "how does she know when to speak?". An
 * answer that cannot be shown working is half an answer.
 *
 * The lines here are the subject of the test, not filler: each one declares
 * which case it describes. The lines are Spanish because that is what is
 * said in the call.
 */

/** The two streams of the call: Elvia through one, Carlos through the other. */
const ELVIA = "stream-elvia";
const CARLOS = "stream-carlos";

describe("what counts as someone not being able to", () => {
  const refusals = [
    "Es que yo a esa hora no puedo",
    "No llego, salgo de la reunión a y media",
    "No me da tiempo de cruzar la ciudad",
    "Uf, imposible",
    "Yo no, que tengo el dentista",
    "Yo tampoco",
    "Ni yo",
  ];

  for (const line of refusals) {
    it(`«${line}»`, () => {
      assert.equal(isARefusal(line), true);
    });
  }

  it("even written without accents, which is how half the platforms transcribe", () => {
    assert.equal(isARefusal("no me da tiempo de ir"), true);
  });

  const notRefusals = [
    "El niño tiene piscina a las siete de la tarde",
    "¿Tú puedes o lo miro yo?",
    "Vale, pues lo llevo yo y ya está",
  ];

  for (const line of notRefusals) {
    it(`and «${line}» is not one`, () => {
      assert.equal(isARefusal(line), false);
    });
  }
});

describe("Mia waits until both have ruled it out", () => {
  it("with only one saying no, she stays quiet", () => {
    // They are still working it out between themselves.
    assert.equal(
      bothHaveRuledItOut([
        { who: ELVIA, text: "El niño tiene piscina a las siete" },
        { who: CARLOS, text: "Es que yo a esa hora no puedo" },
      ]),
      false,
    );
  });

  it("when the second says neither, she speaks", () => {
    assert.equal(
      bothHaveRuledItOut([
        { who: CARLOS, text: "Es que yo a esa hora no puedo" },
        { who: ELVIA, text: "Yo tampoco, tengo la reunión" },
      ]),
      true,
    );
  });

  it("the same person saying it twice is not two", () => {
    assert.equal(
      bothHaveRuledItOut([
        { who: CARLOS, text: "Es que no puedo" },
        { who: CARLOS, text: "De verdad que no puedo" },
      ]),
      false,
    );
  });

  it("and a whole conversation with no refusals leaves her quiet", () => {
    assert.equal(
      bothHaveRuledItOut([
        { who: ELVIA, text: "¿Has sacado la basura?" },
        { who: CARLOS, text: "Sí, esta mañana" },
        { who: ELVIA, text: "Vale, pues ya está" },
      ]),
      false,
    );
  });

  it("with nothing said yet, neither", () => {
    assert.equal(bothHaveRuledItOut([]), false);
  });
});
