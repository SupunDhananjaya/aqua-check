import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Counter from './Counter.tsx';

describe('Counter', () => {
  it('starts at zero', () => {
    render(<Counter />);
    expect(screen.getByRole('status')).toHaveTextContent('Count: 0');
  });

  it('increments on click', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    await user.click(screen.getByRole('button', { name: 'Increment' }));
    expect(screen.getByRole('status')).toHaveTextContent('Count: 1');

    await user.click(screen.getByRole('button', { name: 'Increment' }));
    expect(screen.getByRole('status')).toHaveTextContent('Count: 2');
  });
});
