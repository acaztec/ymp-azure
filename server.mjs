import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 8080;
const distPath = path.join(__dirname, "dist");
const apiDistPath = path.join(__dirname, "api-dist");

/**
 * Convert an Azure Function-style HTTP handler into an Express handler.
 */
function adaptAzureFunction(fn) {
  return async (req, res) => {
    const context = {
      log: console,
      bindingData: { ...(req.params || {}) },
      req: undefined,
      res: undefined,
    };

    const httpRequest = {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      query: req.query,
      params: req.params,
      body: req.body,
    };

    try {
      await fn(context, httpRequest);
      const response = context.res || {};
      const status = response.status ?? (response.jsonBody ? 200 : 204);
      const headers = response.headers || {};

      if (response.jsonBody !== undefined) {
        res.status(status).set(headers).json(response.jsonBody);
        return;
      }

      if (response.body !== undefined) {
        res.status(status).set(headers).send(response.body);
        return;
      }

      res.status(status).set(headers).end();
    } catch (error) {
      console.error("Error handling request", { url: req.originalUrl, error });
      res.status(500).json({ error: "Internal Server Error" });
    }
  };
}

async function createServer() {
  const app = express();

  // Stripe webhooks require the raw body for signature validation.
  const stripeWebhook = (await import(path.join(apiDistPath, "stripe-webhook.js"))).default;
  app.post("/api/stripe-webhook", express.raw({ type: "*/*" }), stripeWebhook);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const [{ default: authHandler }, { default: assessmentsHandler }, { default: assessmentResultsHandler }, { default: pingHandler }, { default: databasePingHandler }] =
    await Promise.all([
      import(path.join(apiDistPath, "auth/index.js")),
      import(path.join(apiDistPath, "assessments/index.js")),
      import(path.join(apiDistPath, "assessment-results/index.js")),
      import(path.join(apiDistPath, "ping/index.js")),
      import(path.join(apiDistPath, "database-ping/index.js")),
    ]);

  // API routes
  app.all("/api/auth/:action?", adaptAzureFunction(authHandler));
  app.all("/api/assessments/:action?", adaptAzureFunction(assessmentsHandler));
  app.all("/api/assessment-results/:action?", adaptAzureFunction(assessmentResultsHandler));
  app.all("/api/ping", adaptAzureFunction(pingHandler));
  app.all("/api/database-ping", adaptAzureFunction(databasePingHandler));

  // Legacy API routes implemented as plain handlers
  const createCheckoutHandler = (await import(path.join(apiDistPath, "create-checkout.js"))).default;
  const sendEmailHandler = (await import(path.join(apiDistPath, "send-email.js"))).default;
  app.all("/api/create-checkout", createCheckoutHandler);
  app.all("/api/send-email", sendEmailHandler);

  // Static assets
  app.use(express.static(distPath));

  // SPA fallback
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

createServer();
