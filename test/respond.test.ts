import { Exit, FiberId } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BudgetExhausted,
  InvalidRequest,
  NarratorError,
  QuestionError,
  RateLimited,
  StoryCorrupt,
  StoryEnded,
  TurnConflict,
} from "@/core/Errors";
import { respond } from "@/server/respond";

const bodyOf = async (response: Response): Promise<unknown> => response.json();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("respond", () => {
  it("returns the value as JSON on success", async () => {
    const response = respond(Exit.succeed({ ok: true }));
    expect(response.status).toBe(200);
    await expect(bodyOf(response)).resolves.toEqual({ ok: true });
  });

  it("maps a finished story to 409", async () => {
    const response = respond(Exit.fail(new StoryEnded({ turns: 15 })));
    expect(response.status).toBe(409);
    await expect(bodyOf(response)).resolves.toEqual({ error: "story_ended" });
  });

  it("maps a turn conflict to 409", async () => {
    const response = respond(Exit.fail(new TurnConflict({ expected: 3, received: 1 })));
    expect(response.status).toBe(409);
    await expect(bodyOf(response)).resolves.toEqual({ error: "turn_conflict" });
  });

  it("maps a rate limit to 429 and says how long to wait", async () => {
    const response = respond(Exit.fail(new RateLimited({ retryAfterSeconds: 17 })));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    await expect(bodyOf(response)).resolves.toEqual({ error: "rate_limited" });
  });

  it("maps a spent budget to 503", async () => {
    const response = respond(Exit.fail(new BudgetExhausted({ maxTurnsPerDay: 500 })));
    expect(response.status).toBe(503);
    await expect(bodyOf(response)).resolves.toEqual({ error: "budget_exhausted" });
  });

  it("maps a bad request to 400 and says what was wrong", async () => {
    const response = respond(Exit.fail(new InvalidRequest({ message: "action: too long" })));
    expect(response.status).toBe(400);
    await expect(bodyOf(response)).resolves.toEqual({
      error: "invalid_request",
      message: "action: too long",
    });
  });

  it("maps either upstream to 502 without leaking the cause", async () => {
    const jev = respond(Exit.fail(new QuestionError({ message: "401 from api.typesafe.ai" })));
    const luna = respond(Exit.fail(new NarratorError({ message: "socket hang up" })));
    expect([jev.status, luna.status]).toEqual([502, 502]);
    await expect(bodyOf(jev)).resolves.toEqual({ error: "upstream_failed" });
    await expect(bodyOf(luna)).resolves.toEqual({ error: "upstream_failed" });
  });

  it("maps an unreadable story to 500", async () => {
    const response = respond(
      Exit.fail(new StoryCorrupt({ sessionId: "abc", message: "unexpected end of JSON" })),
    );
    expect(response.status).toBe(500);
    await expect(bodyOf(response)).resolves.toEqual({ error: "story_corrupt" });
  });

  it("answers an interrupted request with an empty 499", async () => {
    const response = respond(Exit.interrupt(FiberId.none));
    expect(response.status).toBe(499);
    expect(response.body).toBeNull();
  });

  it("logs a defect and answers 500", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = respond(Exit.die(new Error("boom")));
    expect(response.status).toBe(500);
    await expect(bodyOf(response)).resolves.toEqual({ error: "internal" });
    expect(logged).toHaveBeenCalledOnce();
  });
});
