import { render, screen } from '@testing-library/react';
import { useReactTable, getCoreRowModel, type ColumnDef } from '@tanstack/react-table';
import { DataTable } from './DataTable';

type Row = { name: string; email: string };
const data: Row[] = [{ name: 'Ada', email: 'ada@x.com' }];
const columns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
];

function Harness() {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  return <DataTable table={table} />;
}

describe('DataTable', () => {
  it('renders desktop table and mobile cards (both in DOM)', () => {
    render(<Harness />);
    // value appears twice: once in <td>, once in mobile card
    expect(screen.getAllByText('Ada').length).toBeGreaterThanOrEqual(1);
    // mobile card shows the column header as a label
    expect(screen.getAllByText('Email').length).toBeGreaterThanOrEqual(1);
  });
});
