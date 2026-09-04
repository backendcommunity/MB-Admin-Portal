/**
 * The sidebar and the page gate are two independent role lists, and nothing
 * used to tie them together.
 *
 * That shipped a real bug: `navigation.ts` was updated to give INSTRUCTOR
 * Courses, Bootcamps, Projects, Paths and Ship, but every one of those pages
 * still wrapped itself in `<ProtectedPage allowedRoles={['SUPER_ADMIN',
 * 'ADMIN']}>`. An instructor saw five sidebar entries that all redirected to
 * /403. The nav test passed — it only ever checked the nav.
 *
 * So this test reads the two lists off disk and asserts they agree: a role that
 * is offered a nav entry can open the page behind it, and a role that can open
 * a page is offered its entry. Neither list may move alone again.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { NAV_ITEMS } from '../navigation';

const APP_DIR = join(__dirname, '..', '..', '..', 'app', '(app)');

/**
 * Hrefs whose page deliberately has no gate. Each one is a redirect stub kept
 * so an old bookmark still lands somewhere useful — it renders nothing, so
 * there is nothing to protect. Counted, so a page cannot lose its gate and be
 * waved through as "probably a redirect".
 */
const REDIRECT_STUBS: Record<string, string> = {};
const REDIRECT_STUB_COUNT = 0;

function pageFor(href: string) {
  return join(APP_DIR, href.replace(/^\//, ''), 'page.tsx');
}

/** The `allowedRoles={[...]}` array, read out of the page source. */
function gateFor(href: string): { kind: 'gated'; roles: string[] } | { kind: 'redirect' } {
  const file = pageFor(href);
  if (!existsSync(file)) {
    throw new Error(`No page file for nav href ${href} — expected ${file}`);
  }
  const src = readFileSync(file, 'utf8');

  const match = src.match(/allowedRoles=\{\[([^\]]*)\]\}/);
  if (!match) {
    // A page with no gate is only acceptable if it renders nothing at all.
    if (/\bredirect\(/.test(src)) return { kind: 'redirect' };
    throw new Error(`${href} has neither an allowedRoles gate nor a redirect — it renders ungated`);
  }

  const roles = [...match[1].matchAll(/['"]([A-Z_]+)['"]/g)].map((m) => m[1]);
  if (roles.length === 0) {
    throw new Error(`${href} has an allowedRoles array this test could not parse`);
  }
  return { kind: 'gated', roles };
}

describe('the sidebar and the page gates agree', () => {
  it('finds a page for every nav entry — a scan that resolves nothing must not pass', () => {
    const resolved = NAV_ITEMS.filter((item) => existsSync(pageFor(item.href)));
    expect(resolved).toHaveLength(NAV_ITEMS.length);
    expect(NAV_ITEMS.length).toBeGreaterThan(10);
  });

  it.each(NAV_ITEMS.map((item) => [item.href, item.label] as const))(
    '%s (%s) admits exactly the roles its nav entry offers',
    (href) => {
      const item = NAV_ITEMS.find((i) => i.href === href)!;
      const gate = gateFor(href);

      if (gate.kind === 'redirect') {
        expect(Object.keys(REDIRECT_STUBS)).toContain(href);
        return;
      }

      expect([...gate.roles].sort()).toEqual([...(item.roles as string[])].sort());
    },
  );

  it('keeps the redirect-stub exemption list honest', () => {
    const live = new Set(NAV_ITEMS.map((i) => i.href));
    expect(Object.keys(REDIRECT_STUBS).filter((h) => !live.has(h))).toEqual([]);
    expect(Object.keys(REDIRECT_STUBS)).toHaveLength(REDIRECT_STUB_COUNT);
  });

  it('gives an instructor the five content sections that prompted this test', () => {
    // The exact regression: these were in the sidebar and 403'd on open.
    for (const href of ['/courses', '/bootcamps', '/projects', '/paths', '/offers']) {
      const gate = gateFor(href);
      expect(gate.kind).toBe('gated');
      expect((gate as { roles: string[] }).roles).toContain('INSTRUCTOR');
    }
  });
});
