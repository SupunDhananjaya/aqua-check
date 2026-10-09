import { describe, expect, it } from 'vitest';
import type { Measure } from '../config/measures.ts';
import { toNumericValues, validateSample } from './validateSample.ts';

const ph: Measure = {
  name: 'ph',
  label: 'pH',
  description: 'Acidity or alkalinity.',
  unit: 'pH',
  approved_lower_bound: 6,
  approved_upper_bound: 9,
  treatment_if_measure_below_lower_bound: 'Dose alkali.',
  treatment_if_measure_above_upper_bound: 'Dose acid.',
  required: true,
};

const oil: Measure = { ...ph, name: 'oil', label: 'Oil and grease', required: false };

function messageFor(raw: string): string | undefined {
  return validateSample({ ph: raw }, [ph]).fieldErrors.ph;
}

describe('validateSample', () => {
  it('accepts plain, signed, decimal and exponent notation', () => {
    for (const raw of ['7', '7.25', '-3.5', ' 7.5 ', '.5', '7.', '1e2']) {
      expect(messageFor(raw), raw).toBeUndefined();
    }
  });

  it('accepts zero rather than treating it as empty', () => {
    expect(messageFor('0')).toBeUndefined();
  });

  it('asks for a value when the field is blank', () => {
    expect(messageFor('')).toContain('Enter a value');
    expect(messageFor('   ')).toContain('Enter a value');
  });

  it('asks for a number when the entry does not read as one', () => {
    for (const raw of ['abc', '7a', 'Infinity', 'NaN', '0x10', '1e400']) {
      expect(messageFor(raw), raw).toContain('as a number');
    }
  });

  it('names the measure in its message', () => {
    expect(messageFor('')).toContain('pH');
  });

  it('reports a missing key as a blank field', () => {
    expect(validateSample({}, [ph]).fieldErrors.ph).toContain('Enter a value');
  });

  it('returns nothing to fix for a complete sample', () => {
    expect(validateSample({ ph: '7.2' }, [ph])).toEqual({ fieldErrors: {}, formError: null });
  });

  it('lets an optional measure be left blank', () => {
    const { fieldErrors, formError } = validateSample({ ph: '7.2', oil: '' }, [ph, oil]);

    expect(fieldErrors).toEqual({});
    expect(formError).toBeNull();
  });

  it('still checks an optional measure that was filled in', () => {
    expect(validateSample({ ph: '7.2', oil: 'abc' }, [ph, oil]).fieldErrors.oil).toContain(
      'as a number',
    );
  });

  it('refuses a sample with nothing entered at all', () => {
    expect(validateSample({ oil: '' }, [oil]).formError).toContain('at least one measurement');
  });

  it('accepts a sample once any one measure has a value', () => {
    expect(validateSample({ oil: '3' }, [oil]).formError).toBeNull();
  });

  it('raises no form-level problem when there are no measures to enter', () => {
    expect(validateSample({}, [])).toEqual({ fieldErrors: {}, formError: null });
  });
});

describe('toNumericValues', () => {
  it('converts entered strings to numbers', () => {
    expect(toNumericValues({ ph: '7.2', cod: ' 120 ' })).toEqual({ ph: 7.2, cod: 120 });
  });

  it('passes numbers straight through', () => {
    expect(toNumericValues({ ph: 7.2 })).toEqual({ ph: 7.2 });
  });

  it('drops entries that do not read as a finite number', () => {
    expect(toNumericValues({ ph: 'seven', cod: '', tss: 120 })).toEqual({ tss: 120 });
  });
});
