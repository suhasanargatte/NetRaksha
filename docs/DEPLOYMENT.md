# NetRakshak Deployment & Operational Runbook

NetRakshak is designed specifically for **offline, air-gapped, and privacy-sensitive cybersecurity environments**. It requires no external cloud connections, proprietary AI APIs, or internet telemetry.

---

## 1. System Requirements

- **Operating System**: Linux (Ubuntu 20.04+, Debian 11+, RHEL 8+), macOS (12+), or Windows with WSL2.
- **Python Runtime**: Python 3.9+ or Python 3.10+ (Python 3.11 recommended for Docker).
- **Node Runtime**: Node.js v18+ or v20+ with npm.
- **Memory**: Minimum 2 GB RAM (4 GB recommended for larger log volumes).
- **Disk Space**: 500 MB base installation plus storage for uploaded logs and generated reports.

---

## 2. Environment Variables Reference

Configure environment variables via `.env` in the backend working directory or directly in container orchestrators:

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `NetRakshak` | System branding and report title identifier |
| `APP_VERSION` | `0.1.0` | Software release version |
| `APP_ENV` | `development` | Environment tier (`development`, `test`, `production`) |
| `HOST` | `0.0.0.0` | Network binding interface |
| `PORT` | `8000` | Backend API port |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed frontend origins |
| `DATABASE_URL` | `sqlite+aiosqlite:///./netrakshak.db` | Async SQLAlchemy database connection string |
| `UPLOAD_DIR` | `./uploads` | Directory for ingested raw evidence files |
| `REPORTS_DIR` | `./reports` | Directory for generated PDF/CSV reports |
| `MAX_UPLOAD_SIZE_MB` | `100` | Maximum single upload file size limit |
| `ML_CONTAMINATION` | `0.05` | Expected outlier proportion for Isolation Forest (0.01 - 0.20) |
| `ML_ANOMALY_THRESHOLD` | `0.70` | Anomaly score threshold for flagging behavioral outliers |
| `RULE_BRUTE_FORCE_THRESHOLD` | `3` | Failed login count required to trigger brute force alert |
| `RULE_BRUTE_FORCE_WINDOW_SECONDS`| `300` | Time window (seconds) for brute force correlation |
| `RULE_BURST_THRESHOLD` | `20` | Event count required to trigger unusual burst alert |
| `RULE_BURST_WINDOW_SECONDS` | `60` | Time window (seconds) for burst activity |
| `RULE_AFTER_HOURS_START` | `7` | Normal business hours start (07:00 local time) |
| `RULE_AFTER_HOURS_END` | `20` | Normal business hours end (20:00 local time) |
| `LOG_LEVEL` | `INFO` | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |

---

## 3. Local Air-Gapped Deployment

### A. Backend Setup
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### B. Frontend Setup
```bash
cd frontend
npm ci
npm run build   # Produces production distribution in dist/

# For local development dev server:
npm run dev
```

---

## 4. Docker Deployment

To launch the entire platform with isolated containers and persistent volume mounts:

```bash
# Build and launch all services
docker-compose up -d --build

# View container logs
docker-compose logs -f

# Verify backend health check
curl http://localhost:8000/api/v1/health
```

The frontend will be available at `http://localhost` (port 80), and the backend API documentation will be available at `http://localhost:8000/docs`.

---

## 5. Security & Verification Checklist

- [x] **Zero External Telemetry**: System operates with no outbound API calls or cloud dependencies.
- [x] **Password Protection**: Analyst passwords hashed with PBKDF2-HMAC-SHA256 (600,000 iterations).
- [x] **File Path Traversal Protection**: Uploaded filenames are sanitized and stored via unique identifiers.
- [x] **SHA-256 Provenance**: Original raw bytes are hashed at ingest and verifiable on demand.
- [x] **Immutable Audit Trail**: All alert triage, case creations, and report exports generate immutable audit records.

