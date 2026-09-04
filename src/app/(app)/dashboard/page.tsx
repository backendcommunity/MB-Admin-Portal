'use client';

import { ProtectedPage } from '@/components/shared/ProtectedPage';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import InstructorDashboard from '@/components/dashboard/InstructorDashboard';
import { useAuthStore } from '@/store/authStore';

export default function DashboardPage() {
  const role = useAuthStore((state) => state.userRole);
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';

  return (
    <ProtectedPage allowedRoles={['SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR']}>
      {isAdmin ? (
        <section className="flex flex-col gap-6">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Overview of platform activity and key KPIs.
            </p>
          </header>
          <AnalyticsDashboard />
        </section>
      ) : (
        <InstructorDashboard />
      )}
    </ProtectedPage>
  );
}
