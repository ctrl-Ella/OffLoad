import { db } from "@/lib/db";

/**
 * Who the other person in the core circle is.
 *
 * Looked up and not written: this household has two people in the core and
 * both use the same screens. Written by hand, the conflict screen told Carlos
 * to talk it through with Carlos, and each half passed its review while the
 * whole was wrong.
 *
 * `null` while there is nobody else yet, which is the real state of a freshly
 * seeded household. What to show then is the screen's decision, not this
 * query's.
 */
export async function otherCorePerson(personId: string): Promise<string | null> {
  const other = await db.person.findFirst({
    where: { circle: "CORE", id: { not: personId } },
    select: { name: true },
  });

  return other?.name ?? null;
}
