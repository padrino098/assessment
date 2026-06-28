# ELD Trip Planner

Full-stack app that takes trip inputs (current location, pickup, dropoff, current cycle hours used) and outputs a routed map with HOS-compliant stops/rests plus daily ELD log sheets.

- **Live frontend**: _add Vercel URL after deploy_
- **Live API**: _add Render URL after deploy_
- **Loom walkthrough**: _add Loom URL after recording_

## Stack
- **Backend**: Django 5 + Django REST Framework + Postgres (Render)
- **Frontend**: React 18 + Vite + TypeScript + Tailwind (Vercel)
- **Map / routing**: Leaflet + OpenStreetMap tiles + OSRM (public demo) + Nominatim geocoding (server-side, with `User-Agent`)
- **Logs**: custom React SVG, printable

## Repo layout
```
backend/   Django project (config + trips app)
frontend/  Vite + React + TS app
```

## HOS assumptions
- Property-carrying driver, 70 hrs / 8 days, no adverse conditions
- 11-hr driving limit per shift, 14-hr on-duty window
- 30-min break required after 8 cumulative driving hours
- 10 consecutive hours off-duty between shifts
- Fuel stop every 1000 miles (15 min, on-duty not driving)
- 1 hour for pickup and 1 hour for dropoff (on-duty not driving)
- Average speed assumed at **55 mph** for HOS time projection

## Local dev

### Backend
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py runserver
```
API at http://127.0.0.1:8000/api/

### Frontend
```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```
App at http://127.0.0.1:5173/

## API
- `POST /api/trips/` — body `{current_location, pickup_location, dropoff_location, current_cycle_used_hrs}` → returns trip with nested stops + daily logs
- `GET  /api/trips/` — list past trips
- `GET  /api/trips/{id}/` — trip detail

## Deployment
- **Backend**: Render web service (`render.yaml` provided) + managed Postgres
- **Frontend**: Vercel project rooted at `frontend/`, env `VITE_API_URL=https://<render-host>`

## Notes
- OSRM public demo (`router.project-osrm.org`) and Nominatim public are used for the assessment. For production, self-host OSRM or use a paid provider (OpenRouteService, Mapbox).
