import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import App from './App.tsx';
import { appName, measures, standard } from './config/measures.ts';
import { formatSampleDate, todayIso } from './lib/sampleDetails.ts';
import { inRangeValue, outOfRangeValue } from './test/sampleValues.ts';

function renderApp(path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

const SAMPLE_ID = 'WW-2026-0417';
const SAMPLE_NAME = 'Outfall 2 grab';

/** Fills the whole form, optionally overriding one measure's value. */
async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Record<string, number> = {},
) {
  await user.type(screen.getByRole('textbox', { name: 'Sample ID' }), SAMPLE_ID);
  await user.type(screen.getByRole('textbox', { name: 'Sample name' }), SAMPLE_NAME);

  for (const measure of measures) {
    await user.type(
      screen.getByRole('spinbutton', { name: measure.label }),
      String(overrides[measure.name] ?? inRangeValue(measure)),
    );
  }
  await user.click(screen.getByRole('button', { name: 'Check water quality' }));
}

describe('App', () => {
  it('renders the form on the landing route', () => {
    renderApp();

    expect(screen.getByRole('heading', { name: 'New water sample' })).toBeInTheDocument();
  });

  it('takes its name and standard from the configuration', () => {
    renderApp();

    expect(screen.getByRole('heading', { level: 1, name: appName })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toHaveTextContent(String(standard));
  });

  it('sends an unknown route back to the form', () => {
    renderApp('/not-a-page');

    expect(screen.getByRole('heading', { name: 'New water sample' })).toBeInTheDocument();
  });

  it('checks an in-range sample and reports it as approved', async () => {
    const user = userEvent.setup();
    renderApp();

    await fillForm(user);

    expect(screen.getByRole('status')).toHaveTextContent('Sample approved');
    expect(screen.queryByRole('heading', { name: 'Recommended treatment' })).toBeNull();
  });

  it('checks an out-of-range sample and reports the treatment to apply', async () => {
    const user = userEvent.setup();
    renderApp();
    const [first] = measures;

    await fillForm(user, { [first.name]: outOfRangeValue(first, 'above') });

    expect(screen.getByRole('status')).toHaveTextContent('Sample not approved');
    expect(screen.getByRole('heading', { name: 'Recommended treatment' })).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent(
      String(first.treatment_if_measure_above_upper_bound),
    );
  });

  it('carries the sample details through to the report', async () => {
    const user = userEvent.setup();
    renderApp();

    await fillForm(user);

    const values = screen.getAllByRole('definition').map((node) => node.textContent);
    expect(values).toContain(SAMPLE_ID);
    expect(values).toContain(SAMPLE_NAME);
    expect(values).toContain(formatSampleDate(todayIso()));
  });

  it('returns to an empty form from the report', async () => {
    const user = userEvent.setup();
    renderApp();

    await fillForm(user);
    await user.click(screen.getByRole('link', { name: 'Check another sample' }));

    expect(screen.getByRole('heading', { name: 'New water sample' })).toBeInTheDocument();
    for (const input of screen.getAllByRole('spinbutton')) {
      expect(input).toHaveValue(null);
    }
  });
});
