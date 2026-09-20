"use client";

import { useCallback, useRef, useState } from "react";
import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MiaFigure } from "@/components/mia";
import { MIA_LABELS, type MiaState } from "@/components/mia-states";
import { useRoom } from "@/components/useRoom";

/**
 * The room: two people, Mia, and what gets decided inside.
 *
 * This is where Mia gets a frame for the first time, and it is deliberate:
 * the frame and the dark canvas belong to the call, not to the character,
 * which is why the `--color-room-*` tokens are born with this screen.
 *
 * Mia is not a Vonage participant here: her tile is painted by each browser
 * on its own, and what she can truthfully claim is what the captions prove.
 * Her proposal, her voice and the yes-or-no card arrive with the workflow;
 * until then she listens and says so, and nothing more.
 *
 * No example on `/system`, and it falls under the declared exception: it only
 * knows how to paint a real call, with its camera permissions and its open
 * session. An example of it would be a stage set.
 */

/** What reads under the tiles, by status. */
const LINE = {
  outside: "",
  "asking-permission": "Asking for the camera and the microphone…",
  joining: "Joining the room…",
  inside: "",
  failed: "",
} as const;

/**
 * Echo cannot be fixed from inside: the browser's cancellation only knows its
 * own speaker, and on a table with two devices that is where the feedback
 * comes from. The only thing that cuts it is one of the two not sounding, so
 * it is said rather than discovered mid-conversation.
 */
const ECHO = "If you're in the same room, turn the sound off on one of the two devices.";

export function Room({
  myName,
  theirName,
}: Readonly<{
  myName: string;
  /** Null while this household has nobody else in the core yet. */
  theirName: string | null;
}>) {
  const mySlot = useRef<HTMLDivElement | null>(null);
  const theirSlot = useRef<HTMLDivElement | null>(null);

  const [caption, setCaption] = useState("");
  const [heardSomething, setHeardSomething] = useState(false);

  // Every transcribed line is shown. Partials arrive word by word; what would
  // go to Mia is only what is final, and that hand-off comes with the workflow.
  const onCaption = useCallback((text: string) => {
    setCaption(text);
    setHeardSomething(true);
  }, []);

  const room = useRoom({ mySlot, theirSlot, onCaption });
  const inside = room.status === "inside";

  // `listening` means a transcription is running, and the first caption is the
  // proof. Before it arrives she is quiet: claiming to hear with nothing heard
  // yet is rule 4 broken in the one place it shows.
  const miaState: MiaState = inside && heardSomething ? "listening" : "quiet";

  const theirTile = theirName ?? "The other person";

  return (
    <div className="mt-6 overflow-hidden rounded-card bg-room-canvas">
      <div className="grid gap-px bg-room-frame sm:grid-cols-2">
        <Tile name={myName} tag="You">
          <div ref={mySlot} className="size-full" />
        </Tile>

        <Tile name={theirTile} tag={room.accompanied ? "" : "Hasn't joined yet"}>
          <div ref={theirSlot} className="size-full" />
        </Tile>
      </div>

      {/* What Mia is hearing, as she hears it. Not only accessibility: it is
          the proof that she is listening. */}
      {inside && (
        <p
          aria-live="polite"
          className="min-h-11 border-t border-room-frame px-4 py-3 font-mono text-sm text-room-ink-muted"
        >
          {caption}
        </p>
      )}

      {/* Mia's tile goes wide and below: it does not compete with the faces,
          and on a phone it does not leave three eighty-pixel boxes where
          nothing can be seen. */}
      <div className="border-t border-room-frame px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Grows with the screen: this gets projected at three metres. */}
          <MiaFigure state={miaState} className="h-20 w-auto shrink-0 sm:h-28" />

          <p className="min-w-0 flex-1 text-sm text-room-ink-muted sm:text-base">
            <span className="block text-room-ink">Mia</span>
            {/* An `<output>` and not a `role="status"` by hand: both announce
                without stealing focus, and the element does it on its own.
                The subject first: there are more tiles in the room. */}
            <output>
              <span className="sr-only">Mia: </span>
              {MIA_LABELS[miaState]}
            </output>
          </p>
        </div>
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

            {/* Muting the speaker is not going quiet: two buttons because they
                are two things, and with two devices on one table the second
                is what cuts the echo. */}
            <Button
              variant="room"
              onClick={room.toggleSpeaker}
              aria-pressed={!room.speakerOn}
              icon={
                room.speakerOn ? (
                  <Volume2 className="size-[18px]" aria-hidden="true" />
                ) : (
                  <VolumeX className="size-[18px]" aria-hidden="true" />
                )
              }
              label={room.speakerOn ? "Turn the call's sound off" : "Turn the call's sound on"}
            />

            <Button
              variant="danger"
              onClick={room.leave}
              icon={<PhoneOff className="size-[18px]" aria-hidden="true" />}
              label="Hang up"
              className="ml-auto"
            />
          </div>
        ) : (
          <Button
            onClick={() => void room.join()}
            loading={room.status === "asking-permission" || room.status === "joining"}
            icon={<Video className="size-[18px]" aria-hidden="true" />}
          >
            {room.status === "failed" ? "Try again" : "Join the room"}
          </Button>
        )}

        {/* One line that changes, not a new notice under another: stacking
            them moves the buttons just as someone looks for the one to hang up. */}
        <output className="mt-2 block min-h-5 text-sm text-room-ink-muted">
          {room.failure ?? (room.accompanied && room.speakerOn ? ECHO : LINE[room.status])}
        </output>

        {/* Who enters and who leaves cannot be seen without looking at the screen. */}
        <p aria-live="polite" className="sr-only">
          {inside && room.accompanied ? `${theirTile} is in the call.` : ""}
        </p>
      </div>
    </div>
  );
}

/** A video slot with its name underneath. */
function Tile({
  name,
  tag,
  children,
}: Readonly<{ name: string; tag: string; children: React.ReactNode }>) {
  return (
    <div className="relative aspect-video bg-room-canvas">
      {children}

      <p className="pointer-events-none absolute inset-x-0 bottom-0 flex items-baseline gap-2 p-2 text-sm text-room-ink">
        {name}
        {tag && <span className="text-xs text-room-ink-muted">{tag}</span>}
      </p>
    </div>
  );
}
