import { Config, type ConfigError, Context, Effect, Layer } from "effect";

/** How long a story runs. Configuration, not policy, so tests can shorten it. */
export interface RulesService {
  /** Turns a session may play before it closes; the last one is written as a closing chapter. */
  readonly maxTurns: number;
}

/** The story's fixed rules. */
export class Rules extends Context.Tag("story-effect/Rules")<Rules, RulesService>() {}

/** The rules the plan settled on. */
export const defaults: RulesService = { maxTurns: 15 };

/** Fixed rules. */
export const layer = (rules: RulesService): Layer.Layer<Rules> => Layer.succeed(Rules, rules);

/** Rules read from configuration. */
export const layerConfig = (
  rules: Config.Config.Wrap<RulesService>,
): Layer.Layer<Rules, ConfigError.ConfigError> => Layer.effect(Rules, Config.unwrap(rules));
