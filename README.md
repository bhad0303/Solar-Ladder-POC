# Solar Preview POC

Original frontend-only 360° solar preview (React + Vite + TypeScript + Babylon.js).

## Hard rules

- **No** Google Maps, Map Tiles, Solar API, online tiles, API keys, or backend.
- Ground = one local image: `public/assets/site-satellite.jpg`
- Data source of truth: `src/data/project.json`

## Stack

- React 19 + Vite + TypeScript
- `@babylonjs/core` / `gui` / `materials` **6.46.0**
- `suncalc` **1.9.0** (altitude & azimuth in **radians**; azimuth measured from **south** toward west — see `src/geo/sunMath.ts` + tests)
- Zustand 5, Tailwind 4

## Phase status

| Phase | Status |
|-------|--------|
| 0 Scaffold, packages, `project.json`, local image check | **done** |
| 1 Ground + rich house + roof items + orbit | next |
| 2 Panels/zones, trees, neighbours, compass | pending |
| 3 Sun/sky/glow/path/shadows/datetime | pending |
| 4 Panel Info, Measurements, calibration | pending |
| 5 Sun Access worker | pending |
| 6 Mobile layout, perf, polish | pending |

## Setup

```bash
npm install
# Optional: replace public/assets/site-satellite.jpg with your site photo
npm run dev
```

```bash
npm run test
npm run build
```

If the satellite file is missing, the app shows a green ground + message (no crash).

## Coordinates

Local meters: **+X east, +Y up, −Z north**. Imagery plane sized to `imagery.widthMeters × heightMeters` so **1 Babylon unit = 1 meter**.
