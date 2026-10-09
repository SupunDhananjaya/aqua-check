import type { Measure } from '../config/measures.ts';

export type SampleValidation = {
  /** One message per offending measure, keyed by `measure.name`. */
  fieldErrors: Record<string, string>;
  /** A problem with the sample as a whole, such as nothing being entered at all. */
  formError: string | null;
};

/**
 * Checks that every required measure has a value and that each entry reads as a
 * number. No problems means the sample is ready to score; range checking is
 * deliberately not done here — that is the report's job.
 *
 * Kept out of the form component so it can be tested without a DOM: an
 * `<input type="number">` sanitises unparseable keystrokes to `''`, so the
 * not-a-number branch is unreachable through the UI but still worth enforcing
 * for pasted or programmatically set values.
 */
export function validateSample(
  values: Record<string, string>,
  measures: Measure[],
): SampleValidation {
  const fieldErrors: Record<string, string> = {};
  let anyValue = false;

  for (const measure of measures) {
    const raw = (values[measure.name] ?? '').trim();

    if (raw === '') {
      // An optional measure the operator did not run is not an error.
      if (measure.required) fieldErrors[measure.name] = `Enter a value for ${measure.label}.`;
      continue;
    }

    anyValue = true;

    // `Number('')` is 0, which is why the blank check has to come first.
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(raw)) {
      fieldErrors[measure.name] = `Enter ${measure.label} as a number.`;
    }
  }

  // Without this, a config where everything is optional would let an empty form
  // through and report "Sample approved" for a sample nobody measured.
  const formError =
    !anyValue && measures.length > 0
      ? 'Enter at least one measurement before checking the sample.'
      : null;

  return { fieldErrors, formError };
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
