import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RubricEditor } from '@/components/mock-interviews/fields/RubricEditor';

const rows = [
  { criterion: 'Accuracy', weight: 40, description: '' },
  { criterion: 'Communication', weight: 30, description: '' },
];

describe('RubricEditor', () => {
  it('shows the running total without demanding it equal 100', () => {
    render(<RubricEditor value={rows} onChange={() => {}} />);
    expect(screen.getByTestId('rubric-total')).toHaveTextContent('70');
    // Under 100 is valid — the server normalises by the sum.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('flags a weight of zero — the create/update endpoint requires >= 1', () => {
    render(
      <RubricEditor
        value={[{ criterion: 'Fake', weight: 0, description: '' }]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/greater than zero/i);
  });

  it("flags a weight of 0.5 — clears the importer's >0 discard rule but still fails the endpoint's >= 1 minimum", () => {
    render(
      <RubricEditor
        value={[{ criterion: 'Fake', weight: 0.5, description: '' }]}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('accepts a weight of 1.5 — the server uses .number().min(1), not .integer()', () => {
    render(
      <RubricEditor
        value={[{ criterion: 'Real', weight: 1.5, description: '' }]}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('adds a criterion', () => {
    const onChange = vi.fn();
    render(<RubricEditor value={rows} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /add criterion/i }));
    expect(onChange).toHaveBeenCalledWith([
      ...rows,
      { criterion: '', weight: 10, description: '' },
    ]);
  });

  it('removes a criterion', () => {
    const onChange = vi.fn();
    render(<RubricEditor value={rows} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /remove accuracy/i }));
    expect(onChange).toHaveBeenCalledWith([rows[1]]);
  });

  it('applies the standard three', () => {
    const onChange = vi.fn();
    render(<RubricEditor value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /standard three/i }));
    const applied = onChange.mock.calls[0][0];
    expect(applied).toHaveLength(3);
    expect(applied.reduce((n: number, r: any) => n + r.weight, 0)).toBe(100);
  });

  it('says what an empty rubric costs', () => {
    render(<RubricEditor value={[]} onChange={() => {}} />);
    expect(screen.getByText(/no rubric/i)).toBeInTheDocument();
  });

  it('renders read-only when disabled', () => {
    render(<RubricEditor value={rows} onChange={() => {}} disabled />);
    expect(screen.getByRole('button', { name: /add criterion/i })).toBeDisabled();
  });
});
