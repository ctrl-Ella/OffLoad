"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type OT from "@vonage/client-sdk-video";

/**
 * Running a video room: joining, publishing, seeing who enters, leaving.
 *
 * Lives apart from the screen that uses it: this knows about cameras and
 * sessions, the screen knows about tiles and labels. Two reasons to change.
 */

export type RoomStatus = "outside" | "asking-permission" | "joining" | "inside" | "failed";

/** What is needed to get in, as `GET /api/room` returns it. */
export type RoomKey = {
  applicationId: string;
  sessionId: string;
  token: string;
};

type Options = {
  /** Where my tile goes. */
  mySlot: React.RefObject<HTMLDivElement | null>;
  /** Where the tiles of whoever enters go. */
  theirSlot: React.RefObject<HTMLDivElement | null>;
  /** What to do with each transcribed line, theirs and my own. */
  onCaption?: (text: string, who: string, isFinal: boolean) => void;
  /** What to do when the room signals there is something new to look at. */
  onSignal?: () => void;
};

/**
 * The failures, said by what has to be done about them. Permission denied
 * and no camera are fixed in different places — one in the browser, the
 * other by plugging something in — so saying them the same sends half the
 * people to the wrong place.
 */
const FAILURES: Record<string, string> = {
  OT_USER_MEDIA_ACCESS_DENIED:
    "I don't have permission for the camera. It's granted from the padlock in the address bar.",
  OT_NO_DEVICES_FOUND: "I can't find a camera or a microphone.",
  // The two-windows-on-one-machine case, which is how this gets rehearsed.
  OT_HARDWARE_UNAVAILABLE:
    "Something else is using the camera. Close the other window or app that has it open.",
  OT_NOT_SUPPORTED: "This browser can't do the video call. Chrome or Firefox can.",
  OT_TIMEOUT: "Vonage didn't answer in time. Try again.",
};

const GENERIC_FAILURE = "I couldn't join the room. Try again.";

/**
 * What the screen says when the route says no. The response body is not for
 * showing: it is written as a code, for a log. The 503 is the exception and
 * passes through as is: it only names missing environment variables, and
 * whoever reads that is setting this up, not a family.
 */
const DOOR: Record<number, string> = {
  401: "Your session has closed. Sign in again and we'll pick up where we were.",
  403: "This room is for whoever shares a calendar with you.",
  502: "Vonage didn't answer. Try again in a moment.",
};

/**
 * Without https there is no camera, and the browser does not say so: it does
 * not ask and that is it. `localhost` is the only exception, so testing from
 * another device over the network address leaves the call mute with no
 * message.
 */
const INSECURE_CONTEXT =
  "The browser won't let me ask for the camera here: it only allows it over https or on localhost. " +
  "From another device you need the secure address.";

/**
 * Vonage's errors are not `Error`: plain objects with `name` and `message`.
 * Checking `instanceof Error` drops all of them and loses the real reason.
 */
function readFailure(error: unknown): { name: string; message: string } {
  if (typeof error === "object" && error !== null) {
    const loose = error as { name?: unknown; message?: unknown };

    return {
      name: typeof loose.name === "string" ? loose.name : "",
      message: typeof loose.message === "string" ? loose.message : "",
    };
  }

  return { name: "", message: "" };
}

/**
 * The SDK, loaded once and reused. Loaded apart and not at the top of the
 * file because it touches `window` on import, and a client component also
 * renders on the server for the initial HTML. And it starts downloading when
 * the screen opens, not when the button is pressed: the package is heavy, and
 * in a demo the first attempt is the only one there is.
 */
let sdk: Promise<typeof OT> | null = null;

function loadSdk(): Promise<typeof OT> {
  sdk ??= import("@vonage/client-sdk-video")
    .then((module) => ((module as { default?: typeof OT }).default ?? module) as typeof OT)
    // A stored rejected promise turns a network stumble into a permanent
    // failure: the second attempt would return the same error without asking.
    .catch((error: unknown) => {
      sdk = null;
      throw error;
    });

  return sdk;
}

