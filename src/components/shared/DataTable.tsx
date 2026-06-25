'use client';
import { Fragment, type ReactNode } from 'react';
import { flexRender, type Row, type Table as TanstackTable } from '@tanstack/react-table';

export function DataTable<TData>({
  table,
  mobileTitle,
}: {
  table: TanstackTable<TData>;
  mobileTitle?: (row: Row<TData>) => ReactNode;
}) {
  const rows = table.getRowModel().rows;

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead className="border-b bg-muted">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-semibold text-foreground"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-2"
                        style={{ cursor: header.column.getCanSort() ? 'pointer' : undefined }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-xs text-muted-foreground">
                          {header.column.getIsSorted() === 'asc'
                            ? '↑'
                            : header.column.getIsSorted() === 'desc'
                              ? '↓'
                              : ''}
                        </span>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b transition-colors hover:bg-muted/50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-foreground">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: each row is a card. First data column is the card heading (not
          repeated as a labeled row); the rest render as a compact label/value grid;
          the actions menu floats in the top-right. */}
      <div className="space-y-3 md:hidden">
        {rows.map((row) => {
          const cells = row.getVisibleCells();
          const actionCell = cells.find((c) => c.column.id === 'actions');
          const dataCells = cells.filter(
            (c) => c.column.id !== 'actions' && c.column.id !== 'select',
          );
          const [headCell, ...bodyCells] = dataCells;
          return (
            <div
              key={row.id}
              className="relative rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              {actionCell ? (
                <div className="absolute right-1.5 top-2.5">
                  {flexRender(actionCell.column.columnDef.cell, actionCell.getContext())}
                </div>
              ) : null}
              {headCell ? (
                <div className="mb-2.5 pr-8 text-base font-semibold leading-tight text-foreground">
                  {mobileTitle
                    ? mobileTitle(row)
                    : flexRender(headCell.column.columnDef.cell, headCell.getContext())}
                </div>
              ) : null}
              <dl className="grid grid-cols-[minmax(4.5rem,auto)_1fr] gap-x-3 gap-y-2 text-sm">
                {bodyCells.map((cell) => (
                  <Fragment key={cell.id}>
                    <dt className="truncate text-muted-foreground">
                      {/* `as never`: render the column header as the mobile label. flexRender ignores
                          the context for string headers (the data-column case); render-fn headers that
                          read HeaderContext-only fields are not used as data columns here. */}
                      {flexRender(cell.column.columnDef.header, cell.getContext() as never)}
                    </dt>
                    <dd className="min-w-0 break-words text-right font-medium text-foreground">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
    </>
  );
}
