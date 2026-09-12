# Job Search Tracker

A standalone job-application tracker with Supabase backend, so your data syncs across every device.

## 1. Create a Supabase project (free)

1. Go to https://supabase.com and sign up / log in
2. Create a new project (pick any name/region, free tier is enough)
3. Wait ~2 minutes for it to provision

## 2. Set up the database

1. In your Supabase project, go to **SQL Editor** → **New query**
2. Paste the contents of `supabase_schema.sql` (in this folder) and click **Run**
3. This creates the `jobs` table with row-level security, so each user only sees their own data

## 3. Get your API keys

1. In Supabase, go to **Project Settings** → **API**
2. Copy the **Project URL** and the **anon public** key

## 4. Configure the app

1. Copy `.env.example` to `.env`:
   ```
   cp .env.example .env
   ```
2. Paste your Project URL and anon key into `.env`

## 5. Run it locally

```
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173). Enter your email to get a magic sign-in link (check your inbox — Supabase sends it).

## 6. Deploy for free (Vercel)

1. Push this folder to a GitHub repo
2. Go to https://vercel.com, sign in with GitHub, click **Add New Project**
3. Import your repo
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy**

You'll get a live URL (e.g. `job-tracker.vercel.app`) you can open from your phone or any computer, sign in with the same email, and see the same data.

## Notes

- Email sign-in uses Supabase's passwordless magic link — no password to manage.
- Free tiers: Supabase (500MB DB, more than enough) and Vercel (unlimited personal projects) cover this comfortably at zero cost.
- To add columns or change fields later, edit `supabase_schema.sql` and re-run only the new parts in the SQL Editor, then update `src/App.jsx` to match.
