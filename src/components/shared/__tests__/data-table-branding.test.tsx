/**
 * The table chrome the whole portal shares.
 *
 * Column labels are small-caps and muted, and count columns right-align so a
 * column of numbers is comparable at a glance. Both are easy to lose in a
 * refactor and neither shows up in a type error, so they are pinned here.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table';

import { DataTable } from '../DataTable';

type Row = { name: string; cohorts: number };

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Bootcamp' },
  { accessorKey: 'cohorts', header: 'Cohorts', meta: { align: 'right' } },
];

function Harness() {
  const table = useReactTable({
    data: [{ name: 'Node.js Backend', cohorts: 2 }],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  return <DataTable table={table} />;
}

describe('shared table chrome', () => {
  it('sets column labels in muted small caps', () => {
    render(<Harness />);
    const th = screen
      .getAllByText('Bootcamp')
      .find((node) => node.closest('th'))
      ?.closest('th');

    expect(th?.className).toContain('uppercase');
    expect(th?.className).toContain('text-muted-foreground');
    // Not the body text size — a column label is smaller than its cells.
    expect(th?.className).toContain('text-[11px]');
  });

  it('right-aligns a column asked to align right, header and cells together', () => {
    render(<Harness />);
    const th = screen
      .getAllByText('Cohorts')
      .find((n) => n.closest('th'))
      ?.closest('th');
    expect(th?.className).toContain('text-right');

    const td = screen
      .getAllByText('2')
      .find((n) => n.closest('td'))
      ?.closest('td');
    expect(td?.className).toContain('text-right');
  });

  it('leaves an ordinary column alone', () => {
    render(<Harness />);
    const th = screen
      .getAllByText('Bootcamp')
      .find((n) => n.closest('th'))
      ?.closest('th');
    expect(th?.className).toContain('text-left');
    expect(th?.className).not.toContain('text-right');
  });
});
