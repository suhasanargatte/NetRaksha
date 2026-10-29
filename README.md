# NetRakshak

**Offline Cybersecurity Analysis and Investigation Platform**

NetRakshak analyses imported system log files locally, detects suspicious patterns, identifies statistical anomalies, correlates events into investigations, verifies file integrity, and generates downloadable reports — entirely offline, with no external AI API dependency.

---

## Quick start

```bash
# Terminal 1 — Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts, React Query |
| Backend | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2 (async) |
| Database | SQLite (development), PostgreSQL-ready |
| Detection | Rule engine + Scikit-learn Isolation Forest |
| Testing | Pytest + pytest-asyncio (backend), Vitest + RTL (frontend) |

---

## Project structure

```
NetRakshak/
├── backend/       FastAPI application
├── frontend/      React + Vite application
├── sample_data/   Deterministic demo log files (committed)
└── docs/          Setup, deployment, data model documentation
```

---

## Documentation

- [Setup guide](docs/SETUP.md)
- [Deployment guide](docs/DEPLOYMENT.md)
- [Architecture plan](.gemini/…) — see the attached architecture artifact

---

## Implementation status

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Foundation — scaffolding, DB schema, API skeleton | ✅ Complete |
| 2 | Log ingestion — upload, parse, normalise, SHA-256 | ⏳ Next |
| 3 | Rule engine — 12 transparent detection rules | ⏳ Pending |
| 4 | ML engine — Isolation Forest anomaly scoring | ⏳ Pending |
| 5 | Correlation — event grouping into investigations | ⏳ Pending |
| 6 | Dashboard & full UI | ⏳ Pending |
| 7 | Reports & integrity verification | ⏳ Pending |
| 8 | Tests & documentation | ⏳ Pending |

---

## License

Internal project — not licensed for public redistribution.

