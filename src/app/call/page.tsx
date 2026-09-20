import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
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
    <div className="presentation-page">
      <AppNavigation person={person} />

      <main id="content" className="presentation-shell pt-6 pb-20">
        <Link href="/conflict" className="presentation-back">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the clash
        </Link>

        <p className="presentation-eyebrow mt-6">
          <span aria-hidden="true" />
          ON VIDEO
        </p>
        <h1 className="mt-3 text-[clamp(34px,3.5vw,50px)] leading-[1.05] tracking-[-.045em] text-ink">
          {other ? `Talk it through with ${other}` : "Talk it through on video"}
        </h1>
        <p className="mt-3 text-[15px] text-ink-muted">The two of you decide. I listen along.</p>

        {/* The room keeps its dark canvas. It is a designed surface with its
            own measured contrast, and a video tile on white reads as a hole. */}
        <Room myName={person.name} theirName={other} />
      </main>
    </div>
  );
}
