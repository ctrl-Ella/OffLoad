import { OffloadFlow } from "@/app/offload/OffloadFlow";
import { currentPerson } from "@/lib/session";

/**
 * A server component for one reason: the header's account menu needs to
 * know who's signed in, and only the server can read that — the session
 * lives in an httpOnly cookie the browser cannot see. Fetched once here and
 * handed down, rather than the client flow asking for it itself.
 */
export default async function OffloadPage() {
  const person = await currentPerson();

  return <OffloadFlow person={person} />;
}
