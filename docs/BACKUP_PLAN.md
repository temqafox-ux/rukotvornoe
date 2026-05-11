# Backup plan for VPS data

This project stores user data in two places on the VPS:

- `backend/data/app.sqlite` - main database (users, folders, works, sessions)
- `backend/uploads/` - uploaded images

If the VPS fails and there is no backup copy, data is lost. Keep at least one off-server backup.

## What to back up

Create backups for:

- `backend/data/app.sqlite`
- `backend/uploads/` (all files and subfolders)

Optional extra safety:

- `backend/data/` directory (contains current and future db files)

## Manual backup to local PC (Windows PowerShell)

Run from your local machine:

```powershell
$date = Get-Date -Format "yyyy-MM-dd_HH-mm"
$server = "root@YOUR_SERVER_IP"
$localBase = "C:\Backups\rukotvornoe\$date"

New-Item -ItemType Directory -Force -Path $localBase | Out-Null
scp "$server:/var/www/rukotvornoe/backend/data/app.sqlite" "$localBase/app.sqlite"
scp -r "$server:/var/www/rukotvornoe/backend/uploads" "$localBase/uploads"
```

Replace:

- `root@YOUR_SERVER_IP` with your SSH user and server IP
- `/var/www/rukotvornoe` with your real project path on VPS

## Restore from backup

1. Stop backend service.
2. Copy `app.sqlite` back to `backend/data/`.
3. Copy backup files back to `backend/uploads/`.
4. Start backend service.

Example (on VPS):

```bash
systemctl stop rukotvornoe-backend
cp /path/to/backup/app.sqlite /var/www/rukotvornoe/backend/data/app.sqlite
rsync -a /path/to/backup/uploads/ /var/www/rukotvornoe/backend/uploads/
systemctl start rukotvornoe-backend
```

## Recommended schedule

- Daily backup (at least once per day)
- Keep 7 daily + 4 weekly copies
- Verify restore process once before production launch

Without restore verification, a backup is not trusted.

## Automated backup script

Use `backend/backup.sh` on the VPS:

```bash
cd /var/www/rukotvornoe/backend
chmod +x backup.sh
./backup.sh
```

Create daily cron task (03:20):

```bash
crontab -e
```

Add line:

```cron
20 3 * * * /var/www/rukotvornoe/backend/backup.sh >> /var/www/rukotvornoe/backend/backup.log 2>&1
```

Optional custom paths:

```bash
APP_ROOT=/var/www/rukotvornoe BACKUP_ROOT=/var/backups/rukotvornoe RETENTION_DAYS=30 /var/www/rukotvornoe/backend/backup.sh
```
