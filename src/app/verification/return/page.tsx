import type { Metadata } from "next";
import { VerificationReturn } from "@/components/verification-return";

/** This exact path goes in the Vonage panel, under Network Registry →
 *  Number verification Redirect URI, and it has to match character for
 *  character. With a free tunnel it changes on every restart. */

export const metadata: Metadata = {
  title: "Confirmando tu línea · OFFLOAD",
  robots: { index: false },
};

export default function VerificationReturnPage() {
  return (
    <main id="content" className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-16">
      <VerificationReturn />
    </main>
  );
}
