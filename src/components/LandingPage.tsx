import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { configErrors, configPath, measures } from '../config/measures.ts';
import type { SampleDetails } from '../lib/sampleDetails.ts';
import { todayIso, validateSampleDetails } from '../lib/sampleDetails.ts';
import { validateSample } from '../lib/validateSample.ts';
import MeasureField from './MeasureField.tsx';
import SampleFields from './SampleFields.tsx';

/** Values are kept as strings so a partial entry such as `-` or `.` survives typing. */
function blankValues(): Record<string, string> {
  return Object.fromEntries(measures.map((measure) => [measure.name, '']));
}

export default function LandingPage() {
  const [values, setValues] = useState<Record<string, string>>(blankValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [details, setDetails] = useState<SampleDetails>(() => ({
    id: '',
    name: '',
    date: todayIso(),
  }));
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  // Stable across renders so the date picker's limit does not jitter while typing.
  const [maxDate] = useState(todayIso);
  const navigate = useNavigate();

  function handleChange(name: string, next: string) {
    setValues((previous) => ({ ...previous, [name]: next }));
    // Clear this field's message as soon as it is edited; the rest stay put.
    setErrors((previous) => (previous[name] ? { ...previous, [name]: '' } : previous));
    setFormError(null);
  }

  function handleDetailChange(field: keyof SampleDetails, next: string) {
    setDetails((previous) => ({ ...previous, [field]: next }));
    setDetailErrors((previous) => (previous[field] ? { ...previous, [field]: '' } : previous));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Re-read today rather than using the mount-time value, so a window left
    // open across midnight does not start rejecting the current day.
    const nextDetailErrors = validateSampleDetails(details, todayIso());
    const { fieldErrors, formError: nextFormError } = validateSample(values, measures);

    setDetailErrors(nextDetailErrors);
    setErrors(fieldErrors);
    setFormError(nextFormError);

    if (
      Object.keys(nextDetailErrors).length > 0 ||
      Object.keys(fieldErrors).length > 0 ||
      nextFormError !== null
    ) {
      return;
    }

    // The report page recomputes from these raw values, so the history entry
    // stays small, serialisable and survives a reload of /report.
    navigate('/report', { state: { values, sample: details } });
  }

  return (
    <section aria-labelledby="new-sample-heading">
      <h2 id="new-sample-heading" className="text-2xl font-semibold tracking-tight text-slate-900">
        New water sample
      </h2>
      <p className="mt-1 text-slate-600">
        Enter every measured value, then check the sample against the approved ranges.
      </p>

      {/* Only the desktop build supplies a path; on the web this stays hidden. */}
      {configPath === null ? null : (
        <p className="mt-2 text-sm text-slate-500">
          Measures come from{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{configPath}</code> — edit it
          and reload to change them.
        </p>
      )}

      {configErrors.length > 0 ? (
        <div role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-900">Problems in configuration.json</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {configErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {measures.length === 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-600">
            No measures are configured. Add one to{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">
              src/config/configuration.json
            </code>{' '}
            to start checking samples.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <SampleFields
            details={details}
            errors={detailErrors}
            maxDate={maxDate}
            onChange={handleDetailChange}
          />

          <div className="px-6 py-2">
            {measures.map((measure) => (
              <MeasureField
                key={measure.name}
                measure={measure}
                value={values[measure.name] ?? ''}
                error={errors[measure.name] ?? ''}
                onChange={handleChange}
              />
            ))}

            <div className="border-t border-slate-200 py-5">
              {formError === null ? null : (
                <p role="alert" className="mb-3 text-sm font-medium text-rose-700">
                  {formError}
                </p>
              )}
              <button
                type="submit"
                className="rounded-md bg-sky-600 px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
              >
                Check water quality
              </button>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
