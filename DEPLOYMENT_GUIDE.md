# Deployment & Operations Guide - BusinessSuite

This guide covers deployment options for **BusinessSuite**:
1. **Cloud Multi-Tenant SaaS Mode** using Docker Compose or bare-metal Linux.
2. **On-Premise / Standalone Single-Tenant Mode** for dedicated enterprise clients.

---

## 1. Multi-Tenant SaaS Deployment (Docker Compose)

### 1.1 Prerequisites
- Ubuntu 22.04 / Debian 12 / RHEL 9 server.
- Docker Engine 24+ and Docker Compose plugin.
- A registered domain name with DNS A-records pointing to server IP (e.g. `app.yourdomain.com` and `api.yourdomain.com`).

### 1.2 Setup Instructions
1. Clone the repository to the production server:
   ```bash
   git clone <repo-url> /opt/business-suite
   cd /opt/business-suite
   ```

2. Create production `.env` configuration:
   ```bash
   cp .env.example .env
   # Edit .env with production secrets and database passwords
   ```

3. Build and launch containers:
   ```bash
   docker compose up -d --build
   ```

4. Run initial database migration & seed:
   ```bash
   docker compose exec api npx prisma db push --schema=apps/api/prisma/schema.prisma
   docker compose exec api npx ts-node apps/api/prisma/seed.ts
   ```

---

## 2. Standalone Single-Tenant Deployment

For customers purchasing a self-hosted on-premise license:
1. Set the deployment mode in `.env`:
   ```env
   DEPLOYMENT_MODE=SINGLE_TENANT
   ```
2. In Single-Tenant mode, all feature gates and quota limits are permanently bypassed, enabling the full enterprise suite without recurring platform subscription checks.
3. Launch with dedicated single-tenant compose:
   ```bash
   docker compose -f docker-compose.single-tenant.yml up -d --build
   ```

---

## 3. Nginx Reverse Proxy & SSL Configuration

```nginx
server {
    listen 80;
    server_name app.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Automated Backup & Disaster Recovery

Run the backup script via cron every night at 2:00 AM:
```bash
0 2 * * * /opt/business-suite/scripts/backup.sh >> /var/log/bs_backup.log 2>&1
```

To restore from backup:
```bash
/opt/business-suite/scripts/restore.sh ./backups/db_business_suite_20260922_020000.sql.gz
```
