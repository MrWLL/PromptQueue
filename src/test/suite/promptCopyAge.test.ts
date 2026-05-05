import { describe, expect, it } from 'vitest';

import { getPromptCopyAgeLabel } from '../../prompt/promptCopyAge';

describe('getPromptCopyAgeLabel', () => {
  const now = Date.parse('2026-05-05T12:00:00.000Z');

  it('returns undefined when no copy timestamp is available', () => {
    expect(getPromptCopyAgeLabel(undefined, now)).toBeUndefined();
    expect(getPromptCopyAgeLabel('not-a-date', now)).toBeUndefined();
  });

  it('maps elapsed copy time into the expected display buckets', () => {
    expect(
      getPromptCopyAgeLabel('2026-05-05T11:59:45.000Z', now),
    ).toBe('<1m');
    expect(
      getPromptCopyAgeLabel('2026-05-05T11:55:00.000Z', now),
    ).toBe('<10m');
    expect(
      getPromptCopyAgeLabel('2026-05-05T11:35:00.000Z', now),
    ).toBe('<30m');
    expect(
      getPromptCopyAgeLabel('2026-05-05T11:05:00.000Z', now),
    ).toBe('<1h');
    expect(
      getPromptCopyAgeLabel('2026-05-05T08:00:00.000Z', now),
    ).toBe('<5h');
    expect(
      getPromptCopyAgeLabel('2026-05-05T01:00:00.000Z', now),
    ).toBe('<12h');
    expect(
      getPromptCopyAgeLabel('2026-05-04T18:00:00.000Z', now),
    ).toBe('<1d');
    expect(
      getPromptCopyAgeLabel('2026-05-01T12:00:00.000Z', now),
    ).toBe('<7d');
    expect(
      getPromptCopyAgeLabel('2026-04-20T12:00:00.000Z', now),
    ).toBe('>7d');
  });

  it('clamps future timestamps into the freshest bucket', () => {
    expect(
      getPromptCopyAgeLabel('2026-05-05T12:05:00.000Z', now),
    ).toBe('<1m');
  });
});
