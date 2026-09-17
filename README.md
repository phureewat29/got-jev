<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.png">
    <img src=".github/logo.png" alt="Game of Thrones x Jev" width="460">
  </picture>
</p>

<p align="center">
  <strong>Typed judgment, turn by turn</strong>
</p>

<p align="center">
  A Game of Thrones roleplay where you play Jon Snow. A story model writes each scene;
  TypeSafe's Jev reads it back and decides where you now stand, what kind of scene it was,
  how much danger you are in, and what should play under it.
</p>

<p align="center">
  <a href="https://jev.phureewat.com"><strong>jev.phureewat.com</strong></a>
</p>

<br />

Each turn, a story model writes the next scene. Then [TypeSafe](https://docs.typesafe.ai)'s
**Jev** reads that scene and answers multiple questions: where Jon now stands,
what kind of scene it was, how much danger he is in, what music should play under it, and
whether the prose stayed inside the fiction. 

Those answers are values — a location id from a closed data set, a probability distribution, a score. The header, the soundtrack, background and the next turn's prompt are all functions of the same six answers from Jev.

## How a turn works

```
 your action ──► Narrator (GPT-5.6 Luna, via OpenRouter) ──► the scene
                                                               │
                              ┌────────────────────────────────┘
                              ▼
                     Jev — ONE request, multiple questions, evaluated in parallel
                       location · heading · beat · mood · danger · inFiction
                              │
      ┌───────────────────────┼────────────────────────┐
      ▼                       ▼                        ▼
 Decision.resolve       verify & retry            stored answers
 (pure, probabilities)  (inFiction < 0.5          (replay policy later
      │                  → regenerate once)        without re-asking Jev)
      ▼
 Location header · background music · next turn's prompt
```

Jev never writes anything. It labels the story scenario.

## Running it

Requires Node 20.9+ (24 recommended) and pnpm.

Stories live in Redis, so start one first.

```bash
docker run -d --name story-redis -p 6379:6379 redis:alpine

pnpm install
cp .env.example .env.local     # then fill in the two API keys
pnpm dev                       # http://localhost:3000
```

| Variable | Default | Notes |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | — | Required. From [typesafe.ai](https://typesafe.ai) |
| `OPENROUTER_API_KEY` | — | Required. From [openrouter.ai](https://openrouter.ai) |
| `REDIS_URL` | — | Required. The Docker Redis above, or a `rediss://` endpoint in a deployment |
| `TYPESAFE_MODEL` | `jev-latest` | Pin a version if you tune thresholds against one |
| `OPENROUTER_MODEL` | `openai/gpt-5.6-luna` | Any OpenRouter chat model |
| `STORY_TTL_DAYS` | `7` | An untouched story expires on its own |
| `MAX_TURNS` | `15` | Turn 15 is narrated as a closing chapter |
| `MAX_TURNS_PER_MINUTE` | `10` | Per caller |
| `MAX_TURNS_PER_IP_PER_DAY` | `60` | Per caller. A new tale mints a new session, so only the address is durable |
| `MAX_TURNS_PER_DAY` | `500` | Process-wide spend cap |
| `NEXT_PUBLIC_CDN_URL` | — | Optional. Serve music and artwork from a CDN; unset uses `public/` |

```bash
pnpm test        # pure functions + the engine on canned layers, no network
pnpm typecheck
```

## API

| | |
| --- | --- |
| `GET /api/story/:id` | The transcript so far, or the prologue for a new session. Writes nothing. |
| `POST /api/story/:id/turn` | `{ action, turn }` → `{ position, mood, beat, text, turn, turnsRemaining, ended }` |

All model calls happen server-side.

## Notes

- Play is capped at 15 turns per session and 200 characters per action — both to bound spend
  on a public demo, alongside per-IP rate limiting and a daily budget.
- Your action is passed to the narrator as delimited **data**, never as instructions, and
  `inFiction` checks the result. Attempts to talk to the narrator get redirected in-world
  rather than refused.
- Text you type is sent to TypeSafe and OpenRouter. Don't put anything private in it.
- Jon's world is George R. R. Martin's. This is a non-commercial technical demonstration.
