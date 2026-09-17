import { Clock, Config, type ConfigError, Context, Effect, Layer, Ref } from "effect";
import { BudgetExhausted } from "@/core/Errors";

/** A day's allowance of upstream turns, so a public demo cannot run up an unbounded bill. */
export interface BudgetService {
  readonly spend: Effect.Effect<void, BudgetExhausted>;
}

/** The spend guard; a counter that resets when the date changes. */
export class Budget extends Context.Tag("story-effect/Budget")<Budget, BudgetService>() {}

export interface Options {
  readonly maxTurnsPerDay: number;
}

interface Tally {
  readonly day: string;
  readonly spent: number;
}

const dayOf = (millis: number): string => new Date(millis).toISOString().slice(0, 10);

const charge = (
  current: Tally,
  today: string,
  maxTurnsPerDay: number,
): readonly [granted: boolean, next: Tally] => {
  const spent = current.day === today ? current.spent : 0;
  if (spent >= maxTurnsPerDay) return [false, { day: today, spent }];
  return [true, { day: today, spent: spent + 1 }];
};

export const make = Effect.fn("Budget.make")(function* (options: Options) {
  const tally = yield* Ref.make<Tally>({ day: "", spent: 0 });

  const spend = Effect.gen(function* () {
    const today = dayOf(yield* Clock.currentTimeMillis);
    const granted = yield* Ref.modify(tally, (current) => charge(current, today, options.maxTurnsPerDay));
    if (granted) return;
    return yield* new BudgetExhausted({ maxTurnsPerDay: options.maxTurnsPerDay });
  });

  const service: BudgetService = { spend };
  return service;
});

export const layer = (options: Options): Layer.Layer<Budget> => Layer.effect(Budget, make(options));

export const layerConfig = (
  options: Config.Config.Wrap<Options>,
): Layer.Layer<Budget, ConfigError.ConfigError> =>
  Layer.effect(Budget, Effect.flatMap(Config.unwrap(options), make));
