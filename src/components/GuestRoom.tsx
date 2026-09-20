"use client";

import { useRef } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tile } from "@/components/Room";
import { useRoom } from "@/components/useRoom";

/**
 * The call, for someone who arrived by SMS and has never signed in.
 *
 * Deliberately smaller than `Room`: no Mia figure, no captions line, no
 * proposal card. The app knows nothing about this person beyond the name on
 * their invitation, and none of what Mia negotiates with the core is theirs
 * to answer — `/api/room/proposal` and `/api/proposals/[runId]/answer` both
 * require a signed-in core session and stay that way. What this shares with
 * `Room` is the WebRTC plumbing, `useRoom`, and the video tile, `Tile`; both
 * are reused rather than duplicated so the two screens do not quietly drift
 * on the actual call-joining sequence.
 */

/** What reads under the controls, by status. Mirrors `Room`'s own line: the
 *  guest meets the same permission prompts and the same Vonage traps. */
const LINE: Record<string, string> = {
  outside: "",
  "asking-permission": "Asking for the camera and the microphone…",
  joining: "Joining the call…",
  inside: "",
  failed: "",
};

export function GuestRoom({ token }: Readonly<{ token: string }>) {
  const mySlot = useRef<HTMLDivElement | null>(null);
  const theirSlot = useRef<HTMLDivElement | null>(null);

  const room = useRoom({ mySlot, theirSlot, keyEndpoint: `/api/room/guest/${token}` });
  const inside = room.status === "inside";

  return (
    <div className="mt-6 overflow-hidden rounded-card bg-room-canvas">
      <div className="grid gap-px bg-room-frame sm:grid-cols-2">
        <Tile name="You" tag="">
          <div ref={mySlot} className="size-full" />
        </Tile>

        {/* Generic on purpose: this route never learns who else is in the
            room, only that the link is still valid for one specific one. */}
        <Tile name="The family" tag={room.accompanied ? "" : "Hasn't joined yet"}>
          <div ref={theirSlot} className="size-full" />
        </Tile>
      </div>

      <div className="border-t border-room-frame px-4 py-4">
        {inside ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="room"
              onClick={room.toggleMic}
              aria-pressed={!room.micOn}
              icon={
                room.micOn ? (
                  <Mic className="size-[18px]" aria-hidden="true" />
                ) : (
                  <MicOff className="size-[18px]" aria-hidden="true" />
                )
              }
              label={room.micOn ? "Mute the microphone" : "Unmute the microphone"}
            />

            <Button
              variant="room"
              onClick={room.toggleCamera}
              aria-pressed={!room.cameraOn}
              icon={
                room.cameraOn ? (
                  <Video className="size-[18px]" aria-hidden="true" />
                ) : (
                  <VideoOff className="size-[18px]" aria-hidden="true" />
                )
              }
              label={room.cameraOn ? "Turn the camera off" : "Turn the camera on"}
            />

            <Button
              variant="danger"
              onClick={room.leave}
              icon={<PhoneOff className="size-[18px]" aria-hidden="true" />}
              label="Leave the call"
              className="ml-auto"
            />
          </div>
        ) : (
          <Button
            onClick={() => void room.join()}
            loading={room.status === "asking-permission" || room.status === "joining"}
            icon={<Video className="size-[18px]" aria-hidden="true" />}
          >
            {room.status === "failed" ? "Try again" : "Join the call"}
          </Button>
        )}

        <output className="mt-2 block min-h-5 text-sm text-room-ink-muted">
          {room.failure ?? LINE[room.status]}
        </output>

        <p aria-live="polite" className="sr-only">
          {inside && room.accompanied ? "You are in the call. " : ""}
        </p>
      </div>
    </div>
  );
}
