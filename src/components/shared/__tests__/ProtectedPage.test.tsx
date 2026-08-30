/**
 * ProtectedPage is the actual permission boundary: it composes useRoleGuard's
 * redirect decision with what gets rendered. The gap this guards against is
 * subtle — `userRole` is `null` both while auth is still resolving AND once
 * it resolves to "no portal role." A guard that can't tell those apart either
 * bounces every legitimate admin to /403 on first paint, or renders
 * protected content to a role-less viewer while it waits. Only
 * `authResolved` distinguishes the two.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ProtectedPage } from '../ProtectedPage';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

let mockState: { userRole: string | null; authResolved: boolean };
vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

describe('ProtectedPage', () => {
  beforeEach(() => {
    replace.mockClear();
  });

  it('does not redirect and does not render children while auth is unresolved', () => {
    mockState = { userRole: null, authResolved: false };

    render(
      <ProtectedPage allowedRoles={['ADMIN']}>
        <div>secret</div>
      </ProtectedPage>,
    );

    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects to /403 once resolved with no role', () => {
    mockState = { userRole: null, authResolved: true };

    render(
      <ProtectedPage allowedRoles={['ADMIN']}>
        <div>secret</div>
      </ProtectedPage>,
    );

    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/403');
  });

  it('redirects to /403 once resolved with a role that is not allowed', () => {
    mockState = { userRole: 'INSTRUCTOR', authResolved: true };

    render(
      <ProtectedPage allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
        <div>secret</div>
      </ProtectedPage>,
    );

    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/403');
  });

  it('renders children and does not redirect once resolved with an allowed role', () => {
    mockState = { userRole: 'ADMIN', authResolved: true };

    render(
      <ProtectedPage allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
        <div>secret</div>
      </ProtectedPage>,
    );

    expect(screen.getByText('secret')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
