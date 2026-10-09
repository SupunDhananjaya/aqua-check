import { Link, Navigate, useLocation } from 'react-router';
import { formatRange, measures } from '../config/measures.ts';
import { evaluateSample } from '../lib/evaluateSample.ts';
import type { MeasureResult, Outcome } from '../lib/evaluateSample.ts';
import type { SampleDetails } from '../lib/sampleDetails.ts';
import { formatSampleDate } from '../lib/sampleDetails.ts';
import { toNumericValues } from '../lib/validateSample.ts';

const OUTCOME_LABEL: Record<Outcome, string> = {
  pass: 'PASS',
  below: 'BELOW RANGE',
  above: 'ABOVE RANGE',
  missing: 'NOT RECORDED',
  skipped: 'NOT CHECKED',
};

/**
 * Reads the sample the landing page handed over in router state. Returns `null`
 * when there is nothing usable — e.g. someone opened /report directly.
 */
function readValues(state: unknown): Record<string, number> | null {
  if (typeof state !== 'object' || state === null || !('values' in state)) return null;

  const raw = state.values;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const values = toNumericValues(raw);

  return Object.keys(values).length > 0 ? values : null;
}

/**
 * Reads the identifying details. Unlike `readValues` this never forces a
 * redirect: a report with measurements but no metadata is still worth showing,
 * so anything missing simply renders as a dash.
 */
function readSample(state: unknown): SampleDetails {
  const blank = { id: '', name: '', date: '' };
  if (typeof state !== 'object' || state === null || !('sample' in state)) return blank;

  const raw = state.sample;
  if (typeof raw !== 'object' || raw === null) return blank;

  const read = (key: keyof SampleDetails) => {
    const value = (raw as Record<string, unknown>)[key];
    return typeof value === 'string' ? value.trim() : '';
  };

  return { id: read('id'), name: read('name'), date: read('date') };
}

function SampleDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">{value === '' ? '—' : value}</dd>
    </div>
  );
}

function statusClasses(outcome: Outcome): string {
  if (outcome === 'pass') return 'text-emerald-700';
  // A measure nobody ran is not a problem, so it must not be coloured like one.
  if (outcome === 'skipped') return 'text-slate-500';
  return 'text-rose-700';
}

function ResultRow({ result }: { result: MeasureResult }) {
  const { measure, value, outcome } = result;

  return (
    <tr className="border-t border-slate-200">
      <th scope="row" className="py-3 pr-4 text-left font-medium text-slate-900">
        {measure.label}
      </th>
      <td className="py-3 pr-4 text-slate-700 tabular-nums">
        {value === null ? '—' : `${value} ${measure.unit}`}
      </td>
      <td className="py-3 pr-4 text-slate-500 tabular-nums">
        {formatRange(measure)} {measure.unit}
      </td>
      <td className={`py-3 text-sm font-semibold ${statusClasses(outcome)}`}>
        {OUTCOME_LABEL[outcome]}
      </td>
    </tr>
  );
}

export default function ReportPage() {
  const location = useLocation();
  const values = readValues(location.state);
  const sample = readSample(location.state);

  if (values === null) return <Navigate to="/" replace />;

  const { passed, results, failures, skipped } = evaluateSample(values, measures);
  const checked = results.length - skipped.length;

  const verdict =
    checked === 0
      ? 'No measures were checked.'
      : passed
        ? `All ${checked} measures are within the approved range.`
        : `${failures.length} of ${checked} measures are outside the approved range.`;

  return (
    <section aria-labelledby="report-heading">
      <h2 id="report-heading" className="text-2xl font-semibold tracking-tight text-slate-900">
        Sample report
      </h2>

      {/* Identify the sample first, then give the verdict. */}
      <dl className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-3">
        <SampleDetail label="Sample ID" value={sample.id} />
        <SampleDetail label="Sample name" value={sample.name} />
        <SampleDetail
          label="Sampled on"
          value={sample.date === '' ? '' : (formatSampleDate(sample.date) ?? sample.date)}
        />
      </dl>

      <div
        role="status"
        className={`mt-4 rounded-xl border p-5 ${
          passed ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'
        }`}
      >
        <p className={`text-lg font-semibold ${passed ? 'text-emerald-900' : 'text-rose-900'}`}>
          {passed ? 'Sample approved' : 'Sample not approved'}
        </p>
        <p className={`mt-1 text-sm ${passed ? 'text-emerald-800' : 'text-rose-800'}`}>
          {verdict}
          {skipped.length > 0
            ? ` ${skipped.length} ${skipped.length === 1 ? 'measure was' : 'measures were'} not checked.`
            : ''}
        </p>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white px-6 py-2 shadow-sm">
        <table className="w-full text-left">
          <caption className="sr-only">Measured values against their approved ranges</caption>
          <thead>
            <tr>
              <th scope="col" className="py-3 pr-4 text-sm font-semibold text-slate-500">
                Measure
              </th>
              <th scope="col" className="py-3 pr-4 text-sm font-semibold text-slate-500">
                Measured
              </th>
              <th scope="col" className="py-3 pr-4 text-sm font-semibold text-slate-500">
                Approved range
              </th>
              <th scope="col" className="py-3 text-sm font-semibold text-slate-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <ResultRow key={result.measure.name} result={result} />
            ))}
          </tbody>
        </table>
      </div>

      {passed ? null : (
        <section aria-labelledby="treatment-heading" className="mt-8">
          <h3
            id="treatment-heading"
            className="text-xl font-semibold tracking-tight text-slate-900"
          >
            Recommended treatment
          </h3>
          <p className="mt-1 text-slate-600">
            Apply the following, then re-sample and check again.
          </p>

          <ol className="mt-4 space-y-4">
            {failures.map((failure) => (
              <li
                key={failure.measure.name}
                className="rounded-xl border border-amber-300 bg-amber-50 p-5"
              >
                <h4 className="font-semibold text-amber-950">
                  {failure.measure.label} — {OUTCOME_LABEL[failure.outcome]}
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-amber-900">
                  {failure.treatment ?? 'No treatment is configured for this measure.'}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="mt-8">
        <Link
          to="/"
          className="inline-block rounded-md bg-sky-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
        >
          Check another sample
        </Link>
      </div>
    </section>
  );
}
