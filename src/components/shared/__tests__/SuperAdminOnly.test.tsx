/**
 * Visible-but-disabled, not hidden: on a team of three, a control that vanishes
 * reads as a bug and generates a question. A disabled control with a reason
 * answers the question in place.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';

import { SuperAdminOnly } from '../SuperAdminOnly';
import { useAuthStore } from '@/store/authStore';

const asRole = (role: string) => useAuthStore.setState({ userRole: role as never });

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
});
