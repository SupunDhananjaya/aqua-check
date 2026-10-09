import type { Measure } from '../config/measures.ts';

/** A value comfortably inside the measure's approved range. */
export function inRangeValue(measure: Measure): number {
  const { approved_lower_bound: lower, approved_upper_bound: upper } = measure;

  if (lower !== null && upper !== null) return (lower + upper) / 2;
  if (upper !== null) return upper;
  if (lower !== null) return lower;
  return 0;
}

/** A value one unit outside the measure's approved range, on the given side. */
export function outOfRangeValue(measure: Measure, side: 'below' | 'above'): number {
  const bound = side === 'below' ? measure.approved_lower_bound : measure.approved_upper_bound;

  if (bound === null) {
    throw new Error(`${measure.label} has no ${side} bound to exceed.`);
  }

  return side === 'below' ? bound - 1 : bound + 1;
}

/** A complete, in-range sample keyed the way the form keys its values. */
export function inRangeSample(measures: Measure[]): Record<string, number> {
  return Object.fromEntries(measures.map((measure) => [measure.name, inRangeValue(measure)]));
}
