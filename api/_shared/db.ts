import { ClientSecretCredential } from "@azure/identity";
import sql, { ConnectionPool } from "mssql";

let cachedPool: ConnectionPool | null = null;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function getAccessToken(): Promise<string> {
  const tenantId = getEnv("AZURE_TENANT_ID");
  const clientId = getEnv("AZURE_CLIENT_ID");
  const clientSecret = getEnv("AZURE_CLIENT_SECRET");

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const tokenResponse = await credential.getToken("https://database.windows.net/.default");
  if (!tokenResponse?.token) {
    throw new Error("Failed to acquire access token for Azure SQL.");
  }

  return tokenResponse.token;
}

export async function getSqlPool(): Promise<ConnectionPool> {
  if (cachedPool && cachedPool.connected) {
    return cachedPool;
  }

  const server = getEnv("SQL_SERVER_HOST");
  const database = getEnv("SQL_DATABASE_NAME");
  const token = await getAccessToken();

  const config: sql.config = {
    server,
    database,
    options: {
      encrypt: true,
    },
    authentication: {
      type: "azure-active-directory-access-token",
      options: {
        token,
      },
    },
  } as any;

  cachedPool = await sql.connect(config);
  return cachedPool;
}

export async function query<T = any>(
  sqlText: string,
  params: Record<string, any> = {}
): Promise<sql.IResult<T>> {
  const pool = await getSqlPool();
  const request = pool.request();

  for (const [name, value] of Object.entries(params)) {
    request.input(name, value);
  }

  return request.query<T>(sqlText);
}
