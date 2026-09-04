/**
 * Visible-but-disabled, not hidden: on a team of three, a control that vanishes
 * reads as a bug and generates a question. A disabled control with a reason
 * answers the question in place.
 *
 * `userRole` persists to localStorage across sessions; `authResolved` never
 * does and always starts `false`. Setting a role without also resolving auth
 * is not a realistic state on its own — real callers set both together, once
 * the session check lands — except for the one case that matters here: a
 * stale cached role sitting in localStorage from a previous session, read
 * back before this page's own session check has run. That is exactly the
 * shape a shared machine or a role change leaves behind, and it's the case
 * the fourth test below covers.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

import { SuperAdminOnly } from '../SuperAdminOnly';
import { useAuthStore } from '@/store/authStore';

const asRole = (role: string, authResolved = true) =>
  useAuthStore.setState({ userRole: role as never, authResolved });

describe('SuperAdminOnly', () => {
  it('leaves the control alone for a super admin', () => {
    asRole('SUPER_ADMIN');
    render(
      <SuperAdminOnly>
        <button>Delete user</button>
      </SuperAdminOnly>,
    );
    expect(screen.getByRole('button', { name: 'Delete user' })).toBeEnabled();
  });

  it('disables it for an admin', () => {
    asRole('ADMIN');
    render(
      <SuperAdminOnly>
        <button>Delete user</button>
      </SuperAdminOnly>,
    );
    expect(screen.getByRole('button', { name: 'Delete user' })).toBeDisabled();
  });

  it('says why, rather than leaving a dead button', () => {
    asRole('ADMIN');
    render(
      <SuperAdminOnly>
        <button>Delete user</button>
      </SuperAdminOnly>,
    );
    expect(screen.getByText(/super admin only/i)).toBeInTheDocument();
  });

  it('disables it for a stale cached SUPER_ADMIN while auth is still unresolved', () => {
    // userRole survives a reload via localStorage; authResolved never does and
    // starts false every time. A stale role sitting in the store before this
    // session's own check has confirmed anything must not enable the control.
    asRole('SUPER_ADMIN', false);
    render(
      <SuperAdminOnly>
        <button>Delete user</button>
      </SuperAdminOnly>,
    );
    expect(screen.getByRole('button', { name: 'Delete user' })).toBeDisabled();
  });
});
