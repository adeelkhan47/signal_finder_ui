# SF Earthquake – React Frontend

Single-page React app for the earthquake dashboard. Dark theme, 30 records per page, filters and table match the reference UI.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

Open http://localhost:5173 (or the URL Vite prints).

## Backend

The app calls the backend at `http://127.0.0.1:8000` by default. To change it:

1. Copy `.env.example` to `.env`
2. Set `VITE_API_URL` to your backend base URL (no trailing slash)

Example: `VITE_API_URL=http://127.0.0.1:8000`

The app uses **POST** `/earthquake/create` with a JSON body (`starttime`, `endtime`, `minmagnitude`, `maxmagnitude`, `region`) and expects a response like:

```json
{
  "earth_quakes": [ { "id", "mag", "place", "time", "latitude", "longitude", "depth", "url", ... } ],
  "count": 200
}
```

## Features

- **Theme**: Dark layout (header, filter panel, table) aligned with the reference
- **Pagination**: 30 records per page; Previous/Next below the table
- **Table**: date, time, place, mag, latitude, longitude, link, depth
- **Filters**: Magnitude min/max, period and region controls; **Update** fetches with current filters
- **Row selection**: Click a row to highlight; link column opens USGS event page

## Build

```bash
npm run build
```

Output is in `dist/`.
# signal_finder_ui
