import rawConfig from './configuration.json';

/** A single water-quality measure, exactly as it appears in `configuration.json`. */
export type Measure = {
  /** Stable key. Used as the form field id and as the key in a sample's values. */
  name: string;
  label: string;
  description: string;
  unit: string;
  /** `null` means the measure has no lower limit. */
  approved_lower_bound: number | null;
  /** `null` means the measure has no upper limit. */
  approved_upper_bound: number | null;
  treatment_if_measure_below_lower_bound: string | null;
  treatment_if_measure_above_upper_bound: string | null;
  /** `false` lets the operator leave this measure blank. Absent in JSON means `true`. */
  required: boolean;
};

export type ParsedConfig = {
  /** Shown in the header, the document title and the desktop window title. */
  appName: string;
  /** The discharge standard these limits come from, shown in the header. */
  standard: string | null;
  measures: Measure[];
  /** One human-readable line per rejected entry, for display on the landing page. */
  errors: string[];
};

/** Used when `configuration.json` names no application. */
const DEFAULT_APP_NAME = 'aqua-check';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns the string if it is present and not blank, otherwise `null`. */
function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * A bound is a finite number, or `null`/absent for "unbounded on this side".
 * Anything else is invalid; `bound` is then `null` so the remaining checks stay
 * flat — the entry is rejected on `valid` regardless.
 */
function readBound(value: unknown): { valid: boolean; bound: number | null } {
  if (value === null || value === undefined) return { valid: true, bound: null };
  if (typeof value === 'number' && Number.isFinite(value)) return { valid: true, bound: value };
  return { valid: false, bound: null };
}

/**
 * Narrows the untrusted shape of `configuration.json` into `Measure[]`.
 *
 * The JSON is hand-edited, so its inferred type cannot be trusted. Rejected
 * entries are reported in `errors` rather than thrown, so a bad edit shows up as
 * a readable panel instead of a blank screen, and the valid measures still work.
 */
export function parseConfiguration(raw: unknown): ParsedConfig {
  const measures: Measure[] = [];
  const errors: string[] = [];

  // `app_name` and `standard` are optional: absent or blank is a fallback, not a problem.
  const appName = (isRecord(raw) ? readText(raw.app_name) : null) ?? DEFAULT_APP_NAME;
  const standard = isRecord(raw) ? readText(raw.standard) : null;

  if (!isRecord(raw) || !Array.isArray(raw.measures)) {
    return {
      appName,
      standard,
      measures,
      errors: ['configuration.json must be an object with a "measures" array.'],
    };
  }

  const seen = new Set<string>();

  raw.measures.forEach((entry: unknown, index: number) => {
    const where = `measures[${index}]`;

    if (!isRecord(entry)) {
      errors.push(`${where}: expected an object.`);
      return;
    }

    const name = readText(entry.name);
    if (!name) {
      errors.push(`${where}: "name" must be a non-empty string.`);
      return;
    }
    if (seen.has(name)) {
      errors.push(`${where}: duplicate name "${name}" — names must be unique.`);
      return;
    }

    const label = readText(entry.label);
    const unit = readText(entry.unit);
    const lower = readBound(entry.approved_lower_bound);
    const upper = readBound(entry.approved_upper_bound);
    const below = readText(entry.treatment_if_measure_below_lower_bound);
    const above = readText(entry.treatment_if_measure_above_upper_bound);

    const problems: string[] = [];
    if (!label) problems.push('"label" must be a non-empty string');
    if (!unit) problems.push('"unit" must be a non-empty string');
    if (typeof entry.description !== 'string') problems.push('"description" must be a string');
    if (entry.required !== undefined && typeof entry.required !== 'boolean') {
      problems.push('"required" must be true or false');
    }
    if (!lower.valid) problems.push('"approved_lower_bound" must be a finite number or null');
    if (!upper.valid) problems.push('"approved_upper_bound" must be a finite number or null');
    if (lower.bound === null && upper.bound === null) {
      problems.push('at least one of the approved bounds must be set');
    }
    if (lower.bound !== null && upper.bound !== null && lower.bound > upper.bound) {
      problems.push('"approved_lower_bound" must not be greater than "approved_upper_bound"');
    }
    if (lower.bound !== null && !below) {
      problems.push(
        '"treatment_if_measure_below_lower_bound" is required when a lower bound is set',
      );
    }
    if (upper.bound !== null && !above) {
      problems.push(
        '"treatment_if_measure_above_upper_bound" is required when an upper bound is set',
      );
    }

    if (problems.length > 0) {
      errors.push(`${where} ("${name}"): ${problems.join('; ')}.`);
      return;
    }

    // Already guaranteed by the checks above; restated so the compiler can narrow.
    if (label === null || unit === null || typeof entry.description !== 'string') return;

    seen.add(name);
    measures.push({
      name,
      label,
      description: entry.description,
      unit,
      approved_lower_bound: lower.bound,
      approved_upper_bound: upper.bound,
      treatment_if_measure_below_lower_bound: below,
      treatment_if_measure_above_upper_bound: above,
      // Omitting the field keeps the old behaviour: every measure is mandatory.
      required: typeof entry.required === 'boolean' ? entry.required : true,
    });
  });

  return { appName, standard, measures, errors };
}

/** The approved range as shown next to an input and in the report. */
export function formatRange(measure: Measure): string {
  const { approved_lower_bound: lower, approved_upper_bound: upper } = measure;
  if (lower !== null && upper !== null) return `${lower} – ${upper}`;
  if (upper !== null) return `≤ ${upper}`;
  if (lower !== null) return `≥ ${lower}`;
  return 'no limit';
}

/** The configuration envelope a desktop host injects before the page scripts run. */
export type ConfigSource = {
  raw: unknown;
  /** A read or parse failure, to show alongside any validation problems. */
  error: string | null;
  /** The on-disk file the measures came from, when a host supplied one. */
  path: string | null;
};

/**
 * Prefers a host-injected configuration over the bundled one.
 *
 * The Electron build writes `configuration.json` next to the executable and
 * injects it on `window`, so measures can be edited without a rebuild. In a
 * browser the global is absent and the bundled import is used unchanged.
 */
export function selectConfigSource(injected: unknown, bundled: unknown): ConfigSource {
  if (!isRecord(injected)) return { raw: bundled, error: null, path: null };

  const path = typeof injected.path === 'string' && injected.path !== '' ? injected.path : null;
  const error = typeof injected.error === 'string' && injected.error !== '' ? injected.error : null;

  // A host that could not read its file still gets the bundled defaults, so the
  // app stays usable while reporting what went wrong.
  if (error !== null) return { raw: bundled, error, path };

  return { raw: injected.raw ?? bundled, error: null, path };
}

const injectedConfig = typeof window === 'undefined' ? undefined : window.__AQUA_CHECK_CONFIG__;
const source = selectConfigSource(injectedConfig, rawConfig);
const parsed = parseConfiguration(source.raw);

export const measures: Measure[] = parsed.measures;
export const configErrors: string[] = source.error
  ? [source.error, ...parsed.errors]
  : parsed.errors;
/** The on-disk configuration file, when a desktop host supplied one. */
export const configPath: string | null = source.path;
export const appName: string = parsed.appName;
export const standard: string | null = parsed.standard;
