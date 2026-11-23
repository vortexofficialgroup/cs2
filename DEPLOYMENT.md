# Deploying UE Dubai Portal on Vercel

The Vercel project is connected to this GitHub repository and deploys pushes to
`main`. Check build and deployment status in the Vercel project dashboard.

## Shared admin state

1. Create a Supabase project and run
   [`db/supabase-shared-state.sql`](db/supabase-shared-state.sql) in its SQL
   Editor.
2. In Vercel, open the project settings and add these Production environment
   variables:
   - `SUPABASE_URL` — the Supabase project URL.
   - `SUPABASE_ANON_KEY` — the publishable key (required for Microsoft sign-in).
   - `SUPABASE_SERVICE_ROLE_KEY` — the server-side service-role key.
   - `ADMIN_PASSWORD` — a strong initial administrator password.
   - `ADMIN_SECRET` — a long, random secret used to sign administrator
     sessions.
3. For the Gemini-powered chatbot and admin assistant, add `GEMINI_API_KEY`.
   Create a free key at https://aistudio.google.com/api-keys. Leave
   `GEMINI_MODEL` unset to use the default free model
   (`gemini-3.5-flash-lite`), or set it to `gemini-3.8-flash` or
   `gemini-4-hydrogen`. Avoid the legacy `gemini-2.5-*` models: Google now
   limits them to projects that used them before the change.
4. Redeploy after adding or changing environment variables.

Keep all keys and passwords in Vercel's environment-variable settings. Never
put the Supabase service-role key in browser code or expose it with a
`VITE_`-prefixed variable.

## Staff access

Open **Settings → Staff Access** to configure three things:

1. **Microsoft sign-in rules** — add the allowed university email domains
   (e.g. `ue-germany.de`). Only verified Microsoft accounts from those domains
   can sign in; leave the list empty to block everyone. This allowlist applies
   to both staff and students on the public portal. The admin password login
   remains available as a backup.
2. **Normal permissions** — view-only access (View schedule & classes, View
   rooms, View professors, View announcements, View reports) or full manage
   access. View-only staff see the tables without edit/import buttons.
3. **AI using** — per-staff chatbot capabilities: read campus data, find a
   substitute professor ("I am sick"), check capacity, or change schedule /
   rooms / professors / announcements. The AI Assistant tab and its full agent
   are admin-only.

Microsoft accounts are created on first sign-in and stored in the Supabase
`sso_staff` table; edit or remove them in the same Staff Access screen. Manually
created staff accounts still use the local JSON file
(`STAFF_STORE_FILE`, default `~/.ue-portal/staff-users.json`), so those do not
survive Vercel redeploys — prefer Microsoft accounts in production.

### Microsoft app setup (free)

1. Azure portal → Microsoft Entra ID → App registrations → New registration.
   Choose **Accounts in this organizational directory only** (single tenant).
2. Web redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Copy the Application (client) ID and Directory (tenant) ID. Create a client
   secret and copy its **Value**.
4. Supabase → Authentication → Providers → Azure → enable, paste the ID and
   secret, and set **Azure Tenant URL** to
   `https://login.microsoftonline.com/<tenant-id>`.
5. Add `http://localhost:3000/`, `http://localhost:3000/admin.html`, your
   Vercel site root (e.g. `https://your-domain/`) and your Vercel admin URL to
   Supabase's redirect allowlist.
6. Add the allowed domains in Staff Access and redeploy.

## Public login gate

When the site opens, a dimmed CampuSyncer splash with an animated logo appears
while the portal data loads. It then shows a login screen with two tabs:

- **Student** — students can sign in or create their own account with a name,
  email and password (8+ characters). Accounts are stored in the Supabase
  `student_users` table added by the shared-state SQL.
- **Staff** — staff can sign in with their staff username/password or directly
  with Microsoft. The administrator password login stays at `/admin.html`.

Students only unlock the public portal; staff permissions and the AI Assistant
tab are still administered in **Settings → Staff Access**.

## Custom domain

Add your domain in the Vercel project's **Settings → Domains** and follow
Vercel's DNS instructions. Vercel provisions HTTPS for configured domains.
