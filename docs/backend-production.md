# Backend Production Guide

## Recommended architecture

- Frontend: Vercel (leave as is).
- Backend API: VPS (Node.js process behind Nginx).
- Database: SQLite on VPS disk (current state).
- Images: Cloudflare R2 (next step after first stable deploy).

## When VPS is needed

You need a VPS when you want the backend to be public and stable:

- Frontend on Vercel must call a real HTTPS API.
- Local machine should no longer be required to keep backend online.
- You need permanent storage and predictable uptime.

Before that, local development is enough.

## Which Ubuntu version

- Use **Ubuntu 24.04 LTS** for new VPS now.
- Ubuntu 22.04 LTS is also fine if your provider default is 22.04.

If you are choosing from scratch, pick 24.04 LTS.

## Minimum VPS sizing

- Start: **1 vCPU, 1 GB RAM, 20+ GB SSD**.
- Better headroom: **1-2 vCPU, 2 GB RAM, 30+ GB SSD**.

For your current workload, 1 vCPU / 1 GB is usually enough.

## Environment variables

Copy `backend/.env.example` to `backend/.env` and set:

- `PORT`
- `CLIENT_ORIGIN` (can be comma-separated origins)
- `DB_FILE`
- `ADMIN_LOGIN`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

Example:

`CLIENT_ORIGIN=https://your-frontend.vercel.app,https://www.your-domain.com`

## Deploy steps (VPS)

1. Install runtime:
   - Node.js 22 LTS
   - Nginx
   - PM2
2. Upload project to VPS.
3. In `backend/`:
   - `npm ci`
   - `npm run build`
4. Configure `backend/.env`.
5. Start app with PM2:
   - `pm2 start ecosystem.config.cjs`
   - `pm2 save`
6. Configure Nginx with `backend/nginx.rukotvornoe.conf.example`.
7. Enable HTTPS (Let's Encrypt).

## R2 migration (next)

After first stable VPS deploy:

- Replace local `uploads` writes with R2 uploads.
- Store R2 object key or URL in DB.
- Keep API response shape unchanged.
