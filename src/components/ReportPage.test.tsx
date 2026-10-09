import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { measures } from '../config/measures.ts';
import { inRangeSample, outOfRangeValue, requiredOnlySample } from '../test/sampleValues.ts';
import ReportPage from './ReportPage.tsx';

const SAMPLE = { id: 'WW-2026-0417', name: 'Outfall 2 grab', date: '2026-10-09' };

/**
 * The landing route is stubbed so a redirect away from /report is observable.
 * A sample is supplied by default so every case gets a complete report.
 */
function renderReportState(state?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/report', state }]}>
      <Routes>
        <Route path="/" element={<h2>New water sample</h2>} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** Adds the identifying details so individual cases only describe measurements. */
function renderReport(state?: unknown) {
  renderReportState(
    typeof state === 'object' && state !== null ? { sample: SAMPLE, ...state } : state,
  );
}

/** The value beside a term in the detail strip, anchored on a role query. */
function detailValue(label: string) {
  const term = screen.getAllByRole('term').find((node) => node.textContent === label);
  return term?.nextElementSibling?.textContent;
}

function redirectedToForm() {
  return screen.queryByRole('heading', { name: 'New water sample' });
}

function rowFor(label: string) {
  return screen.getByRole('rowheader', { name: label }).closest('tr');
}

const [first, second] = measures;
const optional = measures.filter((measure) => !measure.required);

describe('ReportPage', () => {
  it('approves a sample where every measure is in range', () => {
    renderReport({ values: inRangeSample(measures) });

    expect(screen.getByRole('status')).toHaveTextContent('Sample approved');
    expect(screen.getByRole('status')).toHaveTextContent(
      `All ${measures.length} measures are within the approved range.`,
    );
    expect(screen.queryByRole('heading', { name: 'Recommended treatment' })).toBeNull();
  });

  it('reports every measure in a table, one row each plus the header', () => {
    renderReport({ values: inRangeSample(measures) });

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(measures.length + 1);
    for (const measure of measures) {
      expect(screen.getByRole('rowheader', { name: measure.label })).toBeInTheDocument();
    }
  });

  it('accepts the raw strings the form actually sends', () => {
    const values = Object.fromEntries(
      Object.entries(inRangeSample(measures)).map(([name, value]) => [name, String(value)]),
    );

    renderReport({ values });

    expect(screen.getByRole('status')).toHaveTextContent('Sample approved');
  });

  it('gives the below-bound treatment when a value is under its lower bound', () => {
    renderReport({
      values: { ...inRangeSample(measures), [first.name]: outOfRangeValue(first, 'below') },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Sample not approved');
    expect(screen.getByRole('status')).toHaveTextContent(`1 of ${measures.length} measures`);
    expect(rowFor(first.label)).toHaveTextContent('BELOW RANGE');
    expect(screen.getByRole('listitem')).toHaveTextContent(
      String(first.treatment_if_measure_below_lower_bound),
    );
  });

  it('gives the above-bound treatment when a value is over its upper bound', () => {
    renderReport({
      values: { ...inRangeSample(measures), [first.name]: outOfRangeValue(first, 'above') },
    });

    const treatment = screen.getByRole('listitem');

    expect(rowFor(first.label)).toHaveTextContent('ABOVE RANGE');
    expect(treatment).toHaveTextContent(String(first.treatment_if_measure_above_upper_bound));
    expect(treatment).not.toHaveTextContent(String(first.treatment_if_measure_below_lower_bound));
  });

  it('counts and lists a treatment for each failing measure', () => {
    renderReport({
      values: {
        ...inRangeSample(measures),
        [first.name]: outOfRangeValue(first, 'below'),
        [second.name]: outOfRangeValue(second, 'above'),
      },
    });

    expect(screen.getByRole('status')).toHaveTextContent(`2 of ${measures.length} measures`);
    expect(screen.getByRole('heading', { name: 'Recommended treatment' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('passes a value sitting exactly on a bound', () => {
    const onBounds = Object.fromEntries(
      measures.map((measure) => [
        measure.name,
        measure.approved_upper_bound ?? measure.approved_lower_bound ?? 0,
      ]),
    );

    renderReport({ values: onBounds });

    expect(screen.getByRole('status')).toHaveTextContent('Sample approved');
  });

  it('offers a link back to the form', () => {
    renderReport({ values: inRangeSample(measures) });

    expect(screen.getByRole('link', { name: 'Check another sample' })).toBeInTheDocument();
  });

  it('redirects to the form when opened without a sample', () => {
    renderReport(undefined);

    expect(redirectedToForm()).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('redirects to the form when the handed-over state is unusable', () => {
    renderReport({ values: 'nope' });

    expect(redirectedToForm()).toBeInTheDocument();
  });

  it('reports an optional measure that was left blank as not checked', () => {
    renderReport({ values: requiredOnlySample(measures) });

    expect(screen.getByRole('status')).toHaveTextContent('Sample approved');
    for (const measure of optional) {
      expect(rowFor(measure.label)).toHaveTextContent('NOT CHECKED');
    }
  });

  it('counts the not-checked measures separately from the verdict', () => {
    renderReport({ values: requiredOnlySample(measures) });

    const checked = measures.length - optional.length;
    expect(screen.getByRole('status')).toHaveTextContent(
      `All ${checked} measures are within the approved range.`,
    );
    expect(screen.getByRole('status')).toHaveTextContent(`${optional.length} measure`);
    expect(screen.getByRole('status')).toHaveTextContent('not checked');
  });

  it('recommends no treatment for a measure that was simply not checked', () => {
    renderReport({ values: requiredOnlySample(measures) });

    expect(screen.queryByRole('heading', { name: 'Recommended treatment' })).toBeNull();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('shows the sample id, name and date above the verdict', () => {
    renderReport({ values: inRangeSample(measures) });

    expect(detailValue('Sample ID')).toBe(SAMPLE.id);
    expect(detailValue('Sample name')).toBe(SAMPLE.name);
    expect(detailValue('Sampled on')).toBe('9 October 2026');
  });

  it('still renders a report that carries no sample details', () => {
    renderReportState({ values: inRangeSample(measures) });

    expect(redirectedToForm()).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Sample approved');
    expect(detailValue('Sample ID')).toBe('—');
  });

  it('falls back to the raw value when the date cannot be read', () => {
    renderReportState({ values: inRangeSample(measures), sample: { ...SAMPLE, date: 'nonsense' } });

    expect(detailValue('Sampled on')).toBe('nonsense');
  });

  it('flags a measure the sample never recorded instead of passing it', () => {
    const incomplete = Object.fromEntries(
      Object.entries(inRangeSample(measures)).filter(([name]) => name !== first.name),
    );

    renderReport({ values: incomplete });

    expect(screen.getByRole('status')).toHaveTextContent('Sample not approved');
    expect(rowFor(first.label)).toHaveTextContent('NOT RECORDED');
  });
});
