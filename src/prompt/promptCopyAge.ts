const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function getPromptCopyAgeLabel(
  lastCopiedAt: string | undefined,
  nowMs: number = Date.now(),
): string | undefined {
  if (!lastCopiedAt) {
    return undefined;
  }

  const copiedAtMs = Date.parse(lastCopiedAt);

  if (Number.isNaN(copiedAtMs)) {
    return undefined;
  }

  const elapsedMs = Math.max(0, nowMs - copiedAtMs);

  if (elapsedMs < MINUTE_MS) {
    return '<1m';
  }

  if (elapsedMs < 10 * MINUTE_MS) {
    return '<10m';
  }

  if (elapsedMs < 30 * MINUTE_MS) {
    return '<30m';
  }

  if (elapsedMs < HOUR_MS) {
    return '<1h';
  }

  if (elapsedMs < 5 * HOUR_MS) {
    return '<5h';
  }

  if (elapsedMs < 12 * HOUR_MS) {
    return '<12h';
  }

  if (elapsedMs < DAY_MS) {
    return '<1d';
  }

  if (elapsedMs < 7 * DAY_MS) {
    return '<7d';
  }

  return '>7d';
}
