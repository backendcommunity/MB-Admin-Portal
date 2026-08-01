import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TaskTerminalSpecEditor from '../TaskTerminalSpecEditor';

describe('TaskTerminalSpecEditor', () => {
  it('renders the stdin lines and expected output for the given test case', () => {
    render(
      <TaskTerminalSpecEditor
        value={{ stdin: ['Solomon'], expectedOutput: 'Hello, Solomon!\n' }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByDisplayValue('Solomon')).toBeInTheDocument();
    // Trailing newline must be preserved exactly, so disable testing-library's
    // default whitespace-collapsing normalizer for this assertion.
    expect(
      screen.getByDisplayValue('Hello, Solomon!\n', { normalizer: (text) => text }),
    ).toBeInTheDocument();
  });

  it('editing stdin calls onChange with the updated single object, not an array', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TaskTerminalSpecEditor
        value={{ stdin: ['Solomon'], expectedOutput: 'Hello, Solomon!' }}
        onChange={onChange}
      />,
    );
    await user.type(screen.getByLabelText(/stdin/i), '!');
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(Array.isArray(lastCall)).toBe(false);
    expect(lastCall).toEqual({ stdin: ['Solomon!'], expectedOutput: 'Hello, Solomon!' });
  });

  it('editing expected output calls onChange with the updated single object, not an array', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TaskTerminalSpecEditor
        value={{ stdin: ['Solomon'], expectedOutput: 'Hi' }}
        onChange={onChange}
      />,
    );
    await user.type(screen.getByLabelText(/expected output/i), '!');
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(Array.isArray(lastCall)).toBe(false);
    expect(lastCall).toEqual({ stdin: ['Solomon'], expectedOutput: 'Hi!' });
  });
});
