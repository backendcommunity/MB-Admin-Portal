/**
 * A JSON roster that exercises the paths of the importer that aren't the
 * happy one — the same idea as `lib/projects/sample.ts`. It is meant to be
 * clicked and read, not just imported, so do not "clean up" the rows below:
 *
 * - Ada Lovelace / Grace Hopper: two ordinary rows, both fields present.
 * - Priya (no `name` field): the row that has no name at all. The client
 *   preview derives one just to show something ("derived" note/badge), but
 *   it is the SERVER's derivation (`deriveNameFromEmail`) that actually gets
 *   stored, along with `nameWasDerived` / `nameIsProvisional` — the flag
 *   that forces this person to fix their name at first sign-in. This is the
 *   least discoverable behaviour in the feature, so the sample always
 *   carries a row that triggers it.
 * - "ADA@EXAMPLE.COM": the same address as row 1, differing only in case.
 *   Emails are lower-cased before de-duplicating, so this proves
 *   first-occurrence-wins rather than silently double-counting Ada.
 * - "frank[at]example.com": not a real email shape. It proves a single bad
 *   row is skipped with a reason in the preview rather than failing the
 *   whole batch.
 *
 * Every address uses @example.com — IANA-reserved for documentation and
 * accepted by the server's Joi `.email()` validator. Never swap these for
 * `.test`/`.local`/`.invalid` addresses (those fail server-side validation)
 * or for any real person's address.
 */
export const userSample = JSON.stringify(
  [
    { name: 'Ada Lovelace', email: 'ada@example.com' },
    { name: 'Grace Hopper', email: 'grace@example.com' },
    { email: 'priya@example.com' },
    { name: 'Ada Lovelace', email: 'ADA@EXAMPLE.COM' },
    { name: 'Frank Malformed', email: 'frank[at]example.com' },
  ],
  null,
  2,
);
