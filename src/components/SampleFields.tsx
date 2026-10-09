import type { SampleDetails } from '../lib/sampleDetails.ts';

type SampleFieldsProps = {
  details: SampleDetails;
  /** Validation messages keyed by field name; a missing key means the field is valid. */
  errors: Record<string, string>;
  /** Today, so the date picker itself refuses a future day. */
  maxDate: string;
  onChange: (field: keyof SampleDetails, value: string) => void;
};

type FieldProps = {
  field: keyof SampleDetails;
  label: string;
  value: string;
  error: string;
  onChange: (field: keyof SampleDetails, value: string) => void;
  type?: 'text' | 'date';
  max?: string;
  placeholder?: string;
};

function Field({
  field,
  label,
  value,
  error,
  onChange,
  type = 'text',
  max,
  placeholder,
}: FieldProps) {
  const inputId = `sample-${field}`;
  const errorId = `${inputId}-error`;

  return (
    <div>
      <label htmlFor={inputId} className="block font-medium text-slate-900">
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        value={value}
        max={max}
        placeholder={placeholder}
        onChange={(event) => onChange(field, event.target.value)}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 aria-invalid:border-rose-400"
      />
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function SampleFields({ details, errors, maxDate, onChange }: SampleFieldsProps) {
  return (
    <div className="border-b border-slate-200 px-6 py-5">
      <h3 className="font-semibold text-slate-900">Sample details</h3>
      <p className="mt-0.5 text-sm text-slate-500">
        Recorded on the report so it can be traced back to the sample.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field
          field="id"
          label="Sample ID"
          value={details.id}
          error={errors.id ?? ''}
          onChange={onChange}
          placeholder="WW-2026-0417"
        />
        <Field
          field="name"
          label="Sample name"
          value={details.name}
          error={errors.name ?? ''}
          onChange={onChange}
          placeholder="Outfall 2 grab"
        />
        <Field
          field="date"
          label="Sampled on"
          type="date"
          // A sample cannot have been taken tomorrow.
          max={maxDate}
          value={details.date}
          error={errors.date ?? ''}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
