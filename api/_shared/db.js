import { ClientSecretCredential } from '@azure/identity';
import sql from 'mssql';

const requiredEnvVars = [
  'AZURE_TENANT_ID',
  'AZURE_CLIENT_ID',
  'AZURE_CLIENT_SECRET',
  'SQL_SERVER_HOST',
  'SQL_DATABASE_NAME',
];

function getEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let pool = null;

async function getAccessToken() {
  const tenantId = getEnv('AZURE_TENANT_ID');
  const clientId = getEnv('AZURE_CLIENT_ID');
  const clientSecret = getEnv('AZURE_CLIENT_SECRET');

  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const { token } = await credential.getToken('https://database.windows.net/.default');
  if (!token) {
    throw new Error('Failed to acquire Azure SQL access token');
  }
  return token;
}

export async function getSqlPool() {
  if (pool && pool.connected) {
    return pool;
  }

  const server = getEnv('SQL_SERVER_HOST');
  const database = getEnv('SQL_DATABASE_NAME');
  const token = await getAccessToken();

  pool = await sql.connect({
    server,
    database,
    options: { encrypt: true },
    authentication: {
      type: 'azure-active-directory-access-token',
      options: { token },
    },
  });

  return pool;
}

function getSqlType(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? sql.Int : sql.Float;
  }
  if (typeof value === 'boolean') {
    return sql.Bit;
  }
  if (value instanceof Date) {
    return sql.DateTime2;
  }
  return sql.NVarChar;
}

export async function query(sqlText, params = {}) {
  const pool = await getSqlPool();
  const request = pool.request();

  for (const [name, value] of Object.entries(params)) {
    const type = getSqlType(value);
    if (type) {
      request.input(name, type, value);
    } else {
      request.input(name, value);
    }
  }

  return request.query(sqlText);
}
