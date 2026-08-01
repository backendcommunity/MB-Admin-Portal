import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import TaskTerminalSpecEditor from '../TaskTerminalSpecEditor';

describe('TaskTerminalSpecEditor', () => {
  it('renders one row per existing test case with stdin lines and expected output', () => {
    render(
      <TaskTerminalSpecEditor
        value={[{ stdin: ['Solomon'], expectedOutput: 'Hello, Solomon!\n' }]}
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

  it('Add case appends a new empty row via onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TaskTerminalSpecEditor value={[]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /add test case/i }));
    expect(onChange).toHaveBeenCalledWith([{ stdin: [''], expectedOutput: '' }]);
  });

  it('Remove case drops that row via onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TaskTerminalSpecEditor
        value={[
          { stdin: ['a'], expectedOutput: '1' },
          { stdin: ['b'], expectedOutput: '2' },
        ]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    expect(onChange).toHaveBeenCalledWith([{ stdin: ['b'], expectedOutput: '2' }]);
  });
});
