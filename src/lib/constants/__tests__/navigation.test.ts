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

  it('gives an instructor the seven content sections plus their own two', () => {
    expect(forRole('INSTRUCTOR').sort()).toEqual(
      [
        '/dashboard',
        '/courses',
        '/projects',
        '/paths',
        '/bootcamps',
        '/mock-interviews',
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

  it('now offers an instructor Mock Interviews, not the old templates path', () => {
    // This SUPERSEDES the ruling this section used to record (commit
    // 60c22a0, "fix(nav): stop offering INSTRUCTOR sections the API
    // refuses"), quoted verbatim so overturning it leaves a trace instead of
    // vanishing without a record of what was decided before:
    //
    //   "Ship (/offers) and Mock Interview templates are requireStrictAdmin
    //   on every route because pricing (amount, paddle_price_id) and
    //   template fields have no field-level guard yet, so an instructor got
    //   a 403 on every request after clicking them."
    //
    // That ruling's stated premise no longer holds: template fields now have
    // a field-level guard (a Joi validator plus a publish gate), and the
    // product owner has since chosen instructor own-row CRUD for this
    // section. The nav points at the new `/mock-interviews` section — the
    // old `/mock-interviews/templates` path is a redirect now, not a
    // destination.
    expect(forRole('INSTRUCTOR')).toContain('/mock-interviews');
    expect(hrefs).not.toContain('/mock-interviews/templates');
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
