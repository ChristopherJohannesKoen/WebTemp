# Minimal Server + Web Starter

This repository is a stripped-down template with:
- `server/` - FastAPI API with a single `/health` endpoint.
- `frontend/` - Vite + React app that renders a black full-screen page.

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
