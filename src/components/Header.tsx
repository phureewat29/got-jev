import { useAuiState } from "@assistant-ui/react";
import {
  BEATS,
  DANGERS,
  MOODS,
  type BeatId,
  type DangerId,
  type MoodId,
  type Position,
} from "./api";

type HeaderProps = {
  readonly turn: number;
  readonly total: number;
  /** Where the story opened, used until Jev has labelled a scene. */
  readonly positionFallback: Position;
  /** The mood the story opened on, used until Jev has labelled a scene. */
  readonly moodFallback: MoodId;
};

const isPosition = (value: unknown): value is Position =>
  typeof value === "object" && value !== null && "location" in value;

const oneOf =
  <T extends string>(values: ReadonlyArray<string>) =>
  (value: unknown): value is T =>
    typeof value === "string" && values.includes(value);

const isMood = oneOf<MoodId>(MOODS);
const isBeat = oneOf<BeatId>(BEATS);
const isDanger = oneOf<DangerId>(DANGERS);

const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Re-keyed on its own text, so React replaces the node whenever a label changes
 * and the CSS fade runs again. Without the key the text would swap in place.
 */
const Fading = ({ text }: { readonly text: string }) => (
  <span key={text} className="fading">
    {text}
  </span>
);

/**
 * Title, where Jon stands, and the labels the scene was judged under.
 *
 * Place, mood, beat and danger all come from the last message carrying each one,
 * which is the same judgment that steers the music and the next prompt — so the
 * header can never disagree with what the story is doing.
 */
export const Header = ({ turn, total, positionFallback, moodFallback }: HeaderProps) => {
  const messages = useAuiState((state) => state.thread.messages);

  const lastWhere = messages.findLast((message) => isPosition(message.metadata.custom.position));
  const position = isPosition(lastWhere?.metadata.custom.position)
    ? lastWhere.metadata.custom.position
    : positionFallback;

  const lastMood = messages.findLast((message) => isMood(message.metadata.custom.mood));
  const mood = isMood(lastMood?.metadata.custom.mood)
    ? lastMood.metadata.custom.mood
    : moodFallback;

  const lastBeat = messages.findLast((message) => isBeat(message.metadata.custom.beat));
  const beat = isBeat(lastBeat?.metadata.custom.beat) ? lastBeat.metadata.custom.beat : undefined;

  const lastDanger = messages.findLast((message) => isDanger(message.metadata.custom.danger));
  const danger = isDanger(lastDanger?.metadata.custom.danger)
    ? lastDanger.metadata.custom.danger
    : undefined;

  // Beat and danger only exist once a scene has been judged, so the prologue shows mood alone.
  const labels: ReadonlyArray<readonly [string, string]> = [
    ["Mood", titleCase(mood)],
    ...(beat ? ([["Beat", titleCase(beat)]] as const) : []),
    ...(danger ? ([["Danger", titleCase(danger)]] as const) : []),
  ];

  return (
    <header className="header">
      <h1 className="title">
        <span className="visually-hidden">Game of Thrones</span>
        <span className="logo" aria-hidden="true" />
      </h1>
      <p className="location">
        <Fading text={`Location: ${position.location.name}`} />
      </p>
      <p className="labels">
        {labels.map(([name, value], index) => (
          <span key={name}>
            {index > 0 ? (
              <span className="divider" aria-hidden="true">
                |
              </span>
            ) : null}
            {name}: <Fading text={value} />
          </span>
        ))}
      </p>
      <p className="counter">
        turn {turn} of {total}
      </p>
    </header>
  );
};
