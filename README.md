# your-money-personality

## Email delivery configuration

The application now sends transactional email through [SendGrid](https://sendgrid.com/).

### Required environment variables

Set the following variable in your deployment environment (for example, in Vercel's
Project Settings → Environment Variables):

| Name | Description |
| --- | --- |
| `SENDGRID_API_KEY` | API key with permission to send mail via SendGrid. |

After adding or updating the variable, redeploy the project so that the new value is
picked up by the serverless email endpoint at `api/send-email.js`.

### Customizing the sender and email content

Transactional email bodies are generated inside
`src/services/emailService.ts`, where you can adjust copy, styling, or the
default `from` address (`Money Personality <notifications@yourmoneypersonality.com>`).
Make sure any sender address you use has been verified within your SendGrid
account (either via domain authentication or a single sender). All HTML content is
passed directly to SendGrid in the API request, so you can modify it in code without
needing SendGrid templates unless you prefer to manage them there.

## API routing configuration

The frontend expects JSON from Azure Functions under `/api/*`. When the static
server handles `/api` paths, it falls back to `index.html` and returns HTML
instead of hitting the functions. To ensure API calls reach Azure Functions:

- Deploy the frontend with `VITE_API_BASE_URL` set to the Azure Function base
  URL. For your environment, use
  `https://ymp-appservice-qa-bpfzhrang8ffgkdf.centralus-01.azurewebsites.net`.
- When running the bundled static server (`npm start`) or hosting the built
  files elsewhere, set `API_PROXY_TARGET` to the same URL. The server will
  proxy `/api/*` requests to that target and return JSON responses (or emit a
  502 error if the proxy target is missing or unreachable).

Example `.env` snippet (no trailing slash):

```
VITE_API_BASE_URL=https://ymp-appservice-qa-bpfzhrang8ffgkdf.centralus-01.azurewebsites.net
API_PROXY_TARGET=https://ymp-appservice-qa-bpfzhrang8ffgkdf.centralus-01.azurewebsites.net
```

No SQL changes are required for this routing fix; the backend remains the same.
