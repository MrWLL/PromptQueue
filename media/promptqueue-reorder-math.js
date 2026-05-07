(function () {
  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function buildSlotMidpoints(rects, sourceIndex) {
    const midpoints = [];

    if (!Array.isArray(rects)) {
      return midpoints;
    }

    rects.forEach(function (rect, index) {
      if (index === sourceIndex) {
        return;
      }

      const top = rect ? Number(rect.top) : NaN;
      const height = rect ? Number(rect.height) : NaN;

      if (!Number.isFinite(top) || !Number.isFinite(height)) {
        return;
      }

      midpoints.push({
        gapIndex: index,
        midpoint: top + height / 2,
      });
    });

    Object.defineProperty(midpoints, 'itemCount', {
      configurable: true,
      enumerable: false,
      value: rects.length,
      writable: false,
    });

    return midpoints;
  }

  function resolveGapIndex(midpoints, pointerCenterY) {
    if (!Array.isArray(midpoints) || !midpoints.length) {
      return 0;
    }

    for (let index = 0; index < midpoints.length; index += 1) {
      const midpointEntry = midpoints[index];

      if (pointerCenterY < midpointEntry.midpoint) {
        return midpointEntry.gapIndex;
      }
    }

    return isFiniteNumber(midpoints.itemCount)
      ? midpoints.itemCount
      : midpoints.length + 1;
  }

  function getDisplacedIndexes(sourceIndex, gapIndex, itemCount) {
    if (
      !Number.isInteger(sourceIndex) ||
      !Number.isInteger(gapIndex) ||
      !Number.isInteger(itemCount) ||
      itemCount <= 0
    ) {
      return [];
    }

    const displacedIndexes = [];

    if (gapIndex > sourceIndex + 1) {
      for (
        let index = sourceIndex + 1;
        index < gapIndex && index < itemCount;
        index += 1
      ) {
        displacedIndexes.push(index);
      }

      return displacedIndexes;
    }

    if (gapIndex <= sourceIndex) {
      for (
        let index = Math.max(0, gapIndex);
        index < sourceIndex && index < itemCount;
        index += 1
      ) {
        displacedIndexes.push(index);
      }
    }

    return displacedIndexes;
  }

  function getAutoScrollDelta(pointerY, listRect, threshold, maxStep) {
    const top = listRect ? Number(listRect.top) : NaN;
    const bottom = listRect ? Number(listRect.bottom) : NaN;

    if (
      !Number.isFinite(top) ||
      !Number.isFinite(bottom) ||
      !Number.isFinite(threshold) ||
      !Number.isFinite(maxStep) ||
      threshold <= 0 ||
      maxStep <= 0
    ) {
      return 0;
    }

    if (pointerY < top + threshold) {
      return -maxStep;
    }

    if (pointerY > bottom - threshold) {
      return maxStep;
    }

    return 0;
  }

  const reorderMath = {
    buildSlotMidpoints: buildSlotMidpoints,
    resolveGapIndex: resolveGapIndex,
    getDisplacedIndexes: getDisplacedIndexes,
    getAutoScrollDelta: getAutoScrollDelta,
  };

  globalThis.PromptQueueReorderMath = reorderMath;

  if (typeof window !== 'undefined') {
    window.PromptQueueReorderMath = reorderMath;
  }
})();
