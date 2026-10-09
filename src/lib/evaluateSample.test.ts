import { describe, expect, it } from 'vitest';
import type { Measure } from '../config/measures.ts';
import { evaluateSample } from './evaluateSample.ts';

function makeMeasure(overrides: Partial<Measure> & { name: string }): Measure {
  return {
    label: overrides.name.toUpperCase(),
    description: 'A test measure.',
    unit: 'mg/L',
    approved_lower_bound: 0,
    approved_upper_bound: 10,
    treatment_if_measure_below_lower_bound: 'Raise it.',
    treatment_if_measure_above_upper_bound: 'Lower it.',
    ...overrides,
  };
}

const ph = makeMeasure({
  name: 'ph',
  label: 'pH',
  unit: 'pH',
  approved_lower_bound: 6,
  approved_upper_bound: 9,
  treatment_if_measure_below_lower_bound: 'Dose alkali.',
  treatment_if_measure_above_upper_bound: 'Dose acid.',
});

const cod = makeMeasure({ name: 'cod', label: 'COD', approved_upper_bound: 250 });

describe('evaluateSample', () => {
  it('passes when every value is inside its range', () => {
    const report = evaluateSample({ ph: 7.2, cod: 120 }, [ph, cod]);

    expect(report.passed).toBe(true);
    expect(report.failures).toEqual([]);
    expect(report.results.map((result) => result.outcome)).toEqual(['pass', 'pass']);
    expect(report.results.every((result) => result.treatment === null)).toBe(true);
  });

  it('reports a value under the lower bound with the below-bound treatment', () => {
    const report = evaluateSample({ ph: 4.5, cod: 120 }, [ph, cod]);

    expect(report.passed).toBe(false);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].outcome).toBe('below');
    expect(report.failures[0].treatment).toBe('Dose alkali.');
  });

  it('reports a value over the upper bound with the above-bound treatment', () => {
    const report = evaluateSample({ ph: 7, cod: 400 }, [ph, cod]);

    expect(report.passed).toBe(false);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].outcome).toBe('above');
    expect(report.failures[0].treatment).toBe('Lower it.');
  });

  it('treats both bounds as inclusive', () => {
    const onLower = evaluateSample({ ph: 6 }, [ph]);
    const onUpper = evaluateSample({ ph: 9 }, [ph]);

    expect(onLower.passed).toBe(true);
    expect(onUpper.passed).toBe(true);
  });

  it('skips the check on a null bound', () => {
    const noLower = makeMeasure({ name: 'cod', approved_lower_bound: null });
    const noUpper = makeMeasure({ name: 'flow', approved_upper_bound: null });

    expect(evaluateSample({ cod: -9000 }, [noLower]).passed).toBe(true);
    expect(evaluateSample({ flow: 9000 }, [noUpper]).passed).toBe(true);
  });

  it('keeps failures in configuration order', () => {
    const report = evaluateSample({ ph: 12, cod: 400 }, [ph, cod]);

    expect(report.failures.map((failure) => failure.measure.name)).toEqual(['ph', 'cod']);
  });

  it('flags a measure with no recorded value instead of passing it', () => {
    const report = evaluateSample({ ph: 7 }, [ph, cod]);

    expect(report.passed).toBe(false);
    expect(report.failures[0].outcome).toBe('missing');
    expect(report.failures[0].value).toBeNull();
    expect(report.failures[0].treatment).toContain('COD');
  });

  it('passes vacuously when there are no measures', () => {
    const report = evaluateSample({}, []);

    expect(report.passed).toBe(true);
    expect(report.results).toEqual([]);
  });
});
