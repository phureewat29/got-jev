import { Config, type ConfigError, Context, Layer } from "effect";

/** How long a story runs; read from configuration so tests can shorten it. */
export interface RulesService {
  /** Turns a session may play before it closes; the last one is written as a closing chapter. */
  readonly maxTurns: number;
}

export class Rules extends Context.Tag("story-effect/Rules")<Rules, RulesService>() {}

export const layer = (rules: RulesService): Layer.Layer<Rules> => Layer.succeed(Rules, rules);

export const layerConfig = (
  rules: Config.Config.Wrap<RulesService>,
): Layer.Layer<Rules, ConfigError.ConfigError> => Layer.effect(Rules, Config.unwrap(rules));
