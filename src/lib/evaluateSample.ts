import type { Measure } from '../config/measures.ts';

/**
 * Where a value sits relative to its approved range.
 *
 * `missing` and `skipped` both mean "no value", but they are not the same thing:
 * `skipped` is an optional measure the operator chose not to run, which is fine;
 * `missing` is a required one with no value, which should never get past the form.
 */
export type Outcome = 'pass' | 'below' | 'above' | 'missing' | 'skipped';

export type MeasureResult = {
  measure: Measure;
  /** The entered value, or `null` when nothing was supplied for this measure. */
  value: number | null;
  outcome: Outcome;
  /** The applicable treatment, or `null` when the measure passed. */
  treatment: string | null;
};

export type SampleReport = {
  passed: boolean;
  /** Every measure, in configuration order. */
  results: MeasureResult[];
  /** Did not pass — excludes deliberately skipped measures. In configuration order. */
  failures: MeasureResult[];
  /** Optional measures the operator left blank, in configuration order. */
  skipped: MeasureResult[];
};

/**
 * Scores a sample against the configured measures.
 *
 * Bounds are **inclusive**: a value exactly equal to a bound passes, which is how
 * a discharge consent limit reads ("pH 6–9"). A `null` bound is simply not checked.
 *
 * Pure — no React, no DOM, and the measures are passed in rather than imported, so
 * tests can score against their own fixtures.
 */
export function evaluateSample(values: Record<string, number>, measures: Measure[]): SampleReport {
  const results = measures.map((measure): MeasureResult => {
    const value = values[measure.name];

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      // An optional measure with no value was simply not run — report it, don't fail it.
      if (!measure.required) {
        return { measure, value: null, outcome: 'skipped', treatment: null };
      }

      // The form guarantees a value for every required measure, so this is a
      // wiring fault rather than user error. Surface it instead of passing it.
      return {
        measure,
        value: null,
        outcome: 'missing',
        treatment: `No value was recorded for ${measure.label}. Re-enter the sample and check again.`,
      };
    }

    const { approved_lower_bound: lower, approved_upper_bound: upper } = measure;

    if (lower !== null && value < lower) {
      return {
        measure,
        value,
        outcome: 'below',
        treatment: measure.treatment_if_measure_below_lower_bound,
      };
    }

    if (upper !== null && value > upper) {
      return {
        measure,
        value,
        outcome: 'above',
        treatment: measure.treatment_if_measure_above_upper_bound,
      };
    }

    return { measure, value, outcome: 'pass', treatment: null };
  });

  // Stated as an explicit exclusion rather than `!== 'pass'`: a skipped measure
  // is not a failure, and a negative filter would silently swallow it.
  const failures = results.filter(
    (result) => result.outcome !== 'pass' && result.outcome !== 'skipped',
  );
  const skipped = results.filter((result) => result.outcome === 'skipped');

  return { passed: failures.length === 0, results, failures, skipped };
}
