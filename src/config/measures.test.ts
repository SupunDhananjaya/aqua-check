import { describe, expect, it } from 'vitest';
import rawConfig from './configuration.json';
import {
  configErrors,
  configPath,
  formatRange,
  measures,
  parseMeasures,
  selectConfigSource,
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
  return parseMeasures({ measures: [entry(overrides)] }).errors;
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

describe('parseMeasures', () => {
  it('accepts a well-formed entry', () => {
    const { measures: parsed, errors } = parseMeasures({ measures: [entry()] });

    expect(errors).toEqual([]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('ph');
  });

  it('accepts a one-sided range', () => {
    const { measures: parsed, errors } = parseMeasures({
      measures: [
        entry({ approved_lower_bound: null, treatment_if_measure_below_lower_bound: null }),
      ],
    });

    expect(errors).toEqual([]);
    expect(parsed[0].approved_lower_bound).toBeNull();
  });

  it('rejects a config that is not an object with a measures array', () => {
    expect(parseMeasures(null).errors).toHaveLength(1);
    expect(parseMeasures({ measures: 'nope' }).errors).toHaveLength(1);
  });

  it('accepts an empty measures array', () => {
    expect(parseMeasures({ measures: [] })).toEqual({ measures: [], errors: [] });
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
    const { measures: parsed, errors } = parseMeasures({ measures: [entry(), entry()] });

    expect(parsed).toHaveLength(1);
    expect(errors[0]).toContain('duplicate name');
  });

  it('ignores unknown keys so config metadata can grow', () => {
    const { errors } = parseMeasures({
      version: 1,
      measures: [entry({ sampling_note: 'grab sample' })],
    });

    expect(errors).toEqual([]);
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
    expect(formatRange(parseMeasures({ measures: [entry()] }).measures[0])).toBe('6 – 9');
  });

  it('renders a one-sided range with an inequality', () => {
    const noLower = parseMeasures({
      measures: [
        entry({ approved_lower_bound: null, treatment_if_measure_below_lower_bound: null }),
      ],
    }).measures[0];
    const noUpper = parseMeasures({
      measures: [
        entry({ approved_upper_bound: null, treatment_if_measure_above_upper_bound: null }),
      ],
    }).measures[0];

    expect(formatRange(noLower)).toBe('≤ 9');
    expect(formatRange(noUpper)).toBe('≥ 6');
  });
});
