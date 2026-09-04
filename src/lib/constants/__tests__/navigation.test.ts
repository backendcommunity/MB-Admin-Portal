/**
 * The sidebar is the portal's only statement of what a role can do, so the
 * roles here must match the guards on the API. An entry an instructor can see
 * but cannot use is a support ticket.
 */
import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '../navigation';

const hrefs = NAV_ITEMS.map((i) => i.href);
const forRole = (role: string) =>
  NAV_ITEMS.filter((i) => (i.roles as string[]).includes(role)).map((i) => i.href);

describe('NAV_ITEMS', () => {
  it('no longer lists the two entries that folded into their parents', () => {
    expect(hrefs).not.toContain('/users/flagged');
    expect(hrefs).not.toContain('/bootcamps/assignments');
  });

  it('gives an instructor the six content sections plus their own two', () => {
    expect(forRole('INSTRUCTOR').sort()).toEqual(
      [
        '/dashboard',
        '/courses',
        '/projects',
        '/paths',
        '/bootcamps',
        '/offers',
        '/earnings',
      ].sort(),
    );
  });

  it('no longer lists My Content — the feature was removed outright', () => {
    expect(hrefs).not.toContain('/my-content');
  });

  it('never shows an instructor users, billing or audit logs', () => {
    const banned = ['/users', '/plans', '/subscriptions', '/teams', '/audit-logs', '/settings'];
    expect(forRole('INSTRUCTOR').filter((h) => banned.includes(h))).toEqual([]);
  });

  it('never offers an instructor Mock Interview templates', () => {
    // requireStrictAdmin on all four routes, deliberately: mock interviews
    // were not in the list of things instructors may author. /offers is no
    // longer excluded here — instructors now get full CRUD on their own
    // Ships, and the API is requireAdmin with ownership scoping plus a
    // pricing field-guard.
    expect(forRole('INSTRUCTOR')).not.toContain('/mock-interviews/templates');
  });

  it('gives a super admin everything an admin has', () => {
    const admin = new Set(forRole('ADMIN'));
    expect(forRole('SUPER_ADMIN').filter((h) => !admin.has(h))).toEqual([]);
    expect([...admin].filter((h) => !forRole('SUPER_ADMIN').includes(h))).toEqual([]);
  });

  it('labels the Offers section Ship', () => {
    expect(NAV_ITEMS.find((i) => i.href === '/offers')?.label).toBe('Ship');
  });
});
