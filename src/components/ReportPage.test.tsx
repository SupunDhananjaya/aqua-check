import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { measures } from '../config/measures.ts';
import { inRangeSample, outOfRangeValue } from '../test/sampleValues.ts';
import ReportPage from './ReportPage.tsx';

/** The landing route is stubbed so a redirect away from /report is observable. */
function renderReport(state?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: '/report', state }]}>
      <Routes>
        <Route path="/" element={<h2>New water sample</h2>} />
        <Route path="/report" element={<ReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function redirectedToForm() {
  return screen.queryByRole('heading', { name: 'New water sample' });
}

function rowFor(label: string) {
  return screen.getByRole('rowheader', { name: label }).closest('tr');
}

const [first, second] = measures;

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

  it('flags a measure the sample never recorded instead of passing it', () => {
    const incomplete = Object.fromEntries(
      Object.entries(inRangeSample(measures)).filter(([name]) => name !== first.name),
    );

    renderReport({ values: incomplete });

    expect(screen.getByRole('status')).toHaveTextContent('Sample not approved');
    expect(rowFor(first.label)).toHaveTextContent('NOT RECORDED');
  });
});
