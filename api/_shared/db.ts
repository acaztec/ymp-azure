import { AccessToken, ClientSecretCredential } from "@azure/identity";
import sql, { ConnectionPool } from "mssql";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 minutes before expiry

let cachedPool: ConnectionPool | null = null;
let cachedToken: AccessToken | null = null;
let cachedPoolTokenExpiry: number | null = null;

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function isTokenExpiring(token: AccessToken | null): boolean {
  if (!token?.expiresOnTimestamp) {
    return true;
  }
  return token.expiresOnTimestamp - Date.now() <= TOKEN_REFRESH_BUFFER_MS;
}

async function fetchAccessToken(): Promise<AccessToken> {
  const tenantId = getEnv("AZURE_TENANT_ID");
  const clientId = getEnv("AZURE_CLIENT_ID");
  const clientSecret = getEnv("AZURE_CLIENT_SECRET");

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const tokenResponse = await credential.getToken("https://database.windows.net/.default");
  if (!tokenResponse?.token) {
    throw new Error("Failed to acquire access token for Azure SQL.");
  }

  return tokenResponse;
}

async function getAccessToken(): Promise<AccessToken> {
  if (cachedToken && !isTokenExpiring(cachedToken)) {
    return cachedToken;
  }

  cachedToken = await fetchAccessToken();
  return cachedToken;
}

async function closeCachedPool(): Promise<void> {
  if (!cachedPool) {
    return;
  }

  try {
    await cachedPool.close();
  } catch (error) {
    console.warn("Failed to close cached SQL pool", { error });
  } finally {
    cachedPool = null;
    cachedPoolTokenExpiry = null;
  }
}

export async function getSqlPool(): Promise<ConnectionPool> {
  const server = getEnv("SQL_SERVER_HOST");
  const database = getEnv("SQL_DATABASE_NAME");
  const token = await getAccessToken();

  if (
    cachedPool &&
    cachedPool.connected &&
    cachedPoolTokenExpiry &&
    !isTokenExpiring({ ...token, expiresOnTimestamp: cachedPoolTokenExpiry })
  ) {
    return cachedPool;
  }

  await closeCachedPool();

  console.log("Creating new SQL connection pool", { server, database });
  const config: sql.config = {
    server,
    database,
    options: {
      encrypt: true,
    },
    authentication: {
      type: "azure-active-directory-access-token",
      options: {
        token: token.token,
      },
    },
  } as any;

  cachedPool = await sql.connect(config);
  cachedPoolTokenExpiry = token.expiresOnTimestamp ?? null;
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

  console.log("Executing SQL query", { sqlText, params });

  try {
    const result = await request.query<T>(sqlText);
    console.log("SQL query completed", {
      rowCount: result.recordset?.length,
      rowsAffected: result.rowsAffected,
    });
    return result;
  } catch (error) {
    console.error("SQL query failed", { sqlText, params, error });
    throw error;
  }
}
