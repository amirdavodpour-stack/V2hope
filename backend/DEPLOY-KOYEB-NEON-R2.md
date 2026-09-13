# Free/stable backend deployment plan

This repository is now prepared for a low-cost / starter deployment path:

1. **Koyeb** for the Node.js API (deploy directly from GitHub with auto-deploy on push)
2. **Neon** for PostgreSQL
3. **Cloudflare R2** for object storage via the existing S3-compatible storage layer
4. **Your payment webhook facade / PSP** for the real-money flow

## Why this stack

- The backend already ships with a production Dockerfile.
- The backend already requires PostgreSQL in production.
- The storage layer already supports S3-compatible object storage.
- Koyeb supports GitHub-based continuous deployment and is free to get started.

## Koyeb steps

1. Push the repository to GitHub.
2. In Koyeb, create a **Web Service** from the GitHub repo.
3. Point the service root to `backend/` if needed, or deploy from the repository root using the existing `backend/Dockerfile`.
4. Set the environment variables from `.env.koyeb.neon.r2.example`.
5. Expose port `3000`.
6. Use the generated `https://...koyeb.app` URL as:
   - `PUBLIC_BASE_URL` in the backend
   - `API_BASE_URL` GitHub repository variable/secret for the mobile build, with `/api/v1` appended

Example mobile build URL:

```
https://YOUR-KOYEB-SERVICE.koyeb.app/api/v1
```

## GitHub build

The main APK workflow now accepts `API_BASE_URL` from either:

- a GitHub **secret** named `API_BASE_URL`, or
- a GitHub **repository variable** named `API_BASE_URL`

That makes it easier to get a working APK build after the backend URL is known.

## What remains intentionally external

Only the **real payment gateway / PSP webhook facade** and a **password-reset delivery relay** (email/SMS) remain as must-connect production integrations. The server refuses to boot in production without both — it will not silently log reset tokens or fake payment holds.

Notifications are not a hard blocker for production boot:

- in-app notifications continue to work without external push/email providers
- push/email webhooks are optional
