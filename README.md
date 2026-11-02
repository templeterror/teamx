# Team X

`web` is the Next.js TypeScript app. Deploy it on Vercel with the project root set to `web`.

`api` is the FastAPI app. Deploy it on Railway with the service root set to `api`.

Postgres and auth belong in Supabase.

## Deploy the frontend to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftempleterror%2Fteamx%2Ftree%2Fmain%2Fweb&project-name=course-planner&repository-name=course-planner)

Import `templeterror/teamx` in Vercel and set Root Directory to `web`; framework preset Next.js; no environment variables.

## Run

```bash
cd web
npm install
npm run dev
```

```bash
cd api
uv sync
uv run uvicorn teamx_api.main:app --reload --port 8000
```
