import type { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { query } from "../_shared/db";

const databasePingFunction: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  context.log("database-ping invoked", {
    method: req.method,
    query: req.query,
  });

  try {
    const result = await query<{ currentTime: Date }>("SELECT GETDATE() AS currentTime");
    const currentTime = result.recordset?.[0]?.currentTime;

    context.res = {
      status: 200,
      jsonBody: {
        ok: true,
        currentTime,
        message: "Successfully connected to the database.",
      },
    };
  } catch (error: any) {
    context.log.error("database-ping failed", {
      error,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorName: error?.name,
      errorNumber: error?.number,
      errorState: error?.state,
      originalError: error?.originalError,
    });

    context.res = {
      status: 500,
      jsonBody: {
        ok: false,
        error: "Database ping failed",
        message: error?.message || "Unable to connect to the database.",
        details: {
          code: error?.code,
          name: error?.name,
          number: error?.number,
          state: error?.state,
        },
      },
    };
  }
};

export default databasePingFunction;
