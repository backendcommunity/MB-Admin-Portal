import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CodeArea } from '../CodeArea';

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <CodeArea value={value} onChange={setValue} ariaLabel="Code" />;
}

describe('CodeArea', () => {
  it('turns off the browser prose handling that mangles source', () => {
    render(<Harness />);
    const field = screen.getByLabelText('Code');

    // Autocorrect and autocapitalise rewrite identifiers; smart quotes break
    // string literals; Grammarly edits the value in place.
    expect(field).toHaveAttribute('spellcheck', 'false');
    expect(field).toHaveAttribute('autocorrect', 'off');
    expect(field).toHaveAttribute('autocapitalize', 'off');
    expect(field).toHaveAttribute('data-gramm', 'false');
  });

  it('keeps pasted code byte for byte', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByLabelText('Code') as HTMLTextAreaElement;

    const source = 'def greet(name):\n    print(f"Hello, {name}!")\n\n\nif a < b:\n\tpass';
    await user.click(field);
    await user.paste(source);

    // Indentation, blank runs, tabs, quotes and angle brackets all survive.
    expect(field.value).toBe(source);
  });

  it('indents with Tab instead of leaving the field', async () => {
    const user = userEvent.setup();
    render(<Harness initial="line" />);
    const field = screen.getByLabelText('Code') as HTMLTextAreaElement;

    field.setSelectionRange(4, 4);
    await user.click(field);
    field.setSelectionRange(4, 4);
    await user.keyboard('{Tab}');

    expect(field.value).toBe('line  ');
    expect(field).toHaveFocus();
  });

  it('outdents with Shift+Tab', async () => {
    const user = userEvent.setup();
    render(<Harness initial="  line" />);
    const field = screen.getByLabelText('Code') as HTMLTextAreaElement;

    await user.click(field);
    field.setSelectionRange(2, 2);
    await user.keyboard('{Shift>}{Tab}{/Shift}');

    expect(field.value).toBe('line');
  });

  it('releases focus on Escape, so the field is not a keyboard trap', async () => {
    const user = userEvent.setup();
    render(<Harness initial="x" />);
    const field = screen.getByLabelText('Code');

    await user.click(field);
    expect(field).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(field).not.toHaveFocus();
  });
});
