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
default `from` address (`Money Personality <notifications@yourmoneypersonality.ai>`).
Make sure any sender address you use has been verified within your SendGrid
account (either via domain authentication or a single sender). All HTML content is
passed directly to SendGrid in the API request, so you can modify it in code without
needing SendGrid templates unless you prefer to manage them there.

## API routing configuration

The web app and API now run within the same Azure App Service instance. Requests
to `/api/*` are handled directly by the Node server rather than being proxied to
an external Functions host. No additional proxy configuration is required.

- Keep `VITE_API_BASE_URL` empty (default) to call the co-located API over the
  same origin.
- `npm run build` now builds both the frontend and the API (TypeScript sources
  compile into `api-dist/`). Use `npm start` to serve the compiled assets and
  API from a single Node process.

No SQL changes are required for this routing update; the backend logic remains
the same.
