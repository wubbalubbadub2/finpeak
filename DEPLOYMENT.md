# Deployment Guide

## Architecture
- **Frontend**: Next.js → Vercel (free)
- **Backend**: FastAPI → Render (free tier)
- **Database**: Supabase Postgres (free)
- **Auth**: Supabase Auth (free)

## Prerequisites
- Supabase project: ✅ already set up at https://yzrdvkasriomzvmjbnho.supabase.co
- GitHub account
- Render account (free, no card)
- Vercel account (free, no card)

---

## Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"

# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/kz-finance.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Backend to Render

1. Go to https://render.com → Sign up with GitHub
2. New → Web Service → Connect your repo
3. Settings:
   - **Name**: `kz-finance-api`
   - **Environment**: Python 3
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Free
4. Add environment variables (Settings → Environment):
   ```
   DATABASE_URL=postgresql://postgres.yzrdvkasriomzvmjbnho:lvdX7jsYdJqIxNqt@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
   SUPABASE_URL=https://yzrdvkasriomzvmjbnho.supabase.co
   SUPABASE_ANON_KEY=eyJhbGci...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
   SUPER_ADMIN_EMAIL=shynggys.islam@gmail.com
   ANTHROPIC_API_KEY=sk-ant-...
   FRONTEND_URL=https://YOUR_APP.vercel.app
   ```
5. Deploy. Wait ~3 minutes for first build.
6. Test: visit `https://kz-finance-api.onrender.com/api/health` → should return `{"status":"ok"}`
7. **Important**: Render free tier sleeps after 15 min idle. First request after sleep takes ~30s.

---

## Step 3: Deploy Frontend to Vercel

1. Go to https://vercel.com → Sign up with GitHub
2. Import the same repo
3. Settings:
   - **Framework**: Next.js (auto-detected)
   - **Root directory**: `frontend`
4. Add environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://yzrdvkasriomzvmjbnho.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
   NEXT_PUBLIC_API_URL=https://kz-finance-api.onrender.com
   ```
5. Deploy. Wait ~2 minutes.
6. Visit your Vercel URL and login with `shynggys.islam@gmail.com` / your password.

---

## Step 4: Update Backend CORS

After Vercel deploys, copy your Vercel URL and update the `FRONTEND_URL` env var in Render. The backend already allows all `*.vercel.app` URLs via regex, so this is optional.

---

## Local Development

```bash
# Backend
source .venv/bin/activate
uvicorn backend.app.main:app --port 8000 --reload

# Frontend (separate terminal)
cd frontend
npm run dev
```

Visit http://localhost:3000

---

## Adding Client Users

1. Login as super admin
2. Go to **Пользователи** in the sidebar
3. Click **Добавить пользователя**
4. Fill in name, email; password auto-generates
5. Save the displayed password (only shown once) and share it with the client

Each new user gets:
- Their own Supabase auth account
- A new organization in the database
- A copy of all 50 categories and 84 categorization rules
- Complete data isolation from other users
