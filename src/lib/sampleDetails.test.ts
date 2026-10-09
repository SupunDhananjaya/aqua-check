import { describe, expect, it } from 'vitest';
import type { SampleDetails } from './sampleDetails.ts';
import { formatSampleDate, todayIso, validateSampleDetails } from './sampleDetails.ts';

function details(overrides: Partial<SampleDetails> = {}): SampleDetails {
  return { id: 'WW-2026-0417', name: 'Outfall 2 grab', date: '2026-10-09', ...overrides };
}

describe('todayIso', () => {
  it('formats the local date with padded parts', () => {
    expect(todayIso(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05');
    expect(todayIso(new Date(2026, 9, 9, 12, 0))).toBe('2026-10-09');
  });

  it('reads the local day, not the UTC one', () => {
    // Late evening west of Greenwich is already tomorrow in UTC; the form must
    // still offer today, or a same-day sample gets rejected as being in the future.
    const lateEvening = new Date(2026, 9, 9, 23, 30);

    expect(todayIso(lateEvening)).toBe('2026-10-09');
    expect(todayIso(lateEvening)).toBe(
      `${lateEvening.getFullYear()}-10-${String(lateEvening.getDate()).padStart(2, '0')}`,
    );
  });

  it('defaults to now', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatSampleDate', () => {
  it('renders an unambiguous day, month and year', () => {
    expect(formatSampleDate('2026-10-09')).toBe('9 October 2026');
    expect(formatSampleDate('2026-01-31')).toBe('31 January 2026');
    expect(formatSampleDate('2026-12-01')).toBe('1 December 2026');
  });

  it('accepts a leap day in a leap year', () => {
    expect(formatSampleDate('2024-02-29')).toBe('29 February 2024');
  });

  it('rejects a day that does not exist', () => {
    expect(formatSampleDate('2026-02-31')).toBeNull();
    expect(formatSampleDate('2026-02-29')).toBeNull();
    expect(formatSampleDate('2026-13-01')).toBeNull();
  });

  it('rejects anything that is not an ISO date', () => {
    for (const raw of ['', '   ', 'not-a-date', '09/10/2026', '2026-10-9', '2026-10']) {
      expect(formatSampleDate(raw), raw).toBeNull();
    }
  });
});

describe('validateSampleDetails', () => {
  const today = '2026-10-09';

  it('accepts complete details dated today', () => {
    expect(validateSampleDetails(details(), today)).toEqual({});
  });

  it('accepts any earlier day', () => {
    expect(validateSampleDetails(details({ date: '2019-03-04' }), today)).toEqual({});
    expect(validateSampleDetails(details({ date: '2026-10-08' }), today)).toEqual({});
  });

  it('rejects a date in the future', () => {
    expect(validateSampleDetails(details({ date: '2026-10-10' }), today).date).toContain(
      'cannot be in the future',
    );
  });

  it('asks for a sample ID when it is blank', () => {
    expect(validateSampleDetails(details({ id: '' }), today).id).toContain('Enter a sample ID');
    expect(validateSampleDetails(details({ id: '   ' }), today).id).toContain('Enter a sample ID');
  });

  it('asks for a sample name when it is blank', () => {
    expect(validateSampleDetails(details({ name: '' }), today).name).toContain(
      'Enter a sample name',
    );
  });

  it('asks for the date when it is blank', () => {
    expect(validateSampleDetails(details({ date: '' }), today).date).toContain(
      'Enter the sampling date.',
    );
  });

  it('rejects a date that is not a real day', () => {
    expect(validateSampleDetails(details({ date: '2026-02-31' }), today).date).toContain(
      'as a real date',
    );
  });

  it('reports every offending field at once', () => {
    const errors = validateSampleDetails({ id: '', name: '', date: '' }, today);

    expect(Object.keys(errors).sort()).toEqual(['date', 'id', 'name']);
  });
});
