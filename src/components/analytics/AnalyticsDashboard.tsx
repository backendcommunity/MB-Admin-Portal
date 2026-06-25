"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Users,
  CreditCard,
  TrendingUp,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCcw,
  Loader2,
} from "lucide-react";

import {
  fetchAnalyticsSummary,
  fetchSignupTrend,
  fetchRevenueBreakdown,
  fetchTopCourses,
  type AnalyticsSummary,
  type SignupDataPoint,
  type RevenuePlanPoint,
  type TopCourse,
  type AnalyticsPeriod,
} from "@/lib/api/analytics";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// ─── Colour palette ───────────────────────────────────────────────────────────
const CHART_COLORS = ["#13AECE", "#0E9AB8", "#0C86A0", "#0A7288", "#085E70"];
const ACCENT = "#13AECE";

// ─── KPI Card ─────────────────────────────────────────────────────────────────
type KpiCardProps = {
  title: string;
  value: string;
  delta: number;
  icon: React.ElementType;
  prefix?: string;
};

function KpiCard({ title, value, delta, icon: Icon, prefix = "" }: KpiCardProps) {
  const isUp = delta > 0;
  const isFlat = delta === 0;

  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-3xl font-bold text-foreground">
          {prefix}
          {value}
        </p>
        <div className="flex items-center gap-1 text-xs font-medium">
          {isFlat ? (
            <Minus className="h-3 w-3 text-muted-foreground" />
          ) : isUp ? (
            <ArrowUpRight className="h-3 w-3 text-emerald-500" />
          ) : (
            <ArrowDownRight className="h-3 w-3 text-red-500" />
          )}
          <span
            className={
              isFlat
                ? "text-muted-foreground"
                : isUp
                ? "text-emerald-600"
                : "text-red-500"
            }
          >
            {isFlat ? "No change" : `${Math.abs(delta)}% vs last 30d`}
          </span>
        </div>
      </div>
    </Card>
  );
}

// ─── Period Selector ──────────────────────────────────────────────────────────
const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
];

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtDate(dateStr: string, period: AnalyticsPeriod): string {
  const d = new Date(dateStr);
  if (period === "7d") return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-foreground mb-3">{children}</h2>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-muted ${className}`} />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [signupData, setSignupData] = useState<SignupDataPoint[]>([]);
  const [revenuePlan, setRevenuePlan] = useState<RevenuePlanPoint[]>([]);
  const [topCourses, setTopCourses] = useState<TopCourse[]>([]);
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [summaryData, signupTrend, revenue, courses] = await Promise.all([
          fetchAnalyticsSummary(),
          fetchSignupTrend(period),
          fetchRevenueBreakdown(period),
          fetchTopCourses(),
        ]);
        setSummary(summaryData);
        setSignupData(signupTrend.data);
        setRevenuePlan(revenue.byPlan);
        setTopCourses(courses.data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load analytics";
        setError(msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [period]
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Card className="p-8 flex flex-col items-center gap-3 text-center">
        <p className="text-red-500 font-medium">{error}</p>
        <Button variant="outline" size="sm" onClick={() => loadAll()}>
          Retry
        </Button>
      </Card>
    );
  }

  // ── KPI values ─────────────────────────────────────────────────────────────
  const kpis = [
    {
      title: "Total Users",
      value: summary ? fmtNum(summary.totalUsers.value) : "—",
      delta: summary?.totalUsers.delta ?? 0,
      icon: Users,
    },
    {
      title: "Active Subscribers",
      value: summary ? fmtNum(summary.activeSubscribers.value) : "—",
      delta: summary?.activeSubscribers.delta ?? 0,
      icon: CreditCard,
    },
    {
      title: "MRR",
      value: summary ? fmtNum(summary.mrr.value) : "—",
      delta: summary?.mrr.delta ?? 0,
      icon: TrendingUp,
      prefix: "$",
    },
    {
      title: "Courses Enrolled",
      value: summary ? fmtNum(summary.coursesEnrolled.value) : "—",
      delta: summary?.coursesEnrolled.delta ?? 0,
      icon: BookOpen,
    },
  ];

  const maxEnrollments = Math.max(...topCourses.map((c) => c.enrollments), 1);

  return (
    <div className="space-y-8">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div />
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            {PERIODS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setPeriod(value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAll(true)}
            disabled={refreshing}
            className="gap-1.5"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw className="h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) =>
          loading ? (
            <Skeleton key={kpi.title} className="h-32" />
          ) : (
            <KpiCard key={kpi.title} {...kpi} />
          )
        )}
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signup Trend */}
        <Card className="p-5">
          <SectionTitle>Signup Trend</SectionTitle>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : signupData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">
              No signup data for this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <BarChart data={signupData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => fmtDate(d, period)}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval={period === "7d" ? 0 : period === "30d" ? 4 : 13}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => [Number(v), "Signups"]}
                  labelFormatter={(l) => fmtDate(l, period)}
                />
                <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Revenue by Plan */}
        <Card className="p-5">
          <SectionTitle>Revenue by Plan</SectionTitle>
          {loading ? (
            <Skeleton className="h-56 w-full" />
          ) : revenuePlan.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">
              No revenue data for this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <BarChart data={revenuePlan} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="plan"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${fmtNum(v)}`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, "Revenue"]}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {revenuePlan.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Top Courses ─────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <SectionTitle>Top Courses by Enrollment</SectionTitle>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : topCourses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No enrollment data available.</p>
        ) : (
          <div className="space-y-3">
            {topCourses.map((course, i) => {
              const pct = Math.round((course.enrollments / maxEnrollments) * 100);
              return (
                <div key={course.courseId} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm font-medium text-foreground truncate">
                      {course.title}
                    </p>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground w-14 text-right">
                    {fmtNum(course.enrollments)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
