import React from 'react';
import { render, screen } from '@testing-library/react';
import ImportUsersModal from '../ImportUsersModal';

describe('ImportUsersModal', () => {
  it('offers the activation video but disables it while the flow is not live', async () => {
    render(<ImportUsersModal open onOpenChange={() => {}} onImported={() => {}} />);
    const box = await screen.findByRole('checkbox', { name: /activation walkthrough/i });
    expect(box).toBeDisabled();
    expect(screen.getByText(/not available yet/i)).toBeInTheDocument();
  });
});
