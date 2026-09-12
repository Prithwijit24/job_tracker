# Job Tracker

A colorful kanban-style tracker for job applications, with a Supabase backend so your data syncs across every device.

## Features

- **Passwordless sign-in** — magic link via Supabase Auth
- **Kanban board** — 6 stages (Wishlist → Applied → Screening → Interview → Offer → Closed) with **drag & drop** between columns
- **Table view** — sortable-scan friendly grid with inline status editing
- **Search + platform filter** (Naukri, LinkedIn, Indeed, referrals…)
- **Follow-up reminders** — banner + per-card due labels (overdue / today / in Nd)
- **Stats strip** — total, in-pipeline, interviews, offers, follow-ups due
- **Full CRUD** — add / edit / delete applications via modal, with row-level security per user

## Tech stack

- React 18 + Vite 8 + Supabase (`@supabase/supabase-js`)
- `lucide-react` icons, no CSS framework (inline styles + a small global stylesheet)
- CI/CD: GitHub Actions (`workflow_dispatch`) → Vercel

## Repo layout

```
.
├── job-tracker-app/          # the Vite + React app
│   ├── src/                  # App.jsx, main.jsx, supabaseClient.js
│   ├── supabase_schema.sql   # jobs table + RLS policies
│   └── .env.example          # placeholder env template (never commit real keys)
└── .github/workflows/
    └── deploy-vercel.yml     # manual Deploy to Vercel (preview / production)
```

## Local setup

1. **Create a Supabase project** (free tier is enough).
2. **Create the table** — SQL Editor → New query → paste `job-tracker-app/supabase_schema.sql` → Run.
3. **Configure auth redirect URLs** — Authentication → URL Configuration:
   - Site URL → your production URL (e.g. `https://your-app.vercel.app`)
   - Redirect URLs → add `http://localhost:5173/**` and `https://your-app.vercel.app/**`
   - (Required: magic links use `emailRedirectTo`, which Supabase only honors for allowlisted URLs.)
4. **Get API keys** — Project Settings → API → Project URL + anon key.
5. **Configure the app**:
   ```
   cd job-tracker-app
   cp .env.example .env   # then fill in your URL + anon key
   npm install
   npm run dev
   ```
6. Open the printed URL (usually http://localhost:5173) and sign in with your email.

## Deploy

**Option A — Vercel dashboard:** import the repo, set root to `job-tracker-app/`, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars, deploy.

**Option B — GitHub Actions (manual):** Actions → "Deploy to Vercel" → Run workflow → choose `preview` or `production`. One-time setup — add these repo secrets (Settings → Secrets → Actions):
- `VERCEL_TOKEN` (from vercel.com/account/tokens)
- `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID` (run `npx vercel link` in `job-tracker-app/`, copy from `.vercel/project.json`)

Make sure the Supabase env vars are also set in the Vercel project for the target environment.

## License

See [LICENSE](./LICENSE).
