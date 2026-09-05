# Simulation Platform frontend

React + TypeScript foundation for the Simulation Platform. Uses real backend routes; full gameplay is intentionally deferred.

```powershell
npm ci
npm run dev
npm test
npm run build
```

Node 22 is used for verification. Copy `.env.example` to `.env.local` if the backend proxy target differs from `http://localhost:5070`. The backend and database must be running separately. Production serves `dist/` with SPA fallback and proxies `/api` and `/hubs` to the backend, including WebSocket upgrades.

Sign in with an existing Instructor or Student account, or register a Student account. An instructor must provision classroom/session membership. Open sessions using existing session IDs; the backend has no session or owned-scenario list APIs.

See [frontend architecture and contract mismatches](docs/frontend-architecture.md). Complete milestone acceptance remains blocked by missing session model/capability/readiness/submission metadata and a backend market-projection privacy defect. The frontend does not guess or fabricate that context.
