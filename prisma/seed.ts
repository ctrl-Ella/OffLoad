import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { env } from "../src/lib/env.ts";
import { phoneDigest, phoneTail } from "../src/lib/phone.ts";

/**
 * Seeds the household: the core circle and the support network.
 *
 * Neither door creates people: both look one up and refuse when they find
 * none. Without this, a correct sign-in ends in a refusal and reads like a
 * broken flow.
 *
 * The support network is here for a different reason. Nobody signs in with it —
 * it has no Google and its numbers open no session — but `askWhetherToCall`
 * drops its card when the network is empty, so without these three rows Mia
 * never asks whether to call anyone.
 *
 * The values come from the environment because the repository is public: a
 * phone number or an address in a committed file is published, test line or not.
 */

// Its own client rather than src/lib/db: that one is cached on globalThis for
// Next's reloads, and it imports through the `@/` alias, which
// `node --experimental-strip-types` does not resolve.
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  log: ["error"],
});

async function main(): Promise<void> {
  const {
    TEST_PHONE_ELVIA: elviaPhone,
    TEST_PHONE_CARLOS: carlosPhone,
    TEST_EMAIL_ELVIA: elviaEmail,
    TEST_EMAIL_CARLOS: carlosEmail,
    TEST_PHONE_NICOLAS: nicolasPhone,
    TEST_PHONE_ROSA: rosaPhone,
    TEST_PHONE_MARTA: martaPhone,
    VERIFICATION_PEPPER: pepper,
  } = env;

  if (
    !elviaPhone ||
    !carlosPhone ||
    !elviaEmail ||
    !carlosEmail ||
    !nicolasPhone ||
    !rosaPhone ||
    !martaPhone ||
    !pepper
  ) {
    const missing = [
      !elviaPhone && "TEST_PHONE_ELVIA",
      !carlosPhone && "TEST_PHONE_CARLOS",
      !elviaEmail && "TEST_EMAIL_ELVIA",
      !carlosEmail && "TEST_EMAIL_CARLOS",
      !nicolasPhone && "TEST_PHONE_NICOLAS",
      !rosaPhone && "TEST_PHONE_ROSA",
      !martaPhone && "TEST_PHONE_MARTA",
      !pepper && "VERIFICATION_PEPPER",
    ].filter(Boolean);

    throw new Error(
      `Seeding needs these variables and they are not in .env: ${missing.join(", ")}.`,
    );
  }

  // The addresses belong to the core alone: outside it nobody connects a Google
  // account, and an `email` there would suggest a second way in that is not one.
  const people: { name: string; circle: "CORE" | "SUPPORT"; phone: string; email: string | null }[] = [
    { name: "Elvia", circle: "CORE", phone: elviaPhone, email: elviaEmail },
    { name: "Carlos", circle: "CORE", phone: carlosPhone, email: carlosEmail },
    { name: "Nicolás", circle: "SUPPORT", phone: nicolasPhone, email: null },
    { name: "Abuela Rosa", circle: "SUPPORT", phone: rosaPhone, email: null },
    { name: "Vecina Marta", circle: "SUPPORT", phone: martaPhone, email: null },
  ];

  for (const { name, circle, phone, email } of people) {
    const phoneHash = phoneDigest(phone, pepper);

    // Keyed on the digest: re-seeding after changing the pepper would otherwise
    // leave two rows for the same person.
    await db.person.upsert({
      where: { phoneHash },
      create: { name, circle, phoneHash, phoneTail: phoneTail(phone), email },
      update: { name, circle, email, phoneTail: phoneTail(phone) },
    });

    // The number and the address stay out of the output.
    process.stdout.write(`seeded ${name} (${circle}), line ending ${phoneTail(phone)}\n`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    await db.$disconnect();
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  });
