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
4. Optional, paid: add `DEEPSEEK_API_KEY` as a fallback. DeepSeek requires a
   prepaid balance — it is not free.
5. Redeploy after adding or changing environment variables.

Keep all keys and passwords in Vercel's environment-variable settings. Never
put the Supabase service-role key in browser code or expose it with a
`VITE_`-prefixed variable.

## Custom domain

Add your domain in the Vercel project's **Settings → Domains** and follow
Vercel's DNS instructions. Vercel provisions HTTPS for configured domains.
