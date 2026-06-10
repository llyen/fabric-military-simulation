/**
 * Shared connection helper for writing directly into Rayfin's Fabric SQL
 * database, bypassing the Data API.
 *
 * Why direct SQL? A Fabric-hosted Rayfin backend only supports Fabric brokered
 * (browser SSO) auth, so the entities' `@role('authenticated')` rules cannot be
 * satisfied from a headless Node process. Those rules guard the Data API only —
 * not the underlying SQL database — so seeding and the headless simulator write
 * rows straight into the provisioned Fabric SQL DB using an Entra access token.
 *
 * Override auto-resolution with SQL_SERVER / SQL_DB / SQL_TOKEN env vars.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import sql from 'mssql';

export interface SqlTarget {
  server: string;
  database: string;
  token: string;
}

function token(tenant: string, resource: string): string {
  return execSync(
    `az account get-access-token --tenant ${tenant} --resource ${resource} --query accessToken -o tsv`,
    { encoding: 'utf8' }
  ).trim();
}

export async function resolveTarget(): Promise<SqlTarget> {
  if (process.env.SQL_SERVER && process.env.SQL_DB && process.env.SQL_TOKEN) {
    return {
      server: process.env.SQL_SERVER,
      database: process.env.SQL_DB,
      token: process.env.SQL_TOKEN,
    };
  }

  const registryPath = resolve(process.cwd(), 'rayfin', '.deployments.json');
  if (!existsSync(registryPath)) {
    throw new Error(
      'rayfin/.deployments.json not found — run `rayfin up` first, or set SQL_SERVER/SQL_DB/SQL_TOKEN.'
    );
  }
  const registry = JSON.parse(readFileSync(registryPath, 'utf8')) as {
    deployments: Record<string, { fabricWorkspaceId: string; fabricTenantId: string }>;
    active: string;
  };
  const dep = registry.deployments[registry.active];
  if (!dep) throw new Error('No active deployment in rayfin/.deployments.json.');

  const fabricToken = token(dep.fabricTenantId, 'https://api.fabric.microsoft.com');
  const res = await fetch(
    `https://api.fabric.microsoft.com/v1/workspaces/${dep.fabricWorkspaceId}/sqlDatabases`,
    { headers: { Authorization: `Bearer ${fabricToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Fabric API sqlDatabases list failed: ${res.status} ${await res.text()}`);
  }
  const list = (await res.json()) as {
    value: { displayName: string; properties: { serverFqdn: string; databaseName: string } }[];
  };
  const db = list.value[0];
  if (!db) throw new Error('No SQL database found in the workspace.');

  return {
    server: db.properties.serverFqdn.split(',')[0],
    database: db.properties.databaseName,
    token: token(dep.fabricTenantId, 'https://database.windows.net/'),
  };
}

export async function connect(target?: SqlTarget): Promise<sql.ConnectionPool> {
  const t = target ?? (await resolveTarget());
  return sql.connect({
    server: t.server,
    database: t.database,
    port: 1433,
    connectionTimeout: 15000,
    requestTimeout: 15000,
    options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
    pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
    authentication: {
      type: 'azure-active-directory-access-token',
      options: { token: t.token },
    },
  });
}
