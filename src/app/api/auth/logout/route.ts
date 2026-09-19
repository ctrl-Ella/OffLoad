import { NextResponse } from "next/server";
import { closeSession } from "@/lib/session";
import { env } from "@/lib/env";

/** POST and not GET: a link a browser prefetches would sign people out on
 *  their way past. */
export async function POST() {
  await closeSession();

  return NextResponse.redirect(new URL("/", env.PUBLIC_URL ?? "http://localhost:3000"), {
    // 303 so the browser follows with GET instead of repeating the POST.
    status: 303,
  });
}
