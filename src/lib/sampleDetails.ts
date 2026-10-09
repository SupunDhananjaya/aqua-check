/** The identifying details recorded alongside a check. */
export type SampleDetails = {
  id: string;
  name: string;
  /** ISO `YYYY-MM-DD`, exactly as an `<input type="date">` holds it. */
  date: string;
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Today in the **local** timezone, as `YYYY-MM-DD`.
 *
 * Built from the local date parts rather than `toISOString()`, which is UTC:
 * west of Greenwich that reports yesterday for much of the day, which would both
 * default the form to the wrong date and reject a same-day sample as "in the
 * future". `now` is injectable so this is testable without fake timers.
 */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${now.getFullYear()}-${month}-${day}`;
}

/** Splits an ISO date, returning `null` unless it names a day that really exists. */
function readIsoDate(iso: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(iso.trim());
  if (match === null) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);

  // Round-trip through Date: an impossible day such as 2026-02-31 rolls over to
  // March, so the parts coming back unchanged is the proof that it was real.
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return { year, month, day };
}

/** `2026-10-09` → `9 October 2026`, or `null` when the value is not a real date. */
export function formatSampleDate(iso: string): string | null {
  const parts = readIsoDate(iso);
  if (parts === null) return null;

  return `${parts.day} ${MONTHS[parts.month]} ${parts.year}`;
}

/**
 * Checks the identifying details, returning one message per offending field. An
 * empty object means they are good to record.
 *
 * `today` is passed in rather than read here so the caller decides what "now"
 * means, which keeps this pure and lets the form re-check against a fresh date.
 */
export function validateSampleDetails(
  details: SampleDetails,
  today: string,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (details.id.trim() === '') errors.id = 'Enter a sample ID.';
  if (details.name.trim() === '') errors.name = 'Enter a sample name.';

  const date = details.date.trim();
  if (date === '') {
    errors.date = 'Enter the sampling date.';
  } else if (readIsoDate(date) === null) {
    errors.date = 'Enter the sampling date as a real date.';
  } else if (date > today) {
    // `YYYY-MM-DD` sorts lexicographically, so this is exactly "later than
    // today" with no timezone or date-arithmetic traps.
    errors.date = 'The sampling date cannot be in the future.';
  }

  return errors;
}
