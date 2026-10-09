import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { measures } from '../config/measures.ts';
import { todayIso } from '../lib/sampleDetails.ts';
import { inRangeValue } from '../test/sampleValues.ts';
import LandingPage from './LandingPage.tsx';

/** The report route is stubbed so arriving there is observable. */
function renderLandingPage() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/report" element={<h2>Sample report</h2>} />
      </Routes>
    </MemoryRouter>,
  );
}

function submitButton() {
  return screen.getByRole('button', { name: 'Check water quality' });
}

function arrivedAtReport() {
  return screen.queryByRole('heading', { name: 'Sample report' });
}

const required = measures.filter((measure) => measure.required);
const optional = measures.filter((measure) => !measure.required);

/**
 * Fills the identifying details. The date is left alone: it is pre-filled with
 * today, and a date input cannot be driven with `user.type` — jsdom runs the
 * value-sanitisation algorithm on every keystroke, so a partial value is
 * discarded and typing character-by-character ends up empty.
 */
async function fillSampleDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: 'Sample ID' }), 'WW-2026-0417');
  await user.type(screen.getByRole('textbox', { name: 'Sample name' }), 'Outfall 2 grab');
}

/** Fills every measure the form insists on, leaving the optional ones blank. */
async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  for (const measure of required) {
    await user.type(
      screen.getByRole('spinbutton', { name: measure.label }),
      String(inRangeValue(measure)),
    );
  }
}

describe('LandingPage', () => {
  it('renders one input per configured measure', () => {
    renderLandingPage();

    expect(screen.getAllByRole('spinbutton')).toHaveLength(measures.length);
    for (const measure of measures) {
      expect(screen.getByRole('spinbutton', { name: measure.label })).toBeInTheDocument();
    }
  });

  it('describes each input with its unit, approved range and description', () => {
    renderLandingPage();
    const [first] = measures;

    const input = screen.getByRole('spinbutton', { name: first.label });
    expect(input).toHaveAccessibleDescription(expect.stringContaining(first.description));
    expect(input).toHaveAccessibleDescription(expect.stringContaining(first.unit));
  });

  it('blocks submission and flags every field when the form is empty', async () => {
    const user = userEvent.setup();
    renderLandingPage();

    await user.click(submitButton());

    // One per required measure, plus the sample ID and name, plus the
    // whole-form "enter at least one" message. The date is never blank.
    expect(screen.getAllByRole('alert')).toHaveLength(required.length + 3);
    expect(arrivedAtReport()).toBeNull();
  });

  it('flags only the fields still missing a value', async () => {
    const user = userEvent.setup();
    renderLandingPage();
    const [first] = measures;

    await user.type(
      screen.getByRole('spinbutton', { name: first.label }),
      String(inRangeValue(first)),
    );
    await user.click(submitButton());

    // The remaining measures, plus the still-blank sample ID and name.
    expect(screen.getAllByRole('alert')).toHaveLength(required.length + 1);
    expect(arrivedAtReport()).toBeNull();
  });

  it('clears a field message as soon as that field is edited', async () => {
    const user = userEvent.setup();
    renderLandingPage();
    const [first] = measures;

    await user.click(submitButton());
    expect(screen.getAllByRole('alert')).toHaveLength(required.length + 3);

    await user.type(screen.getByRole('spinbutton', { name: first.label }), '7');

    expect(screen.getAllByRole('alert')).toHaveLength(required.length + 1);
    expect(screen.getByRole('spinbutton', { name: first.label })).toBeValid();
  });

  it('does not treat an out-of-range value as a form error', async () => {
    const user = userEvent.setup();
    renderLandingPage();

    await fillSampleDetails(user);
    for (const measure of measures) {
      const value =
        measure === measures[0] && measure.approved_upper_bound !== null
          ? measure.approved_upper_bound + 100
          : inRangeValue(measure);
      await user.type(screen.getByRole('spinbutton', { name: measure.label }), String(value));
    }
    await user.click(submitButton());

    expect(arrivedAtReport()).toBeInTheDocument();
  });

  it('defaults the sampling date to today and refuses a later one', () => {
    renderLandingPage();

    // A date input has no ARIA role, so it is queried by its label instead.
    const date = screen.getByLabelText('Sampled on');
    expect(date).toHaveValue(todayIso());
    expect(date).toHaveAttribute('max', todayIso());
  });

  it('blocks submission when the sample ID is blank', async () => {
    const user = userEvent.setup();
    renderLandingPage();

    await user.type(screen.getByRole('textbox', { name: 'Sample name' }), 'Outfall 2 grab');
    await fillRequired(user);
    await user.click(submitButton());

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a sample ID.');
    expect(arrivedAtReport()).toBeNull();
  });

  it('blocks submission when the sample name is blank', async () => {
    const user = userEvent.setup();
    renderLandingPage();

    await user.type(screen.getByRole('textbox', { name: 'Sample ID' }), 'WW-2026-0417');
    await fillRequired(user);
    await user.click(submitButton());

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a sample name.');
    expect(arrivedAtReport()).toBeNull();
  });

  it('marks an optional measure in its description rather than its label', () => {
    renderLandingPage();
    const [measure] = optional;

    // The label must stay exactly the measure name, or the accessible name breaks.
    const input = screen.getByRole('spinbutton', { name: measure.label });
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Optional'));
  });

  it('submits with the optional measures left blank', async () => {
    const user = userEvent.setup();
    renderLandingPage();

    await fillSampleDetails(user);
    await fillRequired(user);
    await user.click(submitButton());

    expect(arrivedAtReport()).toBeInTheDocument();
  });

  it('navigates to the report once every field holds a number', async () => {
    const user = userEvent.setup();
    renderLandingPage();

    await fillSampleDetails(user);
    for (const measure of measures) {
      await user.type(
        screen.getByRole('spinbutton', { name: measure.label }),
        String(inRangeValue(measure)),
      );
    }
    await user.click(submitButton());

    expect(arrivedAtReport()).toBeInTheDocument();
  });
});
