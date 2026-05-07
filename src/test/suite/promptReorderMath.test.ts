import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vm from 'node:vm';

import { describe, expect, it } from 'vitest';

type PromptQueueRect = {
  height: number;
  top: number;
};

type PromptQueueMidpoint = {
  gapIndex: number;
  midpoint: number;
};

type PromptQueueReorderMath = {
  buildSlotMidpoints(rects: PromptQueueRect[], sourceIndex: number): PromptQueueMidpoint[];
  resolveGapIndex(midpoints: PromptQueueMidpoint[], pointerCenterY: number): number;
  getDisplacedIndexes(sourceIndex: number, gapIndex: number, itemCount: number): number[];
  getAutoScrollDelta(
    pointerY: number,
    listRect: { bottom: number; top: number },
    threshold: number,
    maxStep: number,
  ): number;
};

async function loadReorderMath(): Promise<PromptQueueReorderMath> {
  const filePath = path.resolve(
    __dirname,
    '../../../media/promptqueue-reorder-math.js',
  );
  const source = await fs.readFile(filePath, 'utf8');
  const context: Record<string, unknown> = {};

  context.window = context;
  context.globalThis = context;

  vm.createContext(context);
  vm.runInContext(source, context, {
    filename: filePath,
  });

  return context.PromptQueueReorderMath as PromptQueueReorderMath;
}

describe('PromptQueue reorder math helper', () => {
  it('exposes the reorder math API on the browser global object', async () => {
    const reorderMath = await loadReorderMath();

    expect(reorderMath).toMatchObject({
      buildSlotMidpoints: expect.any(Function),
      resolveGapIndex: expect.any(Function),
      getDisplacedIndexes: expect.any(Function),
      getAutoScrollDelta: expect.any(Function),
    });
  });

  it('builds remaining-card midpoints in full-list gap order and resolves the next gap index', async () => {
    const reorderMath = await loadReorderMath();
    const rects = [
      { top: 0, height: 40 },
      { top: 50, height: 40 },
      { top: 100, height: 40 },
      { top: 150, height: 40 },
    ];

    const midpoints = reorderMath.buildSlotMidpoints(rects, 1);

    expect(midpoints).toEqual([
      { gapIndex: 0, midpoint: 20 },
      { gapIndex: 2, midpoint: 120 },
      { gapIndex: 3, midpoint: 170 },
    ]);
    expect(reorderMath.resolveGapIndex(midpoints, -10)).toBe(0);
    expect(reorderMath.resolveGapIndex(midpoints, 20)).toBe(2);
    expect(reorderMath.resolveGapIndex(midpoints, 121)).toBe(3);
    expect(reorderMath.resolveGapIndex(midpoints, 999)).toBe(4);
  });

  it('returns the displaced indexes for upward, downward, and no-op gaps', async () => {
    const reorderMath = await loadReorderMath();

    expect(reorderMath.getDisplacedIndexes(1, 4, 4)).toEqual([2, 3]);
    expect(reorderMath.getDisplacedIndexes(3, 1, 5)).toEqual([1, 2]);
    expect(reorderMath.getDisplacedIndexes(2, 3, 5)).toEqual([]);
  });

  it('returns edge auto-scroll deltas only while the pointer is inside the threshold', async () => {
    const reorderMath = await loadReorderMath();
    const listRect = {
      top: 100,
      bottom: 340,
    };

    expect(reorderMath.getAutoScrollDelta(80, listRect, 48, 8)).toBe(-8);
    expect(reorderMath.getAutoScrollDelta(120, listRect, 48, 8)).toBe(-8);
    expect(reorderMath.getAutoScrollDelta(170, listRect, 48, 8)).toBe(0);
    expect(reorderMath.getAutoScrollDelta(320, listRect, 48, 8)).toBe(8);
    expect(reorderMath.getAutoScrollDelta(360, listRect, 48, 8)).toBe(8);
  });
});
