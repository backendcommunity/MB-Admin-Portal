'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { TeamReportBucket } from '@/lib/api/teams';

/**
 * The two things a completion can be, in fixed order. Colour follows the
 * SERIES, never its rank or its size — swapping the order of these two must
 * never repaint them. Both are design-system tokens rather than literals so
 * light and dark each get their own validated step (see `--chart-*` in
 * `globals.css`); the pair separates by ΔE 23.7 (light) / 17.6 (dark) to
 * normal vision and clears the ΔE 8 bar under deuteranopia and tritanopia.
 *
 * `activeMembers` is deliberately NOT plotted beside these: it is a
 * population, not a count of events, and putting it on the same axis would
 * compare unlike units while a second axis would let either series be scaled
 * to tell any story you like. It stays a stat tile, a tooltip line, and a
 * column of the table view.
 */
const SERIES: { key: 'coursesFinished' | 'pathsFinished'; label: string; color: string }[] = [
  { key: 'coursesFinished', label: 'Courses finished', color: 'var(--chart-1)' },
  { key: 'pathsFinished', label: 'Paths finished', color: 'var(--chart-4)' },
];

/**
 * Buckets arrive as ISO dates. A weekly bucket is a week COMMENCING, so it
 * keeps its day; a monthly one would read as a misleadingly precise "1st".
 */
function bucketLabel(iso: string, period: 'week' | 'month'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    ...(period === 'week' ? { day: 'numeric' } : { year: '2-digit' }),
  });
}

/**
 * Hover detail for one bucket. Hand-rolled rather than left to recharts'
 * default because it carries a row the chart does not plot — active members —
 * which is the context that makes a completions count mean anything, and
 * because the label text stays on ink tokens with the colour carried by a
 * swatch beside it, never by the text itself.
 */
function BucketTooltip({
  active,
  payload,
  period,
}: {
  active?: boolean;
  payload?: { payload: TeamReportBucket }[];
  period: 'week' | 'month';
}) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;
  const total = bucket.coursesFinished + bucket.pathsFinished;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-semibold text-foreground">
        {period === 'week' ? 'Week of ' : ''}
        {bucketLabel(bucket.bucket, period)}
      </p>
      <ul className="space-y-1">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: series.color }}
            />
            <span className="text-muted-foreground">{series.label}</span>
            <span className="ml-auto font-medium tabular-nums text-foreground">
              {bucket[series.key]}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex items-center gap-4 border-t border-border pt-1.5 text-muted-foreground">
        <span>{total} total</span>
        <span className="ml-auto">{bucket.activeMembers} active</span>
      </div>
    </div>
  );
}

/**
 * A stacked segment whose TOP corners round only when nothing sits above it
 * in that particular bar.
 *
 * `<Bar radius>` is per-series, not per-bar, so rounding the top series alone
 * leaves a square top on every bucket where that series happens to be zero —
 * a week with courses but no paths finished would read as a different, blunter
 * kind of bar than its neighbours. Rounding both series instead puts a stray
 * curve mid-stack. So the decision is made per datum: round the topmost
 * segment that actually has height, and leave the rest square.
 */
function stackedSegment(index: number) {
  function StackedSegment(props: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    payload?: TeamReportBucket;
  }) {
    const { x = 0, y = 0, width = 0, height = 0, fill, stroke, strokeWidth, payload } = props;
    if (height <= 0 || width <= 0) return null;

    const covered = SERIES.slice(index + 1).some((s) => (payload?.[s.key] ?? 0) > 0);
    const r = covered ? 0 : Math.min(4, width / 2, height);
    const d = r
      ? `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
      : `M${x},${y} h${width} v${height} h${-width} Z`;

    return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  }
  return StackedSegment;
}

/**
 * The completions series as a stacked bar per bucket. Split out of
 * `ReportsTab` so it can be rendered on its own — with static data, outside a
 * query client and outside the admin auth shell — which is the only practical
 * way to actually LOOK at a chart whose container has no width under jsdom.
 */
export function CompletionsChart({
  series,
  period,
  height = 260,
}: {
  series: TeamReportBucket[];
  period: 'week' | 'month';
  height?: number;
}) {
  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        Courses and paths finished per {period}, stacked. Switch to the table view for the exact
        figures.
      </figcaption>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={series} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="bucket"
            tickFormatter={(bucket) => bucketLabel(bucket, period)}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            minTickGap={8}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', fillOpacity: 0.4 }}
            content={<BucketTooltip period={period} />}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="square"
            iconSize={9}
            formatter={(label) => <span className="text-xs text-muted-foreground">{label}</span>}
          />
          {SERIES.map((s, index) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="completions"
              fill={s.color}
              maxBarSize={36}
              // A 2px ring in the surface colour separates the two stacked
              // segments, so a short one still reads as its own block rather
              // than bleeding into its neighbour.
              stroke="var(--card)"
              strokeWidth={2}
              // No grow-in animation: this is a figure an operator reads, not
              // an entrance. It also means the bars are correct the instant
              // the range switches, rather than sweeping up to the new values.
              isAnimationActive={false}
              // recharts types `shape` against its own internal bar props,
              // which do not carry our datum — the cast is only about that
              // payload type, the geometry props are exactly as declared.
              shape={stackedSegment(index) as never}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

export default CompletionsChart;
