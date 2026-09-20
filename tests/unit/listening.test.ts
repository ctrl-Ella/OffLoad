import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bothHaveRuledItOut,
  isAnInviteCommand,
  isARefusal,
  matchInvitedPerson,
} from "../../src/mastra/listening.ts";

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

describe("recognising «invita a Rosa»", () => {
  it("«invita a» is the command", () => {
    assert.equal(isAnInviteCommand("Mia, invita a Rosa"), true);
  });

  it("«que se una» is too", () => {
    assert.equal(isAnInviteCommand("Que se una Nicolás a la llamada"), true);
  });

  it("even without accents", () => {
    assert.equal(isAnInviteCommand("que se una nicolas"), true);
  });

  it("an ordinary sentence is not a command", () => {
    assert.equal(isAnInviteCommand("El niño tiene piscina a las siete"), false);
  });

  it("saying someone's name with no trigger phrase is not a command either", () => {
    assert.equal(isAnInviteCommand("Rosa dice que no puede"), false);
  });
});

const NETWORK = [
  { id: "person_nicolas", name: "Nicolás" },
  { id: "person_rosa", name: "Abuela Rosa" },
  { id: "person_marta", name: "Vecina Marta" },
];

describe("matching who «invita a» names", () => {
  it("matches on the first name alone against a role-prefixed stored name", () => {
    const match = matchInvitedPerson("Mia, invita a Rosa", NETWORK);

    assert.equal(match?.id, "person_rosa");
  });

  it("matches a name with no role prefix directly", () => {
    const match = matchInvitedPerson("que se una Nicolás", NETWORK);

    assert.equal(match?.id, "person_nicolas");
  });

  it("matches with no accent, the same as the transcript sometimes carries", () => {
    const match = matchInvitedPerson("invita a nicolas", NETWORK);

    assert.equal(match?.id, "person_nicolas");
  });

  it("names nobody when the sentence carries no name from the network", () => {
    assert.equal(matchInvitedPerson("invita a alguien", NETWORK), null);
  });

  it("does not guess between two names both said in the same line", () => {
    assert.equal(matchInvitedPerson("invita a Rosa o a Marta", NETWORK), null);
  });

  it("does not fire on the role word alone, with no name said", () => {
    // "Abuela" on its own should not stand in for "Rosa".
    assert.equal(matchInvitedPerson("dile a la abuela que la llamo luego", NETWORK), null);
  });
});
