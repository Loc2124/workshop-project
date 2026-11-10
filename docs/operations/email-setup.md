# Email for Open Slot

The API sends mail through Resend's HTTPS API from the Express service. No Resend key or other mail secret belongs in Vercel or in the React bundle.

## Domain and sender

1. Add `mail.openslot.io.vn` in Resend and wait for the domain to verify.
2. Publish the exact SPF and DKIM records Resend shows for that domain. Keep one SPF record per hostname and merge values if one already exists.
3. Confirm the existing DMARC record covers `mail.openslot.io.vn` and aligns with the selected sender. Do not replace an established policy without reviewing its reporting and enforcement settings.
4. Use a sender on the verified domain, for example `Open Slot <noreply@mail.openslot.io.vn>`. Replies go to `hotro@openslot.io.vn`.

## Render environment

Set these on the Render API service:

- `RESEND_API_KEY`: Resend API key.
- `EMAIL_FROM`: verified sender, for example `Open Slot <noreply@mail.openslot.io.vn>`.
- `CLIENT_URL`: the public site origin `https://www.openslot.io.vn` (no trailing slash).
- `CRON_SECRET`: at least 32 random characters.
- `RESEND_WEBHOOK_SECRET`: signing secret from the Resend webhook endpoint.

The secret entries in `render.yaml` are `sync: false`, so enter their values in Render. The public `CLIENT_URL` and `WEB_ORIGIN` are already set there to `https://www.openslot.io.vn`. Leave email credentials out of Vercel; CORS and generated links use the Render origin values.

After adding `057_email_and_password_reset.sql`, apply migrations to each database used by the API. The repository migration command applies to the `DATABASE_URL` selected in that environment:

```sh
npm run migrate
```

## Webhook and scheduled reminders

In Resend, create a webhook for `email.bounced` and `email.complained` at:

```text
https://api.openslot.io.vn/webhooks/resend
```

Put the signing secret in Render as `RESEND_WEBHOOK_SECRET`. The endpoint validates the Svix signature and timestamp, records suppression, and blocks future delivery to bounced or complained addresses.

Add a GitHub Actions repository secret named `CRON_SECRET` with the same value as Render. `.github/workflows/email-reminders.yml` calls `/cron/remind` hourly. The route retries failed email log entries and sends 23–24 hour booking reminders. It uses a database lock and idempotency keys so overlapping invocations do not send duplicate reminders.

## Verification

Send test messages to Gmail, Outlook, and iPhone Mail. Check Vietnamese diacritics, button links, text-only rendering, mobile width, and spam placement. Use mail-tester.com for a controlled test recipient, then remove the test address and message from any public report before sharing it.

The web and API production builds validate the application code. Domain verification, live Resend delivery, bounce events, and spam scoring still require the Resend account, DNS, Render environment, and a real mailbox.
