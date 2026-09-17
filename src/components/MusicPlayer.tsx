import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useAuiState } from "@assistant-ui/react";
import { MOODS, type MoodId } from "./api";
import { readMuted, writeMuted } from "./session";
import { assetUrl } from "@/cdn";

const VOLUME = 0.25;
/** A mood change is a scene change: long enough to feel like weather turning. */
const CROSSFADE_MS = 1800;
/** Silencing the bards is a command, so it answers quickly. */
const MUTE_MS = 350;

type Slot = 0 | 1;
type Deck = {
  readonly slot: Slot;
  readonly tracks: readonly [MoodId | null, MoodId | null];
};

type MusicPlayerProps = {
  /** The mood the story opened on, used until Jev labels a scene. */
  readonly fallback: MoodId;
  /** True once a turn has been sent; one of several things that can free autoplay. */
  readonly started: boolean;
};

/** Anything the browser will accept as the interaction that frees autoplay. */
const GESTURES = ["pointerdown", "keydown", "touchstart"] as const;

const isMood = (value: unknown): value is MoodId =>
  typeof value === "string" && (MOODS as readonly string[]).includes(value);

const trackSrc = (mood: MoodId | null): string | undefined =>
  mood ? assetUrl(`/music/${mood}.mp3`) : undefined;

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Ramps one element's volume on animation frames and returns a cancel.
 *
 * The curve is equal power — `sin` rising against `cos` falling — because two
 * tracks crossfading on straight lines sum to a dip in the middle, which is
 * heard as the music sagging as it changes. Squared, these two sum to one, so
 * the loudness holds steady across the handover.
 */
const ramp = (element: HTMLAudioElement, target: number, duration: number): (() => void) => {
  const from = element.volume;
  const rising = target > from;
  const startedAt = performance.now();
  let frame = 0;

  const step = (): void => {
    const progress = Math.min(1, (performance.now() - startedAt) / duration);
    const angle = (progress * Math.PI) / 2;
    const eased = rising
      ? from + (target - from) * Math.sin(angle)
      : target + (from - target) * Math.cos(angle);
    element.volume = clamp(eased);
    if (progress < 1) {
      frame = requestAnimationFrame(step);
      return;
    }
    if (target === 0) element.pause();
  };

  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
};

/**
 * Starts a silent track and ramps it up only once playback has actually begun,
 * so a track still buffering does not spend half its fade inaudible and then
 * arrive already half loud.
 */
const rollIn = (element: HTMLAudioElement, target: number): (() => void) => {
  if (!element.paused) return ramp(element, target, CROSSFADE_MS);

  element.volume = 0;
  let cancelled = false;
  let cancelRamp = (): void => undefined;

  void element
    .play()
    .then(() => {
      if (cancelled) return;
      cancelRamp = ramp(element, target, CROSSFADE_MS);
    })
    .catch(() => undefined);

  return () => {
    cancelled = true;
    cancelRamp();
  };
};

const hush = (event: SyntheticEvent<HTMLAudioElement>): void => {
  event.currentTarget.pause();
};

/**
 * Three bars that dance while sound is audible and rest flat when it is not, so
 * the indicator reports what is actually reaching the listener rather than what
 * mood the story happens to be in.
 */
const Equaliser = ({ playing }: { readonly playing: boolean }) => (
  <span className={playing ? "equaliser is-playing" : "equaliser"} aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);

/**
 * Two looping elements take turns holding the current mood, so a change is a
 * crossfade rather than a cut.
 */
export const MusicPlayer = ({ fallback, started }: MusicPlayerProps) => {
  const mood = useAuiState((state) => {
    const labelled = state.thread.messages.findLast((message) =>
      isMood(message.metadata.custom.mood),
    );
    const value = labelled?.metadata.custom.mood;
    return isMood(value) ? value : fallback;
  });

  const first = useRef<HTMLAudioElement>(null);
  const second = useRef<HTMLAudioElement>(null);
  const fades = useRef<ReadonlyArray<() => void>>([]);
  const [muted, setMuted] = useState(false);
  const [wakes, setWakes] = useState(0);
  const [audible, setAudible] = useState(false);
  const [deck, setDeck] = useState<Deck>({ slot: 0, tracks: [mood, null] });

  // The bards play from the opening scene; only silencing them stops it.
  const playing = !muted;

  useEffect(() => setMuted(readMuted()), []);

  /**
   * The first attempt happens on mount and is usually refused, because a page
   * may not start audio before the reader has touched it. Rather than wait for
   * a sent turn, the next interaction of any kind — a click, a key, a tap —
   * retries it, so the music is already under the prologue by the time anyone
   * starts reading properly.
   */
  useEffect(() => {
    const wake = () => setWakes((count) => count + 1);
    GESTURES.forEach((name) =>
      window.addEventListener(name, wake, { once: true, passive: true }),
    );
    return () => GESTURES.forEach((name) => window.removeEventListener(name, wake));
  }, []);

  /** What is really coming out of the speakers, which is what the bars report. */
  const refreshAudible = () =>
    setAudible(
      (first.current !== null && !first.current.paused) ||
        (second.current !== null && !second.current.paused),
    );

  useEffect(() => {
    setDeck((current) => {
      if (current.tracks[current.slot] === mood) return current;
      const slot: Slot = current.slot === 0 ? 1 : 0;
      const tracks: readonly [MoodId | null, MoodId | null] =
        slot === 0 ? [mood, current.tracks[1]] : [current.tracks[0], mood];
      return { slot, tracks };
    });
  }, [mood]);

  useEffect(() => {
    fades.current.forEach((cancel) => cancel());
    const active = deck.slot === 0 ? first.current : second.current;
    const idle = deck.slot === 0 ? second.current : first.current;
    const next: Array<() => void> = [];
    if (idle && !idle.paused) next.push(ramp(idle, 0, CROSSFADE_MS));
    if (active && !playing && !active.paused) next.push(ramp(active, 0, MUTE_MS));
    if (active && playing) next.push(rollIn(active, VOLUME));
    fades.current = next;
  }, [deck, playing, started, wakes]);

  useEffect(() => () => fades.current.forEach((cancel) => cancel()), []);

  const toggle = () => {
    const next = !muted;
    // The click is itself a gesture, so unmuting can start the audio straight away.
    setWakes((count) => count + 1);
    setMuted(next);
    writeMuted(next);
  };

  return (
    <div className="music">
      <audio
        ref={first}
        src={trackSrc(deck.tracks[0])}
        loop
        preload="auto"
        onPlay={refreshAudible}
        onPause={refreshAudible}
        onError={hush}
      />
      <audio
        ref={second}
        src={trackSrc(deck.tracks[1])}
        loop
        preload="auto"
        onPlay={refreshAudible}
        onPause={refreshAudible}
        onError={hush}
      />
      <Equaliser playing={audible && !muted} />
      <button
        type="button"
        className="icon-button"
        onClick={toggle}
        aria-pressed={muted}
        aria-label={muted ? "Let the bards play" : "Silence the bards"}
        title={muted ? "Let the bards play" : "Silence the bards"}
      >
        {muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
      </button>
    </div>
  );
};
