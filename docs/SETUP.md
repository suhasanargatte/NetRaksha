# NetRakshak — Setup Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | ≥ 3.10 | 3.11+ recommended |
| Node.js | ≥ 20 | LTS recommended |
| npm | ≥ 10 | bundled with Node 20 |
| Git | any | — |

---

## 1. Clone the repository

```bash
git clone <repo-url> NetRakshak
cd NetRakshak
```

---

## 2. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install runtime dependencies
pip install -r requirements.txt

# Install development/test dependencies
pip install -r requirements-dev.txt

# Copy the example environment file
cp .env.example .env
# Edit .env if you need non-default values (port, paths, etc.)

# Start the development server
uvicorn app.main:app --reload --port 8000
```

The API will be at http://localhost:8000  
Interactive docs: http://localhost:8000/docs  
Health check: http://localhost:8000/api/v1/health

---

## 3. Frontend setup

```bash
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

The frontend will be at http://localhost:5173  
API requests are proxied to http://localhost:8000 by the Vite dev server.

---

## 4. Running tests

### Backend

```bash
cd backend
source .venv/bin/activate
pytest -v
# With coverage
pytest -v --cov=app --cov-report=term-missing
```

### Frontend

```bash
cd frontend
npm test
# With coverage
npm run test:coverage
```

---

## 5. Environment variables

See `backend/.env.example` for all available settings.  
Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./netrakshak.db` | Database connection string |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed frontend origins |
| `UPLOAD_DIR` | `./uploads` | Directory for uploaded log files |
| `MAX_UPLOAD_SIZE_MB` | `100` | Maximum file upload size |
| `ML_CONTAMINATION` | `0.05` | Isolation Forest contamination rate |

---

## 6. Known limitations (Phase 1)

- Log upload and analysis not yet implemented (Phase 2).
- Dashboard metrics are placeholder until detection is live (Phase 3+).
- No authentication — single-user local deployment only.

