import type { Measure } from '../config/measures.ts';

/**
 * Checks that every measure has a value and that each one reads as a number.
 *
 * Returns one message per offending measure, keyed by `measure.name`; an empty
 * object means the sample is ready to score. Range checking is deliberately not
 * done here — that is the report's job.
 *
 * Kept out of the form component so it can be tested without a DOM: an
 * `<input type="number">` sanitises unparseable keystrokes to `''`, so the
 * not-a-number branch is unreachable through the UI but still worth enforcing
 * for pasted or programmatically set values.
 */
export function validateSample(
  values: Record<string, string>,
  measures: Measure[],
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const measure of measures) {
    const raw = (values[measure.name] ?? '').trim();

    if (raw === '') {
      errors[measure.name] = `Enter a value for ${measure.label}.`;
      continue;
    }

    // `Number('')` is 0, which is why the blank check has to come first.
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(raw)) {
      errors[measure.name] = `Enter ${measure.label} as a number.`;
    }
  }

  return errors;
}

/**
 * Converts raw entries into the numbers `evaluateSample` expects, dropping any
 * that do not read as a finite number. Accepts a loose shape because it also
 * narrows router state, which arrives untyped.
 */
export function toNumericValues(values: object): Record<string, number> {
  const numeric: Record<string, number> = {};

  for (const [name, raw] of Object.entries(values)) {
    const trimmed = String(raw).trim();
    // `Number('')` is 0, so a blank entry has to be dropped rather than scored.
    if (trimmed === '') continue;

    const value = Number(trimmed);
    if (Number.isFinite(value)) numeric[name] = value;
  }

  return numeric;
}
