## Azure Portal configuration for API SQL access

The Azure Functions in this project connect to Azure SQL using either a full connection string or an Entra ID application’s access token. To eliminate 500 errors like `500 (Internal Server Error)` when fetching advisor assessments, ensure the following settings are present in the Function App in the Azure Portal (Settings → **Configuration** → **Application settings**):

1. **Simplest option: provide a SQL connection string**
   - Add an app setting named **`SQL_CONNECTION_STRING`** (or **`AZURE_SQL_CONNECTION_STRING`**) that contains the complete Azure SQL connection string, including credentials.
   - Save and restart the Function App.

2. **Token-based option: use Entra ID app registration credentials**
   - Create or identify an Entra ID **App registration** that has database permissions (via an Azure AD admin on the SQL server).
   - In that App registration, create a **Client secret**.
   - Grant the app access to the SQL database (e.g., run `CREATE USER [appId] FROM EXTERNAL PROVIDER; ALTER ROLE db_datareader ADD MEMBER [appId];` in the database).
   - In the Function App configuration, add these app settings:
     - `AZURE_TENANT_ID` – the Directory (tenant) ID from the App registration
     - `AZURE_CLIENT_ID` – the Application (client) ID from the App registration
     - `AZURE_CLIENT_SECRET` – the client secret you created
     - `SQL_SERVER_HOST` – the server hostname (e.g., `your-server.database.windows.net`)
     - `SQL_DATABASE_NAME` – the database name
   - Save and restart the Function App.

3. **Validate**
   - After saving, click **Configuration** → **Application settings** to confirm the keys are present (client secret will be hidden, which is expected).
   - Restart the Function App to ensure the updated settings are loaded.

Either approach will allow the API to authenticate to Azure SQL using Entra ID; no legacy Azure AD tokens are required.
