/**
 * Browser-local identity. The session id names a storyline on the server; the
 * mute flag is a personal preference. Both tolerate a blocked localStorage.
 */

const SESSION_KEY = "story-effect:session";
const MUTED_KEY = "story-effect:muted";

const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string): void => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
};

/** Reads the stored session id, minting and persisting one on first visit. */
export const loadSessionId = (): string => {
  const stored = read(SESSION_KEY);
  if (stored) return stored;
  return newSessionId();
};

/** Mints a fresh session id and makes it the stored one. */
export const newSessionId = (): string => {
  const id = crypto.randomUUID();
  write(SESSION_KEY, id);
  return id;
};

export const readMuted = (): boolean => read(MUTED_KEY) === "true";

export const writeMuted = (muted: boolean): void => write(MUTED_KEY, String(muted));
