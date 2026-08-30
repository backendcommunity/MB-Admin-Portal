/**
 * One number with its label, as the course header uses.
 *
 * The value leads at a size worth glancing at and the label sits under it in
 * small caps, so a row of these reads as a summary rather than a sentence.
 */
export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3.5 py-2">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

/** The row they sit in. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <div className="mb-5 flex flex-wrap gap-3">{children}</div>;
}
