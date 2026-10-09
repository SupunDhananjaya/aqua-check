import type { Measure } from '../config/measures.ts';
import { formatRange } from '../config/measures.ts';

type MeasureFieldProps = {
  measure: Measure;
  value: string;
  /** Validation message for this field, or an empty string when it is valid. */
  error: string;
  onChange: (name: string, value: string) => void;
};

export default function MeasureField({ measure, value, error, onChange }: MeasureFieldProps) {
  const inputId = `measure-${measure.name}`;
  const rangeId = `${inputId}-range`;
  const descriptionId = `${inputId}-description`;
  const errorId = `${inputId}-error`;

  // The label holds the measure name alone — pulling the unit into it would make
  // pH's accessible name "pH pH". The unit and range are announced as the
  // description instead, so they are still conveyed rather than being visual-only.
  const describedBy = [rangeId, descriptionId, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className="border-b border-slate-200 py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <label htmlFor={inputId} className="font-medium text-slate-900">
          {measure.label}
        </label>
        <span id={rangeId} className="text-sm text-slate-500 tabular-nums">
          Approved {formatRange(measure)} {measure.unit}
        </span>
      </div>

      <p id={descriptionId} className="mt-0.5 text-sm text-slate-500">
        {measure.description}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <input
          id={inputId}
          type="number"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(measure.name, event.target.value)}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="w-40 rounded-md border border-slate-300 bg-white px-3 py-2 tabular-nums shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 aria-invalid:border-rose-400"
        />
        <span className="text-sm text-slate-500">{measure.unit}</span>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
