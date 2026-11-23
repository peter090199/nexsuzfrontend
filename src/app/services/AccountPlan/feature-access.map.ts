/**
 * The ONE place the Angular app ties parts of itself to subscription features.
 *
 * What a plan includes is decided by the master admin in Plan Feature Assignment and reaches the app through
 * FeatureService (one API answer, refreshed centrally). This file only says which feature guards which route, and the
 * codes to use in templates. The API enforces the same features on its own (see App\Support\FeatureAccess in Laravel),
 * so hiding something here is a courtesy: the server is what actually refuses.
 *
 * Only job seekers (DEF-USERS) and recruiters (DEF-CLIENT) are ever limited by a plan. Admins and master admins are not
 * in this map and FeatureService never limits them.
 */
export const FEATURE = {
  APPLY_JOBS: 'APPLY_JOBS',
  CREATE_RESUME: 'CREATE_RESUME',
  CREATE_PROFILE: 'CREATE_PROFILE',
  NETWORK_FEED: 'NETWORK_FEED',
  SEARCH_ACCESS: 'SEARCH_ACCESS',
  MESSAGING_ACCESS: 'MESSAGING_ACCESS',
  JOB_POSTING: 'JOB_POSTING',
  JOB_APPLICANTS: 'JOB_APPLICANTS',
} as const;

export type FeatureCode = typeof FEATURE[keyof typeof FEATURE];

/** the account types a subscription plan applies to */
export const PLAN_ROLES = ['DEF-USERS', 'DEF-CLIENT'] as const;
export type PlanRole = typeof PLAN_ROLES[number];

/**
 * first path segment of a route => the feature it needs, per account type.
 * Used by the route guard, the sidebar menu and anything that links to a page.
 */
export const ROUTE_FEATURES: Record<PlanRole, Record<string, FeatureCode>> = {
  'DEF-USERS': {
    'message': FEATURE.MESSAGING_ACCESS,
    'network': FEATURE.NETWORK_FEED,
    'search': FEATURE.SEARCH_ACCESS,
    'user-cv': FEATURE.CREATE_RESUME,
    'apply-job': FEATURE.APPLY_JOBS,
  },
  'DEF-CLIENT': {
    'message': FEATURE.MESSAGING_ACCESS,
    'network': FEATURE.NETWORK_FEED,
    'search': FEATURE.SEARCH_ACCESS,
    'posting-job': FEATURE.JOB_POSTING,
    'candidates': FEATURE.JOB_APPLICANTS,
    'interviews': FEATURE.JOB_APPLICANTS,
    'reports': FEATURE.JOB_APPLICANTS,
  },
};

/** the plan state the API reports */
export type PlanStatus = 'active' | 'expired' | 'suspended' | 'none' | 'unknown';

export interface PlanInfo {
  status: PlanStatus;
  /** the plan whose features apply today (the free plan once a paid one has expired) */
  plan: string | null;
  /** what the account subscribed to */
  subscribed: string | null;
  expiresAt: string | null;
}
