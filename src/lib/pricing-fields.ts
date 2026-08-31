/**
 * Fields the API reserves for platform staff. Instructors get full CRUD on
 * their own bootcamps, cohorts and Ships, but not on pricing — the API's
 * `assertMayWriteFields` refuses a non-staff payload that merely CONTAINS one
 * of these keys, regardless of value (`amount: 0` still sets the price).
 *
 * Mirrors the academy repo's `MONETISATION_FIELDS`
 * (`src/modules/admin/helpers/field-guard.ts`) exactly. The two lists are not
 * statically linked — nothing here fetches or generates from the API repo —
 * so if that list ever gains, loses or renames a field, this one has to be
 * updated by hand to match. There is no sync mechanism; this comment is it.
 */
export const PRICING_FIELDS = [
  'amount',
  'isPremium',
  'paddle_price_id',
  'paddlePlanCode',
  'productId',
  'asyncpay_plan_id',
  'allowsSubscription',
  'paymentMethods',
] as const;

/**
 * Drop every pricing key from `data` for a non-staff caller — never send them
 * as `undefined` or `null`, the guard tests presence via `in`. A field absent
 * from `data` is left alone, so this is safe to apply uniformly across forms
 * that each only collect a subset of the eight (e.g. a cohort form has no
 * `paddlePlanCode`, a Ship form has no `paddle_price_id`).
 */
export function stripPricingFields<T extends Record<string, unknown>>(data: T): Partial<T> {
  const next = { ...data };
  for (const field of PRICING_FIELDS) delete next[field as keyof T];
  return next;
}
