export const ERROR_TYPES = {
  NOT_FOUND: '/errors/not-found',
  FORBIDDEN: '/errors/forbidden',
  UNAUTHORIZED: '/errors/unauthorized',
  RATE_LIMIT_EXCEEDED: '/errors/rate-limit-exceeded',
  MODULE_NOT_AVAILABLE: '/errors/module-not-available',
  INTERNAL_ERROR: '/errors/internal-server-error',
  BAD_REQUEST: '/errors/bad-request',
} as const;

export const ERROR_TITLES = {
  [ERROR_TYPES.NOT_FOUND]: 'Not Found',
  [ERROR_TYPES.FORBIDDEN]: 'Forbidden',
  [ERROR_TYPES.UNAUTHORIZED]: 'Unauthorized',
  [ERROR_TYPES.RATE_LIMIT_EXCEEDED]: 'Too Many Requests',
  [ERROR_TYPES.MODULE_NOT_AVAILABLE]: 'Module Not Available',
  [ERROR_TYPES.INTERNAL_ERROR]: 'Internal Server Error',
  [ERROR_TYPES.BAD_REQUEST]: 'Bad Request',
} as const;
