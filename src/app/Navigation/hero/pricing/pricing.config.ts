/**
 * Configurable, non-API pricing content for the public website.
 * Plans, prices and features come from the Laravel API (getPlanpublic / getByPlanpublic);
 * only things the API does not own live here, so nothing on the page is invented.
 */

/** Optional annual pricing per plan, keyed by planId (e.g. 'PLN000002'). Leave empty until yearly billing is offered. */
export interface YearlyPrice {
  /** Total price charged per year. */
  price: number;
}
export const YEARLY_PRICING: { [planId: string]: YearlyPrice } = {
  // 'PLN000002': { price: 1990 },
};

/** Enterprise is sold by quote, so it is not a database plan. */
export const ENTERPRISE_PLAN = {
  name: 'Enterprise',
  tag: 'ENTERPRISE',
  description: 'Tailored for large organizations that need custom limits, onboarding and support.',
  highlights: [
    'Custom usage limits',
    'Dedicated onboarding',
    'Dedicated account manager',
    'Custom recruitment workflow',
  ],
  cta: 'Contact Sales',
  /** Landing page section the Contact Sales button scrolls to. */
  contactSectionId: 'contact-section',
};

export interface FaqItem { q: string; a: string; }

/** Every answer below reflects how the subscription system works today. */
export const PRICING_FAQ: FaqItem[] = [
  {
    q: 'How does billing work?',
    a: 'Paid plans are billed per subscription period (one month at a time). You choose a payment method at checkout: GCash, PayPal, or credit/debit card.',
  },
  {
    q: 'What happens when I upgrade?',
    a: 'Your new plan starts right away and replaces your current one. Features from the new plan are available immediately.',
  },
  {
    q: 'Can I downgrade to a lower plan?',
    a: 'Moving down is not available from the pricing page. If you need a lower plan, please contact us and our team will change it for you.',
  },
  {
    q: 'Is the Starter plan really free?',
    a: 'Yes. Starter is free and does not need a payment method. You can upgrade whenever you need more.',
  },
  {
    q: 'How do I get Enterprise pricing?',
    a: 'Enterprise is quoted individually. Use Contact Sales and tell us what your organization needs.',
  },
];
