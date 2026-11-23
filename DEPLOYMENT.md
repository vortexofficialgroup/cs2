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
3. If using the Gemini-powered admin assistant, also add `GEMINI_API_KEY`.
4. Redeploy after adding or changing environment variables.

Keep all keys and passwords in Vercel's environment-variable settings. Never
put the Supabase service-role key in browser code or expose it with a
`VITE_`-prefixed variable.

## Custom domain

Add your domain in the Vercel project's **Settings → Domains** and follow
Vercel's DNS instructions. Vercel provisions HTTPS for configured domains.
