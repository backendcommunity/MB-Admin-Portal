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
    // value appears twice: once in desktop <td>, once in mobile card — proves both layouts in DOM
    expect(screen.getAllByText('Ada').length).toBeGreaterThanOrEqual(2);
    // "Email" header renders as desktop <th> AND mobile card <dt> label
    expect(screen.getAllByText('Email').length).toBeGreaterThanOrEqual(2);
  });
});
