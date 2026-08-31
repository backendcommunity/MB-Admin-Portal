import { describe, it, expect } from 'vitest';
import { PRICING_FIELDS, stripPricingFields } from '../pricing-fields';

describe('PRICING_FIELDS', () => {
  it('mirrors the academy repo field-guard.ts MONETISATION_FIELDS list exactly', () => {
    expect(PRICING_FIELDS).toEqual([
      'amount',
      'isPremium',
      'paddle_price_id',
      'paddlePlanCode',
      'productId',
      'asyncpay_plan_id',
      'allowsSubscription',
      'paymentMethods',
    ]);
  });
});

describe('stripPricingFields', () => {
  it('removes every pricing key present in the payload', () => {
    const out = stripPricingFields({
      title: 'x',
      amount: 0,
      isPremium: false,
      paddle_price_id: 'pri_1',
      paddlePlanCode: 'plan_1',
      productId: 'prod_1',
      asyncpay_plan_id: '',
      allowsSubscription: true,
      paymentMethods: ['card'],
    });

    for (const field of PRICING_FIELDS) {
      expect(field in out).toBe(false);
    }
    expect(out).toEqual({ title: 'x' });
  });

  it('is a no-op on a payload with none of the pricing keys', () => {
    const out = stripPricingFields({ name: 'Cohort 1', duration: 8 });
    expect(out).toEqual({ name: 'Cohort 1', duration: 8 });
  });

  it('does not mutate the input object', () => {
    const input = { amount: 5, title: 'x' };
    stripPricingFields(input);
    expect(input).toEqual({ amount: 5, title: 'x' });
  });
});
