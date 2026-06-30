import { CosmosClient } from '@azure/cosmos';
import { credential } from './identity';
import { config } from './env';

export const cosmosClient = config.azure.endpoints.cosmos
  ? new CosmosClient({
      endpoint: config.azure.endpoints.cosmos,
      aadCredentials: credential,
    })
  : new CosmosClient({
      connectionString: config.azure.fallbacks.cosmosConnectionString!,
    });

export const db = cosmosClient.database(config.azure.fallbacks.cosmosDatabaseName);

export const container = (name: string) => db.container(name);
