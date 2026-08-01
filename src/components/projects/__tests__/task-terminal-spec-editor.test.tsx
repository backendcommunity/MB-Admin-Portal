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

  it('shows an empty-state message and no input fields when stdin is empty', () => {
    render(
      <TaskTerminalSpecEditor value={{ stdin: [], expectedOutput: '' }} onChange={() => {}} />,
    );
    expect(screen.getByText(/no inputs/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/stdin input/i)).not.toBeInTheDocument();
  });

  it('Add input appends a new empty stdin field, as many times as clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <TaskTerminalSpecEditor value={{ stdin: [], expectedOutput: '' }} onChange={onChange} />,
    );

    await user.click(screen.getByRole('button', { name: /add input/i }));
    expect(onChange).toHaveBeenLastCalledWith({ stdin: [''], expectedOutput: '' });

    rerender(
      <TaskTerminalSpecEditor value={{ stdin: [''], expectedOutput: '' }} onChange={onChange} />,
    );
    await user.click(screen.getByRole('button', { name: /add input/i }));
    expect(onChange).toHaveBeenLastCalledWith({ stdin: ['', ''], expectedOutput: '' });
  });

  it('Remove input drops exactly the targeted field, preserving order of the rest', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TaskTerminalSpecEditor
        value={{ stdin: ['first', 'second', 'third'], expectedOutput: '' }}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /remove input 2/i }));
    expect(onChange).toHaveBeenCalledWith({
      stdin: ['first', 'third'],
      expectedOutput: '',
    });
  });

  it('supports N discrete input fields — an instructor can specify any number of required inputs', async () => {
    const onChange = vi.fn();
    render(
      <TaskTerminalSpecEditor
        value={{ stdin: ['a', 'b', 'c', 'd'], expectedOutput: '' }}
        onChange={onChange}
      />,
    );
    expect(screen.getByLabelText('stdin input 1')).toHaveValue('a');
    expect(screen.getByLabelText('stdin input 2')).toHaveValue('b');
    expect(screen.getByLabelText('stdin input 3')).toHaveValue('c');
    expect(screen.getByLabelText('stdin input 4')).toHaveValue('d');
  });
});
