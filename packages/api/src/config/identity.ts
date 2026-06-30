import { DefaultAzureCredential } from '@azure/identity';

// DefaultAzureCredential picks up environment credentials, workload identity,
// App Service / VM Managed Identity, or local Azure CLI sessions (az login).
export const credential = new DefaultAzureCredential();
