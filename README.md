# Starter: FastAPI + Vite (Minimal)

A minimal, industry-standard starter with:
- `server/` - FastAPI API (`/api/health`).
- `frontend/` - Vite + React app that renders a full-screen black page.

## Project Layout

```
server/
  app/
    api/
      routes/
        health.py
      router.py
    core/
      config.py
    main.py
frontend/
  src/
    App.tsx
    main.tsx
    index.css
```

## Quick Start

### Server
```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r server/requirements.txt
uvicorn server.app.main:app --reload --port 8000
```

### Web
```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Configuration

Environment variables for the API:
- `APP_NAME` (default: `Starter API`)
- `API_PREFIX` (default: `/api`)
- `CORS_ORIGINS` (comma-separated, default: `http://localhost:5173`)
