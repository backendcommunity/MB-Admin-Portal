import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/teams' }));

const useAuthStore = vi.fn();
vi.mock('@/store/authStore', () => ({ useAuthStore: (sel: any) => useAuthStore(sel) }));

import { Sidebar } from '@/components/shared/Sidebar';

const props = {
  collapsed: false,
  onToggleCollapse: () => {},
  mobileOpen: false,
  onClose: () => {},
  approvalsCount: 0,
};

beforeEach(() => useAuthStore.mockReset());

describe('Sidebar grouping', () => {
  it('renders section headings for an admin', () => {
    useAuthStore.mockReturnValue('ADMIN');
    render(<Sidebar {...props} />);
    ['Overview', 'Content', 'People', 'Money', 'System'].forEach((g) =>
      expect(screen.getByText(g)).toBeInTheDocument(),
    );
  });

  it('omits a heading whose entries the role cannot see', () => {
    useAuthStore.mockReturnValue('INSTRUCTOR');
    render(<Sidebar {...props} />);
    expect(screen.queryByText('People')).not.toBeInTheDocument();
    expect(screen.queryByText('System')).not.toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('hides headings when collapsed but keeps the links', () => {
    useAuthStore.mockReturnValue('ADMIN');
    render(<Sidebar {...props} collapsed />);
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /teams/i })).toBeInTheDocument();
  });

  it('renders nothing but the prompt when the role is unresolved', () => {
    useAuthStore.mockReturnValue(null);
    render(<Sidebar {...props} />);
    expect(screen.getByText(/sign in to view navigation/i)).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });
});
