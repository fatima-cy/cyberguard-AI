export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  [key: string]: any; // Allow custom extension fields
}

export interface UserCapabilities {
  security_analyst: boolean;
  billing_manager: boolean;
}
