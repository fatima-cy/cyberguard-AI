export const PLATFORM_MODULES = {
  PLATFORM: 'platform',
  CYBERGUARD: 'cyberguard',
  ACADEMY: 'academy',
  SARAH: 'sarah',
  ECOCOLD: 'ecocold',
  SHARED: 'shared',
} as const;

export const TIER_LIMITS = {
  free: {
    maxUsers: 5,
    maxQueriesPerMonth: 10,
    features: ['cyberguard'],
  },
  professional: {
    maxUsers: 50,
    maxQueriesPerMonth: 500,
    features: ['cyberguard', 'academy'],
  },
  enterprise: {
    maxUsers: 1000,
    maxQueriesPerMonth: 10000,
    features: ['cyberguard', 'academy', 'sarah', 'ecocold'],
  },
} as const;
