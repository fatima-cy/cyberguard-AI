export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  [key: string]: any; // Allow custom extension fields
}

export type SubscriptionTier = 'free' | 'professional' | 'enterprise';

export type UserRole = 'super_admin' | 'org_admin' | 'standard';

export interface UserCapabilities {
  security_analyst: boolean;
  billing_manager: boolean;
}