export function useRoom({ mySlot, theirSlot, onCaption, onSignal }: Options) {
  const [status, setStatus] = useState<RoomStatus>("outside");
  const [failure, setFailure] = useState<string | null>(null);
  const [accompanied, setAccompanied] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(true);

  const session = useRef<OT.Session | null>(null);
  const publisher = useRef<OT.Publisher | null>(null);

  // Subscribers are kept so their audio can be muted. A list and not one:
  // whoever enters late brings their own, and muting has to cover that one too.
  const subscribers = useRef<OT.Subscriber[]>([]);

  // Read from a ref inside the `streamCreated` handler: it is registered once
  // and would otherwise see the value the state had on entry forever.
  const speakerLive = useRef(true);

  // In a ref so changing the handler does not rebuild the whole connection.
  // Updated in an effect and not during render.
  const caption = useRef(onCaption);
  const signal = useRef(onSignal);

  useEffect(() => {
    caption.current = onCaption;
    signal.current = onSignal;
  }, [onCaption, onSignal]);

  /** Release the camera, and really release it: otherwise the recording light stays on after hanging up. */
  const leave = useCallback(() => {
    publisher.current?.destroy();
    publisher.current = null;

    session.current?.off();
    session.current?.disconnect();
    session.current = null;

    subscribers.current = [];
    speakerLive.current = true;

    setAccompanied(false);
    setSpeakerOn(true);
    setStatus("outside");
  }, []);

  const join = useCallback(async () => {
    if (session.current) return;

    setFailure(null);
    setStatus("asking-permission");

    /** Hook the captions onto anyone, and pass them up. */
    const listenToCaptions = (who: OT.Subscriber) => {
      void who.subscribeToCaptions(true).catch(() => {
        // One side without captions does not break the call: people talk anyway.
      });

      who.on("captionReceived", (event) => {
        caption.current?.(event.caption, event.streamId, event.isFinal);
      });
    };

    try {
      // Before anything, and before the SDK: without a secure context the
      // browser asks nothing, so waiting for a failure lower down leaves
      // whoever is looking not knowing whose fault it is.
      if (!window.isSecureContext || !navigator.mediaDevices) {
        throw Object.assign(new Error(INSECURE_CONTEXT), { name: "OT_INSECURE" });
      }

      const sdkModule = await loadSdk();

      if (sdkModule.checkSystemRequirements() !== 1) {
        throw Object.assign(new Error("unsupported browser"), { name: "OT_NOT_SUPPORTED" });
      }

      const response = await fetch("/api/room");

      if (!response.ok) {
        if (response.status === 503) {
          const body: unknown = await response.json();
          const said =
            typeof body === "object" && body !== null && "error" in body
              ? String(body.error)
              : GENERIC_FAILURE;

          throw new Error(said);
        }

        throw new Error(DOOR[response.status] ?? GENERIC_FAILURE);
      }

      const key = (await response.json()) as RoomKey;
      const theSession = sdkModule.initSession(key.applicationId, key.sessionId);

      session.current = theSession;

      theSession.on("streamCreated", (event) => {
        if (theirSlot.current) {
          const subscriber = theSession.subscribe(event.stream, theirSlot.current, {
            insertMode: "append",
            width: "100%",
            height: "100%",
          });

          subscribers.current.push(subscriber);
          listenToCaptions(subscriber);

          // Whoever enters while the speaker is already off enters muted.
          if (!speakerLive.current) subscriber.subscribeToAudio(false);
        }
        setAccompanied(true);
      });

      theSession.on("streamDestroyed", () => {
        // `streams` still includes the one leaving while the event lasts.
        subscribers.current = [];
        setAccompanied(false);
      });

      theSession.on("sessionDisconnected", () => {
        setStatus("outside");
        setAccompanied(false);
      });

      theSession.on("signal:proposal", () => signal.current?.());

      setStatus("joining");

      await new Promise<void>((done, broken) => {
        theSession.connect(key.token, (error) => (error ? broken(error) : done()));
      });

      // `initPublisher.promise` and not plain `initPublisher`: the plain one
      // returns the publisher at once and reports failures through a
      // callback. Without collecting it, a denied permission throws nothing,
      // the code carries on to "inside" and the screen says you are in the
      // call with no camera and not one message.
      const thePublisher = await sdkModule.initPublisher.promise(mySlot.current ?? undefined, {
        insertMode: "append",
        width: "100%",
        height: "100%",
        // No name: everyone in the session sees it, and once someone enters
        // through the SIP leg, "everyone" grows.
        showControls: false,
        // Without this what I say is not transcribed and Mia hears half the conversation.
        publishCaptions: true,
      });

      publisher.current = thePublisher;

      await new Promise<void>((done, broken) => {
        theSession.publish(thePublisher, (error) => (error ? broken(error) : done()));
      });

      // To hear my own captions I have to subscribe to myself: the SDK hands
      // nobody their own. Volume at zero and outside the document, or I would
      // hear myself with a delay.
      if (thePublisher.stream) {
        const onlyToHearMyself = theSession.subscribe(
          thePublisher.stream,
          document.createElement("div"),
          { audioVolume: 0, testNetwork: true },
        );

        listenToCaptions(onlyToHearMyself);
      }

      setMicOn(true);
      setCameraOn(true);
      setStatus("inside");
    } catch (error) {
      const { name, message } = readFailure(error);

      // `||` and not `??`: an empty message is as useless as a missing one.
      setFailure(FAILURES[name] ?? (message || GENERIC_FAILURE));
      setStatus("failed");
      leave();
    }
  }, [mySlot, theirSlot, leave]);

  const toggleMic = useCallback(() => {
    setMicOn((on) => {
      publisher.current?.publishAudio(!on);
      return !on;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCameraOn((on) => {
      publisher.current?.publishVideo(!on);
      return !on;
    });
  }, []);

  /**
   * Mute the speaker, which is not the same as going quiet. It exists because
   * of echo: with two devices on the same table, the sound leaves one and
   * comes back through the other's microphone, and the browser's echo
   * cancellation only knows about its own speaker.
   */
  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((on) => {
      speakerLive.current = !on;

      for (const subscriber of subscribers.current) {
        subscriber.subscribeToAudio(!on);
      }

      return !on;
    });
  }, []);

  // Start downloading the SDK while the screen is read. A failure here says
  // nothing: it is retried on the press, which is when there is someone to tell.
  useEffect(() => {
    void loadSdk().catch(() => {
      // Already cleaned up. Nobody to tell yet.
    });
  }, []);

  // Leaving the page is hanging up. Without this, the camera stays on.
  useEffect(() => leave, [leave]);

  return {
    status,
    failure,
    accompanied,
    micOn,
    cameraOn,
    speakerOn,
    join,
    leave,
    toggleMic,
    toggleCamera,
    toggleSpeaker,
  };
}
