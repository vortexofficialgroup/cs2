# 🚀 Deploying UE Portal on Vultr

You have **$200 Vultr credit**. This guide uses about **$6/month** (Cloud Compute, 1 vCPU, 1GB RAM).
Your $200 lasts **33 months** at that size.

---

## Shared admin changes on Vercel

The portal stores admin edits in Supabase so they are available to every browser. Before deploying to Vercel:

1. Create a Supabase project and run [`db/supabase-shared-state.sql`](db/supabase-shared-state.sql) in its SQL Editor.
2. In Vercel project settings, set `ADMIN_USERNAME` and `ADMIN_PASSWORD` for admin login, and add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the Supabase project. Keep the service-role key server-only; do not use a `VITE_` variable or expose it in browser code.
3. Redeploy the Vercel project so the API functions receive those environment variables.

The public portal reads shared changes on load and refreshes them periodically. Admin saves require a valid admin/staff session and the matching permission. On the first administrator login, existing data from that browser's legacy local storage is imported into Supabase.

---

## Step 1 — Create your Vultr server

1. Go to [vultr.com](https://vultr.com) and log in.
2. Click **Deploy New Server → Cloud Compute (Shared CPU)**.
3. Choose settings:
   - **Region:** Closest to Dubai → pick `Singapore` or `London` (no Dubai DC yet)
   - **OS:** Ubuntu 24.04 LTS
   - **Plan:** `vc2-1c-1gb` — **$6/month** (1 vCPU, 1 GB RAM, 25 GB SSD) ✅
   - **Additional features:** Enable **IPv6**, leave the rest default
4. Under **SSH Keys**, add your public key (`cat ~/.ssh/id_rsa.pub`) — this lets GitHub Actions deploy.
5. Click **Deploy Now**. Wait ~60 seconds. Copy your **server IP**.

---

## Step 2 — Set up the server (run once)

SSH into your new server:
```bash
ssh root@YOUR_VULTR_IP
```

Clone the repository so the setup script can install the site's Nginx configuration:
```bash
apt update && apt install -y git
git clone https://github.com/astrax-gif/Ue-portal.git /var/www/ue-portal
cd /var/www/ue-portal
bash scripts/vultr-setup.sh
```

The script installs Nginx, Node.js 20, and PM2, configures the firewall and Nginx, and prints your next steps.

The deployment workflow starts the API, preserves the existing Nginx domain configuration while adding the `/api/` proxy if needed, tests the Nginx configuration, and checks both the API and proxy. If `/etc/ue-portal.env` is missing, it creates the file from the `ADMIN_PASSWORD` and `ADMIN_SECRET` Actions secrets. It also syncs `GEMINI_API_KEY` from Actions secrets to the server environment when configured.

Keep `/etc/ue-portal.env`, `/var/lib/ue-portal/staff-users.json`, and `/var/lib/ue-portal/admin-password.json` private; back up the two data files. The API environment file and account data are stored on the VPS, not in the web root.

---

## Step 3 — Add GitHub Secrets

Go to your repo on GitHub → **Settings → Secrets and variables → Actions → New repository secret**.

Add these deployment secrets:

| Secret name | Value |
|---|---|
| `VULTR_HOST` | Your server IP, e.g. `149.28.xxx.xxx` |
| `VULTR_USER` | `root` (or the user configured on the VPS) |
| `VULTR_SSH_KEY` | Your **private** SSH key — `cat ~/.ssh/id_rsa` |
| `ADMIN_PASSWORD` | Initial admin login password (generated during automatic setup if needed) |
| `ADMIN_SECRET` | Random HMAC signing secret (generated during automatic setup if needed) |
| `GEMINI_API_KEY` | API key for the Gemini-powered admin assistant |

> **Never** paste your private key anywhere except GitHub Secrets.
> `VULTR_USERNAME` and `VULTR_PASSWORD` are also accepted for existing deployments; an SSH key is preferred.
> Without `GEMINI_API_KEY`, AI requests will fail and display a temporary-busy error.

---

## Step 4 — Delete the Vercel files

If your repo has any of these, **delete them**:

```bash
# In your local repo
rm -f vercel.json
rm -rf .vercel/
```

Then commit:
```bash
git add -A
git commit -m "chore: remove Vercel, switch to Vultr"
git push
```

---

## Step 5 — Deploy

That's it. Push to `main` and GitHub Actions runs automatically:

```
Push to main
    └── GitHub Actions
            ├── npm ci
            ├── npm run build
            ├── rsync dist/ → Vultr /var/www/ue-portal/
            └── nginx reload
```

Watch it at: `github.com/astrax-gif/Ue-portal/actions`

Your app will be live at: `http://YOUR_VULTR_IP`

---

## Step 6 — Add a domain + HTTPS (optional but recommended)

**Point your domain** (e.g. `ue-portal.com`) to your Vultr IP:
```
A record → YOUR_VULTR_IP
```

**Edit Nginx config** on the server:
```bash
nano /etc/nginx/sites-available/ue-portal
# Replace: server_name _;
# With:    server_name ue-portal.com www.ue-portal.com;
nginx -t && systemctl reload nginx
```

**Get a free SSL cert:**
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d ue-portal.com -d www.ue-portal.com
```

Done — your site now runs on HTTPS with auto-renewing certs. 🔒

---

## Vultr cost breakdown (with your $200 credit)

| Resource | Plan | Cost |
|---|---|---|
| Cloud Compute VPS | 1 vCPU, 1GB RAM | $6/month |
| Bandwidth | 2TB included | $0 |
| IPv4 | 1 included | $0 |
| **Total** | | **$6/month** |

Your $200 credit = **33 months** of free hosting.

---

## Troubleshooting

**GitHub Actions fails at rsync:**
- Check that `VULTR_SSH_KEY` is the full private key including `-----BEGIN...-----` and `-----END...-----` lines.
- Make sure your public key is in `/root/.ssh/authorized_keys` on the server.

**Nginx 403:**
```bash
chown -R www-data:www-data /var/www/ue-portal
chmod -R 755 /var/www/ue-portal
```

**Nginx 404 on page refresh (SPA routing):**
Make sure the `try_files $uri $uri/ /index.html;` line is in your nginx config. It's already there in `nginx/ue-portal.conf`.

**Check nginx logs:**
```bash
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```
