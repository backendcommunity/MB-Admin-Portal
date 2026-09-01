/**
 * DashboardPage's whole job is picking the right dashboard for the viewer's
 * role. It used to send every non-admin to a permanent "No data yet"
 * placeholder; now INSTRUCTOR gets a real one. This locks in that the admin
 * branch is untouched (still AnalyticsDashboard, and nothing from the
 * instructor view leaks in) and that INSTRUCTOR now gets its own dashboard
 * instead of the placeholder.
 *
 * The two dashboards are stubbed out here — each has its own dedicated test
 * coverage (InstructorDashboard.test.tsx) — so this file only exercises the
 * branch, not either dashboard's internals.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import DashboardPage from '../page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

let mockState: { userRole: string | null; authResolved: boolean };
vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

vi.mock('@/components/analytics/AnalyticsDashboard', () => ({
  default: () => <div data-testid="analytics-dashboard">Analytics dashboard</div>,
}));
vi.mock('@/components/dashboard/InstructorDashboard', () => ({
  default: () => <div data-testid="instructor-dashboard">Instructor dashboard</div>,
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it('gives an ADMIN AnalyticsDashboard and none of the instructor view', () => {
    mockState = { userRole: 'ADMIN', authResolved: true };
    render(<DashboardPage />);

    expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('instructor-dashboard')).not.toBeInTheDocument();
  });

  it('gives a SUPER_ADMIN AnalyticsDashboard and none of the instructor view', () => {
    mockState = { userRole: 'SUPER_ADMIN', authResolved: true };
    render(<DashboardPage />);

    expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('instructor-dashboard')).not.toBeInTheDocument();
  });

  it('gives an INSTRUCTOR the instructor dashboard, not AnalyticsDashboard', () => {
    mockState = { userRole: 'INSTRUCTOR', authResolved: true };
    render(<DashboardPage />);

    expect(screen.getByTestId('instructor-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('analytics-dashboard')).not.toBeInTheDocument();
  });
});
