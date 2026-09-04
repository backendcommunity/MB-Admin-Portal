import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders label with success tone classes', () => {
    render(<StatusBadge label="Active" tone="success" />);
    const el = screen.getByText('Active');
    expect(el).toBeInTheDocument();
    // Semantic tokens, not a fixed palette shade — the wash is themed per mode.
    expect(el.className).toMatch(/success/);
  });

  it('maps every tone onto a semantic token rather than a palette colour', () => {
    const tones = ['info', 'success', 'warning', 'danger'] as const;
    tones.forEach((tone) => {
      const { unmount } = render(<StatusBadge label={tone} tone={tone} />);
      expect(screen.getByText(tone).className).toMatch(
        new RegExp(`${tone === 'info' ? 'info' : tone}`),
      );
      unmount();
    });
  });
  it('uses neutral tone by default', () => {
    render(<StatusBadge label="None" />);
    expect(screen.getByText('None').className).toMatch(/muted/);
  });
});
