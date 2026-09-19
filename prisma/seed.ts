import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { env } from "../src/lib/env.ts";
import { phoneDigest, phoneTail } from "../src/lib/phone.ts";

/**
 * Seeds the core circle.
 *
 * Neither door creates people: both look one up and refuse when they find
 * none. Without this, a correct sign-in ends in a refusal and reads like a
 * broken flow.
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
    VERIFICATION_PEPPER: pepper,
  } = env;

  if (!elviaPhone || !carlosPhone || !elviaEmail || !carlosEmail || !pepper) {
    const missing = [
      !elviaPhone && "TEST_PHONE_ELVIA",
      !carlosPhone && "TEST_PHONE_CARLOS",
      !elviaEmail && "TEST_EMAIL_ELVIA",
      !carlosEmail && "TEST_EMAIL_CARLOS",
      !pepper && "VERIFICATION_PEPPER",
    ].filter(Boolean);

    throw new Error(
      `Seeding needs these variables and they are not in .env: ${missing.join(", ")}.`,
    );
  }

  const people = [
    { name: "Elvia", phone: elviaPhone, email: elviaEmail },
    { name: "Carlos", phone: carlosPhone, email: carlosEmail },
  ];

  for (const { name, phone, email } of people) {
    const phoneHash = phoneDigest(phone, pepper);

    // Keyed on the digest: re-seeding after changing the pepper would otherwise
    // leave two rows for the same person.
    await db.person.upsert({
      where: { phoneHash },
      create: { name, circle: "CORE", phoneHash, phoneTail: phoneTail(phone), email },
      update: { name, email, phoneTail: phoneTail(phone) },
    });

    // The number and the address stay out of the output.
    process.stdout.write(`seeded ${name} (CORE), line ending ${phoneTail(phone)}\n`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (error) => {
    await db.$disconnect();
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  });
