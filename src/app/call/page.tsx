import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Room } from "@/components/Room";
import { otherCorePerson } from "@/lib/household";
import { currentPerson } from "@/lib/session";

/**
 * Talking it through on video, which is the exception and has to stay one.
 * Opening this screen interrupts several people at once, so it is what
 * changes everyone's plans the most. You get here because someone decided it
 * on `/conflict`, never because Mia did it on her own.
 */

export const metadata: Metadata = {
  title: "Talk it through | OFFLOAD",
  description: "The room where what a yes or a no cannot settle gets decided.",
};

export default async function CallPage() {
  const person = await currentPerson();

  if (!person) redirect("/");

  // The support network does not enter the household's room: Nicolás is
  // reached by phone, and that is another door. Not a permission, the
  // difference between the two circles.
  if (person.circle !== "CORE") notFound();

  // Who you talk to is looked up, not written: both core people see this
  // screen and each has the other in front of them.
  const other = await otherCorePerson(person.id);

  return (
    <main
      id="content"
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-11 pb-7 lg:max-w-3xl lg:px-10 lg:pt-12 lg:pb-12"
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-xl font-bold tracking-tight text-ink">OFFLOAD</p>

        <Link
          href="/conflict"
          className="inline-flex size-11 items-center justify-center rounded-control text-ink-muted hover:bg-white hover:text-ink"
          aria-label="Back to the clash"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
      </div>

      <h1 className="mt-8 font-display text-[clamp(1.75rem,1.3rem+1.8vw,2.5rem)] leading-tight text-ink">
        {other ? `Talk it through with ${other}` : "Talk it through on video"}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">The two of you decide. I listen along.</p>

      <Room myName={person.name} theirName={other} />
    </main>
  );
}
