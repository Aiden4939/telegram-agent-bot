import { env } from "../config/env.js";

const userMessageBuckets = new Map<string, number[]>();
const userAgentStartAt = new Map<string, number>();

export function checkAndTrackUserMessage(userId: string): {
  ok: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  const oneMinuteAgo = now - 60_000;
  const bucket = userMessageBuckets.get(userId) ?? [];
  const recent = bucket.filter((t) => t >= oneMinuteAgo);
  if (recent.length >= env.userMessagePerMinuteLimit) {
    const oldest = recent[0] ?? now;
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000)) };
  }
  recent.push(now);
  userMessageBuckets.set(userId, recent);
  return { ok: true };
}

export function checkAgentStartInterval(userId: string): {
  ok: boolean;
  retryAfterSec?: number;
} {
  const now = Date.now();
  const last = userAgentStartAt.get(userId);
  if (last && now - last < env.minAgentStartIntervalMs) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((env.minAgentStartIntervalMs - (now - last)) / 1000),
    };
  }
  userAgentStartAt.set(userId, now);
  return { ok: true };
}
