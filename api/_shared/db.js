import { ClientSecretCredential } from "@azure/identity";
import sql from "mssql";

let cachedPool = null;

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getEnvOptional(name) {
  return process.env[name];
}

async function getAccessToken() {
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

async function createPool() {
  const connectionString =
    getEnvOptional("SQL_CONNECTION_STRING") || getEnvOptional("AZURE_SQL_CONNECTION_STRING");

  if (connectionString) {
    return sql.connect(connectionString);
  }

  const server = getEnv("SQL_SERVER_HOST");
  const database = getEnv("SQL_DATABASE_NAME");
  const token = await getAccessToken();

  const config = {
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
  };

  return sql.connect(config);
}

export async function getSqlPool() {
  if (cachedPool && cachedPool.connected) {
    return cachedPool;
  }

  cachedPool = await createPool();
  return cachedPool;
}

export async function query(sqlText, params = {}) {
  const pool = await getSqlPool();
  const request = pool.request();

  for (const [name, value] of Object.entries(params)) {
    request.input(name, value);
  }

  return request.query(sqlText);
}
