"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * Mia is not a Vonage participant yet: her tile is painted by each browser on
 * its own, and what synchronises her is the state of the run, not a stream.
 * When she enters through the phone bridge, what changes is where her voice
 * comes from, not this screen.
 *
 * No example on `/system`, and it falls under the declared exception: it only
 * knows how to paint a real call, with its camera permissions and its open
 * session. An example of it would be a stage set.
 */

/** What Mia has on the table, as it arrives from the route. */
type ProposalInRoom = {
  runId: string;
  question: string;
  detail: string;
  yesLabel: string;
  noLabel: string;
  recipientName: string;
  forYou: boolean;
};

/** What reads under the tiles, by status. */
const LINE = {
  outside: "",
  "asking-permission": "Asking for the camera and the microphone…",
  joining: "Joining the room…",
  inside: "",
  failed: "",
} as const;

/**
 * How often the room asks whether there is something new. Three seconds and
 * not one: under every turn there is a read of the suspended runs, and with
 * two browsers inside that shows. Vonage's signal is what removes the wait;
 * this is only the floor for when it does not arrive.
 */
const EVERY_MS = 3000;

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

  const [proposal, setProposal] = useState<ProposalInRoom | null>(null);
  const [answering, setAnswering] = useState(false);
  const [caption, setCaption] = useState("");
  const [heardSomething, setHeardSomething] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  /**
   * Which run Mia finished saying her piece in. It is what brings the buttons
   * out: the proposal is heard, not read, so they appear when she finishes
   * speaking and not before. Stored as the run and not a yes or no so the
   * next proposal starts silent on its own.
   */
  const [saidIn, setSaidIn] = useState<string | null>(null);

  /**
   * Mia's clip, already downloaded and waiting to be given the floor.
   * Generated as soon as she raises her hand, not when the button is pressed:
   * synthesis takes over a second, and that second between button and voice
   * reads as the application having hung.
   */
  const clip = useRef<HTMLAudioElement | null>(null);

  const lookForSomething = useCallback(async () => {
    try {
      const response = await fetch("/api/room/proposal");

      if (!response.ok) return;

      const { proposal: found } = (await response.json()) as { proposal: ProposalInRoom | null };

      setProposal(found);
    } catch {
      // A failed poll retries by itself three seconds later. Reporting every
      // network stumble would fill the screen with noise mid-conversation.
    }
  }, []);

  /**
   * Every transcribed line: shown, and if final, sent to Mia. Partials are
   * only painted: they arrive word by word while someone speaks, and sending
   * them would tell Mia the same sentence seven times half built.
   */
  const onCaption = useCallback(
    (text: string, who: string, isFinal: boolean) => {
      setCaption(text);
      setHeardSomething(true);

      if (!isFinal) return;

      void fetch("/api/room/heard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, who }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((r: { speaks?: boolean } | null) => {
          // If Mia is going to speak the card arrives right away: looked for
          // now instead of waiting for the poll's turn.
          if (r?.speaks) void lookForSomething();
        })
        .catch(() => {
          // A lost line breaks nothing: more are coming.
        });
    },
    [lookForSomething],
  );

  const room = useRoom({
    mySlot,
    theirSlot,
    onCaption,
    onSignal: () => void lookForSomething(),
  });
  const inside = room.status === "inside";

  useEffect(() => {
    if (!inside) return;

    // The first turn does not wait the three seconds: whoever enters when
    // something is already on the table has to see it on arrival. A zero
    // timer and not a direct call, so state is not touched while the effect
    // is mounting.
    const first = setTimeout(() => void lookForSomething(), 0);
    const clock = setInterval(() => void lookForSomething(), EVERY_MS);

    return () => {
      clearTimeout(first);
      clearInterval(clock);
    };
  }, [inside, lookForSomething]);

  // Outside the room there is no card to show, and that follows from where
  // you are: no effect needed to clear it.
  const onTheTable = inside ? proposal : null;

  // Download the clip as soon as there is something to say. Tied to the
  // `runId` and not the whole proposal so the poll bringing the same thing
  // does not ask for it again.
  const voiceRun = onTheTable?.runId ?? null;

  useEffect(() => {
    if (!voiceRun) return;

    let alive = true;

    void fetch("/api/room/voice")
      .then((r) => (r.ok ? r.blob() : null))
      .then((audio) => {
        if (!alive) return;

        // Without a clip the buttons come out anyway. If the voice fails and
        // they are all there is, waiting for her to finish is waiting forever.
        if (!audio) {
          setSaidIn(voiceRun);
          return;
        }

        clip.current = new Audio(URL.createObjectURL(audio));
        clip.current.addEventListener("ended", () => {
          setSpeaking(false);
          setSaidIn(voiceRun);
        });
      })
      .catch(() => {
        if (alive) setSaidIn(voiceRun);
      });

    return () => {
      alive = false;
      clip.current?.pause();
      clip.current = null;
    };
  }, [voiceRun]);

  /**
   * Giving her the floor, which is the only thing that makes her sound. Mia
   * emits no audio unless someone gives it to her: rule 2, and it also solves
   * the browser's playback policy by itself — the gesture needed to unlock
   * sound is exactly the one the product already asked for.
   */
  const giveHerTheFloor = useCallback(() => {
    if (!clip.current) return;

    setSpeaking(true);

    void clip.current.play().catch(() => setSpeaking(false));
  }, []);

  const answer = useCallback(
    async (accepts: boolean) => {
      if (!proposal) return;

      setAnswering(true);

      try {
        await fetch(`/api/proposals/${proposal.runId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accepts }),
        });

        // The route answers before the run has resumed, so the card is
        // removed here and the poll brings the next one when it exists.
        setProposal(null);
      } finally {
        setAnswering(false);
      }
    },
    [proposal],
  );

  /**
   * Whose turn it is is said by the run, never by the audio. While the voice
   * does not exist Mia stays at "asks for the floor" and the card reads the
   * same. Saying "speaking" with nothing coming out would announce something
   * not yet true, which is rule 4 broken in the one place it shows. And
   * "listening" only once the first caption has arrived, for the same reason.
   */
  const miaState: MiaState = speaking
    ? "speaking"
    : answering
      ? "preparing"
      : onTheTable
        ? "asking"
        : inside && heardSomething
          ? "listening"
          : "quiet";

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
          the proof that she is listening. Without it, raising her hand looks
          like guesswork. */}
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

          {/* Someone gives it to her, always. Mia does not speak on her own
              even with the clip ready: she asks for the floor, waits, and
              sounds when someone decides. Rule 2. */}
          {onTheTable && !speaking && (
            <Button
              variant="room"
              size="small"
              onClick={giveHerTheFloor}
              className="shrink-0"
              icon={<Volume2 className="size-[18px]" aria-hidden="true" />}
              label="Give Mia the floor"
            />
          )}
        </div>

        {/* No button to call her here, and it is deliberate. Mia asks for the
            floor by herself: if she had to be asked, what the product shows
            is an AI waiting to be invited. The net for when the conversation
            does not wake her is on the server and cannot be seen. */}
        {onTheTable && saidIn === onTheTable.runId && (
          <Card proposal={onTheTable} answering={answering} answer={answer} />
        )}
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
                is what cuts the echo. Mia's clip is not a Vonage stream, so
                this does not silence her. */}
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

        {/* Who enters, who leaves and what Mia proposes cannot be seen
            without looking at the screen. */}
        <p aria-live="polite" className="sr-only">
          {inside && room.accompanied ? `${theirTile} is in the call. ` : ""}
          {onTheTable ? `Mia proposes: ${onTheTable.question}` : ""}
        </p>
      </div>
    </div>
  );
}

/**
 * What has to be answered to Mia: two buttons and nothing more.
 *
 * The proposal is not written because Mia has just said it. Repeating it
 * below left her voice as decoration — it was read before she finished — and
 * filled half a phone screen with something already heard. That leaves the
 * content in audio only, and it is a scope decision taken on 2026-09-19 for
 * the demo, not an oversight: it is in docs/guides/accessibility.md with its
 * reason. Outside a demo the fix is showing the text when the voice does not
 * sound, not removing it altogether.
 *
 * Lives apart from the rest of the room because it changes for another
 * reason: the room changes when the video changes, this when what is decided
 * does.
 */
function Card({
  proposal,
  answering,
  answer,
}: Readonly<{
  proposal: ProposalInRoom;
  answering: boolean;
  answer: (accepts: boolean) => Promise<void>;
}>) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button onClick={() => void answer(true)} loading={answering}>
        {proposal.yesLabel}
      </Button>
      <Button variant="room" onClick={() => void answer(false)} disabled={answering}>
        {proposal.noLabel}
      </Button>
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
