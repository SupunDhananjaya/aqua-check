import { describe, expect, it } from 'vitest';
import rawConfig from './configuration.json';
import {
  appName,
  configErrors,
  configPath,
  formatRange,
  measures,
  parseConfiguration,
  selectConfigSource,
  standard,
} from './measures.ts';

type Entry = Record<string, unknown>;

function entry(overrides: Entry = {}): Entry {
  return {
    name: 'ph',
    label: 'pH',
    description: 'Acidity or alkalinity.',
    unit: 'pH',
    approved_lower_bound: 6,
    approved_upper_bound: 9,
    treatment_if_measure_below_lower_bound: 'Dose alkali.',
    treatment_if_measure_above_upper_bound: 'Dose acid.',
    ...overrides,
  };
}

function problemsFor(overrides: Entry): string[] {
  return parseConfiguration({ measures: [entry(overrides)] }).errors;
}

describe('the shipped configuration.json', () => {
  it('parses with no problems', () => {
    expect(configErrors).toEqual([]);
    expect(measures.length).toBeGreaterThan(0);
    expect(measures).toHaveLength((rawConfig as { measures: unknown[] }).measures.length);
  });

  it('gives every bound it sets a treatment, and keeps the bounds ordered', () => {
    for (const measure of measures) {
      const { approved_lower_bound: lower, approved_upper_bound: upper } = measure;

      if (lower !== null && upper !== null) expect(lower).toBeLessThanOrEqual(upper);
      if (lower !== null) expect(measure.treatment_if_measure_below_lower_bound).toBeTruthy();
      if (upper !== null) expect(measure.treatment_if_measure_above_upper_bound).toBeTruthy();
    }
  });
});

