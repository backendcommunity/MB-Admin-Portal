/**
 * This function used to return SUPER_ADMIN for anything it did not recognise —
 * including `USER`, and including `undefined`. The server still refused the
 * requests, but the portal rendered every super-admin control to whoever got
 * that far. A permission mapper must fail closed.
 */
import { describe, it, expect } from 'vitest';
import { mapAcademyRoleToPortalRole } from '../roleMapping';

describe('mapAcademyRoleToPortalRole', () => {
  it.each([
    ['SUPER_ADMIN', 'SUPER_ADMIN'],
    ['ADMIN', 'ADMIN'],
    ['INSTRUCTOR', 'INSTRUCTOR'],
  ])('maps %s to %s', (input, expected) => {
    expect(mapAcademyRoleToPortalRole(input)).toBe(expected);
  });

  it.each([['USER'], ['CURATOR'], [''], [undefined]])('gives %s no portal role at all', (input) => {
    expect(mapAcademyRoleToPortalRole(input as string | undefined)).toBeNull();
  });
});
