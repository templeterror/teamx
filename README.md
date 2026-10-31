# Team X

`web` is the Next.js TypeScript app. Deploy it on Vercel with the project root set to `web`.

`api` is the FastAPI app. Deploy it on Railway with the service root set to `api`.

Postgres and auth belong in Supabase.

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