describe('parseConfiguration', () => {
  it('accepts a well-formed entry', () => {
    const { measures: parsed, errors } = parseConfiguration({ measures: [entry()] });

    expect(errors).toEqual([]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('ph');
  });

  it('accepts a one-sided range', () => {
    const { measures: parsed, errors } = parseConfiguration({
      measures: [
        entry({ approved_lower_bound: null, treatment_if_measure_below_lower_bound: null }),
      ],
    });

    expect(errors).toEqual([]);
    expect(parsed[0].approved_lower_bound).toBeNull();
  });

  it('rejects a config that is not an object with a measures array', () => {
    expect(parseConfiguration(null).errors).toHaveLength(1);
    expect(parseConfiguration({ measures: 'nope' }).errors).toHaveLength(1);
  });

  it('accepts an empty measures array', () => {
    expect(parseConfiguration({ measures: [] })).toEqual({
      appName: 'aqua-check',
      standard: null,
      measures: [],
      errors: [],
    });
  });

  it('rejects a missing label', () => {
    expect(problemsFor({ label: '' })[0]).toContain('"label"');
  });

  it('rejects a bound that is not a number', () => {
    expect(problemsFor({ approved_upper_bound: '9' })[0]).toContain('"approved_upper_bound"');
  });

  it('rejects an inverted range', () => {
    expect(problemsFor({ approved_lower_bound: 10 })[0]).toContain('must not be greater than');
  });

  it('rejects a measure that can never fail', () => {
    const problems = problemsFor({
      approved_lower_bound: null,
      approved_upper_bound: null,
      treatment_if_measure_below_lower_bound: null,
      treatment_if_measure_above_upper_bound: null,
    });

    expect(problems[0]).toContain('at least one of the approved bounds');
  });

  it('rejects a bound with no matching treatment', () => {
    expect(problemsFor({ treatment_if_measure_above_upper_bound: null })[0]).toContain(
      'treatment_if_measure_above_upper_bound',
    );
  });

  it('reports every problem with one entry in a single pass', () => {
    const problems = problemsFor({ label: '', unit: '' });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"label"');
    expect(problems[0]).toContain('"unit"');
  });

  it('rejects a duplicate name but keeps the first entry', () => {
    const { measures: parsed, errors } = parseConfiguration({ measures: [entry(), entry()] });

    expect(parsed).toHaveLength(1);
    expect(errors[0]).toContain('duplicate name');
  });

  it('ignores unknown keys so config metadata can grow', () => {
    const { errors } = parseConfiguration({
      version: 1,
      measures: [entry({ sampling_note: 'grab sample' })],
    });

    expect(errors).toEqual([]);
  });
});

describe('optional measures', () => {
  it('treats a measure with no "required" field as mandatory', () => {
    expect(parseConfiguration({ measures: [entry()] }).measures[0].required).toBe(true);
  });

  it('keeps an explicit required flag', () => {
    const { measures: parsed, errors } = parseConfiguration({
      measures: [entry({ required: false })],
    });

    expect(errors).toEqual([]);
    expect(parsed[0].required).toBe(false);
  });

  it('rejects a required flag that is not a boolean', () => {
    expect(problemsFor({ required: 'yes' })[0]).toContain('"required" must be true or false');
  });

  it('marks at least one shipped measure optional and the rest required', () => {
    expect(measures.filter((measure) => measure.required).length).toBeGreaterThan(0);
    expect(measures.filter((measure) => !measure.required).length).toBeGreaterThan(0);
  });
});

describe('application metadata', () => {
  it('reads the app name from the configuration', () => {
    expect(parseConfiguration({ app_name: 'Riverside WWTP', measures: [] }).appName).toBe(
      'Riverside WWTP',
    );
    expect(appName).toBe('AquaCheck');
  });

  it('falls back to a default name when none is configured', () => {
    expect(parseConfiguration({ measures: [] }).appName).toBe('aqua-check');
    expect(parseConfiguration({ app_name: '  ', measures: [] }).appName).toBe('aqua-check');
  });

  it('still names the app when the whole configuration is unusable', () => {
    expect(parseConfiguration(null).appName).toBe('aqua-check');
    expect(parseConfiguration({ app_name: 'Riverside WWTP' }).appName).toBe('Riverside WWTP');
  });

  it('reads the standard, or null when none is given', () => {
    expect(parseConfiguration({ standard: 'ISO 1234', measures: [] }).standard).toBe('ISO 1234');
    expect(parseConfiguration({ measures: [] }).standard).toBeNull();
    expect(standard).toBeTruthy();
  });
});

describe('selectConfigSource', () => {
  const bundled = { measures: [entry()] };
  const external = { measures: [entry({ name: 'cod', label: 'COD' })] };

  it('uses the bundled configuration in a browser, where nothing is injected', () => {
    for (const injected of [undefined, null]) {
      expect(selectConfigSource(injected, bundled)).toEqual({
        raw: bundled,
        error: null,
        path: null,
      });
    }
  });

  it('prefers a host-injected configuration and reports where it came from', () => {
    expect(
      selectConfigSource(
        { raw: external, error: null, path: 'C:\\app\\configuration.json' },
        bundled,
      ),
    ).toEqual({ raw: external, error: null, path: 'C:\\app\\configuration.json' });
  });

  it('falls back to the bundled configuration when the host could not read its file', () => {
    const source = selectConfigSource(
      {
        raw: null,
        error: 'configuration.json could not be read: Unexpected token }',
        path: 'C:\\app\\configuration.json',
      },
      bundled,
    );

    expect(source.raw).toBe(bundled);
    expect(source.error).toContain('could not be read');
    expect(source.path).toBe('C:\\app\\configuration.json');
  });

  it('falls back when the envelope carries no configuration at all', () => {
    expect(selectConfigSource({ path: 'C:\\app\\configuration.json' }, bundled).raw).toBe(bundled);
  });

  it('ignores a malformed envelope rather than trusting it', () => {
    expect(selectConfigSource('nope', bundled)).toEqual({ raw: bundled, error: null, path: null });
  });
});

describe('the browser build', () => {
  it('reports no configuration file, so the desktop-only hint stays hidden', () => {
    expect(configPath).toBeNull();
  });
});

describe('formatRange', () => {
  it('renders a two-sided range', () => {
    expect(formatRange(parseConfiguration({ measures: [entry()] }).measures[0])).toBe('6 – 9');
  });

  it('renders a one-sided range with an inequality', () => {
    const noLower = parseConfiguration({
      measures: [
        entry({ approved_lower_bound: null, treatment_if_measure_below_lower_bound: null }),
      ],
    }).measures[0];
    const noUpper = parseConfiguration({
      measures: [
        entry({ approved_upper_bound: null, treatment_if_measure_above_upper_bound: null }),
      ],
    }).measures[0];

    expect(formatRange(noLower)).toBe('≤ 9');
    expect(formatRange(noUpper)).toBe('≥ 6');
  });
});
