import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders label with success tone classes', () => {
    render(<StatusBadge label="Active" tone="success" />);
    const el = screen.getByText('Active');
    expect(el).toBeInTheDocument();
    expect(el.className).toMatch(/emerald/);
  });
  it('uses neutral tone by default', () => {
    render(<StatusBadge label="None" />);
    expect(screen.getByText('None').className).toMatch(/muted/);
  });
});
